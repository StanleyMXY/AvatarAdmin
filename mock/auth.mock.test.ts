import { beforeEach, describe, expect, it } from 'vitest';
import { META_DEFAULTS, META_FIELDS } from './_core/meta';
import { ALL_CODES } from './_core/permissions';
import {
  FAKE_TOTP_CODE,
  mockPassword,
  PASSWORD_MIN_LENGTH,
  resetStore,
  store,
  TOTP_LOCKOUT_MINUTES,
  TOTP_MAX_FAILURES,
} from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import auth from './auth.mock';
import systemPermissions from './system.permissions.mock';

const login = (body: Record<string, unknown>) => call(auth['POST /api/admin/auth/login'], { body });
const enroll = (body: Record<string, unknown>) =>
  call(auth['POST /api/admin/auth/totp/enroll'], { body });
const changePassword = (token: string, body: Record<string, unknown>) =>
  call(auth['POST /api/admin/auth/change-password'], { headers: bearer(token), body });
const me = (token?: string) =>
  call(auth['GET /api/admin/me'], { headers: token ? bearer(token) : {} });
const meta = (token?: string) =>
  call(auth['GET /api/admin/meta'], { headers: token ? bearer(token) : {} });

const signIn = async (username: string) => {
  const result = await login({ username, password: mockPassword(username), totp: FAKE_TOTP_CODE });
  return result.body.data.token as string;
};

beforeEach(() => resetStore());

describe('the endpoints the mock backend serves', () => {
  it('are keyed the way Umi expects', () => {
    expect(Object.keys(auth).sort()).toEqual([
      'GET /api/admin/me',
      'GET /api/admin/meta',
      'POST /api/admin/auth/change-password',
      'POST /api/admin/auth/login',
      'POST /api/admin/auth/totp/enroll',
    ]);
    expect(Object.keys(systemPermissions)).toEqual(['GET /api/admin/permissions']);
  });
});

describe('POST /auth/login', () => {
  it('answers 401 ADMIN_INVALID_CREDENTIALS for a wrong password', async () => {
    const { status, body } = await login({
      username: 'root',
      password: 'wrong-password-xx',
      totp: FAKE_TOTP_CODE,
    });
    expect([status, body.code, body.data]).toEqual([401, 'ADMIN_INVALID_CREDENTIALS', null]);
  });

  it('answers the same for an unknown user, so the two cannot be told apart', async () => {
    const unknown = await login({
      username: 'nobody',
      password: 'x'.repeat(14),
      totp: FAKE_TOTP_CODE,
    });
    const wrong = await login({ username: 'root', password: 'x'.repeat(14), totp: FAKE_TOTP_CODE });
    expect(unknown).toEqual(wrong);
  });

  it('answers the same for a disabled administrator with the right password', async () => {
    adminOf('support').status = 'DISABLED';
    const { status, body } = await login({
      username: 'support',
      password: mockPassword('support'),
      totp: FAKE_TOTP_CODE,
    });
    expect([status, body.code]).toEqual([401, 'ADMIN_INVALID_CREDENTIALS']);
  });

  it('answers 401 ADMIN_TOTP_REQUIRED when an enrolled administrator sends no code', async () => {
    const { status, body } = await login({ username: 'root', password: mockPassword('root') });
    expect([status, body.code]).toEqual([401, 'ADMIN_TOTP_REQUIRED']);
    const empty = await login({ username: 'root', password: mockPassword('root'), totp: '' });
    expect(empty.body.code).toBe('ADMIN_TOTP_REQUIRED');
  });

  it('answers 401 ADMIN_TOTP_INVALID for a wrong code', async () => {
    const { status, body } = await login({
      username: 'root',
      password: mockPassword('root'),
      totp: '123456',
    });
    expect([status, body.code]).toEqual([401, 'ADMIN_TOTP_INVALID']);
  });

  it('answers 200 with a token and its expiry for the right code', async () => {
    const { status, body } = await login({
      username: 'root',
      password: mockPassword('root'),
      totp: FAKE_TOTP_CODE,
    });
    expect([status, body.code]).toEqual([200, '200']);
    expect(typeof body.data.token).toBe('string');
    expect(new Date(body.data.expiresAt).getTime()).toBeGreaterThan(Date.now() + 7 * 3600 * 1000);
    expect(Object.keys(body.data).sort()).toEqual(['expiresAt', 'token']);
  });

  it('issues a different token on each login, not a fixed one', async () => {
    expect(await signIn('root')).not.toBe(await signIn('root'));
  });

  it('answers 200 ENROLL_REQUIRED with an enrollToken and otpauthUri for an administrator who has no authenticator yet', async () => {
    const { status, body } = await login({ username: 'fresh', password: mockPassword('fresh') });
    expect([status, body.code, body.data.status]).toEqual([200, '200', 'ENROLL_REQUIRED']);
    expect(body.data.enrollToken).toBeTruthy();
    expect(body.data.otpauthUri).toMatch(/^otpauth:\/\/totp\/AvatarApp:fresh\?/);
    expect(body.data.token).toBeUndefined();
  });

  it('asks the wrong-password caller for nothing about the code', async () => {
    const { body } = await login({ username: 'fresh', password: 'wrong-wrong-wrong' });
    expect(body.code).toBe('ADMIN_INVALID_CREDENTIALS');
  });

  it('answers 400 INVALID_REQUEST EMPTY_NOT_ALLOWED for missing fields', async () => {
    const { status, body } = await login({ username: 'root' });
    expect([status, body.code]).toEqual([400, 'INVALID_REQUEST']);
    expect(body.data.details).toEqual([{ ref: 'password', reason: 'EMPTY_NOT_ALLOWED' }]);
    expect((await login({})).body.data.details.map((d: { ref: string }) => d.ref)).toEqual([
      'username',
      'password',
    ]);
    expect((await call(auth['POST /api/admin/auth/login'], {})).status).toBe(400);
  });

  it('is case sensitive about the user name', async () => {
    expect(
      (await login({ username: 'ROOT', password: mockPassword('root'), totp: FAKE_TOTP_CODE }))
        .status,
    ).toBe(401);
  });

  it('locks the user name after repeated wrong codes with 429 RATE_LIMITED and retryAfterSeconds', async () => {
    for (let i = 1; i < TOTP_MAX_FAILURES; i++) {
      expect(
        (await login({ username: 'root', password: mockPassword('root'), totp: '111111' })).status,
      ).toBe(401);
    }
    const locked = await login({
      username: 'root',
      password: mockPassword('root'),
      totp: '111111',
    });
    expect([locked.status, locked.body.code]).toEqual([429, 'RATE_LIMITED']);
    expect(locked.body.data.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    const correctButLocked = await login({
      username: 'root',
      password: mockPassword('root'),
      totp: FAKE_TOTP_CODE,
    });
    expect(correctButLocked.status).toBe(429);
  });

  it('resets the count of wrong codes after a right one', async () => {
    for (let i = 1; i < TOTP_MAX_FAILURES; i++)
      await login({ username: 'root', password: mockPassword('root'), totp: '111111' });
    expect(
      (await login({ username: 'root', password: mockPassword('root'), totp: FAKE_TOTP_CODE }))
        .status,
    ).toBe(200);
    for (let i = 1; i < TOTP_MAX_FAILURES; i++) {
      expect(
        (await login({ username: 'root', password: mockPassword('root'), totp: '111111' })).status,
      ).toBe(401);
    }
  });
});

describe('POST /auth/totp/enroll', () => {
  const start = async () =>
    (await login({ username: 'fresh', password: mockPassword('fresh') })).body.data
      .enrollToken as string;

  it('answers 401 ADMIN_TOTP_INVALID for a wrong code and keeps the enrollment token usable', async () => {
    const enrollToken = await start();
    const wrong = await enroll({ enrollToken, totp: '999999' });
    expect([wrong.status, wrong.body.code]).toEqual([401, 'ADMIN_TOTP_INVALID']);
    expect((await enroll({ enrollToken, totp: FAKE_TOTP_CODE })).status).toBe(200);
  });

  it('returns a token on success, and the administrator can then sign in with the code', async () => {
    const enrollToken = await start();
    const { status, body } = await enroll({ enrollToken, totp: FAKE_TOTP_CODE });
    expect([status, body.code]).toEqual([200, '200']);
    expect(body.data.token).toBeTruthy();
    expect((await me(body.data.token)).body.data.username).toBe('fresh');
    expect((await login({ username: 'fresh', password: mockPassword('fresh') })).body.code).toBe(
      'ADMIN_TOTP_REQUIRED',
    );
    expect(
      (await login({ username: 'fresh', password: mockPassword('fresh'), totp: FAKE_TOTP_CODE }))
        .status,
    ).toBe(200);
  });

  it('uses the enrollment token once', async () => {
    const enrollToken = await start();
    await enroll({ enrollToken, totp: FAKE_TOTP_CODE });
    const again = await enroll({ enrollToken, totp: FAKE_TOTP_CODE });
    expect([again.status, again.body.code]).toEqual([401, 'ADMIN_INVALID_TOKEN']);
  });

  it('refuses an unknown, expired or missing enrollment token', async () => {
    expect((await enroll({ enrollToken: 'enroll.nope', totp: FAKE_TOTP_CODE })).body.code).toBe(
      'ADMIN_INVALID_TOKEN',
    );
    const enrollToken = await start();
    (store.enrollTokens.get(enrollToken) as { expiresAt: number }).expiresAt = Date.now() - 1;
    expect((await enroll({ enrollToken, totp: FAKE_TOTP_CODE })).body.code).toBe(
      'ADMIN_INVALID_TOKEN',
    );
    expect((await enroll({ totp: FAKE_TOTP_CODE })).status).toBe(400);
    expect((await enroll({ enrollToken: 'x' })).status).toBe(400);
  });

  it('does not accept a login token as an enrollment token', async () => {
    const token = await signIn('root');
    expect((await enroll({ enrollToken: token, totp: FAKE_TOTP_CODE })).status).toBe(401);
  });
});

describe('POST /auth/change-password', () => {
  const newPassword = 'a-brand-new-password';

  it('changes the password; the old token stops working and no new token is returned', async () => {
    const token = await signIn('support');
    const { status, body } = await changePassword(token, {
      oldPassword: mockPassword('support'),
      newPassword,
    });
    expect([status, body.code, body.data]).toEqual([200, '200', null]);
    expect((await me(token)).status).toBe(401);
    expect(
      (
        await login({
          username: 'support',
          password: mockPassword('support'),
          totp: FAKE_TOTP_CODE,
        })
      ).status,
    ).toBe(401);
    expect(
      (await login({ username: 'support', password: newPassword, totp: FAKE_TOTP_CODE })).status,
    ).toBe(200);
  });

  it('also works while the password must be changed, and clears that state', async () => {
    const token = await signIn('newhire');
    expect((await me(token)).body.data.mustChangePassword).toBe(true);
    expect(
      (await changePassword(token, { oldPassword: mockPassword('newhire'), newPassword })).status,
    ).toBe(200);
    const fresh = await login({ username: 'newhire', password: newPassword, totp: FAKE_TOTP_CODE });
    expect((await me(fresh.body.data.token)).body.data.mustChangePassword).toBe(false);
  });

  it('refuses a wrong old password and leaves the token and password alone', async () => {
    const token = await signIn('support');
    const { status, body } = await changePassword(token, {
      oldPassword: 'not-the-old-one',
      newPassword,
    });
    expect([status, body.code]).toEqual([401, 'ADMIN_INVALID_CREDENTIALS']);
    expect((await me(token)).status).toBe(200);
  });

  it('refuses a new password that is too short or equals the user name, naming the field', async () => {
    const token = await signIn('support');
    const short = await changePassword(token, {
      oldPassword: mockPassword('support'),
      newPassword: 'x'.repeat(PASSWORD_MIN_LENGTH - 1),
    });
    expect([short.status, short.body.code]).toEqual([400, 'INVALID_REQUEST']);
    expect(short.body.data.details).toEqual([{ ref: 'newPassword', reason: 'OUT_OF_RANGE' }]);
    expect(
      (
        await changePassword(token, {
          oldPassword: mockPassword('support'),
          newPassword: 'x'.repeat(PASSWORD_MIN_LENGTH),
        })
      ).status,
    ).toBe(200);
  });

  it('counts the length in characters, not UTF-16 units', async () => {
    const token = await signIn('support');
    const emoji = '😀'.repeat(PASSWORD_MIN_LENGTH);
    expect([...emoji]).toHaveLength(PASSWORD_MIN_LENGTH);
    expect(emoji.length).toBe(PASSWORD_MIN_LENGTH * 2);
    const shortEmoji = await changePassword(token, {
      oldPassword: mockPassword('support'),
      newPassword: '😀'.repeat(PASSWORD_MIN_LENGTH - 6),
    });
    expect(shortEmoji.status).toBe(400);
  });

  it('needs a token and both fields', async () => {
    expect((await call(auth['POST /api/admin/auth/change-password'], { body: {} })).status).toBe(
      401,
    );
    const token = await signIn('support');
    expect((await changePassword(token, { oldPassword: mockPassword('support') })).status).toBe(
      400,
    );
  });
});

describe('GET /me', () => {
  it('gives an ordinary administrator their own permission codes and the fields of the contract', async () => {
    const token = await signIn('support');
    const { status, body } = await me(token);
    expect(status).toBe(200);
    expect(Object.keys(body.data).sort()).toEqual([
      'id',
      'mustChangePassword',
      'passwordMinLength',
      'permissions',
      'superAdmin',
      'username',
    ]);
    expect(body.data).toMatchObject({
      username: 'support',
      superAdmin: false,
      mustChangePassword: false,
      passwordMinLength: PASSWORD_MIN_LENGTH,
    });
    expect(typeof body.data.id).toBe('string');
    expect([...body.data.permissions].sort()).toEqual([...adminOf('support').permissions].sort());
  });

  it('gives the super administrator all 79 built-in codes', async () => {
    const { body } = await me(await signIn('root'));
    expect(body.data.superAdmin).toBe(true);
    expect([...body.data.permissions].sort()).toEqual([...ALL_CODES].sort());
    expect(body.data.permissions).toHaveLength(79);
  });

  it('works while the password must be changed', async () => {
    const { status, body } = await me(await signIn('newhire'));
    expect([status, body.data.mustChangePassword]).toEqual([200, true]);
  });

  it('answers 401 ADMIN_INVALID_TOKEN without a token', async () => {
    const { status, body } = await me();
    expect([status, body.code, body.data]).toEqual([401, 'ADMIN_INVALID_TOKEN', null]);
  });

  it('does not hand out the password or token data', async () => {
    const { body } = await me(await signIn('root'));
    expect(JSON.stringify(body)).not.toMatch(/mock-password|tokenVersion|totpFailures|lockedUntil/);
  });
});

describe('GET /meta', () => {
  it('is a flat object of exactly 20 fields: 12 configuration values and 8 upload limits', async () => {
    const { status, body } = await meta(await signIn('support'));
    expect(status).toBe(200);
    expect(Object.keys(body.data).sort()).toEqual([...META_FIELDS].sort());
    expect(META_FIELDS).toHaveLength(20);
    expect(body.data.pushImageMaxBytes).toBe(1048576);
  });

  it('carries the defaults of contract 17.5 and the fixed upload limits of backend reply 3', async () => {
    const { body } = await meta(await signIn('finance'));
    expect(body.data).toEqual(META_DEFAULTS);
    // The twelve values typed in again from contract 17.5, so the table above cannot agree with itself by accident.
    expect(body.data).toMatchObject({
      supportedLocales: ['en'],
      landIntervalMinutes: 15,
      allowedCurrencies: ['USD'],
      deletionAlertAfterFailures: 5,
      inviteChainMaxDepth: 5,
      maxRecipients: 1000,
      pushImageMaxBytes: 1048576,
      statsMaxRangeDays: 366,
      analyticsLiveMaxRangeDays: 31,
      abuseClusterMinFreeAccounts: 5,
      attributionClickRetentionDays: 30,
      declarationRequired: true,
      uploadMaxBytes: 209715200,
      adMediaMaxBytes: 52428800,
      apkMaxBytes: 104857600,
      renderAssetMaxBytes: 104857600,
    });
    expect(body.data).toMatchObject({
      supportedLocales: ['en'],
      allowedCurrencies: ['USD'],
      declarationRequired: true,
      catalogImageMaxBytes: 2097152,
      catalogImageMaxPixels: 36000000,
      adImageMaxPixels: 36000000,
      defaultAvatarSourceMaxPixels: 250000000,
    });
  });

  it('types: lists of strings, one boolean, the rest whole numbers', async () => {
    const { body } = await meta(await signIn('root'));
    for (const [key, value] of Object.entries(body.data)) {
      if (Array.isArray(value)) expect(value.every((v) => typeof v === 'string')).toBe(true);
      else if (typeof value === 'boolean') expect(key).toBe('declarationRequired');
      else expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('answers 403 ADMIN_FORBIDDEN while the password must be changed, and 401 without a token', async () => {
    const forced = await meta(await signIn('newhire'));
    expect([forced.status, forced.body.code]).toEqual([403, 'ADMIN_FORBIDDEN']);
    expect((await meta()).status).toBe(401);
  });

  it('gives a copy: changing the answer does not change the defaults', async () => {
    const token = await signIn('root');
    const first = await meta(token);
    first.body.data.supportedLocales.push('x');
    expect((await meta(token)).body.data.supportedLocales).toEqual(['en']);
  });
});

describe('GET /permissions', () => {
  const tree = (token?: string) =>
    call(systemPermissions['GET /api/admin/permissions'], { headers: token ? bearer(token) : {} });

  it('answers the tree nodes in { items } for an administrator who may read it', async () => {
    const { status, body } = await tree(await signIn('root'));
    expect(status).toBe(200);
    expect(body.data.items).toHaveLength(79);
    expect(Object.keys(body.data.items[0]).sort()).toEqual([
      'builtin',
      'code',
      'createdByUsername',
      'nameEn',
      'nameZh',
      'parent',
      'sortOrder',
      'type',
    ]);
  });

  it('refuses an administrator who has neither ROLE:MANAGE nor PERMISSION:MANAGE', async () => {
    const { status, body } = await tree(await signIn('support'));
    expect([status, body.code]).toEqual([403, 'ADMIN_FORBIDDEN']);
    expect((await tree()).status).toBe(401);
  });

  it('allows either of the two permissions', async () => {
    const token = await signIn('support');
    const admin = adminOf('support');
    admin.permissions = ['ROLE:MANAGE'];
    expect((await tree(token)).status).toBe(200);
    admin.permissions = ['PERMISSION:MANAGE'];
    expect((await tree(token)).status).toBe(200);
  });
});

describe('the order of the checks in login (contract 17.2: the password first, whether or not the user exists)', () => {
  it('does not ask for a verification code when the password is wrong', async () => {
    const { body } = await login({ username: 'root', password: 'wrong-wrong-wrong' });
    expect(body.code).toBe('ADMIN_INVALID_CREDENTIALS');
    expect(
      (await login({ username: 'root', password: 'wrong-wrong-wrong', totp: '' })).body.code,
    ).toBe('ADMIN_INVALID_CREDENTIALS');
  });

  it('does not say whether the code was right when the password is wrong', async () => {
    const { body } = await login({
      username: 'root',
      password: 'wrong-wrong-wrong',
      totp: FAKE_TOTP_CODE,
    });
    expect(body.code).toBe('ADMIN_INVALID_CREDENTIALS');
  });
});

describe('the lock after wrong codes', () => {
  const wrong = () => login({ username: 'root', password: mockPassword('root'), totp: '111111' });
  const lock = async () => {
    for (let i = 0; i < TOTP_MAX_FAILURES; i++) await wrong();
  };

  it('lasts 5 minutes: retryAfterSeconds is about 300', async () => {
    expect(TOTP_LOCKOUT_MINUTES).toBe(5);
    expect(TOTP_MAX_FAILURES).toBe(5);
    await lock();
    const { body } = await login({
      username: 'root',
      password: mockPassword('root'),
      totp: FAKE_TOTP_CODE,
    });
    expect(body.data.retryAfterSeconds).toBeGreaterThan(290);
    expect(body.data.retryAfterSeconds).toBeLessThanOrEqual(300);
  });

  it('ends: after the time has passed the right code signs in', async () => {
    await lock();
    adminOf('root').lockedUntil = Date.now() - 1;
    expect(
      (await login({ username: 'root', password: mockPassword('root'), totp: FAKE_TOTP_CODE }))
        .status,
    ).toBe(200);
  });

  it('locks by user name, not for everyone', async () => {
    await lock();
    expect(
      (
        await login({
          username: 'support',
          password: mockPassword('support'),
          totp: FAKE_TOTP_CODE,
        })
      ).status,
    ).toBe(200);
  });

  it('also stops enrollment, and a lock reached while enrolling voids the enrollment token', async () => {
    const enrollToken = (await login({ username: 'fresh', password: mockPassword('fresh') })).body
      .data.enrollToken as string;
    for (let i = 1; i < TOTP_MAX_FAILURES; i++) {
      expect((await enroll({ enrollToken, totp: '111111' })).body.code).toBe('ADMIN_TOTP_INVALID');
    }
    const last = await enroll({ enrollToken, totp: '111111' });
    expect([last.status, last.body.code]).toEqual([429, 'RATE_LIMITED']);
    adminOf('fresh').lockedUntil = 0;
    const afterwards = await enroll({ enrollToken, totp: FAKE_TOTP_CODE });
    expect([afterwards.status, afterwards.body.code]).toEqual([401, 'ADMIN_INVALID_TOKEN']);
  });

  it('refuses enrollment with the right code while the user name is locked', async () => {
    const enrollToken = (await login({ username: 'fresh', password: mockPassword('fresh') })).body
      .data.enrollToken as string;
    adminOf('fresh').lockedUntil = Date.now() + 60_000;
    expect((await enroll({ enrollToken, totp: FAKE_TOTP_CODE })).status).toBe(429);
  });

  it('a right code on enrollment resets the count of wrong ones', async () => {
    const start = async () =>
      (await login({ username: 'fresh', password: mockPassword('fresh') })).body.data
        .enrollToken as string;
    const first = await start();
    for (let i = 1; i < TOTP_MAX_FAILURES; i++)
      await enroll({ enrollToken: first, totp: '111111' });
    expect(adminOf('fresh').totpFailures).toBe(TOTP_MAX_FAILURES - 1);
    await enroll({ enrollToken: first, totp: FAKE_TOTP_CODE });
    expect(adminOf('fresh').totpFailures).toBe(0);
  });
});

describe('enrollment tokens', () => {
  it('are valid for 10 minutes', async () => {
    const enrollToken = (await login({ username: 'fresh', password: mockPassword('fresh') })).body
      .data.enrollToken as string;
    const left =
      (store.enrollTokens.get(enrollToken) as { expiresAt: number }).expiresAt - Date.now();
    expect(left).toBeGreaterThan(9 * 60 * 1000);
    expect(left).toBeLessThanOrEqual(10 * 60 * 1000);
  });

  it('do not work for an administrator who has been disabled since', async () => {
    const enrollToken = (await login({ username: 'fresh', password: mockPassword('fresh') })).body
      .data.enrollToken as string;
    adminOf('fresh').status = 'DISABLED';
    expect((await enroll({ enrollToken, totp: FAKE_TOTP_CODE })).body.code).toBe(
      'ADMIN_INVALID_TOKEN',
    );
  });
});

describe('change-password rules that the preset names cannot reach', () => {
  it('refuses a new password equal to the user name', async () => {
    const admin = adminOf('support');
    admin.username = 'a-really-long-user-name';
    const token = (
      await login({ username: admin.username, password: admin.password, totp: FAKE_TOTP_CODE })
    ).body.data.token as string;
    const { status, body } = await changePassword(token, {
      oldPassword: admin.password,
      newPassword: admin.username,
    });
    expect([status, body.code]).toEqual([400, 'INVALID_REQUEST']);
    expect(body.data.details).toEqual([{ ref: 'newPassword', reason: 'OUT_OF_RANGE' }]);
  });
});

describe('me for a super administrator', () => {
  it('lists every built-in code even when the stored list is empty', async () => {
    const token = await signIn('root');
    adminOf('root').permissions = [];
    const { body } = await me(token);
    expect(body.data.permissions).toHaveLength(79);
  });

  it('lists only the stored codes for an ordinary administrator, however the flag looks', async () => {
    const token = await signIn('support');
    adminOf('support').permissions = ['USER:VIEW'];
    expect((await me(token)).body.data.permissions).toEqual(['USER:VIEW']);
  });
});
