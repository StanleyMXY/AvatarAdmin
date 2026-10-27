import { beforeEach, describe, expect, it } from 'vitest';
import { MEMORY_ACCOUNT_IDS, memoryStore, resetMemoryStore } from './_core/memoryData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import memory from './memory.mock';

beforeEach(() => {
  resetStore();
  resetMemoryStore();
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (memory as unknown as Record<string, H>)[name];
const as = (user: string) => bearer(issueToken(adminOf(user)).token).authorization;
const withCodes = (user: string, ...codes: string[]) => {
  adminOf(user).permissions = codes as never;
  return user;
};
const asViewer = () => withCodes('reviewer', 'MEMORY:VIEW');

const request = (
  name: string,
  user: string,
  over: { params?: Record<string, string>; body?: unknown; query?: Record<string, string> } = {},
) => call(h(name), { headers: { authorization: as(user) }, ...over });

const SETTINGS = {
  topK: 8,
  recencyChannelEnabled: true,
  recencyChannelCount: 3,
  consolidationEnabled: false,
  consolidationThreshold: 50,
};

describe('GET /memory/tiers', () => {
  it('lists the tiers with the six fields of the contract, default first', async () => {
    const { status, body } = await request('GET /api/admin/memory/tiers', asViewer());
    expect(status).toBe(200);
    const items = body.data.items as Record<string, unknown>[];
    expect(items.map((t) => t.tierName)).toEqual(['default', 'premium']);
    expect(Object.keys(items[0]).sort()).toEqual(
      [
        'consolidationEnabled',
        'consolidationThreshold',
        'recencyChannelCount',
        'recencyChannelEnabled',
        'tierName',
        'topK',
      ].sort(),
    );
  });

  it('needs MEMORY:VIEW and a token', async () => {
    expect((await request('GET /api/admin/memory/tiers', 'support')).status).toBe(403);
    expect((await call(h('GET /api/admin/memory/tiers'))).status).toBe(401);
  });

  it('reads one tier, and answers 404 for a name that is not there', async () => {
    const ok = await request('GET /api/admin/memory/tiers/:name', asViewer(), {
      params: { name: 'premium' },
    });
    expect(ok.body.data.tierName).toBe('premium');
    const missing = await request('GET /api/admin/memory/tiers/:name', asViewer(), {
      params: { name: 'gold' },
    });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('RESOURCE_NOT_FOUND');
  });
});

describe('PUT /memory/tiers/:name', () => {
  const put = (user: string, name: string, body: unknown) =>
    request('PUT /api/admin/memory/tiers/:name', user, { params: { name }, body });

  it('needs MEMORY:TIER_CONFIG', async () => {
    const refused = await put(asViewer(), 'premium', SETTINGS);
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('ADMIN_FORBIDDEN');
  });

  it('saves the given settings and keeps the ones left out', async () => {
    const user = withCodes('reviewer', 'MEMORY:VIEW', 'MEMORY:TIER_CONFIG');
    expect((await put(user, 'premium', { topK: 30 })).status).toBe(200);
    const row = memoryStore.tiers.get('premium');
    expect(row?.topK).toBe(30);
    expect(row?.consolidationThreshold).toBe(500);
  });

  it('creates a tier that is not there, taking the settings left out from the default tier', async () => {
    const user = withCodes('reviewer', 'MEMORY:VIEW', 'MEMORY:TIER_CONFIG');
    expect((await put(user, 'gold', { topK: 12 })).status).toBe(200);
    const created = memoryStore.tiers.get('gold');
    expect(created?.topK).toBe(12);
    expect(created?.recencyChannelCount).toBe(
      memoryStore.tiers.get('default')?.recencyChannelCount,
    );
  });

  it('refuses a name that is not letters, digits, underscore and hyphen, or is too long', async () => {
    for (const name of ['bad name', 'ไทย', 'a'.repeat(65), 'a.b']) {
      const { status, body } = await put('root', name, SETTINGS);
      expect(status, name).toBe(400);
      expect(body.data.details).toEqual([{ ref: 'name', reason: 'INVALID_PATH' }]);
    }
  });

  it('refuses values out of range or of the wrong type, with the field as the ref', async () => {
    const cases: [Record<string, unknown>, string, string][] = [
      [{ topK: 0 }, 'topK', 'OUT_OF_RANGE'],
      [{ topK: 101 }, 'topK', 'OUT_OF_RANGE'],
      [{ topK: '5' }, 'topK', 'NOT_AN_INTEGER'],
      [{ topK: 2.5 }, 'topK', 'NOT_AN_INTEGER'],
      [{ topK: null }, 'topK', 'NOT_AN_INTEGER'],
      [{ recencyChannelCount: -1 }, 'recencyChannelCount', 'OUT_OF_RANGE'],
      [{ consolidationThreshold: 100001 }, 'consolidationThreshold', 'OUT_OF_RANGE'],
      [{ recencyChannelEnabled: 'true' }, 'recencyChannelEnabled', 'NOT_BOOLEAN'],
      [{ consolidationEnabled: 1 }, 'consolidationEnabled', 'NOT_BOOLEAN'],
    ];
    for (const [body, ref, reason] of cases) {
      const { status, body: reply } = await put('root', 'premium', body);
      expect(status, JSON.stringify(body)).toBe(400);
      expect(reply.data.details).toEqual([{ ref, reason }]);
    }
    expect(memoryStore.tiers.get('premium')?.topK).toBe(10);
  });

  it('answers 502 MEMORY_SERVICE_ERROR when the memory service is down, and changes nothing', async () => {
    memoryStore.serviceDown = true;
    const { status, body } = await put('root', 'premium', { topK: 30 });
    expect(status).toBe(502);
    expect(body.code).toBe('MEMORY_SERVICE_ERROR');
    expect(memoryStore.tiers.get('premium')?.topK).toBe(10);
  });
});

describe('embedding models', () => {
  const put = (user: string, name: string, body: unknown) =>
    request('PUT /api/admin/memory/embedding-models/:name', user, { params: { name }, body });
  const registrar = () => withCodes('reviewer', 'MEMORY:VIEW', 'MEMORY:MODEL_REGISTER');

  it('lists the registered models', async () => {
    const { body } = await request('GET /api/admin/memory/embedding-models', asViewer());
    expect(body.data.items).toEqual([
      { modelName: 'bge-m3', teiBaseUrl: 'https://tei.internal.example', dimensions: 1024 },
    ]);
  });

  it('registers a model with MEMORY:MODEL_REGISTER, and refuses without it', async () => {
    const body = { teiBaseUrl: 'https://tei.internal.example/v2', dimensions: 768 };
    expect((await put(asViewer(), 'e5-base', body)).status).toBe(403);
    expect((await put(registrar(), 'e5-base', body)).status).toBe(200);
    expect(memoryStore.models.get('e5-base')?.dimensions).toBe(768);
  });

  it('registers the same model with the same dimensions again without an error', async () => {
    const same = { teiBaseUrl: 'https://tei.internal.example', dimensions: 1024 };
    expect((await put('root', 'bge-m3', same)).status).toBe(200);
  });

  it('answers 409 MEMORY_MODEL_CONFLICT with the detail of the memory service when the dimensions differ', async () => {
    const { status, body } = await put('root', 'bge-m3', {
      teiBaseUrl: 'https://tei.internal.example',
      dimensions: 768,
    });
    expect(status).toBe(409);
    expect(body.code).toBe('MEMORY_MODEL_CONFLICT');
    expect(typeof body.data.detail).toBe('string');
    expect(body.data.detail).toContain('1024');
    expect(memoryStore.models.get('bge-m3')?.dimensions).toBe(1024);
  });

  it('refuses an address that is not http(s), has a user name, or is on a host that is not allowed', async () => {
    const cases: [string, string][] = [
      ['ftp://tei.internal.example', 'NOT_HTTPS'],
      ['not a url', 'NOT_HTTPS'],
      ['https://user:pw@tei.internal.example', 'INVALID_HOST'],
      ['https://elsewhere.example', 'INVALID_HOST'],
    ];
    for (const [teiBaseUrl, reason] of cases) {
      const { status, body } = await put('root', 'e5-base', { teiBaseUrl, dimensions: 768 });
      expect(status, teiBaseUrl).toBe(400);
      expect(body.data.details).toEqual([{ ref: 'teiBaseUrl', reason }]);
    }
  });

  it('refuses dimensions that are not a whole number from 1 to 8192, and a bad name', async () => {
    const url = 'https://tei.internal.example';
    const dims: [unknown, string][] = [
      [0, 'OUT_OF_RANGE'],
      [8193, 'OUT_OF_RANGE'],
      [1.5, 'NOT_AN_INTEGER'],
      ['1024', 'NOT_AN_INTEGER'],
    ];
    for (const [dimensions, reason] of dims) {
      const { status, body } = await put('root', 'e5-base', { teiBaseUrl: url, dimensions });
      expect(status).toBe(400);
      expect(body.data.details).toEqual([{ ref: 'dimensions', reason }]);
    }
    const name = await put('root', 'e5 base', { teiBaseUrl: url, dimensions: 8 });
    expect(name.body.data.details).toEqual([{ ref: 'name', reason: 'INVALID_PATH' }]);
  });
});

describe('GET /accounts/:id/memory', () => {
  const get = (user: string, id: string) =>
    request('GET /api/admin/accounts/:id/memory', user, { params: { id } });

  it('gives the tier and the assignment history with the name of the administrator', async () => {
    const { status, body } = await get(asViewer(), MEMORY_ACCOUNT_IDS.active);
    expect(status).toBe(200);
    expect(body.data.tier).toEqual({
      tierName: 'premium',
      syncStatus: 'SYNCED',
      assignedAt: expect.any(String),
      lastError: null,
    });
    expect(body.data.embeddingAssignments[0]).toEqual({
      modelName: 'bge-m3',
      assignedBy: adminOf('root').id,
      assignedByUsername: 'root',
      assignedAt: expect.any(String),
    });
  });

  it('gives null as the name when the administrator no longer exists, and keeps the ID', async () => {
    const { body } = await get(asViewer(), MEMORY_ACCOUNT_IDS.failedSync);
    expect(body.data.embeddingAssignments[0].assignedBy).toBe('9999');
    expect(body.data.embeddingAssignments[0].assignedByUsername).toBeNull();
    expect(body.data.tier.syncStatus).toBe('FAILED');
    expect(body.data.tier.lastError).toEqual(expect.any(String));
  });

  it('answers 404 for an account that is not there, and 403 without MEMORY:VIEW', async () => {
    const missing = await get(asViewer(), '424242');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('RESOURCE_NOT_FOUND');
    expect((await get('support', MEMORY_ACCOUNT_IDS.active)).status).toBe(403);
  });
});

describe('PUT /accounts/:id/memory/embedding-model', () => {
  const assigner = () => withCodes('reviewer', 'MEMORY:VIEW', 'MEMORY:MODEL_ASSIGN');
  const put = (user: string, id: string, modelName: unknown) =>
    request('PUT /api/admin/accounts/:id/memory/embedding-model', user, {
      params: { id },
      body: { modelName },
    });

  it('needs MEMORY:MODEL_ASSIGN', async () => {
    expect((await put(asViewer(), MEMORY_ACCOUNT_IDS.active, 'bge-m3')).status).toBe(403);
  });

  it('records the assignment with the administrator and the time, for an active and a banned account', async () => {
    const user = assigner();
    for (const id of [MEMORY_ACCOUNT_IDS.active, MEMORY_ACCOUNT_IDS.banned]) {
      expect((await put(user, id, 'bge-m3')).status).toBe(200);
    }
    const history = memoryStore.accounts.get(MEMORY_ACCOUNT_IDS.banned)?.assignments ?? [];
    expect(history.at(-1)).toMatchObject({ modelName: 'bge-m3', assignedBy: adminOf(user).id });
  });

  it('refuses an account waiting for deletion (403 ACCOUNT_DELETION_SCHEDULED) or being deleted (403 ACCOUNT_DELETING)', async () => {
    const user = assigner();
    const waiting = await put(user, MEMORY_ACCOUNT_IDS.pendingDeletion, 'bge-m3');
    expect([waiting.status, waiting.body.code]).toEqual([403, 'ACCOUNT_DELETION_SCHEDULED']);
    const deleting = await put(user, MEMORY_ACCOUNT_IDS.deleting, 'bge-m3');
    expect([deleting.status, deleting.body.code]).toEqual([403, 'ACCOUNT_DELETING']);
    expect(memoryStore.accounts.get(MEMORY_ACCOUNT_IDS.deleting)?.assignments).toHaveLength(0);
  });

  it('answers 404 for an account or a model that is not there, and 400 for a missing name', async () => {
    const user = assigner();
    expect((await put(user, '424242', 'bge-m3')).status).toBe(404);
    expect((await put(user, MEMORY_ACCOUNT_IDS.active, 'unknown-model')).status).toBe(404);
    const empty = await put(user, MEMORY_ACCOUNT_IDS.active, '');
    expect(empty.status).toBe(400);
    expect(empty.body.data.details).toEqual([{ ref: 'modelName', reason: 'EMPTY_NOT_ALLOWED' }]);
  });
});
