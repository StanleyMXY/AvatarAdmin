import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import {
  createCampaign,
  createCreative,
  createUnit,
  deleteCampaign,
  deleteCreative,
  deleteUnit,
  getAdsMeta,
  getReport,
  listCampaigns,
  listCreatives,
  listPlacements,
  listUnits,
  loadAllPages,
  reviewCreative,
  setCampaignStatus,
  setServingStatus,
  setUnitStatus,
  updateCampaign,
  updateCreative,
  updatePlacement,
  updateUnit,
  warningsOf,
} from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const answer = (data: unknown) => stubFetch(() => jsonResponse(200, envelope('200', data)));
const body = (call: { init: RequestInit }) => JSON.parse(call.init.body as string);

describe('the campaigns', () => {
  it('lists with the paging and the filters that were asked for, and nothing for the ones that were not', async () => {
    const calls = answer({ items: [{ id: '1' }], total: 1 });
    expect(await listCampaigns({ page: 2, pageSize: 50, name: 'สวัสดี', status: 'ACTIVE' })).toEqual({
      items: [{ id: '1' }],
      total: 1,
    });
    const url = new URL(calls[0].url, 'http://x');
    expect(url.pathname).toBe('/api/admin/ads/campaigns');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '2',
      pageSize: '50',
      name: 'สวัสดี',
      status: 'ACTIVE',
    });
    await listCampaigns({ page: 1, pageSize: 20 });
    expect(new URL(calls[1].url, 'http://x').search).toBe('?page=1&pageSize=20');
  });

  it('reads a bare list as a page and a page without a total as having as many as it shows', async () => {
    answer([{ id: '1' }, { id: '2' }]);
    expect(await listCampaigns({ page: 1, pageSize: 20 })).toEqual({
      items: [{ id: '1' }, { id: '2' }],
      total: 2,
    });
    answer({ items: [{ id: '1' }] });
    expect((await listCampaigns({ page: 1, pageSize: 20 })).total).toBe(1);
    answer(null);
    expect(await listCampaigns({ page: 1, pageSize: 20 })).toEqual({ items: [], total: 0 });
  });

  it('creates, updates (a cleared end time is an explicit null), changes the status and deletes by id', async () => {
    const calls = answer({ id: '9' });
    await createCampaign({
      name: 'n',
      description: null,
      priority: 100,
      startAt: null,
      endAt: null,
    });
    expect(calls[0].url).toBe('/api/admin/ads/campaigns');
    expect(calls[0].init.method).toBe('POST');
    expect(body(calls[0])).toEqual({
      name: 'n',
      description: null,
      priority: 100,
      startAt: null,
      endAt: null,
    });
    await updateCampaign('a/b', { name: 'n2', endAt: null });
    expect(calls[1].url).toBe('/api/admin/ads/campaigns/a%2Fb');
    expect(calls[1].init.method).toBe('PUT');
    expect(body(calls[1])).toEqual({ name: 'n2', endAt: null });
    await setCampaignStatus('9', 'PAUSED');
    expect(calls[2].url).toBe('/api/admin/ads/campaigns/9/status');
    expect(calls[2].init.method).toBe('PUT');
    expect(body(calls[2])).toEqual({ status: 'PAUSED' });
    await deleteCampaign('9');
    expect(calls[3].url).toBe('/api/admin/ads/campaigns/9');
    expect(calls[3].init.method).toBe('DELETE');
  });
});

describe('the placements', () => {
  it('reads the list as rows and sends only the fields it is given', async () => {
    const calls = answer({ items: [{ id: '1', slotKey: 'app_open' }] });
    expect(await listPlacements()).toEqual([{ id: '1', slotKey: 'app_open' }]);
    expect(calls[0].url).toBe('/api/admin/ads/placements');
    await updatePlacement('4', { enabled: true });
    expect(calls[1].url).toBe('/api/admin/ads/placements/4');
    expect(calls[1].init.method).toBe('PUT');
    expect(body(calls[1])).toEqual({ enabled: true });
    await updatePlacement('4', { frequencyCap: 5, rewardCredits: 10 });
    expect(body(calls[2])).toEqual({ frequencyCap: 5, rewardCredits: 10 });
  });
});

describe('the units', () => {
  it('lists with its four filters, creates, updates, changes the status and deletes', async () => {
    const calls = answer({ items: [], total: 0 });
    await listUnits({
      page: 1,
      pageSize: 20,
      campaignId: 'c1',
      placementId: 'p1',
      status: 'DRAFT',
      name: 'x',
    });
    expect(Object.fromEntries(new URL(calls[0].url, 'http://x').searchParams)).toEqual({
      page: '1',
      pageSize: '20',
      campaignId: 'c1',
      placementId: 'p1',
      status: 'DRAFT',
      name: 'x',
    });
    await createUnit({
      campaignId: 'c1',
      placementId: 'p1',
      name: 'u',
      weight: 0,
      dailyImpressionCap: 0,
      targeting: { platforms: ['ANDROID'], geo: ['TH'] },
    });
    expect(calls[1].url).toBe('/api/admin/ads/units');
    expect(body(calls[1])).toMatchObject({ weight: 0, targeting: { geo: ['TH'] } });
    await updateUnit('5', {
      name: 'u2',
      targeting: { geo: null },
      weight: 3,
      dailyImpressionCap: 0,
    });
    expect(calls[2].url).toBe('/api/admin/ads/units/5');
    expect(calls[2].init.method).toBe('PUT');
    expect(body(calls[2])).toEqual({
      name: 'u2',
      targeting: { geo: null },
      weight: 3,
      dailyImpressionCap: 0,
    });
    await setUnitStatus('5', 'ACTIVE');
    expect(calls[3].url).toBe('/api/admin/ads/units/5/status');
    expect(body(calls[3])).toEqual({ status: 'ACTIVE' });
    await deleteUnit('5');
    expect(calls[4].init.method).toBe('DELETE');
  });
});

describe('the creatives', () => {
  it('lists with its five filters', async () => {
    const calls = answer({ items: [], total: 0 });
    await listCreatives({
      page: 3,
      pageSize: 10,
      adUnitId: 'u',
      campaignId: 'c',
      reviewStatus: 'APPROVED',
      servingStatus: 'PAUSED',
      type: 'VIDEO',
    });
    expect(Object.fromEntries(new URL(calls[0].url, 'http://x').searchParams)).toEqual({
      page: '3',
      pageSize: '10',
      adUnitId: 'u',
      campaignId: 'c',
      reviewStatus: 'APPROVED',
      servingStatus: 'PAUSED',
      type: 'VIDEO',
    });
  });

  it('creates with the upload id and the typed fields, and the body has no address, size or dimension', async () => {
    const calls = answer({ id: '1', warnings: [] });
    await createCreative({
      adUnitId: 'u1',
      uploadId: 'up-1',
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
    });
    expect(calls[0].url).toBe('/api/admin/ads/creatives');
    expect(calls[0].init.method).toBe('POST');
    const sent = body(calls[0]);
    expect(sent.uploadId).toBe('up-1');
    for (const name of [
      'mediaUrl',
      'thumbnailUrl',
      'width',
      'height',
      'bytes',
      'durationSeconds',
      'type',
    ]) {
      expect(sent, name).not.toHaveProperty(name);
    }
  });

  it('updates, reviews, switches serving and deletes by id', async () => {
    const calls = answer({ id: '1' });
    await updateCreative('1', { title: 't', rewardAfterSeconds: 10 });
    expect(calls[0].url).toBe('/api/admin/ads/creatives/1');
    expect(calls[0].init.method).toBe('PUT');
    expect(body(calls[0])).toEqual({ title: 't', rewardAfterSeconds: 10 });
    await reviewCreative('1', { reviewStatus: 'REJECTED', reviewNote: 'blurry' });
    expect(calls[1].url).toBe('/api/admin/ads/creatives/1/review');
    expect(calls[1].init.method).toBe('PUT');
    expect(body(calls[1])).toEqual({ reviewStatus: 'REJECTED', reviewNote: 'blurry' });
    await reviewCreative('1', { reviewStatus: 'APPROVED' });
    expect(body(calls[2])).toEqual({ reviewStatus: 'APPROVED' });
    await setServingStatus('1', 'PAUSED');
    expect(calls[3].url).toBe('/api/admin/ads/creatives/1/serving-status');
    expect(calls[3].init.method).toBe('PUT');
    expect(body(calls[3])).toEqual({ servingStatus: 'PAUSED' });
    await deleteCreative('1');
    expect(calls[4].init.method).toBe('DELETE');
  });

  it('reads the warnings of a save as code and text, whatever else the answer holds', () => {
    expect(
      warningsOf({
        id: '1',
        warnings: [
          { code: 'AD_NOT_SKIPPABLE', message: 'm' },
          { code: 5 },
          'x',
          null,
          { code: 'AD_SKIP_AFTER_TOO_LONG' },
        ],
      }),
    ).toEqual([
      { code: 'AD_NOT_SKIPPABLE', message: 'm' },
      { code: 'AD_SKIP_AFTER_TOO_LONG', message: '' },
    ]);
    expect(warningsOf({ id: '1' })).toEqual([]);
    expect(warningsOf(null)).toEqual([]);
    expect(warningsOf({ warnings: 'x' })).toEqual([]);
  });
});

describe('the meta and the options', () => {
  it('says whether the geo database is configured, and nothing when the answer is not a boolean', async () => {
    const calls = answer({ geoConfigured: false });
    expect(await getAdsMeta()).toEqual({ geoConfigured: false });
    expect(calls[0].url).toBe('/api/admin/ads/meta');
    answer({ geoConfigured: 'no' });
    expect(await getAdsMeta()).toEqual({ geoConfigured: null });
    answer(null);
    expect(await getAdsMeta()).toEqual({ geoConfigured: null });
  });

  it('reads every page of a list, and stops at an empty page whatever the total says', async () => {
    const pages = [
      { items: [{ id: '1' }, { id: '2' }], total: 5 },
      { items: [{ id: '3' }, { id: '4' }], total: 5 },
      { items: [{ id: '5' }], total: 5 },
    ];
    const calls = stubFetch(() =>
      jsonResponse(200, envelope('200', pages.shift() ?? { items: [], total: 99 })),
    );
    const rows = await loadAllPages((page, pageSize) => listCampaigns({ page, pageSize }));
    expect(rows.map((r) => r.id)).toEqual(['1', '2', '3', '4', '5']);
    expect(calls).toHaveLength(3);
    expect(new URL(calls[0].url, 'http://x').searchParams.get('pageSize')).toBe('200');

    const forever = stubFetch(() => jsonResponse(200, envelope('200', { items: [], total: 99 })));
    expect(await loadAllPages((page, pageSize) => listCampaigns({ page, pageSize }))).toEqual([]);
    expect(forever).toHaveLength(1);
  });
});

describe('the reports', () => {
  const params = { from: '2026-10-20', to: '2026-10-26' };

  it('sends from and to, and the platform and the channel only when they are chosen', async () => {
    const calls = answer({ totals: {}, daily: [] });
    await getReport('overview', params);
    expect(calls[0].url).toBe('/api/admin/ads/report/overview?from=2026-10-20&to=2026-10-26');
    await getReport('overview', { ...params, platform: 'IOS', channelCode: 'unknown' });
    expect(Object.fromEntries(new URL(calls[1].url, 'http://x').searchParams)).toEqual({
      from: '2026-10-20',
      to: '2026-10-26',
      platform: 'IOS',
      channelCode: 'unknown',
    });
  });

  it('has an address for each of the six reports', async () => {
    const calls = answer([]);
    for (const name of [
      'by-placement',
      'by-campaign',
      'by-creative',
      'by-country',
      'nofill',
    ] as const) {
      await getReport(name, params);
    }
    expect(calls.map((c) => new URL(c.url, 'http://x').pathname)).toEqual([
      '/api/admin/ads/report/by-placement',
      '/api/admin/ads/report/by-campaign',
      '/api/admin/ads/report/by-creative',
      '/api/admin/ads/report/by-country',
      '/api/admin/ads/report/nofill',
    ]);
  });

  it('hands back the rows of a list report, from a list or from { items }', async () => {
    answer([{ country: 'TH' }]);
    expect(await getReport('by-country', params)).toEqual([{ country: 'TH' }]);
    answer({ items: [{ country: 'ID' }] });
    expect(await getReport('by-country', params)).toEqual([{ country: 'ID' }]);
    answer(null);
    expect(await getReport('nofill', params)).toEqual([]);
  });

  it('hands back the totals and the days of the overview, with an empty list for a missing one', async () => {
    answer({ totals: { impressions: 3 }, daily: [{ statDate: '2026-10-20', impressions: 3 }] });
    expect(await getReport('overview', params)).toEqual({
      totals: { impressions: 3 },
      daily: [{ statDate: '2026-10-20', impressions: 3 }],
    });
    answer({ totals: null });
    expect(await getReport('overview', params)).toEqual({ totals: {}, daily: [] });
  });

  it('lets the refusal of the backend through with its details', async () => {
    stubFetch(() =>
      jsonResponse(
        400,
        envelope('INVALID_REQUEST', { details: [{ ref: 'channelCode', reason: 'OUT_OF_RANGE' }] }),
      ),
    );
    await expect(getReport('nofill', { ...params, channelCode: 'X' })).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      details: [{ ref: 'channelCode', reason: 'OUT_OF_RANGE' }],
    });
  });
});
