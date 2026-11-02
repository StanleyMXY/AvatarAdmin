import { beforeEach, describe, expect, it } from 'vitest';
import { campaignState, resetCampaignStore } from './_core/campaignData';
import { resetConfigStore, saved } from './_core/configStore';
import { monitorStore, raiseAlert, resetMonitorStore } from './_core/monitorData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import campaign from './campaign.mock';

const NOW = new Date('2026-10-26T10:00:00Z');

beforeEach(() => {
  resetStore();
  resetConfigStore();
  resetCampaignStore(NOW);
  resetMonitorStore();
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

  it('matches the keyword in the code or in the name, each by itself (never across the two), without regard to case, with % _ and a backslash as themselves (contract 10.5)', async () => {
    await send(CAMPAIGN_CREATE, campaignBody({ code: 'ab_cd', name: 'Zz%Yy\\Ww' }));
    const find = async (keyword: string) =>
      ((await get(CAMPAIGNS, { keyword })).body.data.items as { code: string }[]).map(
        (c) => c.code,
      );
    expect(await find('B_C')).toEqual(['ab_cd']);
    expect(await find('zz%yy')).toEqual(['ab_cd']);
    expect(await find('yy\\ww')).toEqual(['ab_cd']);
    expect(await find('%')).toEqual(['ab_cd']);
    // the code and the name are two texts: a word that would need the end of one and the start of the other is in neither
    expect(await find('cd zz')).toEqual([]);
    expect(await find('cdzz')).toEqual([]);
  });

  it('refuses a keyword of more than 100 code points, counted as code points and not as UTF-16 units (400, ref keyword, TOO_LONG)', async () => {
    expect((await get(CAMPAIGNS, { keyword: '🎉'.repeat(100) })).status).toBe(200);
    expect((await get(CAMPAIGNS, { keyword: 'ก'.repeat(100) })).status).toBe(200);
    for (const keyword of ['🎉'.repeat(101), 'a'.repeat(101)]) {
      const refused = await get(CAMPAIGNS, { keyword });
      expect(refused.status).toBe(400);
      expect(refused.body.code).toBe('INVALID_REQUEST');
      expect(refs(refused.body as never)).toEqual(['keyword:TOO_LONG']);
    }
  });

  it('refuses a state that is not true or false (400)', async () => {
    const refused = await get(CAMPAIGNS, { enabled: 'yes' });
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('INVALID_REQUEST');
    expect(refs(refused.body as never)).toEqual(['enabled:NOT_BOOLEAN']);
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

  describe('the postback credential alert of a campaign', () => {
    const open = (id: string) =>
      monitorStore.alerts.filter(
        (a) => a.type === 'POSTBACK_CREDENTIAL_FAILED' && a.refId === id && a.status === 'OPEN',
      );
    const withAlert = (detail: string) => {
      const found = campaignState.campaigns.find((c) => c.facebookPixelId !== null);
      const id = found?.id as string;
      monitorStore.alerts = monitorStore.alerts.filter((a) => a.refId !== id);
      raiseAlert({
        type: 'POSTBACK_CREDENTIAL_FAILED',
        refType: 'ATTRIBUTION_CAMPAIGN',
        refId: id,
        accountId: null,
        detail,
      });
      return { id, found: found as (typeof campaignState.campaigns)[number] };
    };
    const body = (found: (typeof campaignState.campaigns)[number], over = {}) => {
      const { code: _code, ...rest } = campaignBody({
        facebookPixelId: found.facebookPixelId,
        name: found.name,
        ...over,
      });
      return rest;
    };

    // Answers 82. The alert is closed when the token is set (even to the same text), when the token
    // is cleared (null) and there was one, or when the pixel id is not what it was (also emptied).
    it('is closed when the administrator fills in the token again', async () => {
      const { id, found } = withAlert('token_unreadable');
      expect(open(id)).toHaveLength(1);
      await send(CAMPAIGN_UPDATE, body(found, { facebookAccessToken: 'a-new-secret' }), { id });
      expect(open(id)).toHaveLength(0);
    });

    it('is closed also when the token is the same text as the one stored', async () => {
      const { id, found } = withAlert('token_unreadable');
      found.facebookAccessToken = 'same-secret-1';
      await send(CAMPAIGN_UPDATE, body(found, { facebookAccessToken: 'same-secret-1' }), { id });
      expect(open(id)).toHaveLength(0);
      expect(found.facebookAccessToken).toBe('same-secret-1');
    });

    it('is closed when the token is cleared with null and there was one; not when there was none', async () => {
      const { id, found } = withAlert('190');
      found.facebookAccessToken = 'stored-secret';
      await send(CAMPAIGN_UPDATE, body(found, { facebookAccessToken: null }), { id });
      expect(open(id)).toHaveLength(0);
      expect(found.facebookAccessToken).toBeNull();
      raiseAlert({
        type: 'POSTBACK_CREDENTIAL_FAILED',
        refType: 'ATTRIBUTION_CAMPAIGN',
        refId: id,
        accountId: null,
        detail: '190',
      });
      expect(open(id)).toHaveLength(1);
      const cleared = await send(CAMPAIGN_UPDATE, body(found, { facebookAccessToken: null }), {
        id,
      });
      expect(cleared.status).toBe(200);
      expect(open(id)).toHaveLength(1);
    });

    it('is closed when the pixel id is changed, and is kept when neither it nor the token is', async () => {
      const { id, found } = withAlert('pixel_id_malformed');
      await send(CAMPAIGN_UPDATE, body(found, { name: 'Only a new name' }), { id });
      expect(open(id)).toHaveLength(1);
      await send(CAMPAIGN_UPDATE, body(found, { facebookPixelId: 'FB-OK-9' }), { id });
      expect(open(id)).toHaveLength(0);
    });

    it('is closed when the pixel id is emptied, and an update that only renames but leaves the pixel id out empties it', async () => {
      const { id, found } = withAlert('pixel_id_malformed');
      const { facebookPixelId: _pixel, ...withoutPixel } = body(found, { name: 'Just the name' });
      const renamed = await send(CAMPAIGN_UPDATE, withoutPixel, { id });
      expect(renamed.status).toBe(200);
      expect(renamed.body.data.facebookPixelId).toBeNull();
      expect(open(id)).toHaveLength(0);
      expect(found.name).toBe('Just the name');
    });

    it('is kept when only the name changes and the pixel id is sent as it was', async () => {
      const { id, found } = withAlert('token_unreadable');
      const sent = await send(
        CAMPAIGN_UPDATE,
        body(found, { name: 'Renamed ก ع 中', facebookPixelId: found.facebookPixelId }),
        { id },
      );
      expect(sent.status).toBe(200);
      expect(open(id)).toHaveLength(1);
    });

    it('is kept when the update is refused', async () => {
      const { id, found } = withAlert('190');
      const refused = await send(
        CAMPAIGN_UPDATE,
        body(found, { facebookAccessToken: '   ', name: '' }),
        { id },
      );
      expect(refused.status).toBe(400);
      expect(open(id)).toHaveLength(1);
    });
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
        'campaignCode',
        'campaignId',
        'campaignName',
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

  it('names the campaign in each row: campaignCode and campaignName, with the amount as a number', async () => {
    const rows = (await get(COSTS, { pageSize: '200' })).body.data.items;
    for (const row of rows) {
      const campaign = campaignState.campaigns.find((c) => c.id === row.campaignId);
      expect(row.campaignCode).toBe(campaign?.code);
      expect(row.campaignName).toBe(campaign?.name);
      expect(typeof row.amount).toBe('number');
    }
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

  it('checks the campaign (NOT_FOUND), the day, the amount (NEGATIVE, TOO_MANY_DECIMALS) and the currency (CURRENCY_MISMATCH) with the reasons of the backend', async () => {
    const refused = await send(
      COST_CREATE,
      costBody({ campaignId: '9999', statDate: '2026-02-30', amount: -1, currency: 'EUR' }),
    );
    expect(refused.status).toBe(400);
    expect(refs(refused.body as never).sort()).toEqual(
      [
        'amount:NEGATIVE',
        'campaignId:NOT_FOUND',
        'currency:CURRENCY_MISMATCH',
        'statDate:INVALID_FORMAT',
      ].sort(),
    );
    expect(refs((await send(COST_CREATE, costBody({ amount: 1.234 }))).body as never)).toEqual([
      'amount:TOO_MANY_DECIMALS',
    ]);
    expect(refs((await send(COST_CREATE, costBody({ amount: 1e16 }))).body as never)).toEqual([
      'amount:OUT_OF_RANGE',
    ]);
    expect(refs((await send(COST_CREATE, costBody({ amount: undefined }))).body as never)).toEqual([
      'amount:REQUIRED',
    ]);
    expect(refs((await send(COST_CREATE, costBody({ amount: 'abc' }))).body as never)).toEqual([
      'amount:INVALID_FORMAT',
    ]);
    expect(refs((await send(COST_CREATE, costBody({ amount: true }))).body as never)).toEqual([
      'amount:INVALID_TYPE',
    ]);
    expect((await send(COST_CREATE, costBody({ amount: 0 }))).status).toBe(200);
  });

  it('takes the amount as a JSON number or as a decimal written as text, and the currency may be left out', async () => {
    const asText = await send(COST_CREATE, costBody({ amount: '5.25', currency: undefined }));
    expect(asText.status).toBe(200);
    expect(asText.body.data).toMatchObject({ amount: 5.25, currency: 'USD' });
    expect(typeof asText.body.data.amount).toBe('number');
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
    expect(refs(moved.body as never)).toEqual(['statDate:IMMUTABLE']);
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
  /** `index:ref:reason`, or `ref:reason` for a problem of the whole batch (it has no index). */
  const places = (body: {
    data: { details?: { index?: number; ref: string; reason: string }[] };
  }) =>
    (body.data.details ?? []).map((d) =>
      d.index === undefined ? `${d.ref}:${d.reason}` : `${d.index}:${d.ref}:${d.reason}`,
    );

  it('makes new rows and overwrites the rows of a campaign and day that have one, and answers only { count } (the rows written, added and overwritten together)', async () => {
    const existing = campaignState.costs[0];
    const code = campaignState.campaigns.find((c) => c.id === existing.campaignId)?.code as string;
    const count = campaignState.costs.length;
    const result = await send(BATCH, [
      batchRow({ campaignCode: code, statDate: existing.statDate, amount: 777.77, remark: 'over' }),
      batchRow({ statDate: '2026-01-01', amount: 1.5 }),
    ]);
    expect(result.status).toBe(200);
    expect(campaignState.costs).toHaveLength(count + 1);
    // no split of added and overwritten: the backend has none yet (a request to it)
    expect(result.body.data).toEqual({ count: 2 });
    const overwritten = campaignState.costs.find((c) => c.id === existing.id);
    expect(overwritten).toMatchObject({ amount: 777.77, remark: 'over' });
  });

  it('takes the amount as a number or as text, and the currency may be left out', async () => {
    const result = await send(BATCH, [
      batchRow({ statDate: '2026-01-01', amount: '12.50', currency: undefined }),
      batchRow({ statDate: '2026-01-02', amount: 3, currency: '' }),
    ]);
    expect(result.status).toBe(200);
    const stored = campaignState.costs.find((c) => c.statDate === '2026-01-01');
    expect(stored).toMatchObject({ amount: 12.5, currency: 'USD' });
  });

  it('refuses the whole batch when one row is bad, and changes nothing, with { index (from 0), ref (the field), reason } for each problem, all of them at once', async () => {
    const count = campaignState.costs.length;
    const result = await send(BATCH, [
      batchRow(),
      batchRow({ statDate: '2026-09-02', amount: -3 }),
      batchRow({ statDate: '2026-09-03', campaignCode: 'no_such_code' }),
      batchRow({ statDate: '2026-09-04', currency: 'EUR' }),
      batchRow({ statDate: '2026-09-05', amount: 1.234 }),
      batchRow({ statDate: '2026-09-06', amount: 1e16 }),
      batchRow({ statDate: '2026-09-07', amount: undefined }),
    ]);
    expect(result.status).toBe(400);
    expect(result.body.code).toBe('INVALID_REQUEST');
    expect(places(result.body as never).sort()).toEqual(
      [
        '1:amount:NEGATIVE',
        '2:campaignCode:NOT_FOUND',
        '3:currency:CURRENCY_MISMATCH',
        '4:amount:TOO_MANY_DECIMALS',
        '5:amount:OUT_OF_RANGE',
        '6:amount:REQUIRED',
      ].sort(),
    );
    // index is a number of its own, ref is not "<index>.<field>"
    const first = (result.body.data as { details: { index: unknown; ref: string }[] }).details[0];
    expect(typeof first.index).toBe('number');
    expect(first.ref).not.toMatch(/\d/);
    expect(campaignState.costs).toHaveLength(count);
  });

  it('gives every row of a campaign and day that comes twice its own DUPLICATE entry', async () => {
    const count = campaignState.costs.length;
    const result = await send(BATCH, [
      batchRow(),
      batchRow({ statDate: '2026-09-02' }),
      batchRow({ amount: 9 }),
      batchRow({ amount: 10 }),
    ]);
    expect(result.status).toBe(400);
    expect(places(result.body as never).sort()).toEqual(
      ['0:campaignCode:DUPLICATE', '2:campaignCode:DUPLICATE', '3:campaignCode:DUPLICATE'].sort(),
    );
    expect(campaignState.costs).toHaveLength(count);
  });

  it('names a remark that is too long or has a control character, a row that is not an object, and a missing code or day', async () => {
    const result = await send(BATCH, [
      batchRow({ remark: 'ก'.repeat(501) }),
      batchRow({ statDate: '2026-09-02', remark: 'a\u0001b' }),
      'not an object',
      batchRow({ statDate: '2026-09-03', campaignCode: undefined }),
      batchRow({ statDate: undefined }),
    ]);
    expect(places(result.body as never).sort()).toEqual(
      [
        '0:remark:TOO_LONG',
        '1:remark:CONTROL_CHARACTER',
        '2:line:INVALID_TYPE',
        '3:campaignCode:REQUIRED',
        '4:statDate:REQUIRED',
      ].sort(),
    );
  });

  it('refuses more rows than attribution.cost_batch_max before it reads any row, and anything that is not a non-empty list, with no index', async () => {
    saved.set('attribution.cost_batch_max', {
      value: 2,
      updatedAt: '',
      updatedBy: '',
      updatedByUsername: '',
    });
    const three = await send(BATCH, [
      batchRow(),
      batchRow({ statDate: '2026-09-02', amount: -1 }),
      batchRow({ statDate: '2026-09-03' }),
    ]);
    expect(three.status).toBe(400);
    expect(places(three.body as never)).toEqual(['body:OUT_OF_RANGE']);
    expect(places((await send(BATCH, { not: 'a list' })).body as never)).toEqual([
      'body:INVALID_TYPE',
    ]);
    expect(places((await send(BATCH, [])).body as never)).toEqual(['body:REQUIRED']);
  });
});

describe('the performance', () => {
  const rows = async (query: Record<string, unknown>) =>
    (await get(PERFORMANCE, { from: '2026-10-20', to: '2026-10-26', ...query })).body.data
      .items as Record<string, unknown>[];

  it('has a row for each campaign, with the figures of the contract, and one row for the installs that matched no campaign (campaignId is a number, 0 for that row)', async () => {
    const items = await rows({ groupBy: 'campaign' });
    const real = items.filter((r) => r.campaignId !== 0);
    expect(real.length).toBe(campaignState.campaigns.length);
    for (const row of real) {
      for (const field of ['pageViews', 'clicks', 'installs', 'registered', 'cost']) {
        expect(row, field).toHaveProperty(field);
      }
      expect(typeof row.campaignId).toBe('number');
    }
    const organic = items.filter((r) => r.campaignId === 0);
    expect(organic).toHaveLength(1);
    expect(typeof organic[0].unattributedInstalls).toBe('number');
    // the row of the unattributed installs has nothing else, and it is the last
    expect(Object.keys(organic[0]).sort()).toEqual(['campaignId', 'unattributedInstalls']);
    expect(items[items.length - 1]).toBe(organic[0]);
  });

  it('names each campaign in its row (campaignCode, campaignName) and sends cost, cpa and cpi as numbers', async () => {
    const items = await rows({ groupBy: 'campaign' });
    for (const campaign of campaignState.campaigns) {
      const row = items.find((r) => r.campaignId === Number(campaign.id));
      expect(row?.campaignCode, campaign.code).toBe(campaign.code);
      expect(row?.campaignName, campaign.code).toBe(campaign.name);
    }
    for (const row of items.filter((r) => r.campaignId !== 0)) {
      expect(typeof row.cost).toBe('number');
      for (const field of ['cpa', 'cpi']) {
        expect(row[field] === null || typeof row[field] === 'number', field).toBe(true);
      }
    }
  });

  it('puts the row of the unattributed installs last when grouped by day too: no statDate, only campaignId 0 and unattributedInstalls; day rows have no campaignId', async () => {
    const items = await rows({ groupBy: 'day' });
    const last = items[items.length - 1];
    expect(last).toEqual({ campaignId: 0, unattributedInstalls: expect.any(Number) });
    const days = items.slice(0, -1);
    expect(days).toHaveLength(7);
    for (const day of days) {
      expect(typeof day.statDate).toBe('string');
      expect(day).not.toHaveProperty('campaignId');
      expect(day).not.toHaveProperty('unattributedInstalls');
    }
    // the same count as the row of the campaign grouping: the whole range
    const byCampaign = await rows({ groupBy: 'campaign' });
    expect(last.unattributedInstalls).toBe(byCampaign[byCampaign.length - 1].unattributedInstalls);
  });

  it('has no row of unattributed installs when one campaign is asked for, in either grouping', async () => {
    for (const groupBy of ['campaign', 'day']) {
      const items = await rows({ groupBy, campaignId: '1' });
      expect(
        items.some((r) => 'unattributedInstalls' in r),
        groupBy,
      ).toBe(false);
    }
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
    // the last row of the all-campaigns reading is the unattributed installs, not a day
    const all = (await rows({ groupBy: 'day' })).filter((r) => 'statDate' in r);
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
        campaigns.filter((r) => r.campaignId !== 0),
        'clicks',
      ),
    );
    const one = await rows({ groupBy: 'day', campaignId: '2' });
    expect(one).toHaveLength(7);
    expect(sum(one, 'clicks')).toBe(
      sum(
        campaigns.filter((r) => r.campaignId === 2),
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
  });

  it('reads from and to as UTC days YYYY-MM-DD, both included: the last day is in, the day after is not (backend reply 76)', async () => {
    const everything = (await list()).items;
    const day = String(everything[3].clickedAt).slice(0, 10);
    const sameDay = (await list({ from: day, to: day })).items;
    expect(sameDay.length).toBeGreaterThan(0);
    expect(sameDay.every((c) => String(c.clickedAt).slice(0, 10) === day)).toBe(true);
    expect(sameDay.some((c) => c.clickedAt === everything[3].clickedAt)).toBe(true);
    const next = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    expect(
      (await list({ to: day })).items.every((c) => String(c.clickedAt).slice(0, 10) <= day),
    ).toBe(true);
    expect(
      (await list({ from: next, to: next })).items.every(
        (c) => String(c.clickedAt).slice(0, 10) === next,
      ),
    ).toBe(true);
    // every click of the range, nothing more: from the day to the day after is two days
    const twoDays = (await list({ from: day, to: next })).items;
    expect(twoDays.length).toBe(
      everything.filter((c) => [day, next].includes(String(c.clickedAt).slice(0, 10))).length,
    );
  });

  it('refuses a time with hours (an instant) in from or to, a day that does not exist, and from after to, each as OUT_OF_RANGE on the field', async () => {
    const instant = await get(CLICKS, { from: '2026-10-20T00:00:00Z', to: '2026-10-27T00:00:00Z' });
    expect(instant.status).toBe(400);
    expect(refs(instant.body as never).sort()).toEqual(['from:OUT_OF_RANGE', 'to:OUT_OF_RANGE']);
    expect(refs((await get(CLICKS, { to: '2026-02-30' })).body as never)).toEqual([
      'to:OUT_OF_RANGE',
    ]);
    const reversed = await get(CLICKS, { from: '2026-10-26', to: '2026-10-20' });
    expect(reversed.status).toBe(400);
    expect((await get(CLICKS, { from: '2026-10-20', to: '2026-10-20' })).status).toBe(200);
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

  it('matches the keyword in the UTM source, medium and campaign, each by itself and never across two of them', async () => {
    Object.assign(campaignState.clicks[0], {
      utmSource: 'qzxSrc',
      utmMedium: 'qzxMed',
      utmCampaign: 'qzxCmp',
    });
    const ids = async (keyword: string) =>
      (await list({ keyword })).items.map((c) => c.id as string);
    const first = campaignState.clicks[0].id;
    expect(await ids('QZXMED')).toContain(first);
    expect(await ids('qzxsrc qzxmed')).toEqual([]);
    expect(await ids('SrcqzxMed')).toEqual([]);
  });

  it('refuses a keyword of more than 200 characters (400, keyword, TOO_LONG) and one with U+0000 (400, keyword, INVALID_FORMAT)', async () => {
    expect((await get(CLICKS, { keyword: '🎉'.repeat(200) })).status).toBe(200);
    const long = await get(CLICKS, { keyword: 'x'.repeat(201) });
    expect(long.status).toBe(400);
    expect(long.body.code).toBe('INVALID_REQUEST');
    expect(refs(long.body as never)).toEqual(['keyword:TOO_LONG']);
    const nul = await get(CLICKS, { keyword: 'a\u0000b' });
    expect(nul.status).toBe(400);
    expect(nul.body.code).toBe('INVALID_REQUEST');
    expect(refs(nul.body as never)).toEqual(['keyword:INVALID_FORMAT']);
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

  it('gives an empty text, never null, as the key of the records that have no media source or no campaign', async () => {
    const installs = campaignState.records.filter(
      (r) => r.eventName === 'install' && r.installTime !== null,
    );
    for (const r of installs) {
      r.mediaSource = null;
      r.campaign = null;
    }
    for (const groupBy of ['media_source', 'campaign']) {
      const rows = await summary({ groupBy });
      expect(rows.length, groupBy).toBeGreaterThan(0);
      for (const row of rows) expect(row.key, groupBy).toBe('');
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
