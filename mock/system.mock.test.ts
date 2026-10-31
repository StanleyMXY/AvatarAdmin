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
  it('changes the roles, and the permissions follow the roles', async () => {
    const { status, body } = await run('PUT /api/admin/admins/:id', 'root', {
      params: { id: '1005' },
      body: { roleIds: ['2', '6'] },
    });
    expect(status).toBe(200);
    expect(body.data.roles.map((r: { id: string }) => r.id).sort()).toEqual(['2', '6']);
    expect(adminOf('newhire').permissions).toContain('AUDIT:VIEW');
    expect(adminOf('newhire').permissions).toContain('COST:VIEW');
    expect(adminOf('newhire').permissions).not.toContain('USER:VIEW');
  });

  it('refuses the own roles and the own super administrator flag, even with the same values', async () => {
    withCodes('support', ['ADMIN:MANAGE']);
    for (const body of [
      { roleIds: ['1'] },
      { superAdmin: false },
      { roleIds: [], superAdmin: true },
    ]) {
      const refused = await run('PUT /api/admin/admins/:id', 'support', {
        params: { id: '1002' },
        body,
      });
      expect([JSON.stringify(body), refused.status, refused.body.code]).toEqual([
        JSON.stringify(body),
        403,
        'ADMIN_FORBIDDEN',
      ]);
    }
    expect(adminOf('support').superAdmin).toBe(false);
  });

  it('lets only a super administrator set or clear the flag', async () => {
    withCodes('support', ['ADMIN:MANAGE']);
    const refused = await run('PUT /api/admin/admins/:id', 'support', {
      params: { id: '1005' },
      body: { superAdmin: true },
    });
    expect(refused.status).toBe(403);
    const ok = await run('PUT /api/admin/admins/:id', 'root', {
      params: { id: '1005' },
      body: { superAdmin: true },
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
    const roles = await run('PUT /api/admin/admins/:id', 'support', {
      params: { id: '1004' },
      body: { roleIds: ['4'] },
    });
    expect(roles.status).toBe(200);
  });

  it('lets a super administrator clear the flag of another one, but never their own', async () => {
    adminOf('finance').superAdmin = true;
    const other = await run('PUT /api/admin/admins/:id', 'root', {
      params: { id: '1003' },
      body: { superAdmin: false },
    });
    expect(other.status).toBe(200);
    expect(other.body.data.superAdmin).toBe(false);
    const own = await run('PUT /api/admin/admins/:id', 'root', {
      params: { id: '1001' },
      body: { superAdmin: false },
    });
    expect([own.status, own.body.code]).toEqual([403, 'ADMIN_FORBIDDEN']);
    expect(adminOf('root').superAdmin).toBe(true);
  });

  it('answers 404 RESOURCE_NOT_FOUND for an unknown administrator', async () => {
    const { status, body } = await run('PUT /api/admin/admins/:id', 'root', {
      params: { id: '31337' },
      body: {},
    });
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

  it('refuses to disable oneself (403) and the last enabled super administrator (409)', async () => {
    const self = await setStatus('root', '1001', 'DISABLED');
    expect([self.status, self.body.code]).toEqual([403, 'ADMIN_FORBIDDEN']);
    withCodes('support', ['ADMIN:MANAGE']);
    // a super administrator holds every code: only someone who holds them all reaches the rule of the last one
    withCodes('support', [...PERMISSION_CODES]);
    const last = await setStatus('support', '1001', 'DISABLED');
    expect([last.status, last.body.code]).toEqual([409, 'INVALID_STATE']);
    expect(adminOf('root').status).toBe('ACTIVE');
    // with a second enabled super administrator the first can be disabled
    adminOf('finance').superAdmin = true;
    expect((await setStatus('support', '1001', 'DISABLED')).status).toBe(200);
  });

  it('refuses a status that is not ACTIVE or DISABLED', async () => {
    expect((await setStatus('root', '1004', 'GONE')).status).toBe(400);
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
    expect([self.status, self.body.code]).toEqual([403, 'ADMIN_FORBIDDEN']);
    withCodes('support', [...PERMISSION_CODES]);
    const last = await run('DELETE /api/admin/admins/:id', 'support', { params: { id: '1001' } });
    expect([last.status, last.body.code]).toEqual([409, 'INVALID_STATE']);
    const before = systemState.audit.filter((r) => r.adminId === '1004').length;
    const gone = await run('DELETE /api/admin/admins/:id', 'root', { params: { id: '1004' } });
    expect(gone.status).toBe(200);
    expect(store.admins.has('1004')).toBe(false);
    expect(systemState.audit.filter((r) => r.adminId === '1004')).toHaveLength(before);
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
  const rename = { nameZh: '名', nameEn: 'name', sortOrder: 5 };

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
    const done = await update('USER:BAN', rename);
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
      const refused = await update(code, { ...rename, type });
      expect([code, refused.status, refused.body.code, refused.body.data.details]).toEqual([
        code,
        400,
        'INVALID_REQUEST',
        [{ ref: 'type', reason: 'OUT_OF_RANGE' }],
      ]);
      expect(JSON.stringify(systemState.nodes.get(code))).toBe(before);
    }
    expect((await update('CUSTOM:T', { ...rename, type: 'FUNCTION' })).status).toBe(200);
    expect((await update('CUSTOM:T', rename)).status).toBe(200);
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

  it('refuses to delete a node with children: 409 PERMISSION_HAS_CHILDREN; and a built-in node: 409', async () => {
    await create({ code: 'CUSTOM:A' });
    await create({ code: 'CUSTOM:B', parent: 'CUSTOM:A' });
    const parent = await run('DELETE /api/admin/permissions/:code', 'root', {
      params: { code: 'CUSTOM:A' },
    });
    expect([parent.status, parent.body.code]).toEqual([409, 'PERMISSION_HAS_CHILDREN']);
    const builtin = await run('DELETE /api/admin/permissions/:code', 'root', {
      params: { code: 'USER:BAN' },
    });
    expect(builtin.status).toBe(409);
    expect(systemState.nodes.has('USER:BAN')).toBe(true);
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

  it('refuses an action or an object type of more than 64 characters and an object id of more than 255: 400 TOO_LONG on that parameter', async () => {
    for (const [name, limit] of [
      ['action', 64],
      ['targetType', 64],
      ['targetId', 255],
    ] as const) {
      const over = await list({ [name]: 'ก'.repeat(limit + 1) });
      expect([name, over.status, over.body.data.details]).toEqual([
        name,
        400,
        [{ ref: name, reason: 'TOO_LONG' }],
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
// hold themselves (the four 403 ADMIN_FORBIDDEN rules of the backend, `data` null, nothing changed).
describe('what an administrator may grant: only what they hold', () => {
  const MESSAGES = {
    grant: 'Administrators can only grant permissions they hold',
    ownRole: 'Administrators cannot change a role they hold',
    role: 'Administrators can only change roles whose permissions they hold',
    admin: 'Administrators can only act on administrators whose permissions they hold',
  };
  // `support` holds these (and the role "1" of the preset, which holds the support codes).
  const HELD = ['ADMIN:MANAGE', 'ROLE:MANAGE', 'USER:VIEW', 'STATS:VIEW', 'AUDIT:VIEW'];
  const refused = (
    answer: { status: number; body: { code: string; data: unknown; message: string } },
    message: string,
  ) => {
    expect([answer.status, answer.body.code, answer.body.data, answer.body.message]).toEqual([
      403,
      'ADMIN_FORBIDDEN',
      null,
      message,
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
          body: { roleIds: ['2'] },
        }),
        MESSAGES.grant,
      );
      expect(adminOf('newhire').permissions).toEqual(['STATS:VIEW', 'USER:VIEW']);
      const done = await run('PUT /api/admin/admins/:id', 'support', {
        params: { id: '1005' },
        body: { roleIds: ['6'] },
      });
      expect(done.status).toBe(200);
    });

    it('refuses to act on an administrator who holds a code the operator does not hold, on all five routes', async () => {
      // "finance" (1003) holds codes the operator lacks
      const target = { params: { id: '1003' } };
      const before = JSON.stringify([adminOf('finance'), systemState.extras.get('1003')]);
      const answers = [
        await run('PUT /api/admin/admins/:id', 'support', { ...target, body: { roleIds: ['6'] } }),
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

    it('treats a super administrator as holding every code: a non-super operator cannot act on one', async () => {
      refused(
        await run('POST /api/admin/admins/:id/reset-password', 'support', {
          params: { id: '1001' },
          body: { newPassword: GOOD_PASSWORD },
        }),
        MESSAGES.admin,
      );
    });

    it('does not restrict a super administrator', async () => {
      const done = await run('POST /api/admin/admins/:id/reset-totp', 'root', {
        params: { id: '1003' },
      });
      expect(done.status).toBe(200);
    });
  });
});
