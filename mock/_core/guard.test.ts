import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticate, guard, hasPermission } from './auth';
import { MockHttpError, ok, toUmi } from './http';
import { adminForToken, issueToken, resetStore, store } from './store';
import { adminOf, bearer, call, makeReq } from './testing';

beforeEach(() => resetStore());

const tokenOf = (username: string) => issueToken(adminOf(username)).token;

describe('authenticate', () => {
  it('finds the administrator of a valid bearer token', () => {
    expect(authenticate(makeReq({ headers: bearer(tokenOf('support')) })).username).toBe('support');
  });

  it.each([
    ['no header', {}],
    ['no Bearer word', { authorization: 'abc' }],
    ['empty token', { authorization: 'Bearer ' }],
    ['unknown token', { authorization: 'Bearer mock.not-issued' }],
    ['Basic scheme', { authorization: 'Basic dXNlcjpwdw==' }],
    ['two tokens', { authorization: 'Bearer a b' }],
  ])('refuses %s with 401 ADMIN_INVALID_TOKEN', (_name, headers) => {
    try {
      authenticate(makeReq({ headers }));
      throw new Error('should refuse');
    } catch (e) {
      expect(e).toBeInstanceOf(MockHttpError);
      expect([(e as MockHttpError).httpStatus, (e as MockHttpError).code]).toEqual([
        401,
        'ADMIN_INVALID_TOKEN',
      ]);
    }
  });

  it('refuses a tampered token', () => {
    const token = tokenOf('support');
    expect(() => authenticate(makeReq({ headers: bearer(`${token}x`) }))).toThrow(MockHttpError);
    expect(() => authenticate(makeReq({ headers: bearer(token.slice(0, -1)) }))).toThrow(
      MockHttpError,
    );
  });

  it('refuses an expired token', () => {
    const token = tokenOf('support');
    (store.tokens.get(token) as { expiresAt: number }).expiresAt = Date.now() - 1;
    expect(adminForToken(token)).toBeUndefined();
    expect(() => authenticate(makeReq({ headers: bearer(token) }))).toThrow(MockHttpError);
  });

  it('refuses the token of a disabled administrator and of one whose token version moved on', () => {
    const a = tokenOf('support');
    adminOf('support').status = 'DISABLED';
    expect(adminForToken(a)).toBeUndefined();
    adminOf('support').status = 'ACTIVE';
    expect(adminForToken(a)).toBeDefined();
    adminOf('support').tokenVersion += 1;
    expect(adminForToken(a)).toBeUndefined();
  });

  it('reads the header case-insensitively by name (express lower-cases it)', () => {
    expect(
      authenticate(makeReq({ headers: { authorization: `Bearer ${tokenOf('root')}` } })).username,
    ).toBe('root');
  });

  it('takes the first of a repeated header', () => {
    const token = tokenOf('root');
    expect(
      authenticate(makeReq({ headers: { authorization: [`Bearer ${token}`, 'Bearer other'] } }))
        .username,
    ).toBe('root');
  });
});

describe('hasPermission', () => {
  it('matches exactly; a list means any of', () => {
    const support = adminOf('support');
    expect(hasPermission(support, 'USER:VIEW')).toBe(true);
    expect(hasPermission(support, 'USER:EXPORT')).toBe(false);
    expect(hasPermission(support, ['USER:EXPORT', 'USER:BAN'])).toBe(true);
    expect(hasPermission(support, ['USER:EXPORT', 'ADMIN:MANAGE'])).toBe(false);
    expect(hasPermission(support, [])).toBe(false);
  });

  it('lets the super administrator through everything', () => {
    expect(hasPermission(adminOf('root'), 'ADMIN:MANAGE')).toBe(true);
  });
});

describe('guard', () => {
  const handler = vi.fn((req: { admin: { username: string } }) => ok({ who: req.admin.username }));
  const run = (
    perm: Parameters<typeof guard>[0],
    headers: Record<string, string>,
    options?: { allowMustChange?: boolean },
  ) => call(guard(perm, handler as never, options), { headers });

  beforeEach(() => {
    handler.mockClear();
  });

  it('without a token answers 401 ADMIN_INVALID_TOKEN and does not run the handler', async () => {
    const { status, body } = await run('USER:VIEW', {});
    expect([status, body.code, body.data]).toEqual([401, 'ADMIN_INVALID_TOKEN', null]);
    expect(handler).not.toHaveBeenCalled();
  });

  it('with a tampered token answers 401', async () => {
    const { status, body } = await run('USER:VIEW', bearer(`${tokenOf('support')}zz`));
    expect([status, body.code]).toEqual([401, 'ADMIN_INVALID_TOKEN']);
  });

  it('without the permission answers 403 ADMIN_FORBIDDEN and does not run the handler', async () => {
    const { status, body } = await run('ADMIN:MANAGE', bearer(tokenOf('support')));
    expect([status, body.code]).toEqual([403, 'ADMIN_FORBIDDEN']);
    expect(handler).not.toHaveBeenCalled();
  });

  it('with the permission runs the handler with req.admin', async () => {
    const { status, body } = await run('USER:VIEW', bearer(tokenOf('support')));
    expect([status, body.code, body.data]).toEqual([200, '200', { who: 'support' }]);
  });

  it('needs only a sign-in for null', async () => {
    expect((await run(null, bearer(tokenOf('fresh')))).status).toBe(200);
  });

  it('lets the super administrator pass any permission', async () => {
    expect((await run('ADMIN:MANAGE', bearer(tokenOf('root')))).status).toBe(200);
  });

  it('while the password must be changed answers 403 for everything except handlers that allow it', async () => {
    const headers = bearer(tokenOf('newhire'));
    const blocked = await run(null, headers);
    expect([blocked.status, blocked.body.code]).toEqual([403, 'ADMIN_FORBIDDEN']);
    expect((await run('USER:VIEW', headers)).status).toBe(403);
    expect((await run(null, headers, { allowMustChange: true })).status).toBe(200);
  });

  it('turns a thrown MockHttpError into its reply and any other error into 500 INTERNAL_ERROR', async () => {
    const throwing = guard(null, () => {
      throw new MockHttpError(409, 'INVALID_STATE', 'no', { status: 'ENDED' });
    });
    const failed = await call(throwing, { headers: bearer(tokenOf('root')) });
    expect([failed.status, failed.body.code, failed.body.data]).toEqual([
      409,
      'INVALID_STATE',
      { status: 'ENDED' },
    ]);
    const crashing = guard(null, () => {
      throw new Error('bug');
    });
    const crashed = await call(crashing, { headers: bearer(tokenOf('root')) });
    expect([crashed.status, crashed.body.code]).toEqual([500, 'INTERNAL_ERROR']);
  });

  it('supports async handlers', async () => {
    const asyncHandler = guard(null, async () => ok(1));
    expect((await call(asyncHandler, { headers: bearer(tokenOf('root')) })).body.data).toBe(1);
  });
});

describe('toUmi', () => {
  it('writes the status and the envelope', async () => {
    const { status, body } = await call(
      toUmi(() => ({ status: 201, body: { code: '200', message: 'success', data: 1 } })),
    );
    expect([status, body.data]).toEqual([201, 1]);
  });
});
