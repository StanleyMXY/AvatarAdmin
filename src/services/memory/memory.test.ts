import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import {
  assignEmbeddingModel,
  getAccountMemory,
  getTier,
  listEmbeddingModels,
  listTiers,
  registerEmbeddingModel,
  saveTier,
} from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const body = (call: { init: RequestInit }) => JSON.parse(call.init.body as string);

describe('memory services', () => {
  it('reads the tiers and one tier by name, with the name encoded in the path', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', { items: [] })));
    await listTiers();
    await getTier('pre mium/1');
    expect(calls[0].url).toBe('/api/admin/memory/tiers');
    expect(calls[1].url).toBe('/api/admin/memory/tiers/pre%20mium%2F1');
  });

  it('saves a tier with PUT and all its settings in camelCase', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', null)));
    await saveTier('premium', {
      topK: 8,
      recencyChannelEnabled: true,
      recencyChannelCount: 3,
      consolidationEnabled: false,
      consolidationThreshold: 50,
    });
    expect(calls[0].url).toBe('/api/admin/memory/tiers/premium');
    expect(calls[0].init.method).toBe('PUT');
    expect(body(calls[0])).toEqual({
      topK: 8,
      recencyChannelEnabled: true,
      recencyChannelCount: 3,
      consolidationEnabled: false,
      consolidationThreshold: 50,
    });
  });

  it('lists and registers embedding models', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', { items: [] })));
    await listEmbeddingModels();
    await registerEmbeddingModel('bge-m3', {
      teiBaseUrl: 'https://tei.internal',
      dimensions: 1024,
    });
    expect(calls[0].url).toBe('/api/admin/memory/embedding-models');
    expect(calls[1].url).toBe('/api/admin/memory/embedding-models/bge-m3');
    expect(calls[1].init.method).toBe('PUT');
    expect(body(calls[1])).toEqual({ teiBaseUrl: 'https://tei.internal', dimensions: 1024 });
  });

  it('reads the memory of an account and assigns a model to it', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', null)));
    await getAccountMemory('2001');
    await assignEmbeddingModel('2001', 'bge-m3');
    expect(calls[0].url).toBe('/api/admin/accounts/2001/memory');
    expect(calls[1].url).toBe('/api/admin/accounts/2001/memory/embedding-model');
    expect(calls[1].init.method).toBe('PUT');
    expect(body(calls[1])).toEqual({ modelName: 'bge-m3' });
  });
});
