import { beforeEach, describe, expect, it } from 'vitest';
import { PERMISSION_CODES } from '../src/access/permissionCodes';
import { issueToken, resetStore, store } from './_core/store';
import { resetSystemStore, systemState } from './_core/systemData';
import { adminOf, bearer, call } from './_core/testing';
import system from './system.mock';
import systemPermissions from './system.permissions.mock';

const tokenOf = (username: string) => bearer(issueToken(adminOf(username)).token);
const as = (username: string) => ({ headers: tokenOf(username) });
const GOOD_PASSWORD = 'a-long-enough-pass-1';

const run = (
  key: keyof typeof system,
  username: string,
  req: { body?: unknown; params?: Record<string, string>; query?: Record<string, unknown> } = {},
) => call(system[key], { ...as(username), ...req });
const readTree = (username: string) =>
  call(systemPermissions['GET /api/admin/permissions'], as(username));

/** An administrator with these codes (not a super administrator). */
const withCodes = (username: string, codes: string[]) => {
  adminOf(username).permissions = codes as never;
};

/** The ids of the roles an administrator has now, as an update must repeat them. */
const adminRoleIds = (username: string): string[] => [
  ...(systemState.extras.get(adminOf(username).id)?.roleIds ?? []),
];

beforeEach(() => {
  resetStore();
  resetSystemStore();
});

describe('the endpoints and the permissions they ask for', () => {
  it('has exactly the endpoints of the system management row, and none that changes an audit row', () => {
    expect(Object.keys(system).sort()).toEqual(
      [
        'DELETE /api/admin/admins/:id',
        'DELETE /api/admin/permissions/:code',
        'DELETE /api/admin/roles/:id',
        'GET /api/admin/admins',
        'GET /api/admin/audit-logs',
        'GET /api/admin/audit-logs/admins',
        'GET /api/admin/audit-logs/meta',
        'GET /api/admin/roles',
        'POST /api/admin/admins',
        'POST /api/admin/admins/:id/reset-password',
        'POST /api/admin/admins/:id/reset-totp',
        'POST /api/admin/admins/:id/status',
        'POST /api/admin/permissions',
        'POST /api/admin/roles',
        'PUT /api/admin/admins/:id',
        'PUT /api/admin/permissions/:code',
        'PUT /api/admin/roles/:id',
      ].sort(),
    );
  });

  it('answers 401 without a token and 403 ADMIN_FORBIDDEN without the code, for every endpoint', async () => {
    const needs: [keyof typeof system, string[]][] = [
      ['GET /api/admin/admins', ['ADMIN:MANAGE']],
      ['POST /api/admin/admins', ['ADMIN:MANAGE']],
      ['PUT /api/admin/admins/:id', ['ADMIN:MANAGE']],
      ['POST /api/admin/admins/:id/status', ['ADMIN:MANAGE']],
      ['POST /api/admin/admins/:id/reset-password', ['ADMIN:MANAGE']],
      ['POST /api/admin/admins/:id/reset-totp', ['ADMIN:MANAGE']],
      ['DELETE /api/admin/admins/:id', ['ADMIN:MANAGE']],
      ['GET /api/admin/roles', ['ROLE:MANAGE', 'ADMIN:MANAGE']],
      ['POST /api/admin/roles', ['ROLE:MANAGE']],
      ['PUT /api/admin/roles/:id', ['ROLE:MANAGE']],
      ['DELETE /api/admin/roles/:id', ['ROLE:MANAGE']],
      ['POST /api/admin/permissions', ['PERMISSION:MANAGE']],
      ['PUT /api/admin/permissions/:code', ['PERMISSION:MANAGE']],
      ['DELETE /api/admin/permissions/:code', ['PERMISSION:MANAGE']],
      ['GET /api/admin/audit-logs', ['AUDIT:VIEW']],
      ['GET /api/admin/audit-logs/meta', ['AUDIT:VIEW']],
      ['GET /api/admin/audit-logs/admins', ['AUDIT:VIEW']],
    ];
    for (const [key, codes] of needs) {
      expect((await call(system[key], {})).status, key).toBe(401);
      withCodes('support', ['STATS:VIEW']);
      const refused = await run(key, 'support', { params: { id: '1001', code: 'X' } });
      expect([key, refused.status, refused.body.code]).toEqual([key, 403, 'ADMIN_FORBIDDEN']);
      for (const code of codes) {
        withCodes('support', [code]);
        const allowed = await run(key, 'support', { params: { id: '99999', code: 'X' }, body: {} });
        expect([key, code, allowed.body.code === 'ADMIN_FORBIDDEN']).toEqual([key, code, false]);
      }
    }
  });
});

describe('GET /admins', () => {
  it('lists the administrators with their roles by name, newest first, in the shape of the contract', async () => {
    const { status, body } = await run('GET /api/admin/admins', 'root');
    expect(status).toBe(200);
    expect(body.data.total).toBe(6);
    const support = body.data.items.find((a: { username: string }) => a.username === 'support');
    expect(Object.keys(support).sort()).toEqual([
      'createdAt',
      'id',
      'lastLoginAt',
      'mustChangePassword',
      'roles',
      'status',
      'superAdmin',
      'totpEnrolledAt',
      'username',
    ]);
    expect(support.roles).toEqual([{ id: '1', name: 'Soporte al cliente' }]);
    const keys = JSON.stringify(body);
    for (const secret of ['password', 'mock-password', 'tokenVersion', 'totpLastStep']) {
      expect(keys).not.toContain(secret);
    }
  });

  it('pages, and refuses a page size over 200', async () => {
    const page = await run('GET /api/admin/admins', 'root', {
      query: { page: '2', pageSize: '4' },
    });
    expect(page.body.data.items).toHaveLength(2);
    const bad = await run('GET /api/admin/admins', 'root', { query: { pageSize: '201' } });
    expect(bad.status).toBe(400);
    expect(bad.body.data.details).toEqual([{ ref: 'pageSize', reason: 'OUT_OF_RANGE' }]);
  });
});

describe('POST /admins', () => {
  const create = (over: Record<string, unknown> = {}, who = 'root') =>
    run('POST /api/admin/admins', who, {
      body: {
        username: 'anna',
        password: GOOD_PASSWORD,
        roleIds: ['1'],
        superAdmin: false,
        ...over,
      },
    });

  it('creates an administrator who must change the password and can sign in with the roles', async () => {
    const { status, body } = await create();
    expect(status).toBe(200);
    expect(body.data).toMatchObject({
      username: 'anna',
      mustChangePassword: true,
      superAdmin: false,
      status: 'ACTIVE',
      roles: [{ id: '1', name: 'Soporte al cliente' }],
    });
    expect(JSON.stringify(body)).not.toContain(GOOD_PASSWORD);
    const made = [...store.admins.values()].find((a) => a.username === 'anna');
    expect(made?.permissions).toEqual(adminOf('support').permissions);
    expect(made?.password).toBe(GOOD_PASSWORD);
  });

  it('refuses a short password, the user name as password, an empty name and an unknown role', async () => {
    expect((await create({ password: 'short' })).body.data.details).toEqual([
      { ref: 'password', reason: 'OUT_OF_RANGE' },
    ]);
    expect((await create({ username: 'a-user-name-12', password: 'a-user-name-12' })).status).toBe(
      400,
    );
    expect((await create({ username: '   ' })).body.data.details[0]).toEqual({
      ref: 'username',
      reason: 'EMPTY_NOT_ALLOWED',
    });
    expect((await create({ roleIds: ['404'] })).body.data.details).toEqual([
      { ref: 'roleIds', reason: 'OUT_OF_RANGE' },
    ]);
  });

  it('answers 409 DUPLICATE_RESOURCE with data.field username, whatever the case', async () => {
    const { status, body } = await create({ username: 'SUPPORT' });
    expect([status, body.code, body.data]).toEqual([
      409,
      'DUPLICATE_RESOURCE',
      { field: 'username' },
    ]);
  });

  it('lets only a super administrator make a super administrator', async () => {
    withCodes('support', ['ADMIN:MANAGE']);
    const refused = await create({ superAdmin: true }, 'support');
    expect([refused.status, refused.body.code]).toEqual([403, 'ADMIN_FORBIDDEN']);
    expect((await create({ superAdmin: true })).body.data.superAdmin).toBe(true);
  });

  it('writes an audit row that names what was set and never the password', async () => {
    await create();
    const row = systemState.audit[0];
    expect(row).toMatchObject({
      action: 'ADMIN_CREATE',
      adminUsername: 'root',
      targetType: 'ADMIN',
    });
    expect(JSON.stringify(row)).not.toContain(GOOD_PASSWORD);
  });
});

describe('PUT /admins/:id', () => {
  /** An update as the backend wants it (answer 44): the user name and the whole list of roles every time. */
  const put = (who: string, id: string, body: Record<string, unknown>) =>
    run('PUT /api/admin/admins/:id', who, { params: { id }, body });

  it('changes the roles, and the permissions follow the roles', async () => {
    const { status, body } = await put('root', '1005', {
      username: 'newhire',
      roleIds: ['2', '6'],
    });
    expect(status).toBe(200);
    expect(body.data.roles.map((r: { id: string }) => r.id).sort()).toEqual(['2', '6']);
    expect(adminOf('newhire').permissions).toContain('AUDIT:VIEW');
    expect(adminOf('newhire').permissions).toContain('COST:VIEW');
    expect(adminOf('newhire').permissions).not.toContain('USER:VIEW');
  });

  it('needs the user name and the list of roles on every update: a missing one is 400 EMPTY_NOT_ALLOWED, not "keep it"', async () => {
    const before = adminOf('newhire').permissions;
    const noName = await put('root', '1005', { roleIds: ['1'] });
    expect([noName.status, noName.body.code, noName.body.data.details]).toEqual([
      400,
      'INVALID_REQUEST',
      [{ ref: 'username', reason: 'EMPTY_NOT_ALLOWED' }],
    ]);
    const blankName = await put('root', '1005', { username: '   ', roleIds: ['1'] });
    expect(blankName.body.data.details).toEqual([{ ref: 'username', reason: 'EMPTY_NOT_ALLOWED' }]);
    const noRoles = await put('root', '1005', { username: 'newhire' });
    expect([noRoles.status, noRoles.body.data.details]).toEqual([
      400,
      [{ ref: 'roleIds', reason: 'EMPTY_NOT_ALLOWED' }],
    ]);
    const nullRoles = await put('root', '1005', { username: 'newhire', roleIds: null });
    expect(nullRoles.body.data.details).toEqual([{ ref: 'roleIds', reason: 'EMPTY_NOT_ALLOWED' }]);
    const unknown = await put('root', '1005', { username: 'newhire', roleIds: ['404'] });
    expect(unknown.body.data.details).toEqual([{ ref: 'roleIds', reason: 'OUT_OF_RANGE' }]);
    expect(adminOf('newhire').permissions).toEqual(before);
  });

  it('takes every role away only for [] sent on purpose, and keeps the flag when it is not sent', async () => {
    const { status } = await put('root', '1005', { username: 'newhire', roleIds: [] });
    expect(status).toBe(200);
    expect(adminOf('newhire').permissions).toEqual([]);
    expect(adminOf('newhire').superAdmin).toBe(false);
  });

  it('renames the administrator with the update, and refuses a name that is taken (409 DUPLICATE_RESOURCE) without changing anything', async () => {
    const taken = await put('root', '1005', { username: 'REVIEWER', roleIds: ['1'] });
    expect([taken.status, taken.body.code]).toEqual([409, 'DUPLICATE_RESOURCE']);
    expect(adminOf('newhire').username).toBe('newhire');
    const renamed = await put('root', '1005', { username: 'newhire2', roleIds: ['1'] });
    expect([renamed.status, renamed.body.data.username]).toEqual([200, 'newhire2']);
  });

  it('lets the own row be updated when the roles are the same set (in any order) and the flag is not sent or the same: a rename works', async () => {
    withCodes('support', ['ADMIN:MANAGE']);
    const sameRoles = await put('support', '1002', { username: 'support', roleIds: ['1'] });
    expect(sameRoles.status).toBe(200);
    const sameFlag = await put('support', '1002', {
      username: 'support',
      roleIds: ['1'],
      superAdmin: false,
    });
    expect(sameFlag.status).toBe(200);
    const renamed = await put('support', '1002', { username: 'soporte', roleIds: ['1'] });
    expect([renamed.status, renamed.body.data.username]).toEqual([200, 'soporte']);
    // a super administrator too: the same flag is not a change
    const root = await put('root', '1001', {
      username: 'root',
      roleIds: adminRoleIds('root'),
      superAdmin: true,
    });
    expect(root.status).toBe(200);
  });

  it('refuses a change of the own roles or the own flag with 409 INVALID_STATE and data.status, not 403 (answer 22), and changes nothing', async () => {
    withCodes('support', ['ADMIN:MANAGE']);
    const taken = await put('support', '1002', { username: 'support', roleIds: [] });
    expect([taken.status, taken.body.code, taken.body.data]).toEqual([
      409,
      'INVALID_STATE',
      { status: 'ACTIVE', reason: 'SELF_PROTECTED' },
    ]);
    expect(systemState.extras.get('1002')?.roleIds).toEqual(['1']);
    for (const body of [
      { username: 'root', roleIds: ['1'], superAdmin: true },
      { username: 'root', roleIds: adminRoleIds('root'), superAdmin: false },
      { username: 'root', roleIds: ['1', ...adminRoleIds('root')] },
    ]) {
      const refused = await put('root', '1001', body);
      expect([JSON.stringify(body), refused.status, refused.body.code, refused.body.data]).toEqual([
        JSON.stringify(body),
        409,
        'INVALID_STATE',
        { status: 'ACTIVE', reason: 'SELF_PROTECTED' },
      ]);
    }
    expect(adminOf('root').superAdmin).toBe(true);
  });

  it('lets only a super administrator set or clear the flag (a flag with the same value is not a change)', async () => {
    withCodes('support', ['ADMIN:MANAGE', 'USER:VIEW', 'STATS:VIEW']);
    const rolesOf = adminRoleIds('newhire');
    const refused = await put('support', '1005', {
      username: 'newhire',
      roleIds: rolesOf,
      superAdmin: true,
    });
    expect([refused.status, refused.body.code, refused.body.data]).toEqual([
      403,
      'ADMIN_FORBIDDEN',
      { reason: 'SUPER_FLAG' },
    ]);
    expect(adminOf('newhire').superAdmin).toBe(false);
    const same = await put('support', '1005', {
      username: 'newhire',
      roleIds: rolesOf,
      superAdmin: false,
    });
    expect(same.status).toBe(200);
    const ok = await put('root', '1005', {
      username: 'newhire',
      roleIds: rolesOf,
      superAdmin: true,
    });
    expect(ok.body.data.superAdmin).toBe(true);
    // the other fields stay open to the administrator with ADMIN:MANAGE, within what they hold
    withCodes('support', [
      'ADMIN:MANAGE',
      'MODERATION:VIEW',
      'MODERATION:REVIEW',
      'MODERATION:CONFIG',
      'COMPLAINT:VIEW',
      'COMPLAINT:MANAGE',
      'USER:VIEW',
      'STATS:VIEW',
    ]);
    const roles = await put('support', '1004', { username: 'reviewer', roleIds: ['4'] });
    expect(roles.status).toBe(200);
  });

  it('lets a super administrator clear the flag of another one; for the own row it is 409 INVALID_STATE', async () => {
    adminOf('finance').superAdmin = true;
    const other = await put('root', '1003', {
      username: 'finance',
      roleIds: adminRoleIds('finance'),
      superAdmin: false,
    });
    expect(other.status).toBe(200);
    expect(other.body.data.superAdmin).toBe(false);
    const own = await put('root', '1001', {
      username: 'root',
      roleIds: adminRoleIds('root'),
      superAdmin: false,
    });
    expect([own.status, own.body.code]).toEqual([409, 'INVALID_STATE']);
    expect(adminOf('root').superAdmin).toBe(true);
  });

  it('answers 404 RESOURCE_NOT_FOUND for an unknown administrator', async () => {
    const { status, body } = await put('root', '31337', { username: 'x', roleIds: [] });
    expect([status, body.code]).toEqual([404, 'RESOURCE_NOT_FOUND']);
  });
});

describe('POST /admins/:id/status', () => {
  const setStatus = (who: string, id: string, status: string) =>
    run('POST /api/admin/admins/:id/status', who, { params: { id }, body: { status } });

  it('disables and enables, and the token of a disabled administrator is void at once', async () => {
    const { adminForToken } = await import('./_core/store');
    const token = issueToken(adminOf('reviewer')).token;
    expect(adminForToken(token)).toBeDefined();
    expect((await setStatus('root', '1004', 'DISABLED')).body.data.status).toBe('DISABLED');
    expect(adminForToken(token)).toBeUndefined();
    expect((await setStatus('root', '1004', 'ACTIVE')).body.data.status).toBe('ACTIVE');
  });

  it('refuses to change the status of oneself, either way (409 INVALID_STATE with data.status, answer 22), and to disable the last enabled super administrator (409)', async () => {
    for (const status of ['DISABLED', 'ACTIVE']) {
      const self = await setStatus('root', '1001', status);
      expect([status, self.status, self.body.code, self.body.data]).toEqual([
        status,
        409,
        'INVALID_STATE',
        { status: 'ACTIVE', reason: 'SELF_PROTECTED' },
      ]);
    }
    withCodes('support', [...PERMISSION_CODES]);
    const last = await setStatus('support', '1001', 'DISABLED');
    expect([last.status, last.body.code, last.body.data]).toEqual([
      403,
      'ADMIN_FORBIDDEN',
      { reason: 'SUPER_TARGET' },
    ]);
    expect(adminOf('root').status).toBe('ACTIVE');
    // with a second enabled super administrator the first can be disabled (by a super administrator)
    adminOf('finance').superAdmin = true;
    expect((await setStatus('finance', '1001', 'DISABLED')).status).toBe(200);
  });

  it('refuses a status that is not ACTIVE or DISABLED, before it looks for the administrator', async () => {
    expect((await setStatus('root', '1004', 'GONE')).status).toBe(400);
    expect((await setStatus('root', '31337', 'GONE')).status).toBe(400);
    expect((await setStatus('root', '31337', 'DISABLED')).status).toBe(404);
  });
});

describe('reset password, reset authenticator, delete', () => {
  it('resets the password: the rules apply, the administrator must change it, and the tokens are void', async () => {
    const short = await run('POST /api/admin/admins/:id/reset-password', 'root', {
      params: { id: '1004' },
      body: { newPassword: 'short' },
    });
    expect(short.body.data.details).toEqual([{ ref: 'newPassword', reason: 'OUT_OF_RANGE' }]);
    const done = await run('POST /api/admin/admins/:id/reset-password', 'root', {
      params: { id: '1004' },
      body: { newPassword: GOOD_PASSWORD },
    });
    expect(done.status).toBe(200);
    expect(JSON.stringify(done.body)).not.toContain(GOOD_PASSWORD);
    expect(adminOf('reviewer')).toMatchObject({
      mustChangePassword: true,
      password: GOOD_PASSWORD,
    });
    expect(JSON.stringify(systemState.audit[0])).not.toContain(GOOD_PASSWORD);
  });

  it('resets the authenticator: the administrator binds a new one at the next sign-in', async () => {
    expect(adminOf('reviewer').totpEnrolled).toBe(true);
    const done = await run('POST /api/admin/admins/:id/reset-totp', 'root', {
      params: { id: '1004' },
    });
    expect(done.status).toBe(200);
    expect(adminOf('reviewer').totpEnrolled).toBe(false);
  });

  it('deletes an administrator but never oneself or the last enabled super administrator, and keeps the audit rows', async () => {
    const self = await run('DELETE /api/admin/admins/:id', 'root', { params: { id: '1001' } });
    expect([self.status, self.body.code, self.body.data]).toEqual([
      409,
      'INVALID_STATE',
      { status: 'ACTIVE', reason: 'SELF_PROTECTED' },
    ]);
    withCodes('support', [...PERMISSION_CODES]);
    // holding every code does not make a non-super operator a super administrator (SUPER_TARGET)
    const last = await run('DELETE /api/admin/admins/:id', 'support', { params: { id: '1001' } });
    expect([last.status, last.body.code, last.body.data]).toEqual([
      403,
      'ADMIN_FORBIDDEN',
      { reason: 'SUPER_TARGET' },
    ]);
    expect(store.admins.has('1001')).toBe(true);
    const before = systemState.audit.filter((r) => r.adminId === '1004').length;
    const gone = await run('DELETE /api/admin/admins/:id', 'root', { params: { id: '1004' } });
    expect(gone.status).toBe(200);
    expect(store.admins.has('1004')).toBe(false);
    expect(systemState.audit.filter((r) => r.adminId === '1004')).toHaveLength(before);
  });
});

// The two 409 INVALID_STATE that a session of one request at a time cannot meet: the last enabled
// super administrator (a second super administrator changed at the same moment) and a change of a super
// administrator that is under way. `systemState.race` makes the next write on a super administrator
// other than the operator meet one of them.
describe('409 INVALID_STATE data.reason of a race between super administrators (backend answer 22)', () => {
  const routes = (id: string) =>
    [
      ['PUT /api/admin/admins/:id', { username: 'finance', roleIds: adminRoleIds('finance') }],
      ['POST /api/admin/admins/:id/status', { status: 'DISABLED' }],
      ['POST /api/admin/admins/:id/reset-password', { newPassword: GOOD_PASSWORD }],
      ['POST /api/admin/admins/:id/reset-totp', {}],
      ['DELETE /api/admin/admins/:id', undefined],
    ].map(([key, body]) => run(key as keyof typeof system, 'root', { params: { id }, body }));
  const answers = (id: string) => Promise.all(routes(id));

  it.each(['LAST_SUPER_ADMIN', 'CONCURRENT_CHANGE'] as const)(
    'answers %s with the current status, on all five routes, and changes nothing',
    async (race) => {
      adminOf('finance').superAdmin = true;
      systemState.race = race;
      const before = JSON.stringify([adminOf('finance'), systemState.extras.get('1003')]);
      for (const answer of await answers('1003')) {
        expect([answer.status, answer.body.code, answer.body.data]).toEqual([
          409,
          'INVALID_STATE',
          { status: 'ACTIVE', reason: race },
        ]);
      }
      expect(JSON.stringify([adminOf('finance'), systemState.extras.get('1003')])).toBe(before);
      expect(store.admins.has('1003')).toBe(true);
    },
  );

  it('does not touch an administrator who is not a super administrator, and the own account stays SELF_PROTECTED', async () => {
    systemState.race = 'CONCURRENT_CHANGE';
    const other = await run('POST /api/admin/admins/:id/reset-totp', 'root', {
      params: { id: '1004' },
    });
    expect(other.status).toBe(200);
    const own = await run('DELETE /api/admin/admins/:id', 'root', { params: { id: '1001' } });
    expect(own.body.data).toEqual({ status: 'ACTIVE', reason: 'SELF_PROTECTED' });
  });

  it('is off after resetSystemStore', async () => {
    systemState.race = 'LAST_SUPER_ADMIN';
    resetSystemStore();
    expect(systemState.race).toBeNull();
  });
});

describe('roles', () => {
  const body = {
    name: 'Auditor',
    remark: 'read only',
    permissionCodes: ['AUDIT:VIEW', 'ADMIN:MANAGE'],
  };

  it('is readable with ROLE:MANAGE and also with ADMIN:MANAGE, for the role choice', async () => {
    withCodes('support', ['ADMIN:MANAGE']);
    expect((await run('GET /api/admin/roles', 'support')).status).toBe(200);
    withCodes('support', ['USER:VIEW']);
    expect((await run('GET /api/admin/roles', 'support')).status).toBe(403);
  });

  it('lists with ascending permission codes', async () => {
    const { body: answer } = await run('GET /api/admin/roles', 'root');
    expect(answer.data.total).toBe(7);
    for (const role of answer.data.items) {
      expect(role.permissionCodes).toEqual([...role.permissionCodes].sort());
    }
  });

  it('creates a role with sorted codes, refuses a code that is not a node and a name that exists', async () => {
    const made = await run('POST /api/admin/roles', 'root', { body });
    expect(made.body.data.permissionCodes).toEqual(['ADMIN:MANAGE', 'AUDIT:VIEW']);
    const unknown = await run('POST /api/admin/roles', 'root', {
      body: { ...body, name: 'Other', permissionCodes: ['NOT:A_NODE'] },
    });
    expect([unknown.status, unknown.body.data.details]).toEqual([
      400,
      [{ ref: 'permissionCodes', reason: 'OUT_OF_RANGE' }],
    ]);
    const twice = await run('POST /api/admin/roles', 'root', {
      body: { ...body, name: 'auditor' },
    });
    expect([twice.status, twice.body.code, twice.body.data]).toEqual([
      409,
      'DUPLICATE_RESOURCE',
      { field: 'name' },
    ]);
  });

  it('replaces the whole set of codes on update and the administrators with the role follow', async () => {
    expect(adminOf('newhire').permissions).toEqual(['STATS:VIEW', 'USER:VIEW']);
    const updated = await run('PUT /api/admin/roles/:id', 'root', {
      params: { id: '4' },
      body: { name: 'Pengguna baru', remark: null, permissionCodes: ['STATS:VIEW'] },
    });
    expect(updated.body.data.permissionCodes).toEqual(['STATS:VIEW']);
    expect(adminOf('newhire').permissions).toEqual(['STATS:VIEW']);
  });

  it('refuses to delete a role that an administrator still has: 409 ROLE_IN_USE; an unused role goes', async () => {
    const used = await run('DELETE /api/admin/roles/:id', 'root', { params: { id: '1' } });
    expect([used.status, used.body.code]).toEqual([409, 'ROLE_IN_USE']);
    expect(systemState.roles.has('1')).toBe(true);
    const free = await run('DELETE /api/admin/roles/:id', 'root', { params: { id: '6' } });
    expect(free.status).toBe(200);
    expect(systemState.roles.has('6')).toBe(false);
  });
});

describe('the permission tree', () => {
  const create = (over: Record<string, unknown> = {}) =>
    run('POST /api/admin/permissions', 'root', {
      body: {
        code: 'CUSTOM:GROUP',
        parent: null,
        type: 'MENU',
        sortOrder: 500,
        nameZh: '自定义分组',
        nameEn: 'Custom group',
        ...over,
      },
    });
  const update = (code: string, body: Record<string, unknown>) =>
    run('PUT /api/admin/permissions/:code', 'root', { params: { code }, body });
  // An update always carries the parent: absent is null (backend answer 87), not "unchanged".
  const rename = { nameZh: '名', nameEn: 'name', sortOrder: 5 };
  const parentOf = (code: string) => systemState.nodes.get(code)?.parent ?? null;
  const renameKeepingParent = (code: string) => ({ ...rename, parent: parentOf(code) });

  it('is read with ROLE:MANAGE or PERMISSION:MANAGE and with nothing else', async () => {
    for (const [codes, status] of [
      [['ROLE:MANAGE'], 200],
      [['PERMISSION:MANAGE'], 200],
      [['ADMIN:MANAGE', 'AUDIT:VIEW'], 403],
    ] as const) {
      withCodes('support', [...codes]);
      expect((await readTree('support')).status).toBe(status);
    }
  });

  it('starts with the 79 built-in nodes and has the custom ones of this session after them', async () => {
    expect((await readTree('root')).body.data.items).toHaveLength(PERMISSION_CODES.length);
    await create();
    const items = (await readTree('root')).body.data.items;
    expect(items).toHaveLength(PERMISSION_CODES.length + 1);
    expect(items.at(-1)).toMatchObject({ code: 'CUSTOM:GROUP', builtin: false, parent: null });
  });

  it('creates a custom node; a code that exists gives 409 DUPLICATE_RESOURCE with data.field code', async () => {
    expect((await create()).status).toBe(200);
    const twice = await create();
    expect([twice.status, twice.body.code, twice.body.data]).toEqual([
      409,
      'DUPLICATE_RESOURCE',
      { field: 'code' },
    ]);
    expect((await create({ code: 'USER:VIEW' })).body.code).toBe('DUPLICATE_RESOURCE');
    expect((await create({ code: 'CUSTOM:X', parent: 'NOPE' })).body.data.details).toEqual([
      { ref: 'parent', reason: 'OUT_OF_RANGE' },
    ]);
  });

  it('lets a built-in node change its names and order, and refuses a new parent', async () => {
    const done = await update('USER:BAN', renameKeepingParent('USER:BAN'));
    expect(done.body.data).toMatchObject({
      code: 'USER:BAN',
      nameEn: 'name',
      sortOrder: 5,
      parent: 'USER:VIEW',
    });
    const moved = await update('USER:BAN', { ...rename, parent: 'ABUSE:VIEW' });
    expect([moved.status, moved.body.data.details]).toEqual([
      400,
      [{ ref: 'parent', reason: 'OUT_OF_RANGE' }],
    ]);
    // the same parent written again is no change
    expect((await update('USER:BAN', { ...rename, parent: 'USER:VIEW' })).status).toBe(200);
  });

  it('refuses a new type for a node, built in or not: 400 on type, nothing changes; the same type written again is no change', async () => {
    await create({ code: 'CUSTOM:T', type: 'FUNCTION', parent: 'USER:VIEW' });
    for (const [code, type] of [
      ['USER:BAN', 'MENU'],
      ['CUSTOM:T', 'MENU'],
    ]) {
      const before = JSON.stringify(systemState.nodes.get(code));
      const refused = await update(code, { ...renameKeepingParent(code), type });
      expect([code, refused.status, refused.body.code, refused.body.data.details]).toEqual([
        code,
        400,
        'INVALID_REQUEST',
        [{ ref: 'type', reason: 'OUT_OF_RANGE' }],
      ]);
      expect(JSON.stringify(systemState.nodes.get(code))).toBe(before);
    }
    const keep = renameKeepingParent('CUSTOM:T');
    expect((await update('CUSTOM:T', { ...keep, type: 'FUNCTION' })).status).toBe(200);
    expect((await update('CUSTOM:T', keep)).status).toBe(200);
  });

  it('lets a custom node change its parent, and refuses a loop: under itself or under a descendant', async () => {
    await create({ code: 'CUSTOM:A' });
    await create({ code: 'CUSTOM:B', parent: 'CUSTOM:A' });
    await create({ code: 'CUSTOM:C', parent: 'CUSTOM:B' });
    await create({ code: 'CUSTOM:D' });
    expect((await update('CUSTOM:D', { ...rename, parent: 'CUSTOM:A' })).body.data.parent).toBe(
      'CUSTOM:A',
    );
    for (const parent of ['CUSTOM:A', 'CUSTOM:B', 'CUSTOM:C']) {
      const loop = await update('CUSTOM:A', { ...rename, parent });
      expect([parent, loop.status]).toEqual([parent, 400]);
    }
    expect(systemState.nodes.get('CUSTOM:A')?.parent).toBe(null);
    expect((await update('CUSTOM:C', { ...rename, parent: 'CUSTOM:A' })).status).toBe(200);
    expect((await update('CUSTOM:A', { ...rename, parent: null })).status).toBe(200);
  });

  it('takes an update without parent as parent null (backend answer 87): a custom node goes to the root, a built-in node with a parent is refused on parent', async () => {
    await create({ code: 'CUSTOM:A' });
    await create({ code: 'CUSTOM:B', parent: 'CUSTOM:A' });
    const moved = await update('CUSTOM:B', rename);
    expect([moved.status, moved.body.data.parent]).toEqual([200, null]);
    const builtin = await update('USER:BAN', rename);
    expect([builtin.status, builtin.body.code, builtin.body.data.details]).toEqual([
      400,
      'INVALID_REQUEST',
      [{ ref: 'parent', reason: 'OUT_OF_RANGE' }],
    ]);
    expect(parentOf('USER:BAN')).toBe('USER:VIEW');
    // with the parent it was read with, the same update is fine; a built-in node that is a root needs null
    expect((await update('USER:BAN', renameKeepingParent('USER:BAN'))).status).toBe(200);
    const root = [...systemState.nodes.values()].find((n) => n.builtin && n.parent === null);
    expect(root).toBeDefined();
    expect((await update(String(root?.code), rename)).status).toBe(200);
  });

  it('needs both names on an update: a missing or blank one is 400 on that name; the order stays when it is not sent', async () => {
    await create({ code: 'CUSTOM:A', sortOrder: 77 });
    const noZh = await update('CUSTOM:A', { nameEn: 'x', parent: null });
    expect([noZh.status, noZh.body.data.details]).toEqual([
      400,
      [{ ref: 'nameZh', reason: 'EMPTY_NOT_ALLOWED' }],
    ]);
    const blankEn = await update('CUSTOM:A', { nameZh: 'x', nameEn: '  ', parent: null });
    expect(blankEn.body.data.details).toEqual([{ ref: 'nameEn', reason: 'EMPTY_NOT_ALLOWED' }]);
    const kept = await update('CUSTOM:A', { nameZh: 'x', nameEn: 'y', parent: null });
    expect([kept.status, kept.body.data.sortOrder]).toEqual([200, 77]);
  });

  it('takes the code and the type of the body as no change when they are the path / the current type, and refuses another code on code', async () => {
    await create({ code: 'CUSTOM:A' });
    expect(
      (await update('CUSTOM:A', { ...renameKeepingParent('CUSTOM:A'), code: 'CUSTOM:A' })).status,
    ).toBe(200);
    for (const code of ['CUSTOM:A', 'USER:BAN']) {
      const other = await update(code, { ...renameKeepingParent(code), code: 'CUSTOM:Z' });
      expect([code, other.status, other.body.data.details]).toEqual([
        code,
        400,
        [{ ref: 'code', reason: 'OUT_OF_RANGE' }],
      ]);
    }
    expect(systemState.nodes.has('CUSTOM:Z')).toBe(false);
  });

  it('answers the cycle, the unknown parent and the parent of a built-in node on the parent field, one detail each (backend answer 88)', async () => {
    await create({ code: 'CUSTOM:A' });
    await create({ code: 'CUSTOM:B', parent: 'CUSTOM:A' });
    for (const [code, parent] of [
      ['CUSTOM:A', 'CUSTOM:A'],
      ['CUSTOM:A', 'CUSTOM:B'],
      ['CUSTOM:B', 'NO:SUCH'],
      ['USER:BAN', 'CUSTOM:A'],
    ] as const) {
      const refused = await update(code, { ...rename, parent });
      expect([code, parent, refused.status, refused.body.code, refused.body.data.details]).toEqual([
        code,
        parent,
        400,
        'INVALID_REQUEST',
        [{ ref: 'parent', reason: 'OUT_OF_RANGE' }],
      ]);
    }
  });

  it('accepts a code of ASCII letters, digits and _ : # / . - (1 to 128, case sensitive, a dot anywhere) and refuses the rest on code (backend answer 87)', async () => {
    for (const code of [
      'a.b/c#d_e:f-g',
      'A'.repeat(128),
      '.x',
      'x.',
      '.',
      '..',
      'custom:group',
      'CUSTOM:GROUP',
    ]) {
      const made = await create({ code });
      expect([code, made.status]).toEqual([code, 200]);
    }
    for (const [code, reason] of [
      ['has space', 'OUT_OF_RANGE'],
      ['ก:ไทย', 'OUT_OF_RANGE'],
      ['a,b', 'OUT_OF_RANGE'],
      ['a\u200bb', 'OUT_OF_RANGE'],
      ['a%b', 'OUT_OF_RANGE'],
      ['', 'EMPTY_NOT_ALLOWED'],
      ['A'.repeat(129), 'TOO_LONG'],
    ] as const) {
      const refused = await create({ code });
      expect([
        code.length > 20 ? code.length : code,
        refused.status,
        refused.body.data.details,
      ]).toEqual([code.length > 20 ? code.length : code, 400, [{ ref: 'code', reason }]]);
    }
  });

  it('gives only the first failing check on a create, in the order code, type, parent, nameZh, nameEn', async () => {
    const all = await create({
      code: 'bad code',
      type: 'X',
      parent: 'NO:SUCH',
      nameZh: '',
      nameEn: '',
    });
    expect(all.body.data.details).toEqual([{ ref: 'code', reason: 'OUT_OF_RANGE' }]);
    const noType = await create({ type: 'X', parent: 'NO:SUCH', nameZh: '', nameEn: '' });
    expect(noType.body.data.details).toEqual([{ ref: 'type', reason: 'OUT_OF_RANGE' }]);
    const noParent = await create({ parent: 'NO:SUCH', nameZh: '', nameEn: '' });
    expect(noParent.body.data.details).toEqual([{ ref: 'parent', reason: 'OUT_OF_RANGE' }]);
    const noZh = await create({ nameZh: '', nameEn: '' });
    expect(noZh.body.data.details).toEqual([{ ref: 'nameZh', reason: 'EMPTY_NOT_ALLOWED' }]);
    const longEn = await create({ nameEn: 'ก'.repeat(101) });
    expect(longEn.body.data.details).toEqual([{ ref: 'nameEn', reason: 'TOO_LONG' }]);
    expect((await create({ nameEn: 'ก'.repeat(100) })).status).toBe(200);
  });

  it('deletes a custom node without children and clears its grants from the roles', async () => {
    await create({ code: 'CUSTOM:A' });
    await run('PUT /api/admin/roles/:id', 'root', {
      params: { id: '6' },
      body: { name: 'المدققون', remark: null, permissionCodes: ['AUDIT:VIEW', 'CUSTOM:A'] },
    });
    // a custom node has no effect on the permissions
    expect(adminOf('support').permissions).not.toContain('CUSTOM:A');
    const done = await run('DELETE /api/admin/permissions/:code', 'root', {
      params: { code: 'CUSTOM:A' },
    });
    expect(done.status).toBe(200);
    expect(systemState.roles.get('6')?.permissionCodes).toEqual(['AUDIT:VIEW']);
  });

  it('refuses to delete a node with children: 409 PERMISSION_HAS_CHILDREN; and a built-in node: 400 INVALID_REQUEST (contract 3353)', async () => {
    await create({ code: 'CUSTOM:A' });
    await create({ code: 'CUSTOM:B', parent: 'CUSTOM:A' });
    const parent = await run('DELETE /api/admin/permissions/:code', 'root', {
      params: { code: 'CUSTOM:A' },
    });
    expect([parent.status, parent.body.code]).toEqual([409, 'PERMISSION_HAS_CHILDREN']);
    const builtin = await run('DELETE /api/admin/permissions/:code', 'root', {
      params: { code: 'USER:BAN' },
    });
    expect([builtin.status, builtin.body.code, builtin.body.data.details]).toEqual([
      400,
      'INVALID_REQUEST',
      [{ ref: 'code', reason: 'OUT_OF_RANGE' }],
    ]);
    expect(systemState.nodes.has('USER:BAN')).toBe(true);
    // a node the application checks by code is built in too, whatever its flag says
    const node = systemState.nodes.get('CUSTOM:B');
    if (node) node.builtin = true;
    const flagged = await run('DELETE /api/admin/permissions/:code', 'root', {
      params: { code: 'CUSTOM:B' },
    });
    expect([flagged.status, flagged.body.code]).toEqual([400, 'INVALID_REQUEST']);
    expect(systemState.nodes.has('CUSTOM:B')).toBe(true);
  });
});

// The choices of the audit filters (backend answers 45 and 46): the values the backend can write, and
// the administrators that exist, for anyone who may read the log.
describe('GET /audit-logs/meta and GET /audit-logs/admins', () => {
  const META = 'GET /api/admin/audit-logs/meta' as const;
  const ADMINS = 'GET /api/admin/audit-logs/admins' as const;

  it('gives {actions, targetTypes}, each a list of text in the order of the character codes, without a duplicate', async () => {
    const { status, body } = await run(META, 'root');
    expect(status).toBe(200);
    expect(Object.keys(body.data).sort()).toEqual(['actions', 'targetTypes']);
    for (const list of [body.data.actions, body.data.targetTypes] as string[][]) {
      expect(list.length).toBeGreaterThan(10);
      expect(list.every((value) => typeof value === 'string' && value !== '')).toBe(true);
      expect(new Set(list).size).toBe(list.length);
      expect(list).toEqual([...list].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    }
  });

  it('keeps the case of the object types as the backend writes it: four in capitals, the rest in camel case with a capital first letter', async () => {
    const { targetTypes } = (await run(META, 'root')).body.data as { targetTypes: string[] };
    for (const value of ['NOTIFICATION', 'PUSH_SCHEDULE', 'PUSH_TASK', 'PUSH_TEMPLATE']) {
      expect(targetTypes, value).toContain(value);
    }
    expect(targetTypes.some((value) => /^[A-Z][a-z]+[A-Za-z]*$/.test(value))).toBe(true);
    // the order is that of the character codes, not of a language: 'USER' before 'User'
    expect(targetTypes.indexOf('USER')).toBeLessThan(targetTypes.indexOf('User'));
  });

  it('lists every value this mock writes into the log, in the seed and in the writes of its routes', async () => {
    const { actions, targetTypes } = (await run(META, 'root')).body.data as {
      actions: string[];
      targetTypes: string[];
    };
    await run('POST /api/admin/roles', 'root', {
      body: { name: 'Meta test', remark: null, permissionCodes: ['USER:VIEW'] },
    });
    await run('POST /api/admin/admins/:id/reset-totp', 'root', { params: { id: '1004' } });
    await run('POST /api/admin/permissions', 'root', {
      body: {
        code: 'META:X',
        parent: null,
        type: 'MENU',
        sortOrder: 900,
        nameZh: '甲',
        nameEn: 'X',
      },
    });
    for (const row of systemState.audit) {
      expect(actions, row.action).toContain(row.action);
      expect(targetTypes, String(row.targetType)).toContain(String(row.targetType));
    }
  });

  it('gives {items: [{id, username}]}: every administrator that exists, only those two fields, by username', async () => {
    const { status, body } = await run(ADMINS, 'root');
    expect(status).toBe(200);
    expect(Object.keys(body.data)).toEqual(['items']);
    const items = body.data.items as { id: string; username: string }[];
    expect(items).toHaveLength(store.admins.size);
    for (const item of items) expect(Object.keys(item).sort()).toEqual(['id', 'username']);
    const names = items.map((item) => item.username);
    expect(names).toEqual([...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    expect(JSON.stringify(body)).not.toMatch(/password|status|roles|lastLoginAt|superAdmin/);
  });

  it('leaves out an administrator who was deleted, and shows one who was made', async () => {
    await run('DELETE /api/admin/admins/:id', 'root', { params: { id: '1004' } });
    await run('POST /api/admin/admins', 'root', {
      body: { username: 'ñandú-สมชาย', password: GOOD_PASSWORD, roleIds: [], superAdmin: false },
    });
    const items = (await run(ADMINS, 'root')).body.data.items as { id: string; username: string }[];
    expect(items.some((item) => item.id === '1004')).toBe(false);
    expect(items.some((item) => item.username === 'ñandú-สมชาย')).toBe(true);
  });

  it('is open to AUDIT:VIEW alone, while GET /admins stays closed to it', async () => {
    withCodes('support', ['AUDIT:VIEW']);
    expect((await run(META, 'support')).status).toBe(200);
    expect((await run(ADMINS, 'support')).status).toBe(200);
    expect((await run('GET /api/admin/admins', 'support')).status).toBe(403);
  });

  it('writes no audit row for a read', async () => {
    const before = systemState.audit.length;
    await run(META, 'root');
    await run(ADMINS, 'root');
    expect(systemState.audit).toHaveLength(before);
  });
});

describe('GET /audit-logs', () => {
  const list = (query: Record<string, unknown> = {}) =>
    run('GET /api/admin/audit-logs', 'root', { query });

  it('lists newest first with the name of the moment of writing, a missing name as null', async () => {
    const { body } = await list({ pageSize: '200' });
    expect(body.data.total).toBe(40);
    const times = body.data.items.map((r: { createdAt: string }) => r.createdAt);
    expect(times).toEqual([...times].sort().reverse());
    const renamed = body.data.items.find(
      (r: { adminUsername: string }) => r.adminUsername === 'old-support',
    );
    expect(renamed.adminId).toBe('1002');
    expect(adminOf('support').username).toBe('support');
    expect(
      body.data.items.find(
        (r: { adminId: string; adminUsername: string | null }) =>
          r.adminId === '1003' && r.adminUsername === null,
      ),
    ).toBeDefined();
    expect(Object.keys(body.data.items[0]).sort()).toEqual([
      'action',
      'adminId',
      'adminUsername',
      'createdAt',
      'detail',
      'id',
      'targetId',
      'targetType',
    ]);
  });

  it('filters by administrator, action, object type, object id and the time range (from included, to not)', async () => {
    expect(
      (await list({ adminId: '9999' })).body.data.items.map((r: { action: string }) => r.action),
    ).toEqual(['ROLE_UPDATE']);
    expect(
      (await list({ action: 'USER_BAN', pageSize: '200' })).body.data.items.every(
        (r: { action: string }) => r.action === 'USER_BAN',
      ),
    ).toBe(true);
    expect((await list({ targetType: 'ROLE' })).body.data.total).toBe(1);
    expect((await list({ targetId: '10000000001' })).body.data.total).toBe(1);
    const exact = await list({ from: '2026-10-25T08:00:00Z', to: '2026-10-26T00:00:00Z' });
    expect(exact.body.data.total).toBe(1);
    const toExcluded = await list({ from: '2026-10-25T00:00:00Z', to: '2026-10-25T08:00:00Z' });
    expect(toExcluded.body.data.total).toBe(0);
    expect((await list({ from: 'yesterday' })).status).toBe(400);
  });

  it('refuses an action or an object type of more than 64 characters and an object id of more than 255: 400 OUT_OF_RANGE on that parameter, as the backend answers', async () => {
    for (const [name, limit] of [
      ['action', 64],
      ['targetType', 64],
      ['targetId', 255],
    ] as const) {
      const over = await list({ [name]: 'ก'.repeat(limit + 1) });
      expect([name, over.status, over.body.data.details]).toEqual([
        name,
        400,
        [{ ref: name, reason: 'OUT_OF_RANGE' }],
      ]);
      expect((await list({ [name]: 'ก'.repeat(limit) })).status).toBe(200);
    }
    // the limit counts characters, not UTF-16 units: 64 emoji are fine
    expect((await list({ action: '😀'.repeat(64) })).status).toBe(200);
  });

  it('has the rows every write of this module added, with the administrator that did it', async () => {
    await run('POST /api/admin/roles', 'root', {
      body: { name: 'New', remark: '', permissionCodes: [] },
    });
    const first = (await list()).body.data.items[0];
    expect(first).toMatchObject({ action: 'ROLE_CREATE', adminId: '1001', adminUsername: 'root' });
  });

  it('keeps the name of the moment when the administrator is renamed afterwards', async () => {
    const headers = tokenOf('root');
    await call(system['POST /api/admin/roles'], {
      headers,
      body: { name: 'Zed', remark: '', permissionCodes: [] },
    });
    adminOf('root').username = 'root-renamed';
    const answer = await call(system['GET /api/admin/audit-logs'], { headers });
    expect(answer.body.data.items[0].adminUsername).toBe('root');
    expect(adminOf('root-renamed').username).toBe('root-renamed');
  });
});

// An administrator who is not a super administrator can only hand out, change and act on what they
// hold themselves (the 403 ADMIN_FORBIDDEN rules of the backend, `data.reason` names the rule, nothing
// changed).
describe('what an administrator may grant: only what they hold', () => {
  const MESSAGES = {
    grant: 'GRANT_NOT_HELD',
    ownRole: 'OWN_ROLE',
    role: 'ROLE_NOT_HELD',
    admin: 'ADMIN_NOT_HELD',
    superTarget: 'SUPER_TARGET',
    superFlag: 'SUPER_FLAG',
  };
  // `support` holds these (and the role "1" of the preset, which holds the support codes).
  const HELD = ['ADMIN:MANAGE', 'ROLE:MANAGE', 'USER:VIEW', 'STATS:VIEW', 'AUDIT:VIEW'];
  const refused = (
    answer: { status: number; body: { code: string; data: unknown } },
    reason: string,
  ) => {
    expect([answer.status, answer.body.code, answer.body.data]).toEqual([
      403,
      'ADMIN_FORBIDDEN',
      { reason },
    ]);
  };
  const roleBody = (permissionCodes: string[], name = 'Created by support') => ({
    name,
    remark: null,
    permissionCodes,
  });
  const roleCount = () => systemState.roles.size;

  beforeEach(() => withCodes('support', HELD));

  describe('roles', () => {
    it('POST /roles refuses a code the operator does not hold and creates nothing', async () => {
      const before = roleCount();
      refused(
        await run('POST /api/admin/roles', 'support', {
          body: roleBody(['USER:VIEW', 'COST:VIEW']),
        }),
        MESSAGES.grant,
      );
      expect(roleCount()).toBe(before);
      const done = await run('POST /api/admin/roles', 'support', {
        body: roleBody(['USER:VIEW', 'STATS:VIEW']),
      });
      expect(done.status).toBe(200);
      expect(roleCount()).toBe(before + 1);
    });

    it('PUT /roles/{id} refuses a role the operator holds, even with the same codes', async () => {
      const role = systemState.roles.get('1');
      const answer = await run('PUT /api/admin/roles/:id', 'support', {
        params: { id: '1' },
        body: roleBody(['USER:VIEW'], role?.name),
      });
      refused(answer, MESSAGES.ownRole);
      expect(systemState.roles.get('1')?.permissionCodes).toEqual(role?.permissionCodes);
    });

    it('PUT /roles/{id} refuses a role that has a code the operator does not hold, whatever is sent', async () => {
      // role "2" (finance) has codes the operator lacks
      const before = [...(systemState.roles.get('2')?.permissionCodes ?? [])];
      refused(
        await run('PUT /api/admin/roles/:id', 'support', {
          params: { id: '2' },
          body: roleBody([], 'Finance reduced'),
        }),
        MESSAGES.role,
      );
      expect(systemState.roles.get('2')?.permissionCodes).toEqual(before);
    });

    it('PUT /roles/{id} refuses a new code the operator does not hold, in a role the operator may change', async () => {
      // role "6" has AUDIT:VIEW only, which the operator holds
      refused(
        await run('PUT /api/admin/roles/:id', 'support', {
          params: { id: '6' },
          body: roleBody(['AUDIT:VIEW', 'COST:VIEW'], 'المدققون'),
        }),
        MESSAGES.grant,
      );
      expect(systemState.roles.get('6')?.permissionCodes).toEqual(['AUDIT:VIEW']);
      const done = await run('PUT /api/admin/roles/:id', 'support', {
        params: { id: '6' },
        body: roleBody(['AUDIT:VIEW', 'USER:VIEW'], 'المدققون'),
      });
      expect(done.status).toBe(200);
    });

    it('DELETE /roles/{id} refuses a role that has a code the operator does not hold', async () => {
      refused(
        await run('DELETE /api/admin/roles/:id', 'support', { params: { id: '3' } }),
        MESSAGES.role,
      );
      // the check comes before "still given to administrators"
      expect(systemState.roles.has('3')).toBe(true);
      withCodes('support', [...HELD, 'AUDIT:VIEW']);
      expect(
        (await run('DELETE /api/admin/roles/:id', 'support', { params: { id: '6' } })).status,
      ).toBe(200);
    });

    it('does not restrict a super administrator', async () => {
      const done = await run('POST /api/admin/roles', 'root', {
        body: roleBody(['COST:VIEW', 'USER:VIEW'], 'By root'),
      });
      expect(done.status).toBe(200);
      // not even for a node that is not one of the codes the application checks
      await run('POST /api/admin/permissions', 'root', {
        body: {
          code: 'CUSTOM:X',
          parent: null,
          type: 'MENU',
          sortOrder: 900,
          nameZh: '甲',
          nameEn: 'X',
        },
      });
      expect(
        (await run('POST /api/admin/roles', 'root', { body: roleBody(['CUSTOM:X'], 'Custom') }))
          .status,
      ).toBe(200);
      expect(
        (await run('PUT /api/admin/roles/:id', 'root', { params: { id: '2' }, body: roleBody([]) }))
          .status,
      ).toBe(200);
    });
  });

  describe('administrators', () => {
    const create = (roleIds: string[]) =>
      run('POST /api/admin/admins', 'support', {
        body: { username: 'anna', password: GOOD_PASSWORD, roleIds, superAdmin: false },
      });

    it('POST /admins refuses roles whose codes together are not all held and creates nothing', async () => {
      const before = store.admins.size;
      refused(await create(['6', '2']), MESSAGES.grant);
      expect(store.admins.size).toBe(before);
      expect((await create(['6'])).status).toBe(200);
    });

    it('PUT /admins/{id} refuses roleIds whose codes are not all held', async () => {
      // the target "newhire" holds USER:VIEW and STATS:VIEW, both held by the operator
      refused(
        await run('PUT /api/admin/admins/:id', 'support', {
          params: { id: '1005' },
          body: { username: 'newhire', roleIds: ['2'] },
        }),
        MESSAGES.grant,
      );
      expect(adminOf('newhire').permissions).toEqual(['STATS:VIEW', 'USER:VIEW']);
      const done = await run('PUT /api/admin/admins/:id', 'support', {
        params: { id: '1005' },
        body: { username: 'newhire', roleIds: ['6'] },
      });
      expect(done.status).toBe(200);
    });

    it('refuses to act on an administrator who holds a code the operator does not hold, on all five routes', async () => {
      // "finance" (1003) holds codes the operator lacks
      const target = { params: { id: '1003' } };
      const before = JSON.stringify([adminOf('finance'), systemState.extras.get('1003')]);
      const answers = [
        await run('PUT /api/admin/admins/:id', 'support', {
          ...target,
          body: { username: 'finance', roleIds: ['6'] },
        }),
        await run('POST /api/admin/admins/:id/status', 'support', {
          ...target,
          body: { status: 'DISABLED' },
        }),
        await run('POST /api/admin/admins/:id/reset-password', 'support', {
          ...target,
          body: { newPassword: GOOD_PASSWORD },
        }),
        await run('POST /api/admin/admins/:id/reset-totp', 'support', target),
        await run('DELETE /api/admin/admins/:id', 'support', target),
      ];
      for (const answer of answers) refused(answer, MESSAGES.admin);
      expect(JSON.stringify([adminOf('finance'), systemState.extras.get('1003')])).toBe(before);
      expect(store.admins.has('1003')).toBe(true);
    });

    it('lets the operator act on an administrator whose codes are all held', async () => {
      const target = { params: { id: '1005' } };
      expect(
        (
          await run('POST /api/admin/admins/:id/status', 'support', {
            ...target,
            body: { status: 'DISABLED' },
          })
        ).status,
      ).toBe(200);
      expect((await run('POST /api/admin/admins/:id/reset-totp', 'support', target)).status).toBe(
        200,
      );
      expect((await run('DELETE /api/admin/admins/:id', 'support', target)).status).toBe(200);
    });

    it('refuses a non-super operator who acts on a super administrator with SUPER_TARGET on all five routes, even when the operator holds every code', async () => {
      const target = { params: { id: '1001' } };
      const before = JSON.stringify([adminOf('root'), systemState.extras.get('1001')]);
      for (const codes of [HELD, [...PERMISSION_CODES]]) {
        withCodes('support', codes);
        const answers = [
          await run('PUT /api/admin/admins/:id', 'support', {
            ...target,
            body: { username: 'root', roleIds: adminRoleIds('root') },
          }),
          await run('POST /api/admin/admins/:id/status', 'support', {
            ...target,
            body: { status: 'DISABLED' },
          }),
          await run('POST /api/admin/admins/:id/reset-password', 'support', {
            ...target,
            body: { newPassword: GOOD_PASSWORD },
          }),
          await run('POST /api/admin/admins/:id/reset-totp', 'support', target),
          await run('DELETE /api/admin/admins/:id', 'support', target),
        ];
        for (const answer of answers) refused(answer, MESSAGES.superTarget);
      }
      expect(JSON.stringify([adminOf('root'), systemState.extras.get('1001')])).toBe(before);
    });

    it('refuses a non-super operator who sets or clears the super administrator flag with SUPER_FLAG, after the roles they hand out are checked', async () => {
      const rolesOf = adminRoleIds('newhire');
      const before = store.admins.size;
      refused(
        await run('POST /api/admin/admins', 'support', {
          body: { username: 'anna', password: GOOD_PASSWORD, roleIds: [], superAdmin: true },
        }),
        MESSAGES.superFlag,
      );
      expect(store.admins.size).toBe(before);
      refused(
        await run('PUT /api/admin/admins/:id', 'support', {
          params: { id: '1005' },
          body: { username: 'newhire', roleIds: rolesOf, superAdmin: true },
        }),
        MESSAGES.superFlag,
      );
      // the roles are checked before the flag: both wrong, the roles are named
      refused(
        await run('PUT /api/admin/admins/:id', 'support', {
          params: { id: '1005' },
          body: { username: 'newhire', roleIds: ['2'], superAdmin: true },
        }),
        MESSAGES.grant,
      );
      expect(adminOf('newhire').superAdmin).toBe(false);
    });

    it('does not restrict a super administrator', async () => {
      const done = await run('POST /api/admin/admins/:id/reset-totp', 'root', {
        params: { id: '1003' },
      });
      expect(done.status).toBe(200);
    });
  });
});
