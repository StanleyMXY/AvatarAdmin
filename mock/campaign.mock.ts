// The campaign endpoints of the mock backend (contract 10.3 to 10.5 and 17.4, the "投放管理" row; the
// shapes of the clicks, the campaigns, the records and the summary are those of the backend replies).
// State lives in _core/campaignData.ts. What the contract leaves open (the body of a single cost, the
// refs of the details of a refused batch, what a batch answers) follows
// docs/contract-requests/2026-10-26-admin-frontend-campaign.md. The report of the performance reads
// the sample costs, so that a cost entered here shows in it. The export and the landing of the
// performance report are in export.mock.ts and stats.mock.ts.

import { trimSpec } from '../src/utils/trimSpec';
import { guard, hasPermission } from './_core/auth';
import {
  campaignState,
  type MockCampaign,
  type MockCost,
  maskIp,
  usernameOf,
} from './_core/campaignData';
import { currentValue } from './_core/configStore';
import { invalidRequest, MockHttpError, ok } from './_core/http';
import { paginateQuery } from './_core/paginate';
import { between, unit } from './_core/statData';
import { daysIn, oneOf, rangeOf, text, validDay } from './_core/statRange';

type Detail = { ref: string; reason: string };

const CODE = /^[a-z0-9_-]{3,32}$/;
const AMOUNT = /^\d+(\.\d{1,2})?$/;
const UTM_VALUE = /^[A-Za-z0-9._-]{1,64}$/;
const KNOWN_CHANNELS = ['play', 'direct', 'appstore'];
const PLATFORM_PIXEL = {
  FACEBOOK: 'facebookPixelId',
  GOOGLE: 'googlePixelId',
  TIKTOK: 'tiktokPixelId',
} as const;
const CLICK_STATUSES = ['PENDING', 'MATCHED', 'EXPIRED'];
const SOURCES = ['APPSFLYER', 'SELF'];
const MATCH_TYPES = ['APK_BLOCK', 'REFERRER', 'FINGERPRINT'];
const SUMMARY_GROUPS = ['source', 'media_source', 'campaign'];

const fail = (details: Detail[], message = 'invalid request') => invalidRequest(message, details);
const notFound = (what: string) =>
  new MockHttpError(404, 'RESOURCE_NOT_FOUND', `There is no such ${what}`);
const isText = (value: unknown): value is string => typeof value === 'string';
const idOf = (req: { params: Record<string, string> }) => req.params.id;
const costCurrency = (): string => {
  const value = currentValue('attribution.cost_currency');
  return isText(value) && value !== '' ? value : 'USD';
};
const round2 = (value: number) => Math.round(value * 100) / 100;

// ---- the shapes of the answers ----

const campaignRow = (c: MockCampaign) => {
  const { facebookAccessToken, quiet: _quiet, ...rest } = c;
  return {
    ...rest,
    createdByUsername: usernameOf(c.createdBy),
    facebookAccessTokenSet: facebookAccessToken !== null,
  };
};

const costRow = (c: MockCost) => ({ ...c, createdByUsername: usernameOf(c.createdBy) });

// ---- the checks of a campaign ----

const optionalText = (value: unknown, ref: string, details: Detail[]): string | null => {
  if (value === undefined || value === null) return null;
  if (!isText(value)) {
    details.push({ ref, reason: 'OUT_OF_RANGE' });
    return null;
  }
  const trimmed = trimSpec(value);
  return trimmed === '' ? null : trimmed;
};

const requiredText = (value: unknown, ref: string, details: Detail[]): string => {
  const trimmed = isText(value) ? trimSpec(value) : '';
  if (trimmed === '') details.push({ ref, reason: 'EMPTY_NOT_ALLOWED' });
  return trimmed;
};

function campaignFields(body: Record<string, unknown>, details: Detail[]) {
  const name = requiredText(body.name, 'name', details);
  const mediaSource = requiredText(body.mediaSource, 'mediaSource', details);
  const campaign = requiredText(body.campaign, 'campaign', details);
  const utmMedium = requiredText(body.utmMedium, 'utmMedium', details);
  const adset = optionalText(body.adset, 'adset', details);
  const ad = optionalText(body.ad, 'ad', details);
  const facebookPixelId = optionalText(body.facebookPixelId, 'facebookPixelId', details);
  const googlePixelId = optionalText(body.googlePixelId, 'googlePixelId', details);
  const tiktokPixelId = optionalText(body.tiktokPixelId, 'tiktokPixelId', details);
  const remark = optionalText(body.remark, 'remark', details);
  let enabled = true;
  if (body.enabled !== undefined) {
    if (typeof body.enabled === 'boolean') enabled = body.enabled;
    else details.push({ ref: 'enabled', reason: 'NOT_BOOLEAN' });
  }
  let channelCodes: string[] = [];
  if (body.channelCodes !== undefined && body.channelCodes !== null) {
    const list = body.channelCodes;
    if (!Array.isArray(list) || list.some((x) => !isText(x) || !KNOWN_CHANNELS.includes(x))) {
      details.push({ ref: 'channelCodes', reason: 'OUT_OF_RANGE' });
    } else {
      channelCodes = [...new Set(list as string[])];
    }
  }
  // The token is only ever written: absent means "keep what is there".
  let token: string | undefined;
  if (body.facebookAccessToken !== undefined) {
    const typed = isText(body.facebookAccessToken) ? trimSpec(body.facebookAccessToken) : '';
    if (typed === '') details.push({ ref: 'facebookAccessToken', reason: 'EMPTY_NOT_ALLOWED' });
    else token = typed;
  }
  return {
    fields: {
      name,
      mediaSource,
      campaign,
      utmMedium,
      adset,
      ad,
      facebookPixelId,
      googlePixelId,
      tiktokPixelId,
      remark,
      enabled,
      channelCodes,
    },
    token,
  };
}

// ---- the checks of a cost ----

type CostFields = { campaignId: string; statDate: string; amount: number; remark: string | null };

/** The campaign, the day, the amount (a number, not below 0, at most two decimals) and the currency. */
function costFields(body: Record<string, unknown>, details: Detail[]): CostFields {
  const campaignId = isText(body.campaignId) ? body.campaignId : '';
  if (!campaignState.campaigns.some((c) => c.id === campaignId)) {
    details.push({ ref: 'campaignId', reason: 'OUT_OF_RANGE' });
  }
  const statDate = isText(body.statDate) ? body.statDate : '';
  if (!validDay(statDate)) details.push({ ref: 'statDate', reason: 'OUT_OF_RANGE' });
  const amount = body.amount;
  if (amount === undefined || amount === null) {
    details.push({ ref: 'amount', reason: 'EMPTY_NOT_ALLOWED' });
  } else if (typeof amount !== 'number' || !AMOUNT.test(String(amount))) {
    details.push({ ref: 'amount', reason: 'OUT_OF_RANGE' });
  }
  if (body.currency !== undefined && body.currency !== costCurrency()) {
    details.push({ ref: 'currency', reason: 'OUT_OF_RANGE' });
  }
  const remark = optionalText(body.remark, 'remark', details);
  return { campaignId, statDate, amount: typeof amount === 'number' ? amount : 0, remark };
}

const costExists = () =>
  new MockHttpError(
    409,
    'COST_EXISTS',
    'The campaign has a cost on this day already; change that one',
  );

// ---- the figures of the performance report ----

type Day = { pageViews: number; clicks: number; installs: number; registered: number };

/** What a campaign did on a day; the campaign without traffic does nothing. */
function figuresOf(campaign: MockCampaign, day: string): Day {
  if (campaign.quiet) return { pageViews: 0, clicks: 0, installs: 0, registered: 0 };
  const pageViews = between(150, 900, 'pv', campaign.id, day);
  const clicks = Math.floor(pageViews * (0.2 + unit('ck', campaign.id, day) * 0.5));
  const installs = Math.floor(clicks * (0.15 + unit('in', campaign.id, day) * 0.4));
  const registered = Math.floor(installs * (0.3 + unit('rg', campaign.id, day) * 0.5));
  return { pageViews, clicks, installs, registered };
}

const costOf = (campaignId: string | null, day: string): number =>
  campaignState.costs
    .filter((c) => c.statDate === day && (campaignId === null || c.campaignId === campaignId))
    .reduce((sum, c) => sum + c.amount, 0);

const ratio = (n: number, d: number): number | null =>
  d === 0 ? null : Math.round((n / d) * 10_000) / 10_000;
const perUnit = (cost: number, d: number): number | null => (d === 0 ? null : round2(cost / d));

function performanceRow(totals: Day, cost: number) {
  return {
    ...totals,
    clickRate: ratio(totals.clicks, totals.pageViews),
    installRate: ratio(totals.installs, totals.clicks),
    registerRate: ratio(totals.registered, totals.installs),
    cost: round2(cost),
    cpa: perUnit(cost, totals.registered),
    cpi: perUnit(cost, totals.installs),
  };
}

const addDay = (a: Day, b: Day): Day => ({
  pageViews: a.pageViews + b.pageViews,
  clicks: a.clicks + b.clicks,
  installs: a.installs + b.installs,
  registered: a.registered + b.registered,
});
const NONE: Day = { pageViews: 0, clicks: 0, installs: 0, registered: 0 };

// ---- filters of the lists ----

/** `from` (included) and `to` (not included) as instants; 400 for text that is not an instant. */
function instantRange(req: { query: Record<string, unknown> }): { from: number; to: number } {
  const details: Detail[] = [];
  const read = (ref: 'from' | 'to', fallback: number) => {
    const value = text(req.query[ref]);
    if (value === '') return fallback;
    const ms = /^\d{4}-\d{2}-\d{2}T/.test(value) ? Date.parse(value) : Number.NaN;
    if (Number.isNaN(ms)) details.push({ ref, reason: 'OUT_OF_RANGE' });
    return ms;
  };
  const from = read('from', Number.NEGATIVE_INFINITY);
  const to = read('to', Number.POSITIVE_INFINITY);
  if (details.length > 0) throw fail(details);
  return { from, to };
}

function enumQuery(
  req: { query: Record<string, unknown> },
  ref: string,
  allowed: string[],
  details: Detail[],
) {
  const value = text(req.query[ref]);
  if (value === '') return null;
  if (!allowed.includes(value)) {
    details.push({ ref, reason: 'OUT_OF_RANGE' });
    return null;
  }
  return value;
}

export default {
  // ---- campaigns ----
  'GET /api/admin/attribution/campaigns': guard(
    ['ATTRIBUTION:MANAGE', 'ATTRIBUTION:VIEW'],
    (req) => {
      const keyword = text(req.query.keyword).toLowerCase();
      const enabled = text(req.query.enabled);
      if (enabled !== '' && enabled !== 'true' && enabled !== 'false') {
        throw fail([{ ref: 'enabled', reason: 'NOT_BOOLEAN' }]);
      }
      const rows = campaignState.campaigns
        .filter(
          (c) =>
            (keyword === '' || `${c.code} ${c.name}`.toLowerCase().includes(keyword)) &&
            (enabled === '' || c.enabled === (enabled === 'true')),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || Number(b.id) - Number(a.id));
      const page = paginateQuery(rows, req);
      return ok({ items: page.items.map(campaignRow), total: page.total });
    },
  ),

  'POST /api/admin/attribution/campaigns': guard('ATTRIBUTION:MANAGE', (req) => {
    const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<
      string,
      unknown
    >;
    const details: Detail[] = [];
    const code = isText(body.code) ? body.code : '';
    if (!CODE.test(code)) details.push({ ref: 'code', reason: 'OUT_OF_RANGE' });
    const { fields, token } = campaignFields(body, details);
    if (details.length > 0) throw fail(details);
    if (campaignState.campaigns.some((c) => c.code === code)) {
      throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The code exists already', {
        field: 'code',
      });
    }
    const now = new Date().toISOString();
    const created: MockCampaign = {
      id: String(campaignState.next.campaign++),
      code,
      ...fields,
      createdBy: req.admin.id,
      createdAt: now,
      updatedAt: now,
      facebookAccessToken: token ?? null,
      quiet: false,
    };
    campaignState.campaigns.push(created);
    return ok(campaignRow(created));
  }),

  'PUT /api/admin/attribution/campaigns/:id': guard('ATTRIBUTION:MANAGE', (req) => {
    const found = campaignState.campaigns.find((c) => c.id === idOf(req));
    if (!found) throw notFound('campaign');
    const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<
      string,
      unknown
    >;
    const details: Detail[] = [];
    // The code is the key of the campaign: it can be sent again, not changed.
    if (body.code !== undefined && body.code !== found.code) {
      details.push({ ref: 'code', reason: 'OUT_OF_RANGE' });
    }
    const { fields, token } = campaignFields(body, details);
    if (details.length > 0) throw fail(details);
    Object.assign(found, fields, { updatedAt: new Date().toISOString() });
    if (token !== undefined) found.facebookAccessToken = token;
    return ok(campaignRow(found));
  }),

  'GET /api/admin/attribution/campaigns/:id/link': guard('ATTRIBUTION:MANAGE', (req) => {
    const found = campaignState.campaigns.find((c) => c.id === idOf(req));
    if (!found) throw notFound('campaign');
    const platform = text(req.query.platform);
    if (!(platform in PLATFORM_PIXEL)) {
      throw fail([{ ref: 'platform', reason: 'OUT_OF_RANGE' }]);
    }
    if (!found[PLATFORM_PIXEL[platform as keyof typeof PLATFORM_PIXEL]]) {
      throw fail(
        [{ ref: 'platform', reason: 'EMPTY_NOT_ALLOWED' }],
        'The campaign has no pixel id for this platform',
      );
    }
    const base = currentValue('attribution.link_base_url');
    if (!isText(base) || base === '') {
      throw fail(
        [{ ref: 'attribution.link_base_url', reason: 'EMPTY_NOT_ALLOWED' }],
        'attribution.link_base_url is not configured',
      );
    }
    const utm = (name: string, fallback: string) => {
      const value = text(req.query[name]);
      return UTM_VALUE.test(value) ? value : fallback;
    };
    const query = new URLSearchParams({
      utm_source: utm('utmSource', found.mediaSource),
      utm_medium: utm('utmMedium', found.utmMedium),
      utm_campaign: utm('utmCampaign', found.campaign),
    });
    return ok({ url: `${base}/go/${found.code}?${query.toString()}` });
  }),

  // ---- costs ----
  'GET /api/admin/attribution/costs': guard('ATTRIBUTION:MANAGE', (req) => {
    const details: Detail[] = [];
    for (const ref of ['from', 'to'] as const) {
      const value = text(req.query[ref]);
      if (value !== '' && !validDay(value)) details.push({ ref, reason: 'OUT_OF_RANGE' });
    }
    if (details.length > 0) throw fail(details);
    const campaignId = text(req.query.campaignId);
    const from = text(req.query.from);
    const to = text(req.query.to);
    const rows = campaignState.costs
      .filter(
        (c) =>
          (campaignId === '' || c.campaignId === campaignId) &&
          (from === '' || c.statDate >= from) &&
          (to === '' || c.statDate <= to),
      )
      .sort((a, b) => b.statDate.localeCompare(a.statDate) || Number(b.id) - Number(a.id));
    const page = paginateQuery(rows, req);
    return ok({ items: page.items.map(costRow), total: page.total });
  }),

  'POST /api/admin/attribution/costs': guard('ATTRIBUTION:MANAGE', (req) => {
    const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<
      string,
      unknown
    >;
    const details: Detail[] = [];
    const fields = costFields(body, details);
    if (details.length > 0) throw fail(details);
    if (
      campaignState.costs.some(
        (c) => c.campaignId === fields.campaignId && c.statDate === fields.statDate,
      )
    ) {
      throw costExists();
    }
    const now = new Date().toISOString();
    const created: MockCost = {
      id: String(campaignState.next.cost++),
      ...fields,
      currency: costCurrency(),
      createdBy: req.admin.id,
      createdAt: now,
      updatedAt: now,
    };
    campaignState.costs.push(created);
    return ok(costRow(created));
  }),

  'PUT /api/admin/attribution/costs/:id': guard('ATTRIBUTION:MANAGE', (req) => {
    const found = campaignState.costs.find((c) => c.id === idOf(req));
    if (!found) throw notFound('cost');
    const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<
      string,
      unknown
    >;
    const details: Detail[] = [];
    const fields = costFields(body, details);
    // The campaign and the day are the key of a cost: they can be sent again, not changed.
    if (fields.campaignId !== found.campaignId && !details.some((d) => d.ref === 'campaignId')) {
      details.push({ ref: 'campaignId', reason: 'OUT_OF_RANGE' });
    }
    if (fields.statDate !== found.statDate && !details.some((d) => d.ref === 'statDate')) {
      details.push({ ref: 'statDate', reason: 'OUT_OF_RANGE' });
    }
    if (details.length > 0) throw fail(details);
    Object.assign(found, {
      amount: fields.amount,
      remark: fields.remark,
      updatedAt: new Date().toISOString(),
    });
    return ok(costRow(found));
  }),

  'DELETE /api/admin/attribution/costs/:id': guard('ATTRIBUTION:MANAGE', (req) => {
    const at = campaignState.costs.findIndex((c) => c.id === idOf(req));
    if (at < 0) throw notFound('cost');
    campaignState.costs.splice(at, 1);
    return ok(null);
  }),

  // All or nothing; a (campaign, day) that has a cost is overwritten.
  'POST /api/admin/attribution/costs/batch': guard('ATTRIBUTION:MANAGE', (req) => {
    const body = req.body;
    if (!Array.isArray(body)) throw fail([{ ref: 'body', reason: 'OUT_OF_RANGE' }]);
    if (body.length === 0) throw fail([{ ref: 'body', reason: 'EMPTY_NOT_ALLOWED' }]);
    const max = currentValue('attribution.cost_batch_max');
    if (typeof max === 'number' && body.length > max) {
      throw fail([{ ref: 'body', reason: 'OUT_OF_RANGE' }], `a batch has at most ${max} rows`);
    }
    const details: Detail[] = [];
    const wanted: {
      campaignId: string;
      statDate: string;
      amount: number;
      remark: string | null;
    }[] = [];
    const seen = new Set<string>();
    body.forEach((element, index) => {
      const one = (typeof element === 'object' && element !== null ? element : {}) as Record<
        string,
        unknown
      >;
      const code = isText(one.campaignCode) ? one.campaignCode : '';
      const campaign = campaignState.campaigns.find((c) => c.code === code);
      const own: Detail[] = [];
      if (!campaign) own.push({ ref: 'campaignCode', reason: 'OUT_OF_RANGE' });
      // costFields reports an unknown campaign id itself; here the code is what was unknown.
      const problems: Detail[] = [];
      const fields = costFields({ ...one, campaignId: campaign?.id ?? '' }, problems);
      for (const detail of problems) {
        if (detail.ref === 'campaignId') continue;
        own.push(detail);
      }
      if (own.length > 0) {
        for (const detail of own)
          details.push({ ref: `${index}.${detail.ref}`, reason: detail.reason });
        return;
      }
      const key = `${fields.campaignId}|${fields.statDate}`;
      if (seen.has(key)) {
        details.push({ ref: String(index), reason: 'OUT_OF_RANGE' });
        return;
      }
      seen.add(key);
      wanted.push(fields);
    });
    if (details.length > 0) throw fail(details, 'some rows are not valid');
    const now = new Date().toISOString();
    let overwritten = 0;
    for (const row of wanted) {
      const old = campaignState.costs.find(
        (c) => c.campaignId === row.campaignId && c.statDate === row.statDate,
      );
      if (old) {
        Object.assign(old, {
          amount: row.amount,
          remark: row.remark,
          currency: costCurrency(),
          updatedAt: now,
        });
        overwritten += 1;
      } else {
        campaignState.costs.push({
          id: String(campaignState.next.cost++),
          ...row,
          currency: costCurrency(),
          createdBy: req.admin.id,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    return ok({ imported: wanted.length, overwritten });
  }),

  // ---- the reports ----
  'GET /api/admin/attribution/performance': guard('ATTRIBUTION:VIEW', (req) => {
    const { from, to } = rangeOf(req);
    const groupBy = oneOf(req, 'groupBy', ['campaign', 'day'], 'campaign');
    const only = text(req.query.campaignId);
    const campaigns = campaignState.campaigns.filter((c) => only === '' || c.id === only);
    const days = daysIn(from, to);

    if (groupBy === 'day') {
      return ok({
        items: days.map((day) => {
          const totals = campaigns.reduce((sum, c) => addDay(sum, figuresOf(c, day)), NONE);
          const cost = campaigns.reduce((sum, c) => sum + costOf(c.id, day), 0);
          return { statDate: day, ...performanceRow(totals, cost) };
        }),
      });
    }
    const items: Record<string, unknown>[] = campaigns.map((c) => {
      const totals = days.reduce((sum, day) => addDay(sum, figuresOf(c, day)), NONE);
      const cost = days.reduce((sum, day) => sum + costOf(c.id, day), 0);
      return { campaignId: c.id, ...performanceRow(totals, cost) };
    });
    // The installs that matched no campaign are not a campaign's: one row, only with all campaigns.
    if (only === '') {
      items.push({
        campaignId: '0',
        unattributedInstalls: days.reduce((sum, day) => sum + between(5, 40, 'un', day), 0),
      });
    }
    return ok({ items });
  }),

  'GET /api/admin/attribution/clicks': guard('ATTRIBUTION:VIEW', (req) => {
    const details: Detail[] = [];
    const status = enumQuery(req, 'status', CLICK_STATUSES, details);
    if (details.length > 0) throw fail(details);
    const { from, to } = instantRange(req);
    const campaignId = text(req.query.campaignId);
    const keyword = text(req.query.keyword);
    const lower = keyword.toLowerCase();
    const mayReadAddress = hasPermission(req.admin, 'ANALYTICS:IP_VIEW');
    const rows = campaignState.clicks
      .filter((c) => {
        const at = Date.parse(c.clickedAt);
        if (at < from || at >= to) return false;
        if (campaignId !== '' && c.campaignId !== campaignId) return false;
        if (status !== null && c.status !== status) return false;
        if (keyword === '') return true;
        const inUtm = `${c.utmSource} ${c.utmMedium} ${c.utmCampaign}`
          .toLowerCase()
          .includes(lower);
        // A whole address is matched only for an administrator who may see addresses.
        return inUtm || (mayReadAddress && c.ip === keyword);
      })
      .sort((a, b) => b.clickedAt.localeCompare(a.clickedAt) || Number(b.id) - Number(a.id));
    const page = paginateQuery(rows, req);
    return ok({
      items: page.items.map((c) => ({
        id: c.id,
        clickedAt: c.clickedAt,
        campaignId: c.campaignId,
        campaignName: campaignState.campaigns.find((x) => x.id === c.campaignId)?.name ?? null,
        status: c.status,
        channel: c.channel,
        utmSource: c.utmSource,
        utmMedium: c.utmMedium,
        utmCampaign: c.utmCampaign,
        ip: mayReadAddress ? c.ip : maskIp(c.ip),
        claimedAt: c.claimedAt,
      })),
      total: page.total,
    });
  }),

  'GET /api/admin/attribution/records': guard('ATTRIBUTION:VIEW', (req) => {
    const details: Detail[] = [];
    const source = enumQuery(req, 'source', SOURCES, details);
    const matchType = enumQuery(req, 'matchType', MATCH_TYPES, details);
    if (details.length > 0) throw fail(details);
    const { from, to } = instantRange(req);
    const rows = campaignState.records
      .filter((r) => {
        const at = Date.parse(r.eventTime);
        return (
          at >= from &&
          at < to &&
          (source === null || r.source === source) &&
          (matchType === null || r.matchType === matchType)
        );
      })
      .sort((a, b) => b.eventTime.localeCompare(a.eventTime) || Number(b.id) - Number(a.id));
    return ok(paginateQuery(rows, req));
  }),

  'GET /api/admin/attribution/summary': guard('ATTRIBUTION:VIEW', (req) => {
    const groupBy = text(req.query.groupBy);
    if (groupBy === '') throw fail([{ ref: 'groupBy', reason: 'EMPTY_NOT_ALLOWED' }]);
    if (!SUMMARY_GROUPS.includes(groupBy)) throw fail([{ ref: 'groupBy', reason: 'OUT_OF_RANGE' }]);
    const { from, to } = rangeOf(req);
    const groups = new Map<
      string,
      {
        source: string;
        key: string | null;
        installs: number;
        activations: number;
        costs: Map<string, number>;
      }
    >();
    for (const r of campaignState.records) {
      if (r.eventName !== 'install' || r.installTime === null) continue;
      const day = r.installTime.slice(0, 10);
      if (day < from || day > to) continue;
      const key =
        groupBy === 'source' ? r.source : groupBy === 'media_source' ? r.mediaSource : r.campaign;
      const id = `${r.source}|${key}`;
      const row = groups.get(id) ?? {
        source: r.source,
        key,
        installs: 0,
        activations: 0,
        costs: new Map(),
      };
      row.installs += 1;
      if (r.accountId !== null) row.activations += 1;
      if (r.cost !== null && r.costCurrency !== null) {
        row.costs.set(r.costCurrency, (row.costs.get(r.costCurrency) ?? 0) + r.cost);
      }
      groups.set(id, row);
    }
    const items = [...groups.values()]
      .sort(
        (a, b) =>
          b.installs - a.installs ||
          String(a.key).localeCompare(String(b.key)) ||
          a.source.localeCompare(b.source),
      )
      .map((row) => ({
        source: row.source,
        key: row.key,
        installs: row.installs,
        activations: row.activations,
        costs: [...row.costs.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([currency, amount]) => ({ currency, amount: round2(amount) })),
      }));
    return ok({ items });
  }),
};
