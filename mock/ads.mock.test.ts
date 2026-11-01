import { beforeEach, describe, expect, it } from 'vitest';
import { must } from '../tests/must';
import { adsState, resetAdsStore } from './_core/adsData';
import { resetConfigStore, saved } from './_core/configStore';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import ads from './ads.mock';

const NOW = new Date('2026-10-26T10:00:00Z');

beforeEach(() => {
  resetStore();
  resetConfigStore();
  resetAdsStore(NOW);
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (ads as unknown as Record<string, H>)[name];
const token = (user: string) => bearer(issueToken(adminOf(user)).token).authorization;

// A query string holds text only, so the numbers of a test are turned into text first.
const asText = (query: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(query).map(([key, value]) => [key, String(value)]));
const get = (name: string, query: Record<string, unknown> = {}, params = {}, user = 'root') =>
  call(h(name), { headers: { authorization: token(user) }, query: asText(query), params });
const send = (name: string, body: unknown, params = {}, user = 'root') =>
  call(h(name), { headers: { authorization: token(user) }, body, params });

/** An administrator with exactly these permissions. */
const only = (...codes: string[]) => {
  const admin = adminOf('support');
  admin.permissions = codes as typeof admin.permissions;
  return 'support';
};

const CAMPAIGNS = 'GET /api/admin/ads/campaigns';
const CAMPAIGN_CREATE = 'POST /api/admin/ads/campaigns';
const CAMPAIGN_ONE = 'GET /api/admin/ads/campaigns/:id';
const CAMPAIGN_UPDATE = 'PUT /api/admin/ads/campaigns/:id';
const CAMPAIGN_STATUS = 'PUT /api/admin/ads/campaigns/:id/status';
const CAMPAIGN_DELETE = 'DELETE /api/admin/ads/campaigns/:id';
const PLACEMENTS = 'GET /api/admin/ads/placements';
const PLACEMENT_UPDATE = 'PUT /api/admin/ads/placements/:id';
const UNITS = 'GET /api/admin/ads/units';
const UNIT_CREATE = 'POST /api/admin/ads/units';
const UNIT_ONE = 'GET /api/admin/ads/units/:id';
const UNIT_UPDATE = 'PUT /api/admin/ads/units/:id';
const UNIT_STATUS = 'PUT /api/admin/ads/units/:id/status';
const UNIT_DELETE = 'DELETE /api/admin/ads/units/:id';
const CREATIVES = 'GET /api/admin/ads/creatives';
const CREATIVE_CREATE = 'POST /api/admin/ads/creatives';
const CREATIVE_UPDATE = 'PUT /api/admin/ads/creatives/:id';
const CREATIVE_REVIEW = 'PUT /api/admin/ads/creatives/:id/review';
const CREATIVE_SERVING = 'PUT /api/admin/ads/creatives/:id/serving-status';
const CREATIVE_DELETE = 'DELETE /api/admin/ads/creatives/:id';
const MEDIA = 'POST /api/admin/ads/media';
const META = 'GET /api/admin/ads/meta';
const REPORT = (name: string) => `GET /api/admin/ads/report/${name}`;

const refs = (answer: { body: { data: { details?: { ref: string; reason: string }[] } } }) =>
  (answer.body.data?.details ?? []).map((d) => `${d.ref}:${d.reason}`);

const findBy = async <T>(name: string, query: Record<string, unknown>) =>
  (await get(name, { pageSize: 200, ...query })).body.data.items as T[];

describe('the permissions', () => {
  it('lets each list be read with its own code and with the codes of the pages that pick from it, and nothing else', async () => {
    const cases: [string, string[], string[]][] = [
      [CAMPAIGNS, ['ADS:CAMPAIGN', 'ADS:UNIT', 'ADS:CREATIVE'], ['ADS:PLACEMENT', 'ADS:REPORT']],
      [PLACEMENTS, ['ADS:PLACEMENT', 'ADS:UNIT'], ['ADS:CAMPAIGN', 'ADS:CREATIVE', 'ADS:REPORT']],
      [UNITS, ['ADS:UNIT', 'ADS:CREATIVE'], ['ADS:CAMPAIGN', 'ADS:PLACEMENT', 'ADS:REPORT']],
      [CREATIVES, ['ADS:CREATIVE'], ['ADS:UNIT', 'ADS:CAMPAIGN', 'ADS:PLACEMENT', 'ADS:REPORT']],
    ];
    for (const [name, allowed, refused] of cases) {
      for (const code of allowed)
        expect((await get(name, {}, {}, only(code))).status, `${name} ${code}`).toBe(200);
      for (const code of refused) {
        const answer = await get(name, {}, {}, only(code));
        expect(answer.status, `${name} ${code}`).toBe(403);
        expect(answer.body.code).toBe('ADMIN_FORBIDDEN');
      }
    }
  });

  it('asks for the code of the resource on every write, and for the report code on the six reports', async () => {
    const writes: [string, string][] = [
      [CAMPAIGN_CREATE, 'ADS:CAMPAIGN'],
      [CAMPAIGN_UPDATE, 'ADS:CAMPAIGN'],
      [CAMPAIGN_STATUS, 'ADS:CAMPAIGN'],
      [CAMPAIGN_DELETE, 'ADS:CAMPAIGN'],
      [PLACEMENT_UPDATE, 'ADS:PLACEMENT'],
      [UNIT_CREATE, 'ADS:UNIT'],
      [UNIT_UPDATE, 'ADS:UNIT'],
      [UNIT_STATUS, 'ADS:UNIT'],
      [UNIT_DELETE, 'ADS:UNIT'],
      [CREATIVE_CREATE, 'ADS:CREATIVE'],
      [CREATIVE_UPDATE, 'ADS:CREATIVE'],
      [CREATIVE_REVIEW, 'ADS:CREATIVE'],
      [CREATIVE_SERVING, 'ADS:CREATIVE'],
      [CREATIVE_DELETE, 'ADS:CREATIVE'],
      [MEDIA, 'ADS:CREATIVE'],
    ];
    const others = ['ADS:CAMPAIGN', 'ADS:PLACEMENT', 'ADS:UNIT', 'ADS:CREATIVE', 'ADS:REPORT'];
    for (const [name, code] of writes) {
      for (const other of others.filter((c) => c !== code)) {
        const answer = await send(name, {}, { id: '1' }, only(other));
        expect(answer.status, `${name} with ${other}`).toBe(403);
      }
    }
    for (const name of [
      'overview',
      'by-placement',
      'by-campaign',
      'by-creative',
      'by-country',
      'nofill',
    ]) {
      expect((await get(REPORT(name), {}, {}, only('ADS:REPORT'))).status, name).toBe(200);
      expect((await get(REPORT(name), {}, {}, only('ADS:UNIT'))).status, name).toBe(403);
    }
  });

  it('lets any ads code read the meta, and nothing else', async () => {
    for (const code of [
      'ADS:CAMPAIGN',
      'ADS:PLACEMENT',
      'ADS:UNIT',
      'ADS:CREATIVE',
      'ADS:REPORT',
    ]) {
      expect((await get(META, {}, {}, only(code))).status, code).toBe(200);
    }
    expect((await get(META, {}, {}, only('USER:VIEW'))).status).toBe(403);
  });

  it('answers 401 without a token', async () => {
    const answer = await call(h(CAMPAIGNS), { headers: {} });
    expect(answer.status).toBe(401);
  });
});

describe('the campaigns', () => {
  it('lists with total and paging, filters by name (contains, any case) and status, and refuses a page size above 200', async () => {
    const all = await get(CAMPAIGNS, { pageSize: 200 });
    expect(all.body.data.total).toBeGreaterThanOrEqual(8);
    const statuses = new Set(all.body.data.items.map((c: { status: string }) => c.status));
    expect(statuses).toEqual(new Set(['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED']));
    const second = await get(CAMPAIGNS, { page: 2, pageSize: 3 });
    expect(second.body.data.items).toHaveLength(3);
    expect(second.body.data.total).toBe(all.body.data.total);
    const ended = await get(CAMPAIGNS, { status: 'ENDED', pageSize: 200 });
    expect(ended.body.data.items.every((c: { status: string }) => c.status === 'ENDED')).toBe(true);
    const named = await get(CAMPAIGNS, {
      name: all.body.data.items[0].name.slice(1, 5).toUpperCase(),
    });
    expect(named.body.data.items.map((c: { id: string }) => c.id)).toContain(
      all.body.data.items[0].id,
    );
    const bad = await get(CAMPAIGNS, { pageSize: 201 });
    expect(bad.status).toBe(400);
    expect(refs(bad)).toEqual(['pageSize:OUT_OF_RANGE']);
    expect((await get(CAMPAIGNS, { status: 'WRONG' })).status).toBe(400);
  });

  it('shows the names of the administrators next to their ids, and null for one that has been deleted', async () => {
    const row = (await get(CAMPAIGNS, { pageSize: 200 })).body.data.items[0];
    expect(row.createdByUsername).toBe('root');
    expect(row).toHaveProperty('updatedByUsername');
    must(adsState.campaigns.get(row.id)).createdBy = 'gone';
    const again = (await get(CAMPAIGNS, { pageSize: 200 })).body.data.items.find(
      (c: { id: string }) => c.id === row.id,
    );
    expect(again.createdBy).toBe('gone');
    expect(again.createdByUsername).toBeNull();
  });

  it('creates a draft with the priority 100 by default, the creator and the trimmed words, and lists it', async () => {
    const created = await send(CAMPAIGN_CREATE, { name: '  Mới 🚀  ' });
    expect(created.status).toBe(200);
    expect(created.body.data).toMatchObject({
      name: 'Mới 🚀',
      status: 'DRAFT',
      priority: 100,
      description: null,
      startAt: null,
      endAt: null,
      createdByUsername: 'root',
    });
    const listed = await get(CAMPAIGNS, { name: 'Mới', pageSize: 200 });
    expect(listed.body.data.items.map((c: { id: string }) => c.id)).toContain(created.body.data.id);
  });

  it('refuses a name that is empty after trimming, a bad priority, a bad time, and an end before the start, with the field in the details', async () => {
    expect(refs(await send(CAMPAIGN_CREATE, { name: `${String.fromCharCode(0x3000)} ` }))).toEqual([
      'name:EMPTY_NOT_ALLOWED',
    ]);
    expect(refs(await send(CAMPAIGN_CREATE, { name: 'a', priority: 1.5 }))).toEqual([
      'priority:NOT_AN_INTEGER',
    ]);
    expect(refs(await send(CAMPAIGN_CREATE, { name: 'a', startAt: 'tomorrow' }))).toEqual([
      'startAt:OUT_OF_RANGE',
    ]);
    const reversed = await send(CAMPAIGN_CREATE, {
      name: 'a',
      startAt: '2026-11-02T00:00:00Z',
      endAt: '2026-11-01T00:00:00Z',
    });
    expect(reversed.status).toBe(400);
    expect(refs(reversed)).toEqual(['endAt:OUT_OF_RANGE']);
    const same = await send(CAMPAIGN_CREATE, {
      name: 'a',
      startAt: '2026-11-01T00:00:00Z',
      endAt: '2026-11-01T00:00:00Z',
    });
    expect(same.status).toBe(200);
  });

  it('updates like a merge patch: what is not sent stays, an explicit null clears', async () => {
    const created = await send(CAMPAIGN_CREATE, {
      name: 'x',
      description: 'd',
      priority: 5,
      startAt: '2026-11-01T00:00:00Z',
      endAt: '2026-12-01T00:00:00Z',
    });
    const id = created.body.data.id;
    const patched = await send(CAMPAIGN_UPDATE, { name: 'y', endAt: null }, { id });
    expect(patched.body.data).toMatchObject({
      name: 'y',
      description: 'd',
      priority: 5,
      startAt: '2026-11-01T00:00:00Z',
      endAt: null,
    });
    expect((await send(CAMPAIGN_UPDATE, { name: null }, { id })).status).toBe(400);
    expect((await get(CAMPAIGN_ONE, {}, { id })).body.data.name).toBe('y');
  });

  it('does not change an ended campaign: 409 INVALID_STATE with the state', async () => {
    const ended = (await findBy<{ id: string }>(CAMPAIGNS, { status: 'ENDED' }))[0];
    const answer = await send(CAMPAIGN_UPDATE, { name: 'z' }, { id: ended.id });
    expect(answer.status).toBe(409);
    expect(answer.body.code).toBe('INVALID_STATE');
    expect(answer.body.data.status).toBe('ENDED');
  });

  it('knows no campaign that is not there: 404', async () => {
    expect((await get(CAMPAIGN_ONE, {}, { id: 'nope' })).status).toBe(404);
    expect((await send(CAMPAIGN_UPDATE, { name: 'a' }, { id: 'nope' })).status).toBe(404);
    expect((await send(CAMPAIGN_STATUS, { status: 'ACTIVE' }, { id: 'nope' })).status).toBe(404);
    expect((await send(CAMPAIGN_DELETE, {}, { id: 'nope' })).status).toBe(404);
  });

  it('moves between states as the contract says: DRAFT to ACTIVE, ACTIVE and PAUSED both ways, any live state to ENDED, nothing out of ENDED', async () => {
    const id = (await send(CAMPAIGN_CREATE, { name: 'life' })).body.data.id;
    const to = async (status: string) => send(CAMPAIGN_STATUS, { status }, { id });
    expect((await to('PAUSED')).status).toBe(409);
    expect((await to('ACTIVE')).body.data.status).toBe('ACTIVE');
    expect((await to('PAUSED')).body.data.status).toBe('PAUSED');
    expect((await to('ACTIVE')).body.data.status).toBe('ACTIVE');
    expect((await to('DRAFT')).status).toBe(409);
    expect((await to('ENDED')).body.data.status).toBe('ENDED');
    const refused = await to('ACTIVE');
    expect(refused.status).toBe(409);
    expect(refused.body.data.status).toBe('ENDED');
    expect((await to('NONSENSE')).status).toBe(400);
  });

  it('deletes a draft, or an ended one with no unit; not an active one, and not one that has a unit', async () => {
    const campaigns = await findBy<{ id: string; status: string }>(CAMPAIGNS, {});
    const units = await findBy<{ campaignId: string }>(UNITS, {});
    const hasUnit = (id: string) => units.some((u) => u.campaignId === id);
    const active = must(campaigns.find((c) => c.status === 'ACTIVE'));
    expect((await send(CAMPAIGN_DELETE, {}, { id: active.id })).status).toBe(409);
    const endedWithUnit = must(campaigns.find((c) => c.status === 'ENDED' && hasUnit(c.id)));
    const refused = await send(CAMPAIGN_DELETE, {}, { id: endedWithUnit.id });
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('INVALID_STATE');
    const draftWithUnit = campaigns.find((c) => c.status === 'DRAFT' && hasUnit(c.id));
    if (draftWithUnit)
      expect((await send(CAMPAIGN_DELETE, {}, { id: draftWithUnit.id })).status).toBe(409);
    const endedFree = must(campaigns.find((c) => c.status === 'ENDED' && !hasUnit(c.id)));
    expect((await send(CAMPAIGN_DELETE, {}, { id: endedFree.id })).status).toBe(200);
    const draftFree = must(campaigns.find((c) => c.status === 'DRAFT' && !hasUnit(c.id)));
    expect((await send(CAMPAIGN_DELETE, {}, { id: draftFree.id })).status).toBe(200);
    expect((await get(CAMPAIGN_ONE, {}, { id: endedFree.id })).status).toBe(404);
  });
});

describe('the placements', () => {
  it('has the four preset placements with their formats, the spec 9:16, 720 and 10 MB, and no cooldown on the rewarded one', async () => {
    const rows = (await get(PLACEMENTS)).body.data.items;
    expect(rows.map((p: { slotKey: string; adFormat: string }) => [p.slotKey, p.adFormat])).toEqual(
      [
        ['app_open', 'SPLASH'],
        ['call_end', 'INTERSTITIAL'],
        ['history_feed', 'NATIVE'],
        ['reward_credits', 'REWARDED'],
      ],
    );
    for (const row of rows) {
      expect(row).toMatchObject({
        creativeAspect: '9:16',
        creativeMinShortSide: 720,
        creativeMaxBytes: 10485760,
      });
    }
    const rewarded = rows[3];
    expect(rewarded.cooldownMinutes).toBeNull();
    expect(rewarded.frequencyCap).toBeGreaterThan(0);
    expect(rewarded.rewardCredits).toBeGreaterThan(0);
    expect(rows[0].rewardCredits).toBeNull();
  });

  it('has no way to add or delete one', () => {
    expect(Object.keys(ads).filter((k) => k.includes('/ads/placements'))).toEqual([
      PLACEMENTS,
      PLACEMENT_UPDATE,
    ]);
  });

  it('changes the enabled flag alone, and the other numbers alone', async () => {
    const [open] = (await get(PLACEMENTS)).body.data.items;
    const off = await send(PLACEMENT_UPDATE, { enabled: false }, { id: open.id });
    expect(off.body.data).toMatchObject({ enabled: false, frequencyCap: open.frequencyCap });
    const capped = await send(
      PLACEMENT_UPDATE,
      { frequencyCap: 0, cooldownMinutes: 0 },
      { id: open.id },
    );
    expect(capped.body.data).toMatchObject({ enabled: false, frequencyCap: 0, cooldownMinutes: 0 });
  });

  it('refuses a rewarded frequency cap of 0 and a reward of 0 or less, and a reward or a cooldown on a placement that has none', async () => {
    const rows = (await get(PLACEMENTS)).body.data.items;
    const rewarded = rows[3];
    expect(refs(await send(PLACEMENT_UPDATE, { frequencyCap: 0 }, { id: rewarded.id }))).toEqual([
      'frequencyCap:OUT_OF_RANGE',
    ]);
    expect(refs(await send(PLACEMENT_UPDATE, { rewardCredits: 0 }, { id: rewarded.id }))).toEqual([
      'rewardCredits:OUT_OF_RANGE',
    ]);
    expect(refs(await send(PLACEMENT_UPDATE, { rewardCredits: 5 }, { id: rows[0].id }))).toEqual([
      'rewardCredits:OUT_OF_RANGE',
    ]);
    expect(refs(await send(PLACEMENT_UPDATE, { cooldownMinutes: 5 }, { id: rewarded.id }))).toEqual(
      ['cooldownMinutes:OUT_OF_RANGE'],
    );
    expect(refs(await send(PLACEMENT_UPDATE, { frequencyCap: -1 }, { id: rows[0].id }))).toEqual([
      'frequencyCap:OUT_OF_RANGE',
    ]);
    expect(refs(await send(PLACEMENT_UPDATE, { frequencyCap: 1.5 }, { id: rows[0].id }))).toEqual([
      'frequencyCap:NOT_AN_INTEGER',
    ]);
    expect(refs(await send(PLACEMENT_UPDATE, { enabled: 'yes' }, { id: rows[0].id }))).toEqual([
      'enabled:NOT_BOOLEAN',
    ]);
    const same = (await get(PLACEMENTS)).body.data.items[3];
    expect(same.frequencyCap).toBe(rewarded.frequencyCap);
  });

  it('says 404 for a placement that is not there', async () => {
    expect((await send(PLACEMENT_UPDATE, { enabled: true }, { id: 'nope' })).status).toBe(404);
  });
});

describe('the units', () => {
  it('lists with its filters and shows the units of the seed with their targeting', async () => {
    const all = await findBy<{
      id: string;
      campaignId: string;
      placementId: string;
      status: string;
      targeting: unknown;
    }>(UNITS, {});
    expect(all.length).toBeGreaterThanOrEqual(6);
    const first = all[0];
    const byCampaign = await findBy<{ campaignId: string }>(UNITS, {
      campaignId: first.campaignId,
    });
    expect(byCampaign.every((u) => u.campaignId === first.campaignId)).toBe(true);
    const byPlacement = await findBy<{ placementId: string }>(UNITS, {
      placementId: first.placementId,
    });
    expect(byPlacement.every((u) => u.placementId === first.placementId)).toBe(true);
    const drafts = await findBy<{ status: string }>(UNITS, { status: 'DRAFT' });
    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts.every((u) => u.status === 'DRAFT')).toBe(true);
    expect(all.some((u) => (u.targeting as { geo?: string[] } | null)?.geo?.length)).toBe(true);
    expect(
      all.some((u) => (u.targeting as { day_parts?: unknown[] } | null)?.day_parts?.length),
    ).toBe(true);
    const zero = all.find((u) => (u as unknown as { weight: number }).weight === 0);
    expect(zero).toBeDefined();
  });

  it('gives one unit with the list of its creatives', async () => {
    const one = await get(UNIT_ONE, {}, { id: '1' });
    expect(one.status).toBe(200);
    expect(one.body.data.id).toBe('1');
    expect(Array.isArray(one.body.data.creatives)).toBe(true);
    expect(one.body.data.creatives.length).toBeGreaterThan(0);
    expect((await get(UNIT_ONE, {}, { id: 'nope' })).status).toBe(404);
  });

  const unitBody = (over: Record<string, unknown> = {}) => ({
    campaignId: '2',
    placementId: '1',
    name: 'Mới',
    weight: 100,
    dailyImpressionCap: 0,
    targeting: {},
    ...over,
  });

  it('creates a draft unit, with the checks of the fields', async () => {
    const created = await send(UNIT_CREATE, unitBody({ weight: 0 }));
    expect(created.status).toBe(200);
    expect(created.body.data).toMatchObject({ status: 'DRAFT', weight: 0, dailyImpressionCap: 0 });
    expect(refs(await send(UNIT_CREATE, unitBody({ name: ' ' })))).toEqual([
      'name:EMPTY_NOT_ALLOWED',
    ]);
    expect(refs(await send(UNIT_CREATE, unitBody({ weight: -1 })))).toEqual([
      'weight:OUT_OF_RANGE',
    ]);
    expect(refs(await send(UNIT_CREATE, unitBody({ dailyImpressionCap: -1 })))).toEqual([
      'dailyImpressionCap:OUT_OF_RANGE',
    ]);
    expect((await send(UNIT_CREATE, unitBody({ campaignId: 'nope' }))).status).toBe(404);
    expect((await send(UNIT_CREATE, unitBody({ placementId: 'nope' }))).status).toBe(404);
  });

  it('does not put a unit into an ended campaign', async () => {
    const ended = (await findBy<{ id: string }>(CAMPAIGNS, { status: 'ENDED' }))[0];
    const answer = await send(UNIT_CREATE, unitBody({ campaignId: ended.id }));
    expect(answer.status).toBe(409);
    expect(answer.body.data.status).toBe('ENDED');
  });

  it('checks the targeting by the rules of 22.5 and points at the field', async () => {
    const bad = async (targeting: unknown) =>
      refs(await send(UNIT_CREATE, unitBody({ targeting })));
    expect(await bad({ unknown_key: 1 })).toEqual(['targeting.unknown_key:OUT_OF_RANGE']);
    expect(await bad({ platforms: ['WEB'] })).toEqual(['targeting.platforms:OUT_OF_RANGE']);
    expect(await bad({ geo: ['th'] })).toEqual(['targeting.geo:OUT_OF_RANGE']);
    expect(await bad({ geo: 'TH' })).toEqual(['targeting.geo:OUT_OF_RANGE']);
    expect(await bad({ os_version_min: 'abc' })).toEqual(['targeting.os_version_min:OUT_OF_RANGE']);
    expect(await bad({ app_version_min: '1..2' })).toEqual([
      'targeting.app_version_min:OUT_OF_RANGE',
    ]);
    expect(await bad({ languages: ['not a tag'] })).toEqual([
      'targeting.languages:INVALID_LANGUAGE_TAG',
    ]);
    expect(await bad({ day_parts: [{ start: '25:00', end: '1:00' }] })).toEqual([
      'targeting.day_parts:OUT_OF_RANGE',
    ]);
    expect(await bad({ day_parts: [{ start: '8:00' }] })).toEqual([
      'targeting.day_parts:OUT_OF_RANGE',
    ]);
    expect(await bad('x')).toEqual(['targeting:OUT_OF_RANGE']);
    const fine = await send(
      UNIT_CREATE,
      unitBody({
        targeting: {
          platforms: ['ANDROID'],
          geo: ['TH', 'ID'],
          os_version_min: '13',
          app_version_min: '1.2.3',
          languages: ['th', 'ar-SA'],
          day_parts: [{ start: '23:00', end: '2:00' }],
        },
      }),
    );
    expect(fine.status).toBe(200);
  });

  it('updates name, targeting, weight and cap only; a null in the targeting removes that key; the campaign and the placement stay', async () => {
    const before = (await get(UNIT_ONE, {}, { id: '1' })).body.data;
    expect(before.targeting.geo).toEqual(['TH', 'ID']);
    const after = await send(
      UNIT_UPDATE,
      {
        name: 'New name',
        targeting: { geo: null, app_version_min: '2.0' },
        campaignId: '99',
        placementId: '99',
      },
      { id: '1' },
    );
    expect(after.body.data.name).toBe('New name');
    expect(after.body.data.targeting).not.toHaveProperty('geo');
    expect(after.body.data.targeting.app_version_min).toBe('2.0');
    expect(after.body.data.targeting.platforms).toEqual(before.targeting.platforms);
    expect(after.body.data.campaignId).toBe(before.campaignId);
    expect(after.body.data.placementId).toBe(before.placementId);
  });

  it('moves between states: DRAFT to ACTIVE, ACTIVE and PAUSED both ways; never back to DRAFT, never to ENDED', async () => {
    const id = (await send(UNIT_CREATE, unitBody())).body.data.id;
    const to = (status: string) => send(UNIT_STATUS, { status }, { id });
    expect((await to('PAUSED')).status).toBe(409);
    expect((await to('ACTIVE')).body.data.status).toBe('ACTIVE');
    expect((await to('PAUSED')).body.data.status).toBe('PAUSED');
    expect((await to('ACTIVE')).body.data.status).toBe('ACTIVE');
    const back = await to('DRAFT');
    expect(back.status).toBe(409);
    expect(back.body.data.status).toBe('ACTIVE');
    expect((await to('ENDED')).status).toBe(400);
  });

  it('deletes a draft unit that has no creative, and nothing else', async () => {
    const units = await findBy<{ id: string; status: string }>(UNITS, {});
    const creatives = await findBy<{ adUnitId: string }>(CREATIVES, {});
    const hasCreative = (id: string) => creatives.some((c) => c.adUnitId === id);
    const active = must(units.find((u) => u.status === 'ACTIVE'));
    expect((await send(UNIT_DELETE, {}, { id: active.id })).status).toBe(409);
    const draftWith = units.find((u) => u.status === 'DRAFT' && hasCreative(u.id));
    if (draftWith) expect((await send(UNIT_DELETE, {}, { id: draftWith.id })).status).toBe(409);
    const draftFree = must(units.find((u) => u.status === 'DRAFT' && !hasCreative(u.id)));
    expect((await send(UNIT_DELETE, {}, { id: draftFree.id })).status).toBe(200);
    expect((await get(UNIT_ONE, {}, { id: draftFree.id })).status).toBe(404);
  });
});

describe('the media upload', () => {
  it('answers with the record of the upload: id, addresses, size, dimensions, duration and type', async () => {
    const first = await send(MEDIA, undefined);
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ mediaType: 'IMAGE', width: 1080, height: 1920 });
    expect(typeof first.body.data.uploadId).toBe('string');
    expect(first.body.data.mediaUrl).toMatch(/^(https:|data:)/);
    expect(first.body.data.thumbnailUrl).toMatch(/^(https:|data:)/);
    expect(first.body.data.bytes).toBeGreaterThan(0);
    expect(first.body.data.durationSeconds).toBeNull();
    const second = await send(MEDIA, undefined);
    expect(second.body.data.uploadId).not.toBe(first.body.data.uploadId);
    expect(second.body.data.mediaType).toBe('VIDEO');
    expect(second.body.data.durationSeconds).toBeGreaterThan(0);
  });

  it('answers 503 DEPENDENCY_UNAVAILABLE when the public base address is not set', async () => {
    adsState.mediaAvailable = false;
    const answer = await send(MEDIA, undefined);
    expect(answer.status).toBe(503);
    expect(answer.body.code).toBe('DEPENDENCY_UNAVAILABLE');
  });
});

describe('the creatives', () => {
  const upload = async () => (await send(MEDIA, undefined)).body.data.uploadId as string;
  const imageUpload = async () => {
    adsState.nextMedia = {
      mediaType: 'IMAGE',
      width: 1080,
      height: 1920,
      bytes: 300_000,
      durationSeconds: null,
    };
    return upload();
  };
  const body = (over: Record<string, unknown> = {}) => ({
    adUnitId: '1',
    uploadId: 'set below',
    clickAction: 'OPEN_URL',
    clickTarget: 'https://example.com/a',
    language: '*',
    weight: 100,
    skippable: true,
    rewardAfterSeconds: null,
    title: null,
    body: null,
    ctaText: null,
    advertiserName: null,
    ...over,
  });
  const make = async (over: Record<string, unknown> = {}) =>
    send(CREATIVE_CREATE, body({ uploadId: await imageUpload(), ...over }));

  it('lists with its five filters; the answer has the two statuses apart and the address of the thumbnail', async () => {
    const all = await findBy<Record<string, unknown>>(CREATIVES, {});
    expect(all.length).toBeGreaterThanOrEqual(8);
    expect(new Set(all.map((c) => c.reviewStatus))).toEqual(
      new Set(['DRAFT', 'APPROVED', 'REJECTED']),
    );
    expect(new Set(all.map((c) => c.servingStatus))).toEqual(new Set(['ACTIVE', 'PAUSED']));
    expect(new Set(all.map((c) => c.type))).toEqual(new Set(['IMAGE', 'VIDEO']));
    const approved = await findBy<{ reviewStatus: string }>(CREATIVES, {
      reviewStatus: 'APPROVED',
    });
    expect(approved.every((c) => c.reviewStatus === 'APPROVED')).toBe(true);
    const paused = await findBy<{ servingStatus: string }>(CREATIVES, { servingStatus: 'PAUSED' });
    expect(paused.every((c) => c.servingStatus === 'PAUSED')).toBe(true);
    const videos = await findBy<{ type: string }>(CREATIVES, { type: 'VIDEO' });
    expect(videos.every((c) => c.type === 'VIDEO')).toBe(true);
    const ofUnit = await findBy<{ adUnitId: string }>(CREATIVES, { adUnitId: '1' });
    expect(ofUnit.length).toBeGreaterThan(0);
    expect(ofUnit.every((c) => c.adUnitId === '1')).toBe(true);
    const ofCampaign = await findBy<{ adUnitId: string }>(CREATIVES, { campaignId: '2' });
    expect(ofCampaign.length).toBeGreaterThan(0);
    expect(ofCampaign.every((c) => ['1', '2', '8'].includes(c.adUnitId))).toBe(true);
    expect(all.some((c) => c.thumbnailUrl === null)).toBe(false);
    expect(all.find((c) => c.reviewStatus === 'REJECTED')?.reviewNote).toBeTruthy();
    expect(all.every((c) => !('uniqueUsers' in c))).toBe(true);
  });

  it('creates a draft that is not paused, from the upload alone: the size, dimensions and addresses come from the upload record', async () => {
    const uploaded = (await send(MEDIA, undefined)).body.data;
    const answer = await send(CREATIVE_CREATE, {
      ...body({ uploadId: uploaded.uploadId }),
      mediaUrl: 'https://evil.example/x.png',
      width: 1,
      height: 1,
      bytes: 1,
      type: 'VIDEO',
    });
    expect(answer.status).toBe(200);
    expect(answer.body.data).toMatchObject({
      reviewStatus: 'DRAFT',
      servingStatus: 'ACTIVE',
      type: 'IMAGE',
      width: 1080,
      height: 1920,
      bytes: uploaded.bytes,
      uploadId: uploaded.uploadId,
      createdByUsername: 'root',
    });
    expect(answer.body.data.mediaUrl).not.toContain('evil');
    expect(answer.body.data.warnings).toEqual([]);
  });

  it('refuses a missing, an unknown and an already used upload; an upload of another kind', async () => {
    expect(refs(await send(CREATIVE_CREATE, body({ uploadId: '' })))).toEqual([
      'uploadId:EMPTY_NOT_ALLOWED',
    ]);
    expect((await send(CREATIVE_CREATE, body({ uploadId: 'nope' }))).status).toBe(404);
    const used = await make();
    expect(used.status).toBe(200);
    const again = await send(CREATIVE_CREATE, body({ uploadId: used.body.data.uploadId }));
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('INVALID_STATE');
    const other = await upload();
    must(adsState.uploads.get(other)).kind = 'APK';
    const wrong = await send(CREATIVE_CREATE, body({ uploadId: other }));
    expect(wrong.status).toBe(400);
    expect(refs(wrong)).toEqual(['uploadId:OUT_OF_RANGE']);
  });

  it('checks the file against the spec of the placement of the unit: the ratio within the tolerance, the shorter side and the size', async () => {
    const check = async (media: Record<string, unknown>) => {
      adsState.nextMedia = { mediaType: 'IMAGE', durationSeconds: null, ...media } as never;
      return send(CREATIVE_CREATE, body({ uploadId: await upload() }));
    };
    expect((await check({ width: 1080, height: 1920, bytes: 1000 })).status).toBe(200);
    expect((await check({ width: 1080, height: 1940, bytes: 1000 })).status).toBe(200);
    for (const media of [
      { width: 1280, height: 720, bytes: 1000 },
      { width: 600, height: 1067, bytes: 1000 },
      { width: 1080, height: 1920, bytes: 10485761 },
    ]) {
      const refused = await check(media);
      expect(refused.status, JSON.stringify(media)).toBe(400);
      expect(refs(refused)).toEqual(['uploadId:OUT_OF_RANGE']);
    }
    saved.set('ads.creative_aspect_tolerance_percent', {
      value: 20,
      updatedAt: NOW.toISOString(),
      updatedBy: '1001',
      updatedByUsername: 'root',
    });
    expect((await check({ width: 1080, height: 2200, bytes: 1000 })).status).toBe(200);
  });

  it('wants the click target by the click action: https for a link, a screen of the list for a route', async () => {
    expect(refs(await make({ clickTarget: 'http://example.com' }))).toEqual([
      'clickTarget:NOT_HTTPS',
    ]);
    expect(refs(await make({ clickAction: 'IN_APP_ROUTE', clickTarget: 'profile/42' }))).toEqual([
      'clickTarget:OUT_OF_RANGE',
    ]);
    expect((await make({ clickAction: 'IN_APP_ROUTE', clickTarget: 'store' })).status).toBe(200);
    expect(refs(await make({ clickAction: 'NONSENSE' }))).toEqual(['clickAction:OUT_OF_RANGE']);
    expect(refs(await make({ weight: -1 }))).toEqual(['weight:OUT_OF_RANGE']);
  });

  it('wants a reward threshold of 5 to 30 on a rewarded placement, and not above the length of a video; native placements need a title and a button text', async () => {
    const rewardedUnit = '4';
    expect(refs(await make({ adUnitId: rewardedUnit }))).toEqual([
      'rewardAfterSeconds:EMPTY_NOT_ALLOWED',
    ]);
    expect(refs(await make({ adUnitId: rewardedUnit, rewardAfterSeconds: 4 }))).toEqual([
      'rewardAfterSeconds:OUT_OF_RANGE',
    ]);
    expect(refs(await make({ adUnitId: rewardedUnit, rewardAfterSeconds: 31 }))).toEqual([
      'rewardAfterSeconds:OUT_OF_RANGE',
    ]);
    expect((await make({ adUnitId: rewardedUnit, rewardAfterSeconds: 30 })).status).toBe(200);
    adsState.nextMedia = {
      mediaType: 'VIDEO',
      width: 1080,
      height: 1920,
      bytes: 1000,
      durationSeconds: 8,
    };
    const video = await upload();
    expect(
      refs(
        await send(
          CREATIVE_CREATE,
          body({ adUnitId: rewardedUnit, uploadId: video, rewardAfterSeconds: 9 }),
        ),
      ),
    ).toEqual(['rewardAfterSeconds:OUT_OF_RANGE']);
    adsState.nextMedia = {
      mediaType: 'VIDEO',
      width: 1080,
      height: 1920,
      bytes: 1000,
      durationSeconds: 8,
    };
    const video2 = await upload();
    expect(
      (
        await send(
          CREATIVE_CREATE,
          body({ adUnitId: rewardedUnit, uploadId: video2, rewardAfterSeconds: 8 }),
        )
      ).status,
    ).toBe(200);
    const nativeUnit = '3';
    expect(refs(await make({ adUnitId: nativeUnit }))).toEqual([
      'title:EMPTY_NOT_ALLOWED',
      'ctaText:EMPTY_NOT_ALLOWED',
    ]);
    expect((await make({ adUnitId: nativeUnit, title: 'สวัสดี', ctaText: 'ติดตั้ง' })).status).toBe(200);
  });

  it('answers with warnings, and saves anyway: an unskippable full-screen ad, and a skip delay above 5 seconds', async () => {
    const unskippable = await make({ skippable: false });
    expect(unskippable.status).toBe(200);
    expect(unskippable.body.data.warnings.map((w: { code: string }) => w.code)).toEqual([
      'AD_NOT_SKIPPABLE',
    ]);
    saved.set('ads.skip_after_seconds', {
      value: 8,
      updatedAt: NOW.toISOString(),
      updatedBy: '1001',
      updatedByUsername: 'root',
    });
    const both = await make({ skippable: false });
    expect(both.body.data.warnings.map((w: { code: string }) => w.code).sort()).toEqual([
      'AD_NOT_SKIPPABLE',
      'AD_SKIP_AFTER_TOO_LONG',
    ]);
    const native = await make({ adUnitId: '3', title: 't', ctaText: 'c', skippable: false });
    expect(native.body.data.warnings.map((w: { code: string }) => w.code)).toEqual([
      'AD_SKIP_AFTER_TOO_LONG',
    ]);
  });

  it('reviews only a draft: approve, or reject with a note; a rejection without a note is refused', async () => {
    const id = (await make()).body.data.id;
    const noNote = await send(CREATIVE_REVIEW, { reviewStatus: 'REJECTED' }, { id });
    expect(noNote.status).toBe(400);
    expect(refs(noNote)).toEqual(['reviewNote:EMPTY_NOT_ALLOWED']);
    expect(
      refs(await send(CREATIVE_REVIEW, { reviewStatus: 'REJECTED', reviewNote: '  ' }, { id })),
    ).toEqual(['reviewNote:EMPTY_NOT_ALLOWED']);
    const rejected = await send(
      CREATIVE_REVIEW,
      { reviewStatus: 'REJECTED', reviewNote: ' blurry ' },
      { id },
    );
    expect(rejected.body.data).toMatchObject({
      reviewStatus: 'REJECTED',
      reviewNote: 'blurry',
      reviewedByUsername: 'root',
    });
    const second = await send(CREATIVE_REVIEW, { reviewStatus: 'APPROVED' }, { id });
    expect(second.status).toBe(409);
    expect(second.body.data.status).toBe('REJECTED');
    const other = (await make()).body.data.id;
    const approved = await send(CREATIVE_REVIEW, { reviewStatus: 'APPROVED' }, { id: other });
    expect(approved.body.data.reviewStatus).toBe('APPROVED');
    expect(approved.body.data.reviewedAt).toBeTruthy();
    expect((await send(CREATIVE_REVIEW, { reviewStatus: 'DRAFT' }, { id: other })).status).toBe(
      400,
    );
  });

  it('edits a draft or a rejected one; an edit of a rejected one makes it a draft again and clears the note; an approved one is not edited', async () => {
    const id = (await make()).body.data.id;
    const edited = await send(CREATIVE_UPDATE, { title: 'New', weight: 7 }, { id });
    expect(edited.body.data).toMatchObject({ title: 'New', weight: 7, reviewStatus: 'DRAFT' });
    await send(CREATIVE_REVIEW, { reviewStatus: 'REJECTED', reviewNote: 'no' }, { id });
    const back = await send(CREATIVE_UPDATE, { title: 'Again' }, { id });
    expect(back.body.data).toMatchObject({
      reviewStatus: 'DRAFT',
      reviewNote: null,
      title: 'Again',
    });
    await send(CREATIVE_REVIEW, { reviewStatus: 'APPROVED' }, { id });
    const refused = await send(CREATIVE_UPDATE, { title: 'Late' }, { id });
    expect(refused.status).toBe(409);
    expect(refused.body.data.status).toBe('APPROVED');
    expect((await send(CREATIVE_UPDATE, { rewardAfterSeconds: null }, { id: '7' })).status).toBe(
      400,
    );
  });

  it('takes a new upload on an edit and throws the old one away; the same upload id is no change; a used one is refused', async () => {
    const created = (await make()).body.data;
    const same = await send(
      CREATIVE_UPDATE,
      { uploadId: created.uploadId, title: 't' },
      { id: created.id },
    );
    expect(same.status).toBe(200);
    expect(same.body.data.uploadId).toBe(created.uploadId);
    const fresh = await imageUpload();
    const changed = await send(CREATIVE_UPDATE, { uploadId: fresh }, { id: created.id });
    expect(changed.body.data.uploadId).toBe(fresh);
    expect(adsState.uploads.has(created.uploadId)).toBe(false);
    const clash = await send(CREATIVE_UPDATE, { uploadId: 'up-seed-1' }, { id: created.id });
    expect(clash.status).toBe(409);
  });

  it('switches the serving status of an approved creative only, at once and without a new review', async () => {
    const id = (await make()).body.data.id;
    const early = await send(CREATIVE_SERVING, { servingStatus: 'PAUSED' }, { id });
    expect(early.status).toBe(409);
    expect(early.body.data.status).toBe('DRAFT');
    await send(CREATIVE_REVIEW, { reviewStatus: 'APPROVED' }, { id });
    const paused = await send(CREATIVE_SERVING, { servingStatus: 'PAUSED' }, { id });
    expect(paused.body.data).toMatchObject({ servingStatus: 'PAUSED', reviewStatus: 'APPROVED' });
    const resumed = await send(CREATIVE_SERVING, { servingStatus: 'ACTIVE' }, { id });
    expect(resumed.body.data.servingStatus).toBe('ACTIVE');
    expect((await send(CREATIVE_SERVING, { servingStatus: 'X' }, { id })).status).toBe(400);
  });

  it('deletes a draft or a rejected one, and not an approved one; the upload goes with it', async () => {
    const created = (await make()).body.data;
    expect((await send(CREATIVE_DELETE, {}, { id: created.id })).status).toBe(200);
    expect(adsState.uploads.has(created.uploadId)).toBe(false);
    const approved = (
      await findBy<{ id: string; reviewStatus: string }>(CREATIVES, { reviewStatus: 'APPROVED' })
    )[0];
    const refused = await send(CREATIVE_DELETE, {}, { id: approved.id });
    expect(refused.status).toBe(409);
    expect(refused.body.data.status).toBe('APPROVED');
    expect((await send(CREATIVE_DELETE, {}, { id: 'nope' })).status).toBe(404);
  });
});

describe('the meta', () => {
  it('says whether the geo database is configured', async () => {
    adsState.geoConfigured = false;
    expect((await get(META)).body.data).toEqual({ geoConfigured: false });
    adsState.geoConfigured = true;
    expect((await get(META)).body.data).toEqual({ geoConfigured: true });
  });
});

describe('the reports', () => {
  const range = { from: '2026-10-20', to: '2026-10-26' };
  const METRICS = [
    'impressions',
    'guestImpressions',
    'starts',
    'viewableImpressions',
    'nonViewableImpressions',
    'undeterminedImpressions',
    'clicks',
    'completions',
    'skips',
    'errors',
    'totalWatchSeconds',
  ];

  it('overview has the totals with every metric and the ratios, and the days with impressions, clicks and completions', async () => {
    const { data } = (await get(REPORT('overview'), range)).body;
    for (const name of METRICS) expect(typeof data.totals[name], name).toBe('number');
    expect(data.totals).not.toHaveProperty('uniqueUsers');
    expect(data.totals.guestImpressions).toBeLessThanOrEqual(data.totals.impressions);
    expect(data.totals.undeterminedImpressions).toBeGreaterThanOrEqual(0);
    expect(
      data.totals.viewableImpressions +
        data.totals.nonViewableImpressions +
        data.totals.undeterminedImpressions,
    ).toBe(data.totals.impressions);
    expect(data.totals.ctr).toBeCloseTo(data.totals.clicks / data.totals.impressions, 6);
    expect(data.totals.completionRate).toBeCloseTo(data.totals.completions / data.totals.starts, 6);
    expect(data.totals.avgWatchSeconds).toBeCloseTo(
      data.totals.totalWatchSeconds / data.totals.starts,
      6,
    );
    expect(data.daily.length).toBeGreaterThan(0);
    for (const day of data.daily) {
      expect(Object.keys(day).sort()).toEqual(['clicks', 'completions', 'impressions', 'statDate']);
      expect(day.statDate >= range.from && day.statDate <= range.to).toBe(true);
    }
    expect(data.daily.reduce((s: number, d: { impressions: number }) => s + d.impressions, 0)).toBe(
      data.totals.impressions,
    );
  });

  it('keeps the totals of the overview and the sums of the four tables equal', async () => {
    const total = (await get(REPORT('overview'), range)).body.data.totals.impressions;
    for (const name of ['by-placement', 'by-campaign', 'by-creative', 'by-country']) {
      const rows = (await get(REPORT(name), range)).body.data;
      expect(Array.isArray(rows), name).toBe(true);
      expect(
        rows.reduce((s: number, r: { impressions: number }) => s + r.impressions, 0),
        name,
      ).toBe(total);
    }
  });

  it('has the dimension keys the backend named, the empty text for an unknown country, and a null ratio where the denominator is 0', async () => {
    const placement = (await get(REPORT('by-placement'), range)).body.data;
    expect(Object.keys(placement[0])).toEqual(
      expect.arrayContaining(['placementId', 'slotKey', 'placementName']),
    );
    const campaign = (await get(REPORT('by-campaign'), range)).body.data;
    expect(Object.keys(campaign[0])).toEqual(
      expect.arrayContaining(['campaignId', 'campaignName']),
    );
    const creative = (await get(REPORT('by-creative'), range)).body.data;
    expect(Object.keys(creative[0])).toEqual(
      expect.arrayContaining(['creativeId', 'creativeTitle']),
    );
    expect(creative.some((r: { creativeTitle: unknown }) => r.creativeTitle === null)).toBe(true);
    const country = (await get(REPORT('by-country'), range)).body.data;
    expect(country.some((r: { country: string }) => r.country === '')).toBe(true);
    expect(country.some((r: { country: string }) => r.country === 'TH')).toBe(true);
    const idle = creative.find((r: { impressions: number }) => r.impressions === 0);
    expect(idle).toBeDefined();
    expect(idle.ctr).toBeNull();
    expect(idle.completionRate).toBeNull();
    expect(idle.avgWatchSeconds).toBeNull();
    for (const row of [...placement, ...campaign, ...creative, ...country]) {
      expect(row).not.toHaveProperty('uniqueUsers');
      expect(row.undeterminedImpressions).toBeGreaterThanOrEqual(0);
    }
  });

  it('takes the platform and the channel as two conditions, `unknown` as a channel, and a smaller number for a narrower filter', async () => {
    const all = (await get(REPORT('overview'), range)).body.data.totals.impressions;
    const android = (await get(REPORT('overview'), { ...range, platform: 'ANDROID' })).body.data
      .totals.impressions;
    const channel = (await get(REPORT('overview'), { ...range, channelCode: 'play' })).body.data
      .totals.impressions;
    const both = (
      await get(REPORT('overview'), { ...range, platform: 'ANDROID', channelCode: 'play' })
    ).body.data.totals.impressions;
    const unknown = (await get(REPORT('overview'), { ...range, channelCode: 'unknown' })).body.data
      .totals.impressions;
    expect(android).toBeLessThan(all);
    expect(channel).toBeLessThan(all);
    expect(both).toBeLessThan(Math.min(android, channel) + 1);
    expect(unknown).toBeLessThan(all);
    for (const name of ['by-placement', 'by-campaign', 'by-creative', 'by-country', 'nofill']) {
      expect((await get(REPORT(name), { ...range, channelCode: 'play' })).status, name).toBe(200);
    }
  });

  it('refuses a bad channel code, a bad platform and a bad range on every report, as INVALID_REQUEST with the name of the parameter', async () => {
    for (const name of [
      'overview',
      'by-placement',
      'by-campaign',
      'by-creative',
      'by-country',
      'nofill',
    ]) {
      const channel = await get(REPORT(name), { ...range, channelCode: 'Bad Code' });
      expect(channel.status, name).toBe(400);
      expect(refs(channel)).toEqual(['channelCode:OUT_OF_RANGE']);
      expect(refs(await get(REPORT(name), { ...range, channelCode: 'x' }))).toEqual([
        'channelCode:OUT_OF_RANGE',
      ]);
      expect(refs(await get(REPORT(name), { ...range, platform: 'WEB' }))).toEqual([
        'platform:OUT_OF_RANGE',
      ]);
      expect((await get(REPORT(name), { from: '2026-10-27', to: '2026-10-26' })).status, name).toBe(
        400,
      );
      expect((await get(REPORT(name), { from: '2024-01-01', to: '2026-10-26' })).status, name).toBe(
        400,
      );
    }
  });

  it('has the nofill rows with the date, the slot, the reason and the count and nothing about the platform or the channel, and all eleven reasons', async () => {
    const rows = (await get(REPORT('nofill'), { from: '2026-09-27', to: '2026-10-26' })).body.data;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(['cnt', 'reason', 'slotKey', 'statDate']);
      expect(row.cnt).toBeGreaterThan(0);
    }
    expect(new Set(rows.map((r: { reason: string }) => r.reason)).size).toBe(11);
    expect(new Set(rows.map((r: { slotKey: string }) => r.slotKey))).toEqual(
      new Set(['app_open', 'call_end', 'history_feed', 'reward_credits']),
    );
    const guestOnly = rows.filter((r: { reason: string }) => r.reason === 'NOT_FOR_GUEST');
    expect(
      guestOnly.every((r: { slotKey: string }) =>
        ['history_feed', 'reward_credits'].includes(r.slotKey),
      ),
    ).toBe(true);
  });
});
