import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import { changePassword, enrollTotp, getAdminMeta, getMe, login, normalizeMe } from './index';

beforeEach(() => {
  sessionStorage.clear();
  resetSessionState();
});
afterEach(() => vi.unstubAllGlobals());

describe('login', () => {
  it('posts the user name, the password and, when given, the code', async () => {
    const calls = stubFetch(() =>
      jsonResponse(200, envelope('200', { token: 't', expiresAt: '2026-10-26T08:00:00Z' })),
    );
    await login({ username: 'root', password: 'pw', totp: '000000' });
    expect(calls[0].url).toBe('/api/admin/auth/login');
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      username: 'root',
      password: 'pw',
      totp: '000000',
    });
  });

  it('leaves the code out when there is none', async () => {
    const calls = stubFetch(() =>
      jsonResponse(200, envelope('200', { token: 't', expiresAt: 'x' })),
    );
    await login({ username: 'root', password: 'pw' });
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ username: 'root', password: 'pw' });
  });

  it('sends no Authorization header even when a token is held (signing in is not done with an old session)', async () => {
    setToken('old-token');
    const calls = stubFetch(() =>
      jsonResponse(200, envelope('200', { token: 't', expiresAt: 'x' })),
    );
    await login({ username: 'root', password: 'pw' });
    expect(Object.keys(calls[0].init.headers).map((k) => k.toLowerCase())).not.toContain(
      'authorization',
    );
  });

  it('returns a token answer as it is, and the enrollment answer with its status', async () => {
    stubFetch(() => jsonResponse(200, envelope('200', { token: 't', expiresAt: 'x' })));
    expect(await login({ username: 'a', password: 'b' })).toEqual({ token: 't', expiresAt: 'x' });
    stubFetch(() =>
      jsonResponse(
        200,
        envelope('200', { status: 'ENROLL_REQUIRED', enrollToken: 'e', otpauthUri: 'otpauth://x' }),
      ),
    );
    expect(await login({ username: 'a', password: 'b' })).toEqual({
      status: 'ENROLL_REQUIRED',
      enrollToken: 'e',
      otpauthUri: 'otpauth://x',
    });
  });

  it('throws the backend error with its code', async () => {
    stubFetch(() => jsonResponse(401, envelope('ADMIN_TOTP_REQUIRED')));
    await expect(login({ username: 'a', password: 'b' })).rejects.toMatchObject({
      code: 'ADMIN_TOTP_REQUIRED',
    });
  });
});

describe('enrollTotp, changePassword', () => {
  it('posts the enrollment token and the code to the enroll path', async () => {
    const calls = stubFetch(() =>
      jsonResponse(200, envelope('200', { token: 't', expiresAt: 'x' })),
    );
    await enrollTotp({ enrollToken: 'e', totp: '123456' });
    expect(calls[0].url).toBe('/api/admin/auth/totp/enroll');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ enrollToken: 'e', totp: '123456' });
  });

  it('sends no Authorization header for the enrollment either: the enrollment token is in the body', async () => {
    setToken('old-token');
    const calls = stubFetch(() =>
      jsonResponse(200, envelope('200', { token: 't', expiresAt: 'x' })),
    );
    await enrollTotp({ enrollToken: 'e', totp: '123456' });
    expect(Object.keys(calls[0].init.headers).map((k) => k.toLowerCase())).not.toContain(
      'authorization',
    );
  });

  it('posts the old and the new password with the token', async () => {
    setToken('tok');
    const calls = stubFetch(() => jsonResponse(200, envelope('200', null)));
    await changePassword({ oldPassword: 'a b ', newPassword: ' c d' });
    expect(calls[0].url).toBe('/api/admin/auth/change-password');
    expect(calls[0].init.headers.Authorization).toBe('Bearer tok');
    // Passwords are sent exactly as typed: no trimming, no hashing.
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      oldPassword: 'a b ',
      newPassword: ' c d',
    });
  });
});

describe('getMe', () => {
  it('reads the account and keeps what the backend sent', async () => {
    setToken('tok');
    const calls = stubFetch(() =>
      jsonResponse(
        200,
        envelope('200', {
          id: '7',
          username: 'ploy',
          superAdmin: false,
          mustChangePassword: false,
          permissions: ['USER:VIEW'],
          passwordMinLength: 12,
        }),
      ),
    );
    const me = await getMe();
    expect(calls[0].url).toBe('/api/admin/me');
    expect(me).toEqual({
      id: '7',
      username: 'ploy',
      superAdmin: false,
      mustChangePassword: false,
      permissions: ['USER:VIEW'],
      passwordMinLength: 12,
    });
  });

  it('treats missing fields as missing, without an error', async () => {
    stubFetch(() => jsonResponse(200, envelope('200', { username: 'x' })));
    expect(await getMe()).toEqual({
      id: undefined,
      username: 'x',
      superAdmin: false,
      mustChangePassword: false,
      permissions: [],
      passwordMinLength: undefined,
    });
  });
});

describe('normalizeMe', () => {
  it('accepts only the strict values for the flags and a clean list of codes', () => {
    expect(
      normalizeMe({
        superAdmin: 'true',
        mustChangePassword: 1,
        permissions: ['A:B', 3, null, 'C:D'],
        passwordMinLength: -4,
        username: '',
      }),
    ).toEqual({
      id: undefined,
      username: undefined,
      superAdmin: false,
      mustChangePassword: false,
      permissions: ['A:B', 'C:D'],
      passwordMinLength: undefined,
    });
  });

  it('gives a nothing-account for an answer that is not an object', () => {
    for (const raw of [null, undefined, 'x', 5, []]) {
      expect(normalizeMe(raw).permissions).toEqual([]);
      expect(normalizeMe(raw).superAdmin).toBe(false);
    }
  });

  it('keeps a user name in any script', () => {
    for (const name of ['สมชาย', 'أحمد', 'Nguyễn', '王小明', 'José', 'Budi']) {
      expect(normalizeMe({ username: name }).username).toBe(name);
    }
  });
});

describe('getAdminMeta', () => {
  it('returns the fields of the answer', async () => {
    setToken('tok');
    const calls = stubFetch(() =>
      jsonResponse(200, envelope('200', { maxRecipients: null, uploadMaxBytes: 1048576 })),
    );
    expect(await getAdminMeta()).toEqual({ maxRecipients: null, uploadMaxBytes: 1048576 });
    expect(calls[0].url).toBe('/api/admin/meta');
  });

  it('returns nothing, not an error, when the endpoint is missing or the network fails', async () => {
    stubFetch(() => jsonResponse(404, envelope('RESOURCE_NOT_FOUND')));
    expect(await getAdminMeta()).toEqual({});
    stubFetch(() => {
      throw new TypeError('offline');
    });
    expect(await getAdminMeta()).toEqual({});
  });

  it('returns nothing for a lost session too (the request layer has already told the session)', async () => {
    stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')));
    expect(await getAdminMeta()).toEqual({});
  });
});
