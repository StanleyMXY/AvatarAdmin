import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import {
  batchCosts,
  createCampaign,
  createCost,
  deleteCost,
  getCampaignLink,
  getClicks,
  getPerformance,
  getRecords,
  getSummary,
  listAllCampaigns,
  listCampaigns,
  listCosts,
  readCostSettings,
  updateCampaign,
  updateCost,
} from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const answer = (data: unknown) => stubFetch(() => jsonResponse(200, envelope('200', data)));
const body = (call: { init: RequestInit }) => JSON.parse(call.init.body as string);

const FIELDS = {
  name: 'Spring',
  mediaSource: 'facebook',
  campaign: 'spring',
  utmMedium: 'cpc',
  adset: null,
  ad: null,
  facebookPixelId: '111',
  googlePixelId: null,
  tiktokPixelId: null,
  channelCodes: ['play'],
  remark: null,
  enabled: true,
};

describe('the campaigns', () => {
  it('lists with the filters and the paging, and drops a filter that is empty', async () => {
    const calls = answer({ items: [{ id: '1' }], total: 1 });
    await listCampaigns({ keyword: 'spring', enabled: true, page: 2, pageSize: 50 });
    expect(calls[0].url).toBe(
      '/api/admin/attribution/campaigns?keyword=spring&enabled=true&page=2&pageSize=50',
    );
    await listCampaigns({ keyword: '', page: 1, pageSize: 20 });
    expect(calls[1].url).toBe('/api/admin/attribution/campaigns?page=1&pageSize=20');
  });

  it('reads every page for the dropdowns, and stops at an empty page whatever the total says', async () => {
    const pages: Record<string, unknown> = {
      '1': { items: [{ id: '1' }, { id: '2' }], total: 3 },
      '2': { items: [{ id: '3' }], total: 3 },
    };
    const calls = stubFetch(({ url }) => {
      const page = new URL(url, 'http://x').searchParams.get('page') ?? '';
      return jsonResponse(200, envelope('200', pages[page] ?? { items: [], total: 99 }));
    });
    expect((await listAllCampaigns()).map((c) => c.id)).toEqual(['1', '2', '3']);
    expect(calls.map((c) => new URL(c.url, 'http://x').searchParams.get('pageSize'))).toEqual([
      '200',
      '200',
    ]);
    pages['2'] = { items: [], total: 99 };
    expect((await listAllCampaigns()).map((c) => c.id)).toEqual(['1', '2']);
  });

  it('creates with the code and updates without it, and the token is sent only when it was typed', async () => {
    const calls = answer({ id: '9' });
    await createCampaign({ ...FIELDS, code: 'spring_us', facebookAccessToken: 'secret-token' });
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].url).toBe('/api/admin/attribution/campaigns');
    expect(body(calls[0])).toMatchObject({
      code: 'spring_us',
      facebookAccessToken: 'secret-token',
    });

    await updateCampaign('9', FIELDS);
    expect(calls[1].init.method).toBe('PUT');
    expect(calls[1].url).toBe('/api/admin/attribution/campaigns/9');
    expect(body(calls[1])).not.toHaveProperty('code');
    expect(body(calls[1])).not.toHaveProperty('facebookAccessToken');
  });

  it('asks for the link with the platform and the UTM values that were given', async () => {
    const calls = answer({ url: 'https://x.example/go/spring_us' });
    const link = await getCampaignLink('9', {
      platform: 'FACEBOOK',
      utmSource: 'facebook',
      utmMedium: '',
      utmCampaign: 'spring',
    });
    expect(link.url).toBe('https://x.example/go/spring_us');
    expect(calls[0].url).toBe(
      '/api/admin/attribution/campaigns/9/link?platform=FACEBOOK&utmSource=facebook&utmCampaign=spring',
    );
  });
});

describe('the costs', () => {
  it('lists with the campaign, the days and the paging', async () => {
    const calls = answer({ items: [], total: 0 });
    await listCosts({
      campaignId: '4',
      from: '2026-10-01',
      to: '2026-10-31',
      page: 1,
      pageSize: 20,
    });
    expect(calls[0].url).toBe(
      '/api/admin/attribution/costs?campaignId=4&from=2026-10-01&to=2026-10-31&page=1&pageSize=20',
    );
  });

  it('creates, updates and deletes by id', async () => {
    const calls = answer({ id: '5' });
    const costBody = {
      campaignId: '4',
      statDate: '2026-10-20',
      amount: 12.5,
      currency: 'USD',
      remark: null,
    };
    await createCost(costBody);
    await updateCost('5', costBody);
    await deleteCost('5');
    expect(calls.map((c) => [c.init.method, c.url])).toEqual([
      ['POST', '/api/admin/attribution/costs'],
      ['PUT', '/api/admin/attribution/costs/5'],
      ['DELETE', '/api/admin/attribution/costs/5'],
    ]);
    expect(body(calls[0])).toEqual(costBody);
  });

  it('sends a batch as the array of the request body', async () => {
    const calls = answer(null);
    const rows = [
      {
        campaignCode: 'spring_us',
        statDate: '2026-10-20',
        amount: 1,
        currency: 'USD',
        remark: 'ก',
      },
    ];
    await batchCosts(rows);
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].url).toBe('/api/admin/attribution/costs/batch');
    expect(body(calls[0])).toEqual(rows);
  });
});

describe('the reports', () => {
  it('asks for the performance by campaign or by day', async () => {
    const calls = answer({ items: [] });
    await getPerformance({ from: '2026-10-20', to: '2026-10-26', groupBy: 'day', campaignId: '4' });
    await getPerformance({ from: '2026-10-20', to: '2026-10-26', groupBy: 'campaign' });
    expect(calls[0].url).toBe(
      '/api/admin/attribution/performance?from=2026-10-20&to=2026-10-26&groupBy=day&campaignId=4',
    );
    expect(calls[1].url).toBe(
      '/api/admin/attribution/performance?from=2026-10-20&to=2026-10-26&groupBy=campaign',
    );
  });

  it('asks for clicks and records with the filters named as the backend names them', async () => {
    const calls = answer({ items: [], total: 0 });
    await getClicks({
      from: '2026-10-20T00:00:00Z',
      to: '2026-10-27T00:00:00Z',
      status: 'PENDING',
      keyword: 'x',
      page: 1,
      pageSize: 20,
    });
    await getRecords({
      source: 'SELF',
      matchType: 'FINGERPRINT',
      from: 'a',
      to: 'b',
      page: 3,
      pageSize: 10,
    });
    expect(calls[0].url).toBe(
      '/api/admin/attribution/clicks?from=2026-10-20T00%3A00%3A00Z&to=2026-10-27T00%3A00%3A00Z&status=PENDING&keyword=x&page=1&pageSize=20',
    );
    expect(calls[1].url).toBe(
      '/api/admin/attribution/records?source=SELF&matchType=FINGERPRINT&from=a&to=b&page=3&pageSize=10',
    );
  });

  it('asks for the summary with the grouping, and the days', async () => {
    const calls = answer({ items: [] });
    await getSummary({ groupBy: 'media_source', from: '2026-10-20', to: '2026-10-26' });
    expect(calls[0].url).toBe(
      '/api/admin/attribution/summary?groupBy=media_source&from=2026-10-20&to=2026-10-26',
    );
  });
});

describe('the parameters the pages need', () => {
  const config = (items: unknown[]) => answer({ items });

  it('reads the currency, the batch limit and the link root from the configuration', async () => {
    config([
      { key: 'attribution.cost_currency', value: 'EUR' },
      { key: 'attribution.cost_batch_max', value: 500 },
      { key: 'attribution.link_base_url', value: 'https://go.example' },
      { key: 'other.key', value: 1 },
    ]);
    expect(await readCostSettings()).toEqual({
      currency: 'EUR',
      batchMax: 500,
      linkBaseUrl: 'https://go.example',
    });
  });

  it('says null for what is missing, empty or of the wrong type, and never throws on a list without the keys', async () => {
    config([
      { key: 'attribution.cost_currency', value: '' },
      { key: 'attribution.cost_batch_max', value: 'many' },
      { key: 'attribution.link_base_url', value: null },
    ]);
    expect(await readCostSettings()).toEqual({ currency: null, batchMax: null, linkBaseUrl: null });
    config([]);
    expect(await readCostSettings()).toEqual({ currency: null, batchMax: null, linkBaseUrl: null });
  });

  it('lets a failed read of the configuration through, so that the page can say it could not read it', async () => {
    stubFetch(() => jsonResponse(500, envelope('INTERNAL_ERROR')));
    await expect(readCostSettings()).rejects.toMatchObject({ httpStatus: 500 });
  });
});
