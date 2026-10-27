import { beforeEach, describe, expect, it } from 'vitest';
import { campaignState, resetCampaignStore } from './_core/campaignData';
import { resetConfigStore, saved } from './_core/configStore';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import campaign from './campaign.mock';

const NOW = new Date('2026-10-26T10:00:00Z');

beforeEach(() => {
  resetStore();
  resetConfigStore();
  resetCampaignStore(NOW);
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (campaign as unknown as Record<string, H>)[name];
const token = (user: string) => bearer(issueToken(adminOf(user)).token).authorization;

const get = (name: string, query: Record<string, unknown> = {}, params = {}, user = 'root') =>
  call(h(name), { headers: { authorization: token(user) }, query, params });
const send = (name: string, body: unknown, params = {}, user = 'root') =>
  call(h(name), { headers: { authorization: token(user) }, body, params });

/** An administrator with exactly these permissions. */
const only = (...codes: string[]) => {
  const admin = adminOf('support');
  admin.permissions = codes as typeof admin.permissions;
  return 'support';
};

const CAMPAIGNS = 'GET /api/admin/attribution/campaigns';
const CAMPAIGN_CREATE = 'POST /api/admin/attribution/campaigns';
const CAMPAIGN_UPDATE = 'PUT /api/admin/attribution/campaigns/:id';
const LINK = 'GET /api/admin/attribution/campaigns/:id/link';
const COSTS = 'GET /api/admin/attribution/costs';
const COST_CREATE = 'POST /api/admin/attribution/costs';
const COST_UPDATE = 'PUT /api/admin/attribution/costs/:id';
const COST_DELETE = 'DELETE /api/admin/attribution/costs/:id';
const BATCH = 'POST /api/admin/attribution/costs/batch';
const PERFORMANCE = 'GET /api/admin/attribution/performance';
const CLICKS = 'GET /api/admin/attribution/clicks';
const RECORDS = 'GET /api/admin/attribution/records';
const SUMMARY = 'GET /api/admin/attribution/summary';

const campaignBody = (over: Record<string, unknown> = {}) => ({
  code: 'new_one',
  name: 'New one',
  mediaSource: 'facebook',
  campaign: 'new_one',
  utmMedium: 'cpc',
  adset: null,
  ad: null,
  facebookPixelId: 'FB-1',
  googlePixelId: null,
  tiktokPixelId: null,
  channelCodes: ['play'],
  remark: null,
  enabled: true,
  ...over,
});

const costBody = (over: Record<string, unknown> = {}) => ({
  campaignId: '1',
  statDate: '2026-10-01',
  amount: 10.5,
  currency: 'USD',
  remark: null,
  ...over,
});

const batchRow = (over: Record<string, unknown> = {}) => ({
  campaignCode: 'spring_th',
  statDate: '2026-09-01',
  amount: 5,
  currency: 'USD',
  remark: null,
  ...over,
});

const refs = (body: { data: { details?: { ref: string; reason: string }[] } }) =>
  (body.data.details ?? []).map((d) => `${d.ref}:${d.reason}`);

describe('the permissions', () => {
  it('lets the campaign list be read with ATTRIBUTION:MANAGE or ATTRIBUTION:VIEW, and nothing else', async () => {
    expect((await get(CAMPAIGNS, {}, {}, only('ATTRIBUTION:MANAGE'))).status).toBe(200);
    expect((await get(CAMPAIGNS, {}, {}, only('ATTRIBUTION:VIEW'))).status).toBe(200);
    const refused = await get(CAMPAIGNS, {}, {}, only('USER:VIEW'));
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('ADMIN_FORBIDDEN');
  });

  it('needs ATTRIBUTION:MANAGE for every write and for the costs and the link, and ATTRIBUTION:VIEW for the reports', async () => {
    const viewer = only('ATTRIBUTION:VIEW');
    for (const [name, body, params] of [
      [CAMPAIGN_CREATE, campaignBody(), {}],
      [CAMPAIGN_UPDATE, campaignBody(), { id: '1' }],
      [COST_CREATE, costBody(), {}],
      [COST_UPDATE, costBody(), { id: '1' }],
      [COST_DELETE, undefined, { id: '1' }],
      [BATCH, [batchRow()], {}],
    ] as const) {
      expect((await send(name, body, params, viewer)).status, name).toBe(403);
    }
    expect((await get(COSTS, {}, {}, viewer)).status).toBe(403);
    expect((await get(LINK, { platform: 'FACEBOOK' }, { id: '1' }, viewer)).status).toBe(403);
    const manager = only('ATTRIBUTION:MANAGE');
    for (const name of [PERFORMANCE, CLICKS, RECORDS, SUMMARY]) {
      expect((await get(name, { groupBy: 'source' }, {}, manager)).status, name).toBe(403);
    }
  });
});

describe('the campaigns', () => {
  it('lists newest first with the columns of the reply, and never the token', async () => {
    const { body } = await get(CAMPAIGNS);
    expect(body.data.total).toBeGreaterThanOrEqual(7);
    const first = body.data.items[0];
    expect(Object.keys(first).sort()).toEqual(
      [
        'ad',
        'adset',
        'campaign',
        'channelCodes',
        'code',
        'createdAt',
        'createdBy',
        'createdByUsername',
        'enabled',
        'facebookAccessTokenSet',
        'facebookPixelId',
        'googlePixelId',
        'id',
        'mediaSource',
        'name',
        'remark',
        'tiktokPixelId',
        'updatedAt',
        'utmMedium',
      ].sort(),
    );
    expect(typeof first.facebookAccessTokenSet).toBe('boolean');
    expect(JSON.stringify(body)).not.toMatch(/facebookAccessToken"/);
    const times = body.data.items.map((c: { createdAt: string }) => c.createdAt);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('has names in every language the product targets, and a remark that is one long string', async () => {
    const { body } = await get(CAMPAIGNS);
    const text = body.data.items
      .map((c: { name: string; remark: string | null }) => `${c.name} ${c.remark}`)
      .join(' ');
    expect(text).toMatch(/[฀-๿]/); // Thai
    expect(text).toMatch(new RegExp(String.fromCharCode(91, 0x600, 45, 0x6ff, 93))); // Arabic
    expect(text).toMatch(/[一-鿿]/); // Chinese
    expect(text).toMatch(/Campaña|Chiến|Kampanye|Spring/);
    expect(
      body.data.items.some(
        (c: { remark: string | null }) =>
          (c.remark ?? '').length >= 300 && !/\s/.test(c.remark ?? ''),
      ),
    ).toBe(true);
  });

  it('filters by a word of the code or the name without regard to case, and by the state', async () => {
    const all = (await get(CAMPAIGNS)).body.data.items;
    const byCode = (await get(CAMPAIGNS, { keyword: 'SPRING' })).body.data.items;
    expect(byCode.length).toBeGreaterThan(0);
    expect(
      byCode.every((c: { code: string; name: string }) => /spring/i.test(`${c.code} ${c.name}`)),
    ).toBe(true);
    const off = (await get(CAMPAIGNS, { enabled: 'false' })).body.data.items;
    expect(off.length).toBeGreaterThan(0);
    expect(off.every((c: { enabled: boolean }) => !c.enabled)).toBe(true);
    const on = (await get(CAMPAIGNS, { enabled: 'true' })).body.data.items;
    expect(on.length + off.length).toBe(all.length);
    expect((await get(CAMPAIGNS, { keyword: 'no-such-word-anywhere' })).body.data).toEqual({
      items: [],
      total: 0,
    });
  });

  it('pages, and refuses a page outside the range', async () => {
    const page = await get(CAMPAIGNS, { page: '2', pageSize: '3' });
    expect(page.body.data.items).toHaveLength(3);
    const bad = await get(CAMPAIGNS, { pageSize: '201' });
    expect(bad.status).toBe(400);
    expect(refs(bad.body as never)).toEqual(['pageSize:OUT_OF_RANGE']);
  });

  it('makes a campaign that then shows in the list, without ever returning the token', async () => {
    const made = await send(
      CAMPAIGN_CREATE,
      campaignBody({ facebookAccessToken: 'secret-token-123' }),
    );
    expect(made.status).toBe(200);
    expect(made.body.data).toMatchObject({
      code: 'new_one',
      facebookAccessTokenSet: true,
      createdByUsername: 'root',
      channelCodes: ['play'],
    });
    expect(JSON.stringify(made.body)).not.toContain('secret-token-123');
    const listed = await get(CAMPAIGNS, { keyword: 'new_one' });
    expect(listed.body.data.items).toHaveLength(1);
    expect(JSON.stringify(listed.body)).not.toContain('secret-token-123');
  });

  it('says a campaign has no token when none was given', async () => {
    const made = await send(CAMPAIGN_CREATE, campaignBody());
    expect(made.body.data.facebookAccessTokenSet).toBe(false);
  });

  it('checks the code: 3 to 32 of a-z, 0-9, - and _, and the code is the key (409 DUPLICATE_RESOURCE)', async () => {
    for (const code of ['ab', 'a'.repeat(33), 'Upper', 'with space', 'ünï', '']) {
      const refused = await send(CAMPAIGN_CREATE, campaignBody({ code }));
      expect(refused.status, code).toBe(400);
      expect(refs(refused.body as never), code).toContain('code:OUT_OF_RANGE');
    }
    expect((await send(CAMPAIGN_CREATE, campaignBody({ code: 'abc' }))).status).toBe(200);
    expect((await send(CAMPAIGN_CREATE, campaignBody({ code: 'a'.repeat(32) }))).status).toBe(200);
    const duplicate = await send(CAMPAIGN_CREATE, campaignBody({ code: 'abc' }));
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('DUPLICATE_RESOURCE');
    expect(duplicate.body.data).toEqual({ field: 'code' });
  });

  it('refuses an empty name, a channel that is not registered, and a token that is empty', async () => {
    const refused = await send(
      CAMPAIGN_CREATE,
      campaignBody({ name: '   ', channelCodes: ['play', 'nope'], facebookAccessToken: '' }),
    );
    expect(refused.status).toBe(400);
    expect(refs(refused.body as never).sort()).toEqual(
      [
        'channelCodes:OUT_OF_RANGE',
        'facebookAccessToken:EMPTY_NOT_ALLOWED',
        'name:EMPTY_NOT_ALLOWED',
      ].sort(),
    );
  });

  it('saves the channel codes once each', async () => {
    const made = await send(
      CAMPAIGN_CREATE,
      campaignBody({ channelCodes: ['play', 'play', 'direct'] }),
    );
    expect(made.body.data.channelCodes).toEqual(['play', 'direct']);
  });

  it('changes a campaign and keeps the code and, without a new token, the old token', async () => {
    const id = campaignState.campaigns.find((c) => c.facebookAccessToken !== null)?.id as string;
    expect(id).toBeTruthy();
    const { code, ...rest } = campaignBody({ name: 'Renamed ก ع 中', code: 'ignored' });
    expect(code).toBe('ignored');
    const changed = await send(CAMPAIGN_UPDATE, rest, { id });
    expect(changed.status).toBe(200);
    expect(changed.body.data).toMatchObject({
      id,
      name: 'Renamed ก ع 中',
      facebookAccessTokenSet: true,
    });
    expect(changed.body.data.code).not.toBe('ignored');
    const before = campaignState.campaigns.find((c) => c.id === id)?.facebookAccessToken;
    expect(before).toBeTruthy();
    await send(CAMPAIGN_UPDATE, { ...rest, facebookAccessToken: 'another-secret' }, { id });
    expect(campaignState.campaigns.find((c) => c.id === id)?.facebookAccessToken).toBe(
      'another-secret',
    );
  });

  it('refuses a different code on update, an unknown id, and switches the state', async () => {
    const found = campaignState.campaigns[0];
    const { code: _code, ...rest } = campaignBody();
    const wrongCode = await send(
      CAMPAIGN_UPDATE,
      { ...rest, code: 'other_code' },
      { id: found.id },
    );
    expect(wrongCode.status).toBe(400);
    expect(refs(wrongCode.body as never)).toEqual(['code:OUT_OF_RANGE']);
    expect((await send(CAMPAIGN_UPDATE, rest, { id: '9999' })).status).toBe(404);
    const off = await send(CAMPAIGN_UPDATE, { ...rest, enabled: false }, { id: found.id });
    expect(off.body.data.enabled).toBe(false);
  });

  it('has no way to delete a campaign', () => {
    expect(
      Object.keys(campaign).some((key) =>
        key.startsWith('DELETE /api/admin/attribution/campaigns'),
      ),
    ).toBe(false);
  });
});

describe('the link of a campaign', () => {
  const withBase = () =>
    saved.set('attribution.link_base_url', {
      value: 'https://go.example',
      updatedAt: '',
      updatedBy: '',
      updatedByUsername: '',
    });
  const withPixels = (id: string) => {
    const found = campaignState.campaigns.find((c) => c.id === id);
    if (!found) throw new Error('no campaign');
    found.facebookPixelId = 'FB-1';
    found.googlePixelId = null;
    return found;
  };

  it('makes the link from the link root, the code and the UTM values, with the defaults of the campaign for what is not given', async () => {
    withBase();
    const found = withPixels('1');
    const link = await get(LINK, { platform: 'FACEBOOK', utmSource: 'facebook' }, { id: '1' });
    expect(link.status).toBe(200);
    const url = new URL(link.body.data.url);
    expect(url.origin).toBe('https://go.example');
    expect(url.pathname).toBe(`/go/${found.code}`);
    expect(url.searchParams.get('utm_source')).toBe('facebook');
    expect(url.searchParams.get('utm_medium')).toBe(found.utmMedium);
    expect(url.searchParams.get('utm_campaign')).toBe(found.campaign);
  });

  it('drops a UTM value with characters outside A-Z a-z 0-9 . _ - or longer than 64, as the campaign default takes over', async () => {
    withBase();
    const found = withPixels('1');
    const link = await get(
      LINK,
      { platform: 'FACEBOOK', utmSource: 'a b', utmCampaign: 'x'.repeat(65) },
      { id: '1' },
    );
    const url = new URL(link.body.data.url);
    expect(url.searchParams.get('utm_source')).toBe(found.mediaSource);
    expect(url.searchParams.get('utm_campaign')).toBe(found.campaign);
  });

  it('refuses a platform the campaign has no pixel id for (400 INVALID_REQUEST)', async () => {
    withBase();
    withPixels('1');
    const refused = await get(LINK, { platform: 'GOOGLE' }, { id: '1' });
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('INVALID_REQUEST');
  });

  it('refuses when the link root is not configured (400 INVALID_REQUEST)', async () => {
    withPixels('1');
    const refused = await get(LINK, { platform: 'FACEBOOK' }, { id: '1' });
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('INVALID_REQUEST');
  });

  it('refuses an unknown platform and an unknown campaign, and makes a link for a campaign that is switched off', async () => {
    withBase();
    withPixels('1');
    expect((await get(LINK, { platform: 'MYSPACE' }, { id: '1' })).status).toBe(400);
    expect((await get(LINK, { platform: 'FACEBOOK' }, { id: '9999' })).status).toBe(404);
    const found = withPixels('1');
    found.enabled = false;
    expect((await get(LINK, { platform: 'FACEBOOK' }, { id: '1' })).status).toBe(200);
  });
});

describe('the costs', () => {
  it('lists newest day first with the columns of AttributionCost and the name of who entered it', async () => {
    const { body } = await get(COSTS);
    expect(body.data.total).toBeGreaterThan(10);
    const first = body.data.items[0];
    expect(Object.keys(first).sort()).toEqual(
      [
        'amount',
        'campaignId',
        'createdAt',
        'createdBy',
        'createdByUsername',
        'currency',
        'id',
        'remark',
        'statDate',
        'updatedAt',
      ].sort(),
    );
    expect(first.currency).toBe('USD');
    const days = body.data.items.map((c: { statDate: string }) => c.statDate);
    expect([...days].sort().reverse()).toEqual(days);
  });

  it('filters by campaign and by days, both ends included', async () => {
    const all = (await get(COSTS, { pageSize: '200' })).body.data.items;
    const oneCampaign = all[0].campaignId;
    const mine = (await get(COSTS, { campaignId: oneCampaign, pageSize: '200' })).body.data.items;
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((c: { campaignId: string }) => c.campaignId === oneCampaign)).toBe(true);
    const day = all[0].statDate;
    const sameDay = (await get(COSTS, { from: day, to: day, pageSize: '200' })).body.data.items;
    expect(sameDay.length).toBeGreaterThan(0);
    expect(sameDay.every((c: { statDate: string }) => c.statDate === day)).toBe(true);
  });

  it('makes a cost with two decimals, and says COST_EXISTS for a campaign and day that has one already', async () => {
    const made = await send(COST_CREATE, costBody({ remark: 'ก 🎉' }));
    expect(made.status).toBe(200);
    expect(made.body.data).toMatchObject({
      campaignId: '1',
      statDate: '2026-10-01',
      amount: 10.5,
      currency: 'USD',
      remark: 'ก 🎉',
      createdByUsername: 'root',
    });
    const again = await send(COST_CREATE, costBody({ amount: 99 }));
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('COST_EXISTS');
    const stored = campaignState.costs.find(
      (c) => c.campaignId === '1' && c.statDate === '2026-10-01',
    );
    expect(stored?.amount).toBe(10.5);
  });

  it('checks the campaign, the day, the amount (not below 0, two decimals) and the currency', async () => {
    const refused = await send(
      COST_CREATE,
      costBody({ campaignId: '9999', statDate: '2026-02-30', amount: -1, currency: 'EUR' }),
    );
    expect(refused.status).toBe(400);
    expect(refs(refused.body as never).sort()).toEqual(
      [
        'amount:OUT_OF_RANGE',
        'campaignId:OUT_OF_RANGE',
        'currency:OUT_OF_RANGE',
        'statDate:OUT_OF_RANGE',
      ].sort(),
    );
    expect(refs((await send(COST_CREATE, costBody({ amount: 1.234 }))).body as never)).toEqual([
      'amount:OUT_OF_RANGE',
    ]);
    expect(refs((await send(COST_CREATE, costBody({ amount: '5' }))).body as never)).toEqual([
      'amount:OUT_OF_RANGE',
    ]);
    expect((await send(COST_CREATE, costBody({ amount: 0 }))).status).toBe(200);
  });

  it('takes the currency from attribution.cost_currency', async () => {
    saved.set('attribution.cost_currency', {
      value: 'EUR',
      updatedAt: '',
      updatedBy: '',
      updatedByUsername: '',
    });
    expect((await send(COST_CREATE, costBody())).status).toBe(400);
    expect((await send(COST_CREATE, costBody({ currency: 'EUR' }))).status).toBe(200);
  });

  it('changes the amount and the remark of a cost, and keeps its campaign and day', async () => {
    const made = (await send(COST_CREATE, costBody())).body.data;
    const changed = await send(COST_UPDATE, costBody({ amount: 20.25, remark: 'x' }), {
      id: made.id,
    });
    expect(changed.body.data).toMatchObject({
      id: made.id,
      amount: 20.25,
      remark: 'x',
      statDate: '2026-10-01',
    });
    const moved = await send(COST_UPDATE, costBody({ statDate: '2026-10-02' }), { id: made.id });
    expect(moved.status).toBe(400);
    expect(refs(moved.body as never)).toEqual(['statDate:OUT_OF_RANGE']);
    expect((await send(COST_UPDATE, costBody(), { id: '9999' })).status).toBe(404);
  });

  it('deletes a cost, and 404 for one that is gone', async () => {
    const made = (await send(COST_CREATE, costBody())).body.data;
    expect((await send(COST_DELETE, undefined, { id: made.id })).status).toBe(200);
    expect((await send(COST_DELETE, undefined, { id: made.id })).status).toBe(404);
    expect(campaignState.costs.some((c) => c.id === made.id)).toBe(false);
  });
});

describe('the batch of costs', () => {
  it('makes new rows and overwrites the rows of a campaign and day that have one, in one answer', async () => {
    const existing = campaignState.costs[0];
    const code = campaignState.campaigns.find((c) => c.id === existing.campaignId)?.code as string;
    const count = campaignState.costs.length;
    const result = await send(BATCH, [
      batchRow({ campaignCode: code, statDate: existing.statDate, amount: 777.77, remark: 'over' }),
      batchRow({ statDate: '2026-01-01', amount: 1.5 }),
    ]);
    expect(result.status).toBe(200);
    expect(campaignState.costs).toHaveLength(count + 1);
    // the rows written, and how many of them overwrote a cost (the page writes the others as added)
    expect(result.body.data).toEqual({ imported: 2, overwritten: 1 });
    const overwritten = campaignState.costs.find((c) => c.id === existing.id);
    expect(overwritten).toMatchObject({ amount: 777.77, remark: 'over' });
  });

  it('refuses the whole batch when one row is bad, and changes nothing, naming the row of each problem', async () => {
    const count = campaignState.costs.length;
    const result = await send(BATCH, [
      batchRow(),
      batchRow({ statDate: '2026-09-02', amount: -3 }),
      batchRow({ statDate: '2026-09-03', campaignCode: 'no_such_code' }),
      batchRow({ statDate: '2026-09-04', currency: 'EUR' }),
    ]);
    expect(result.status).toBe(400);
    expect(result.body.code).toBe('INVALID_REQUEST');
    expect(refs(result.body as never).sort()).toEqual(
      ['1.amount:OUT_OF_RANGE', '2.campaignCode:OUT_OF_RANGE', '3.currency:OUT_OF_RANGE'].sort(),
    );
    expect(campaignState.costs).toHaveLength(count);
  });

  it('refuses the same campaign and day twice in one batch', async () => {
    const count = campaignState.costs.length;
    const result = await send(BATCH, [batchRow(), batchRow({ amount: 9 })]);
    expect(result.status).toBe(400);
    expect(refs(result.body as never)).toEqual(['1:OUT_OF_RANGE']);
    expect(campaignState.costs).toHaveLength(count);
  });

  it('refuses more rows than attribution.cost_batch_max, and anything that is not a non-empty list', async () => {
    saved.set('attribution.cost_batch_max', {
      value: 2,
      updatedAt: '',
      updatedBy: '',
      updatedByUsername: '',
    });
    const three = await send(BATCH, [
      batchRow(),
      batchRow({ statDate: '2026-09-02' }),
      batchRow({ statDate: '2026-09-03' }),
    ]);
    expect(three.status).toBe(400);
    expect(refs(three.body as never)).toEqual(['body:OUT_OF_RANGE']);
    expect((await send(BATCH, { not: 'a list' })).status).toBe(400);
    expect((await send(BATCH, [])).status).toBe(400);
  });
});

describe('the performance', () => {
  const rows = async (query: Record<string, unknown>) =>
    (await get(PERFORMANCE, { from: '2026-10-20', to: '2026-10-26', ...query })).body.data
      .items as Record<string, unknown>[];

  it('has a row for each campaign, with the figures of the contract, and one row for the installs that matched no campaign', async () => {
    const items = await rows({ groupBy: 'campaign' });
    const real = items.filter((r) => r.campaignId !== '0');
    expect(real.length).toBe(campaignState.campaigns.length);
    for (const row of real) {
      for (const field of ['pageViews', 'clicks', 'installs', 'registered', 'cost']) {
        expect(row, field).toHaveProperty(field);
      }
    }
    const organic = items.filter((r) => r.campaignId === '0');
    expect(organic).toHaveLength(1);
    expect(typeof organic[0].unattributedInstalls).toBe('number');
  });

  it('works out each rate from the counts, and gives null where the denominator is 0', async () => {
    const items = await rows({ groupBy: 'campaign' });
    const quiet = items.find((r) => r.pageViews === 0) as Record<string, number | null>;
    expect(quiet).toBeTruthy();
    expect(quiet.clickRate).toBeNull();
    expect(quiet.installRate).toBeNull();
    expect(quiet.registerRate).toBeNull();
    expect(quiet.cpa).toBeNull();
    expect(quiet.cpi).toBeNull();
    const busy = items.find(
      (r) => (r.pageViews as number) > 0 && (r.clicks as number) > 0,
    ) as Record<string, number | null>;
    expect(busy.clickRate).toBeCloseTo((busy.clicks as number) / (busy.pageViews as number), 3);
  });

  it('adds the costs of the days of the range into cost', async () => {
    const id = '1';
    const items = await rows({ groupBy: 'campaign', campaignId: id });
    expect(items).toHaveLength(1);
    const expected = campaignState.costs
      .filter(
        (c) => c.campaignId === id && c.statDate >= '2026-10-20' && c.statDate <= '2026-10-26',
      )
      .reduce((sum, c) => sum + c.amount, 0);
    expect(items[0].cost as number).toBeCloseTo(expected, 2);
  });

  it('has a row for each day of the range by day, the total of all campaigns, or one campaign', async () => {
    const all = await rows({ groupBy: 'day' });
    expect(all.map((r) => r.statDate)).toEqual([
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ]);
    const campaigns = await rows({ groupBy: 'campaign' });
    const sum = (list: Record<string, unknown>[], field: string) =>
      list.reduce((s, r) => s + (typeof r[field] === 'number' ? (r[field] as number) : 0), 0);
    expect(sum(all, 'clicks')).toBe(
      sum(
        campaigns.filter((r) => r.campaignId !== '0'),
        'clicks',
      ),
    );
    const one = await rows({ groupBy: 'day', campaignId: '2' });
    expect(one).toHaveLength(7);
    expect(sum(one, 'clicks')).toBe(
      sum(
        campaigns.filter((r) => r.campaignId === '2'),
        'clicks',
      ),
    );
  });

  it('refuses a range that is not days, a range the wrong way round, and an unknown grouping', async () => {
    expect(
      (await get(PERFORMANCE, { from: 'yesterday', to: '2026-10-26', groupBy: 'day' })).status,
    ).toBe(400);
    expect(
      (await get(PERFORMANCE, { from: '2026-10-27', to: '2026-10-26', groupBy: 'day' })).status,
    ).toBe(400);
    const bad = await get(PERFORMANCE, { from: '2026-10-20', to: '2026-10-26', groupBy: 'week' });
    expect(bad.status).toBe(400);
    expect(refs(bad.body as never)).toEqual(['groupBy:OUT_OF_RANGE']);
  });
});

describe('the clicks', () => {
  const list = async (query: Record<string, unknown> = {}, user = 'root') =>
    (await get(CLICKS, { pageSize: '200', ...query }, {}, user)).body.data as {
      items: Record<string, unknown>[];
      total: number;
    };

  it('lists newest first with the columns of the reply and without the attribution id and the user agent', async () => {
    const { items, total } = await list();
    expect(total).toBeGreaterThan(40);
    expect(Object.keys(items[0]).sort()).toEqual(
      [
        'campaignId',
        'campaignName',
        'channel',
        'claimedAt',
        'clickedAt',
        'id',
        'ip',
        'status',
        'utmCampaign',
        'utmMedium',
        'utmSource',
      ].sort(),
    );
    const times = items.map((c) => c.clickedAt as string);
    expect([...times].sort().reverse()).toEqual(times);
    expect(new Set(items.map((c) => c.status))).toEqual(new Set(['PENDING', 'MATCHED', 'EXPIRED']));
    expect(new Set(items.map((c) => c.channel))).toEqual(
      new Set(['STORE_REDIRECT', 'APK_DOWNLOAD']),
    );
  });

  it('gives a claim time to a matched click only', async () => {
    const { items } = await list();
    for (const click of items) {
      expect(click.claimedAt === null, `${click.id} ${click.status}`).toBe(
        click.status !== 'MATCHED',
      );
    }
  });

  it('masks the address unless the administrator may see it in full (ANALYTICS:IP_VIEW)', async () => {
    const masked = await list({}, only('ATTRIBUTION:VIEW'));
    expect(masked.items.every((c) => /\*/.test(String(c.ip)))).toBe(true);
    const full = await list({}, only('ATTRIBUTION:VIEW', 'ANALYTICS:IP_VIEW'));
    expect(full.items.every((c) => !/\*/.test(String(c.ip)))).toBe(true);
  });

  it('filters by campaign, status, the keyword in the UTM values, and the time, the end not included', async () => {
    const everything = (await list()).items;
    const campaignId = everything[0].campaignId as string;
    const byCampaign = (await list({ campaignId })).items;
    expect(byCampaign.every((c) => c.campaignId === campaignId)).toBe(true);
    expect((await list({ status: 'MATCHED' })).items.every((c) => c.status === 'MATCHED')).toBe(
      true,
    );
    const utm = String(everything[0].utmSource);
    const byWord = (await list({ keyword: utm.toUpperCase() })).items;
    expect(byWord.length).toBeGreaterThan(0);
    expect(
      byWord.every((c) =>
        `${c.utmSource} ${c.utmMedium} ${c.utmCampaign}`.toLowerCase().includes(utm.toLowerCase()),
      ),
    ).toBe(true);
    const at = everything[3].clickedAt as string;
    expect((await list({ to: at })).items.some((c) => c.clickedAt === at)).toBe(false);
    expect((await list({ from: at })).items.some((c) => c.clickedAt === at)).toBe(true);
  });

  it('matches a whole address in the keyword only for an administrator who may see addresses', async () => {
    const address = campaignState.clicks[0].ip as string;
    const withRight = await list(
      { keyword: address },
      only('ATTRIBUTION:VIEW', 'ANALYTICS:IP_VIEW'),
    );
    expect(withRight.items.length).toBeGreaterThan(0);
    const without = await list({ keyword: address }, only('ATTRIBUTION:VIEW'));
    expect(without.items).toHaveLength(0);
  });

  it('refuses a status that is not one of the three, and a time that is not an instant', async () => {
    const status = await get(CLICKS, { status: 'DONE' });
    expect(status.status).toBe(400);
    expect(refs(status.body as never)).toEqual(['status:OUT_OF_RANGE']);
    expect((await get(CLICKS, { from: 'last week' })).status).toBe(400);
  });
});

describe('the records', () => {
  const list = async (query: Record<string, unknown> = {}) =>
    (await get(RECORDS, { pageSize: '200', ...query })).body.data as {
      items: Record<string, unknown>[];
      total: number;
    };

  it('lists newest event first with the fields of the note, and no device or platform identifier', async () => {
    const { items } = await list();
    expect(items.length).toBeGreaterThan(30);
    expect(Object.keys(items[0]).sort()).toEqual(
      [
        'accountId',
        'ad',
        'adset',
        'appVersion',
        'attributionCampaignId',
        'campaign',
        'campaignType',
        'conversionType',
        'cost',
        'costCurrency',
        'costInSelectedCurrency',
        'costModel',
        'countryCode',
        'eventName',
        'eventTime',
        'id',
        'installTime',
        'isRetargeting',
        'matchType',
        'mediaSource',
        'platform',
        'registeredAt',
        'source',
      ].sort(),
    );
    const times = items.map((r) => r.eventTime as string);
    expect([...times].sort().reverse()).toEqual(times);
    expect(new Set(items.map((r) => r.source))).toEqual(new Set(['APPSFLYER', 'SELF']));
  });

  it('gives a match type to the records of the own attribution only', async () => {
    const { items } = await list();
    for (const record of items)
      expect(record.matchType === null, String(record.id)).toBe(record.source !== 'SELF');
    expect(new Set(items.filter((r) => r.source === 'SELF').map((r) => r.matchType))).toEqual(
      new Set(['APK_BLOCK', 'REFERRER', 'FINGERPRINT']),
    );
  });

  it('filters by source, match type and time (from included, to not included), and says 400 for a value out of range', async () => {
    expect((await list({ source: 'SELF' })).items.every((r) => r.source === 'SELF')).toBe(true);
    expect(
      (await list({ matchType: 'FINGERPRINT' })).items.every((r) => r.matchType === 'FINGERPRINT'),
    ).toBe(true);
    const all = (await list()).items;
    const at = all[2].eventTime as string;
    expect((await list({ to: at })).items.some((r) => r.eventTime === at)).toBe(false);
    expect((await list({ from: at })).items.some((r) => r.eventTime === at)).toBe(true);
    const bad = await get(RECORDS, { source: 'OTHER', matchType: 'GUESS' });
    expect(bad.status).toBe(400);
    expect(refs(bad.body as never).sort()).toEqual([
      'matchType:OUT_OF_RANGE',
      'source:OUT_OF_RANGE',
    ]);
  });

  it('pages', async () => {
    const page = await get(RECORDS, { page: '2', pageSize: '10' });
    expect(page.body.data.items).toHaveLength(10);
    expect(page.body.data.total).toBeGreaterThan(20);
  });
});

describe('the summary', () => {
  const summary = async (query: Record<string, unknown>) =>
    (await get(SUMMARY, { from: '2026-10-01', to: '2026-10-26', ...query })).body.data.items as {
      source: string;
      key: string;
      installs: number;
      activations: number;
      costs: { currency: string; amount: number }[];
    }[];

  it('needs groupBy, one of source, media_source and campaign', async () => {
    const missing = await get(SUMMARY, {});
    expect(missing.status).toBe(400);
    expect(refs(missing.body as never)).toEqual(['groupBy:EMPTY_NOT_ALLOWED']);
    const wrong = await get(SUMMARY, { groupBy: 'country' });
    expect(refs(wrong.body as never)).toEqual(['groupBy:OUT_OF_RANGE']);
  });

  it('keeps the two sources apart, and never adds them', async () => {
    const rows = await summary({ groupBy: 'media_source' });
    expect(new Set(rows.map((r) => r.source))).toEqual(new Set(['APPSFLYER', 'SELF']));
    const records = campaignState.records.filter((r) => r.eventName === 'install');
    for (const row of rows) {
      const own = records.filter(
        (r) =>
          r.source === row.source &&
          r.mediaSource === row.key &&
          r.installTime !== null &&
          r.installTime.slice(0, 10) >= '2026-10-01' &&
          r.installTime.slice(0, 10) <= '2026-10-26',
      );
      expect(row.installs, `${row.source} ${row.key}`).toBe(own.length);
      expect(row.activations).toBe(own.filter((r) => r.accountId !== null).length);
    }
  });

  it('groups by source with the source as the key', async () => {
    const rows = await summary({ groupBy: 'source' });
    for (const row of rows) expect(row.key).toBe(row.source);
  });

  it('sums the costs of a currency, a currency apart from another, and has none where there is no cost', async () => {
    const rows = await summary({ groupBy: 'source' });
    const external = rows.find((r) => r.source === 'APPSFLYER');
    expect(external?.costs.length).toBeGreaterThan(1);
    expect(new Set(external?.costs.map((c) => c.currency)).size).toBe(external?.costs.length);
    const own = rows.find((r) => r.source === 'SELF');
    expect(own?.costs).toEqual([]);
  });

  it('refuses a range that is not days', async () => {
    expect((await get(SUMMARY, { groupBy: 'source', from: 'x' })).status).toBe(400);
  });
});
