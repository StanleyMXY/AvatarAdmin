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
import { resolveAlertsOf } from './_core/monitorData';
import { paginateQuery } from './_core/paginate';
import { between, unit } from './_core/statData';
import { daysIn, oneOf, rangeOf, text, validDay } from './_core/statRange';

/** `index` is the place of the row in a list that was sent (a batch), counted from 0; it is a field of its own. */
type Detail = { ref: string; reason: string; index?: number };

const CODE = /^[a-z0-9_-]{3,32}$/;
const AMOUNT_TEXT = /^(-)?(\d+)(?:\.(\d+))?$/;
/** A control character other than tab, line feed and carriage return. */
const hasControlCharacter = (value: string): boolean =>
  [...value].some((ch) => {
    const code = ch.charCodeAt(0);
    return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;
  });
const REMARK_MAX = 500;
const UTM_VALUE = /^[A-Za-z0-9._-]{1,64}$/;
const KNOWN_CHANNELS = ['play', 'direct', 'appstore'];
const PLATFORM_PIXEL = {
  FACEBOOK: 'facebookPixelId',
  GOOGLE: 'googlePixelId',
  TIKTOK: 'tiktokPixelId',
} as const;
const KEYWORD_MAX = 100;
const CLICK_KEYWORD_MAX = 200;
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

const costRow = (c: MockCost) => {
  const campaign = campaignState.campaigns.find((x) => x.id === c.campaignId);
  return {
    ...c,
    campaignCode: campaign?.code ?? null,
    campaignName: campaign?.name ?? null,
    createdByUsername: usernameOf(c.createdBy),
  };
};

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
  // The token is only ever written: absent means "keep what is there", a text sets it, and an
  // explicit null clears it (answers 82; this page has no way to send null).
  let token: string | null | undefined;
  if (body.facebookAccessToken === null) {
    token = null;
  } else if (body.facebookAccessToken !== undefined) {
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

/**
 * The amount as the backend reads it (backend reply 75): a JSON number or a number written as text,
 * read as a decimal; not below 0 (NEGATIVE), at most two decimals (TOO_MANY_DECIMALS, never
 * rounded), below 10^16 (OUT_OF_RANGE).
 */
function readAmount(value: unknown, details: Detail[]): number {
  const refuse = (reason: string) => {
    details.push({ ref: 'amount', reason });
    return 0;
  };
  if (value === undefined || value === null) return refuse('REQUIRED');
  let written: string;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return refuse('INVALID_FORMAT');
    written = String(value);
    // a number that JavaScript writes with an exponent is huge or tiny
    if (/e/i.test(written))
      return refuse(Math.abs(value) >= 1 ? 'OUT_OF_RANGE' : 'TOO_MANY_DECIMALS');
  } else if (typeof value === 'string') {
    written = trimSpec(value);
  } else {
    return refuse('INVALID_TYPE');
  }
  const match = AMOUNT_TEXT.exec(written);
  if (!match) return refuse('INVALID_FORMAT');
  const [, minus, whole, decimals = ''] = match;
  if (minus && /[1-9]/.test(whole + decimals)) return refuse('NEGATIVE');
  if (decimals.replace(/0+$/, '').length > 2) return refuse('TOO_MANY_DECIMALS');
  if (whole.replace(/^0+/, '').length > 16) return refuse('OUT_OF_RANGE');
  return Number(written);
}

/** The remark: text of at most 500 code points without control characters, or nothing. */
function readRemark(value: unknown, details: Detail[]): string | null {
  if (value === undefined || value === null) return null;
  if (!isText(value)) {
    details.push({ ref: 'remark', reason: 'INVALID_TYPE' });
    return null;
  }
  const trimmed = trimSpec(value);
  if (hasControlCharacter(trimmed)) details.push({ ref: 'remark', reason: 'CONTROL_CHARACTER' });
  else if ([...trimmed].length > REMARK_MAX) details.push({ ref: 'remark', reason: 'TOO_LONG' });
  return trimmed === '' ? null : trimmed;
}

/** The currency may be left out (it is the one of the system); if it is there it has to be that one. */
function checkCurrency(value: unknown, details: Detail[]): void {
  if (value === undefined || value === null || value === '') return;
  if (value !== costCurrency()) details.push({ ref: 'currency', reason: 'CURRENCY_MISMATCH' });
}

/** The day: `YYYY-MM-DD`, a day that exists. */
function readDay(value: unknown, details: Detail[]): string {
  if (value === undefined || value === null || value === '') {
    details.push({ ref: 'statDate', reason: 'REQUIRED' });
    return '';
  }
  if (!isText(value) || !validDay(value)) {
    details.push({ ref: 'statDate', reason: 'INVALID_FORMAT' });
    return '';
  }
  return value;
}

/** The campaign, the day, the amount and the currency of one cost, with the reasons of the backend. */
function costFields(body: Record<string, unknown>, details: Detail[]): CostFields {
  const campaignId = isText(body.campaignId) ? body.campaignId : '';
  if (body.campaignId === undefined || body.campaignId === null) {
    details.push({ ref: 'campaignId', reason: 'REQUIRED' });
  } else if (!campaignState.campaigns.some((c) => c.id === campaignId)) {
    details.push({ ref: 'campaignId', reason: 'NOT_FOUND' });
  }
  const statDate = readDay(body.statDate, details);
  const amount = readAmount(body.amount, details);
  checkCurrency(body.currency, details);
  const remark = readRemark(body.remark, details);
  return { campaignId, statDate, amount, remark };
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

/**
 * `from` and `to` of the clicks (backend reply 76): UTC days `YYYY-MM-DD`, both included, so the end
 * is the start of the day after `to`. An instant (with hours) is refused, as is a day that does not
 * exist and a `from` after the `to`; each as OUT_OF_RANGE on the field.
 */
function dayRange(req: { query: Record<string, unknown> }): { from: number; to: number } {
  const details: Detail[] = [];
  const read = (ref: 'from' | 'to') => {
    const value = text(req.query[ref]);
    if (value === '') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !validDay(value)) {
      details.push({ ref, reason: 'OUT_OF_RANGE' });
      return null;
    }
    return value;
  };
  const from = read('from');
  const to = read('to');
  if (from !== null && to !== null && from > to)
    details.push({ ref: 'from', reason: 'OUT_OF_RANGE' });
  if (details.length > 0) throw fail(details);
  return {
    from: from === null ? Number.NEGATIVE_INFINITY : Date.parse(`${from}T00:00:00Z`),
    to: to === null ? Number.POSITIVE_INFINITY : Date.parse(`${to}T00:00:00Z`) + 86_400_000,
  };
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
      const raw = text(req.query.keyword);
      const enabled = text(req.query.enabled);
      const details: Detail[] = [];
      // at most 100 code points (contract 10.5); the contract names no reason, TOO_LONG is the one of a long text
      if ([...raw].length > KEYWORD_MAX) details.push({ ref: 'keyword', reason: 'TOO_LONG' });
      if (enabled !== '' && enabled !== 'true' && enabled !== 'false') {
        details.push({ ref: 'enabled', reason: 'NOT_BOOLEAN' });
      }
      if (details.length > 0) throw fail(details);
      const keyword = raw.toLowerCase();
      // the code and the name are matched each by itself: a word never spans the two
      const rows = campaignState.campaigns
        .filter(
          (c) =>
            (keyword === '' ||
              c.code.toLowerCase().includes(keyword) ||
              c.name.toLowerCase().includes(keyword)) &&
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
    // The backend closes the open postback credential alert of the campaign when the token changed
    // (a token is set, even the same text, or cleared while there was one) or the pixel id is not
    // what it was, also when it is emptied (answers 82). The PUT replaces every field: an update that
    // leaves the pixel id out empties it, so a rename must send the pixel id it read. Only the Meta
    // pixel id is compared: the alert is about the Meta token and pixel, and the answer says nothing
    // of the others.
    const tokenChanged =
      token !== undefined && (token !== null || found.facebookAccessToken !== null);
    const pixelChanged = fields.facebookPixelId !== found.facebookPixelId;
    Object.assign(found, fields, { updatedAt: new Date().toISOString() });
    if (token !== undefined) found.facebookAccessToken = token;
    if (tokenChanged || pixelChanged) resolveAlertsOf('ATTRIBUTION_CAMPAIGN', found.id);
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
      details.push({ ref: 'campaignId', reason: 'IMMUTABLE' });
    }
    if (fields.statDate !== found.statDate && !details.some((d) => d.ref === 'statDate')) {
      details.push({ ref: 'statDate', reason: 'IMMUTABLE' });
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

  // All or nothing; a (campaign, day) that has a cost is overwritten. The answer is { count } (rows
  // written, added and overwritten together). A refusal lists every problem at once as
  // { index (from 0), ref (the field), reason }; a problem of the whole batch has no index.
  'POST /api/admin/attribution/costs/batch': guard('ATTRIBUTION:MANAGE', (req) => {
    const body = req.body;
    if (!Array.isArray(body)) throw fail([{ ref: 'body', reason: 'INVALID_TYPE' }]);
    const max = currentValue('attribution.cost_batch_max');
    if (typeof max === 'number' && body.length > max) {
      throw fail([{ ref: 'body', reason: 'OUT_OF_RANGE' }], `a batch has at most ${max} rows`);
    }
    if (body.length === 0) throw fail([{ ref: 'body', reason: 'REQUIRED' }]);
    const details: Detail[] = [];
    const wanted: {
      index: number;
      campaignId: string;
      statDate: string;
      amount: number;
      remark: string | null;
    }[] = [];
    body.forEach((element, index) => {
      if (typeof element !== 'object' || element === null || Array.isArray(element)) {
        details.push({ index, ref: 'line', reason: 'INVALID_TYPE' });
        return;
      }
      const one = element as Record<string, unknown>;
      const own: Detail[] = [];
      const code = isText(one.campaignCode) ? one.campaignCode : '';
      const campaign = campaignState.campaigns.find((c) => c.code === code);
      if (one.campaignCode === undefined || one.campaignCode === null || code === '') {
        own.push({ ref: 'campaignCode', reason: 'REQUIRED' });
      } else if (!campaign) {
        own.push({ ref: 'campaignCode', reason: 'NOT_FOUND' });
      }
      const statDate = readDay(one.statDate, own);
      const amount = readAmount(one.amount, own);
      checkCurrency(one.currency, own);
      const remark = readRemark(one.remark, own);
      if (own.length > 0) {
        for (const detail of own) details.push({ index, ...detail });
        return;
      }
      wanted.push({ index, campaignId: (campaign as MockCampaign).id, statDate, amount, remark });
    });
    // A campaign and day that comes more than once: every row of the group gets an entry.
    const groups = new Map<string, number[]>();
    for (const row of wanted) {
      const key = `${row.campaignId}|${row.statDate}`;
      groups.set(key, [...(groups.get(key) ?? []), row.index]);
    }
    for (const indexes of groups.values()) {
      if (indexes.length > 1) {
        for (const index of indexes)
          details.push({ index, ref: 'campaignCode', reason: 'DUPLICATE' });
      }
    }
    if (details.length > 0) {
      throw fail(
        details.sort((a, b) => (a.index ?? -1) - (b.index ?? -1)),
        'some rows are not valid',
      );
    }
    const now = new Date().toISOString();
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
      } else {
        campaignState.costs.push({
          id: String(campaignState.next.cost++),
          campaignId: row.campaignId,
          statDate: row.statDate,
          amount: row.amount,
          remark: row.remark,
          currency: costCurrency(),
          createdBy: req.admin.id,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    return ok({ count: wanted.length });
  }),

  // ---- the reports ----
  'GET /api/admin/attribution/performance': guard('ATTRIBUTION:VIEW', (req) => {
    const { from, to } = rangeOf(req);
    const groupBy = oneOf(req, 'groupBy', ['campaign', 'day'], 'campaign');
    const only = text(req.query.campaignId);
    const campaigns = campaignState.campaigns.filter((c) => only === '' || c.id === only);
    const days = daysIn(from, to);

    // The installs that matched no campaign are not a campaign's: they are the last row of either
    // grouping when no campaign is asked for (a number, campaignId 0, and only the count; backend reply 38).
    const unattributed = (): Record<string, unknown>[] =>
      only === ''
        ? [
            {
              campaignId: 0,
              unattributedInstalls: days.reduce((sum, day) => sum + between(5, 40, 'un', day), 0),
            },
          ]
        : [];

    if (groupBy === 'day') {
      return ok({
        items: [
          ...days.map((day) => {
            const totals = campaigns.reduce((sum, c) => addDay(sum, figuresOf(c, day)), NONE);
            const cost = campaigns.reduce((sum, c) => sum + costOf(c.id, day), 0);
            return { statDate: day, ...performanceRow(totals, cost) };
          }),
          ...unattributed(),
        ],
      });
    }
    const items: Record<string, unknown>[] = campaigns.map((c) => {
      const totals = days.reduce((sum, day) => addDay(sum, figuresOf(c, day)), NONE);
      const cost = days.reduce((sum, day) => sum + costOf(c.id, day), 0);
      // campaignId is a number on the wire; the row names the campaign itself
      return {
        campaignId: Number(c.id),
        campaignCode: c.code,
        campaignName: c.name,
        ...performanceRow(totals, cost),
      };
    });
    items.push(...unattributed());
    return ok({ items });
  }),

  'GET /api/admin/attribution/clicks': guard('ATTRIBUTION:VIEW', (req) => {
    const details: Detail[] = [];
    const status = enumQuery(req, 'status', CLICK_STATUSES, details);
    if (details.length > 0) throw fail(details);
    const { from, to } = dayRange(req);
    const campaignId = text(req.query.campaignId);
    const keyword = text(req.query.keyword);
    // contract 10.3: at most 200 characters, and no U+0000 (400, ref keyword, INVALID_FORMAT)
    if ([...keyword].length > CLICK_KEYWORD_MAX) {
      throw fail([{ ref: 'keyword', reason: 'TOO_LONG' }]);
    }
    if (keyword.includes('\u0000')) throw fail([{ ref: 'keyword', reason: 'INVALID_FORMAT' }]);
    const lower = keyword.toLowerCase();
    const mayReadAddress = hasPermission(req.admin, 'ANALYTICS:IP_VIEW');
    const rows = campaignState.clicks
      .filter((c) => {
        const at = Date.parse(c.clickedAt);
        if (at < from || at >= to) return false;
        if (campaignId !== '' && c.campaignId !== campaignId) return false;
        if (status !== null && c.status !== status) return false;
        if (keyword === '') return true;
        // each of the three by itself: a word never spans two of them
        const inUtm = [c.utmSource, c.utmMedium, c.utmCampaign].some((v) =>
          String(v ?? '')
            .toLowerCase()
            .includes(lower),
        );
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
        key: string;
        installs: number;
        activations: number;
        costs: Map<string, number>;
      }
    >();
    for (const r of campaignState.records) {
      if (r.eventName !== 'install' || r.installTime === null) continue;
      const day = r.installTime.slice(0, 10);
      if (day < from || day > to) continue;
      // a missing media source or campaign is an empty text, never null (backend reply 76)
      const key =
        (groupBy === 'source'
          ? r.source
          : groupBy === 'media_source'
            ? r.mediaSource
            : r.campaign) ?? '';
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
