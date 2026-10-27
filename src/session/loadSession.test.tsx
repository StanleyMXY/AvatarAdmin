import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../tests/httpStubs';
import { resetUmiStub, setTestInitialState } from '../../tests/stubs/umi-max';
import { resetSessionState, setToken } from '../request/session';
import { loadSession } from './loadSession';
import { useAdminMeta } from './useSession';

const meBody = (extra: Record<string, unknown> = {}) =>
  envelope('200', {
    id: '1',
    username: 'ploy',
    superAdmin: false,
    mustChangePassword: false,
    permissions: ['USER:VIEW'],
    passwordMinLength: 12,
    ...extra,
  });

beforeEach(() => {
  resetUmiStub();
  sessionStorage.clear();
  resetSessionState();
});
afterEach(() => vi.unstubAllGlobals());

describe('loadSession', () => {
  it('is empty and asks nothing when there is no token', async () => {
    const calls = stubFetch(() => jsonResponse(200, meBody()));
    expect(await loadSession()).toEqual({});
    expect(calls).toHaveLength(0);
  });

  it('reads the account and then the shared values', async () => {
    setToken('tok');
    const calls = stubFetch((call) =>
      jsonResponse(
        200,
        call.url.endsWith('/me')
          ? meBody()
          : envelope('200', { maxRecipients: null, uploadMaxBytes: 5 }),
      ),
    );
    const state = await loadSession();
    expect(state.me?.username).toBe('ploy');
    expect(state.meta).toEqual({ maxRecipients: null, uploadMaxBytes: 5 });
    expect(calls.map((c) => c.url)).toEqual(['/api/admin/me', '/api/admin/meta']);
  });

  it('does not ask for the shared values while the password must be changed (the server refuses them then)', async () => {
    setToken('tok');
    const calls = stubFetch(() => jsonResponse(200, meBody({ mustChangePassword: true })));
    const state = await loadSession();
    expect(state.me?.mustChangePassword).toBe(true);
    expect(state.meta).toBeUndefined();
    expect(calls.map((c) => c.url)).toEqual(['/api/admin/me']);
  });

  it('gives the account with empty shared values when the endpoint is missing or the network fails', async () => {
    setToken('tok');
    stubFetch((call) =>
      call.url.endsWith('/me')
        ? jsonResponse(200, meBody())
        : jsonResponse(404, envelope('RESOURCE_NOT_FOUND')),
    );
    expect((await loadSession()).meta).toEqual({});
    stubFetch((call) => {
      if (call.url.endsWith('/me')) return jsonResponse(200, meBody());
      throw new TypeError('offline');
    });
    expect((await loadSession()).meta).toEqual({});
  });

  it('is empty when the token is no longer good, and the token is gone', async () => {
    setToken('old');
    stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')));
    expect(await loadSession()).toEqual({});
    expect(sessionStorage.getItem('avatar-admin.token')).toBeNull();
  });

  it('is empty when the account cannot be read for another reason', async () => {
    setToken('tok');
    stubFetch(() => {
      throw new TypeError('offline');
    });
    expect(await loadSession()).toEqual({});
  });
});

describe('useAdminMeta', () => {
  it('is an empty object when nothing was read, without an error', () => {
    setTestInitialState({});
    expect(renderHook(() => useAdminMeta()).result.current).toEqual({});
    setTestInitialState(undefined);
    expect(renderHook(() => useAdminMeta()).result.current).toEqual({});
  });

  it('gives what was read, a null included', () => {
    setTestInitialState({ me: {}, meta: { maxRecipients: null, pushImageMaxBytes: 1024 } });
    const meta = renderHook(() => useAdminMeta()).result.current;
    expect(meta.maxRecipients).toBeNull();
    expect(meta.pushImageMaxBytes).toBe(1024);
  });
});
