import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import { listConfig, resetConfig, saveConfig } from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

describe('config services', () => {
  it('lists the keys', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', { items: [{ key: 'a.b' }] })));
    expect((await listConfig()).items).toEqual([{ key: 'a.b' }]);
    expect(calls[0].url).toBe('/api/admin/config');
  });

  it('saves one key with { value }, whatever the value is', async () => {
    const calls = stubFetch(() =>
      jsonResponse(200, envelope('200', { key: 'k', value: 1, warnings: [] })),
    );
    await saveConfig('auth.access_ttl_minutes', 60);
    expect(calls[0].url).toBe('/api/admin/config/auth.access_ttl_minutes');
    expect(calls[0].init.method).toBe('PUT');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ value: 60 });
    await saveConfig('x.y', null);
    expect(JSON.parse(calls[1].init.body as string)).toEqual({ value: null });
    await saveConfig('x.y', ['th', 'ar']);
    expect(JSON.parse(calls[2].init.body as string)).toEqual({ value: ['th', 'ar'] });
  });

  it('resets one key with DELETE', async () => {
    const calls = stubFetch(() =>
      jsonResponse(200, envelope('200', { key: 'k', value: 5, warnings: [] })),
    );
    const result = await resetConfig('x.y');
    expect(calls[0].url).toBe('/api/admin/config/x.y');
    expect(calls[0].init.method).toBe('DELETE');
    expect(result.warnings).toEqual([]);
  });

  it('lets the backend refusal through with its details', async () => {
    stubFetch(() =>
      jsonResponse(
        400,
        envelope('INVALID_REQUEST', { details: [{ ref: 'k', reason: 'OUT_OF_RANGE' }] }),
      ),
    );
    await expect(saveConfig('k', 0)).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      details: [{ ref: 'k', reason: 'OUT_OF_RANGE' }],
    });
  });
});
