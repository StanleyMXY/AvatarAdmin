import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import {
  confirmBatch,
  createPrice,
  listPendingBatches,
  listPrices,
  listUsageModels,
  normalizeBatch,
  RESOURCE_TYPES,
  rejectBatch,
  retireBatch,
  UNIT_OF,
  updateUsageModel,
} from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const answer = (data: unknown) => () => jsonResponse(200, envelope('200', data));

describe('the price endpoints', () => {
  it('GET /usage/prices sends the filters and the paging', async () => {
    const calls = stubFetch(answer({ items: [], total: 0 }));
    await listPrices({
      resourceType: 'LLM',
      model: 'm 1',
      status: 'ACTIVE',
      page: 2,
      pageSize: 200,
    });
    expect(calls[0].url).toBe(
      '/api/admin/usage/prices?resourceType=LLM&model=m+1&status=ACTIVE&page=2&pageSize=200',
    );
    expect(calls[0].init.method).toBe('GET');
  });

  it('GET /usage/price-batches/pending and GET /usage/models', async () => {
    const calls = stubFetch(answer({ items: [], total: 0 }));
    await listPendingBatches();
    await listUsageModels({ page: 1, pageSize: 200 });
    expect(calls.map((c) => c.url)).toEqual([
      '/api/admin/usage/price-batches/pending',
      '/api/admin/usage/models?page=1&pageSize=200',
    ]);
  });

  it('POST /usage/prices sends the prices as the strings they are, and the bounds as integers', async () => {
    const calls = stubFetch(answer(null));
    await createPrice({
      resourceType: 'LLM',
      provider: 'p',
      model: 'm',
      unit: 'TOKENS_1M',
      effectiveFrom: '2026-10-26',
      currency: 'USD',
      bands: [
        {
          inputMinTokens: 0,
          inputMaxTokens: 32000,
          inputPrice: '0.0000000001',
          cachedInputPrice: null,
          outputPrice: '12345678.1234567890',
        },
        {
          inputMinTokens: 32001,
          inputMaxTokens: null,
          inputPrice: '0.40',
          cachedInputPrice: '0.1000',
          outputPrice: '2',
        },
      ],
    });
    await createPrice({
      resourceType: 'CLOUD_RENDER',
      provider: 'p',
      model: 'm',
      unit: 'MINUTE',
      effectiveFrom: '2026-10-26',
      currency: 'USD',
      unitPrice: '0.0000000001',
    });
    expect(calls[0].url).toBe('/api/admin/usage/prices');
    expect(calls[0].init.method).toBe('POST');
    const text = calls[0].init.body as string;
    expect(text).toContain('"inputPrice":"0.0000000001"');
    expect(text).toContain('"outputPrice":"12345678.1234567890"');
    expect(text).toContain('"cachedInputPrice":null');
    expect(text).toContain('"inputMinTokens":32001');
    expect(JSON.parse(calls[1].init.body as string)).toEqual({
      resourceType: 'CLOUD_RENDER',
      provider: 'p',
      model: 'm',
      unit: 'MINUTE',
      effectiveFrom: '2026-10-26',
      currency: 'USD',
      unitPrice: '0.0000000001',
    });
  });

  it('confirm, reject, retire and the model registration go to the path of the batch or model', async () => {
    const calls = stubFetch(answer(null));
    await confirmBatch('b/1', { effectiveFrom: '2026-10-01', currency: 'USD' });
    await rejectBatch('b 2', 'too high');
    await retireBatch('b3', 'wrong model');
    await updateUsageModel('42', { syncAdapter: 'DASHSCOPE_INTL', syncModelId: 'm' });
    await updateUsageModel('43', { syncAdapter: null, syncModelId: 'm2' });
    expect(calls.map((c) => [c.init.method, c.url])).toEqual([
      ['POST', '/api/admin/usage/price-batches/b%2F1/confirm'],
      ['POST', '/api/admin/usage/price-batches/b%202/reject'],
      ['POST', '/api/admin/usage/price-batches/b3/retire'],
      ['PUT', '/api/admin/usage/models/42'],
      ['PUT', '/api/admin/usage/models/43'],
    ]);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      effectiveFrom: '2026-10-01',
      currency: 'USD',
    });
    expect(JSON.parse(calls[1].init.body as string)).toEqual({ note: 'too high' });
    expect(JSON.parse(calls[2].init.body as string)).toEqual({ note: 'wrong model' });
    expect(JSON.parse(calls[4].init.body as string)).toEqual({
      syncAdapter: null,
      syncModelId: 'm2',
    });
  });
});

describe('reading a batch: prices stay decimal text', () => {
  const raw = {
    batchId: 'b1',
    resourceType: 'LLM',
    provider: 'p',
    model: 'm',
    unit: 'TOKENS_1M',
    effectiveFrom: '2026-10-01',
    currency: 'USD',
    status: 'ACTIVE',
    source: 'MANUAL',
    confirmedBy: '1001',
    confirmedByUsername: 'root',
    confirmedAt: '2026-10-01T00:00:00Z',
    reviewedBy: null,
    reviewedByUsername: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: '2026-10-01T00:00:00Z',
    bands: [
      {
        inputMinTokens: 0,
        inputMaxTokens: null,
        inputPrice: '0.0000000001',
        cachedInputPrice: null,
        outputPrice: '12345678.1234567890',
      },
    ],
    unitPrice: null,
  };

  it('keeps the strings exactly', () => {
    const batch = normalizeBatch(raw);
    expect(batch.bands?.[0]).toEqual({
      inputMinTokens: 0,
      inputMaxTokens: null,
      inputPrice: '0.0000000001',
      cachedInputPrice: null,
      outputPrice: '12345678.1234567890',
    });
    expect(batch.unitPrice).toBeNull();
  });

  it('writes a price that came as a JSON number without an exponent', () => {
    const batch = normalizeBatch({ ...raw, bands: null, unitPrice: 0.0000001 });
    expect(batch.unitPrice).toBe('0.0000001');
    expect(batch.bands).toBeNull();
  });

  it('a price that is not a decimal becomes null (shown as a dash), not NaN', () => {
    const batch = normalizeBatch({
      ...raw,
      bands: [
        {
          inputMinTokens: 0,
          inputMaxTokens: null,
          inputPrice: 'x',
          cachedInputPrice: '',
          outputPrice: null,
        },
      ],
    });
    expect(batch.bands?.[0]).toMatchObject({
      inputPrice: null,
      cachedInputPrice: null,
      outputPrice: null,
    });
  });

  it('reads the lists through the same normalization, the pending ones with their active batch', async () => {
    stubFetch(
      answer({
        items: [
          { ...raw, status: 'PENDING_REVIEW', active: { ...raw, bands: null, unitPrice: '3' } },
          { ...raw, status: 'PENDING_REVIEW', active: null },
        ],
      }),
    );
    const { items } = await listPendingBatches();
    expect(items[0].active?.unitPrice).toBe('3');
    expect(items[1].active).toBeNull();
    stubFetch(answer({ items: [{ ...raw, unitPrice: 5e-7, bands: null }], total: 1 }));
    expect((await listPrices({ page: 1, pageSize: 200 })).items[0].unitPrice).toBe('0.0000005');
  });
});

describe('the resource types and their units (contract 14.2)', () => {
  it('has the seven types, each with the unit the contract gives it', () => {
    expect([...RESOURCE_TYPES]).toEqual([
      'LLM',
      'IMAGE_EDIT',
      'IMAGE_TO_VIDEO',
      'MATTING',
      'DRIVING_PREP',
      'AGE_ESTIMATION',
      'CLOUD_RENDER',
    ]);
    expect(UNIT_OF).toEqual({
      LLM: 'TOKENS_1M',
      IMAGE_EDIT: 'CALL',
      IMAGE_TO_VIDEO: 'SECOND',
      MATTING: 'CALL',
      DRIVING_PREP: 'CALL',
      AGE_ESTIMATION: 'CALL',
      CLOUD_RENDER: 'MINUTE',
    });
  });
});
