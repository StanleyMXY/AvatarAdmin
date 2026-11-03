import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import {
  adminPatchBody,
  createAdmin,
  createPermission,
  createRole,
  deleteAdmin,
  deletePermission,
  deleteRole,
  getAuditMeta,
  isOwnAccount,
  listAdmins,
  listAuditAdmins,
  listAuditLogs,
  listPermissions,
  listRoles,
  loadAllAdmins,
  loadAllRoles,
  resetAdminPassword,
  resetAdminTotp,
  setAdminStatus,
  updateAdmin,
  updatePermission,
  updateRole,
} from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const answer = (data: unknown) => stubFetch(() => jsonResponse(200, envelope('200', data)));
const body = (call: { init: RequestInit }) => JSON.parse(call.init.body as string);
const path = (call: { url: string }) => new URL(call.url, 'http://x').pathname;
const query = (call: { url: string }) =>
  Object.fromEntries(new URL(call.url, 'http://x').searchParams);

describe('who is the signed-in administrator', () => {
  it('matches by id, and by user name (the names are not case sensitive) when an id is missing', () => {
    expect(isOwnAccount({ id: '7', username: 'a' }, { id: '7', username: 'b' })).toBe(true);
    expect(isOwnAccount({ id: '7', username: 'a' }, { id: '8', username: 'a' })).toBe(false);
    expect(isOwnAccount({ username: 'Root' }, { id: '8', username: 'root' })).toBe(true);
    expect(isOwnAccount({ username: 'root' }, { id: '8', username: 'other' })).toBe(false);
    expect(isOwnAccount({ id: '7' }, { id: '7', username: 'x' })).toBe(true);
  });

  it('counts every row as the own one when nothing is known about the signed-in administrator', () => {
    expect(isOwnAccount(undefined, { id: '8', username: 'x' })).toBe(true);
    expect(isOwnAccount({}, { id: '8', username: 'x' })).toBe(true);
  });
});

describe('the administrators', () => {
  it('lists with the paging and reads every page when asked for all of them', async () => {
    const calls = answer({ items: [{ id: '1' }], total: 1 });
    expect(await listAdmins({ page: 2, pageSize: 50 })).toEqual({ items: [{ id: '1' }], total: 1 });
    expect(path(calls[0])).toBe('/api/admin/admins');
    expect(query(calls[0])).toEqual({ page: '2', pageSize: '50' });
    await loadAllAdmins();
    expect(query(calls[1])).toEqual({ page: '1', pageSize: '200' });
  });

  it('creates with the password exactly as typed: no trimming, no hashing, and the other fields as given', async () => {
    const calls = answer({ id: '9' });
    const typed = `  Pass${String.fromCharCode(0x3000)}word 12345  `;
    await createAdmin({
      username: 'anna',
      password: typed,
      roleIds: ['1', '2'],
      superAdmin: false,
    });
    expect(calls[0].init.method).toBe('POST');
    expect(path(calls[0])).toBe('/api/admin/admins');
    expect(body(calls[0])).toEqual({
      username: 'anna',
      password: typed,
      roleIds: ['1', '2'],
      superAdmin: false,
    });
  });

  it('puts the id in the path encoded, and always sends the user name and the whole list of roles: the patch roles replace the current ones, the flag goes only when the patch holds it (backend answer 44)', async () => {
    const calls = answer({});
    await updateAdmin(
      { id: 'a/b', username: 'x', roleIds: ['1', '2'] },
      { roleIds: ['3'], superAdmin: true },
      { id: '1' },
    );
    expect(calls[0].init.method).toBe('PUT');
    expect(path(calls[0])).toBe('/api/admin/admins/a%2Fb');
    expect(body(calls[0])).toEqual({ username: 'x', roleIds: ['3'], superAdmin: true });
    // a patch of the flag only still carries the current roles, not nothing and not []
    await updateAdmin(
      { id: '5', username: 'ผู้ตรวจ', roleIds: ['1', '2'] },
      { superAdmin: false },
      { id: '1' },
    );
    expect(body(calls[1])).toEqual({ username: 'ผู้ตรวจ', roleIds: ['1', '2'], superAdmin: false });
    // a patch of the roles only has no flag
    await updateAdmin({ id: '5', username: 'x', roleIds: ['1'] }, { roleIds: [] }, { id: '1' });
    expect(body(calls[2])).toEqual({ username: 'x', roleIds: [] });
    // an empty patch is still a whole request: the user name and the current roles
    await updateAdmin({ id: '5', username: 'x', roleIds: ['7'] }, {}, { id: '1' });
    expect(body(calls[3])).toEqual({ username: 'x', roleIds: ['7'] });
  });

  it('sends the user name and the current roles of the own row too, and never its flag or other roles, whatever the patch holds', async () => {
    const calls = answer({});
    await updateAdmin(
      { id: '1', username: 'root', roleIds: ['1', '4'] },
      { roleIds: ['9'], superAdmin: false },
      { id: '1', username: 'root' },
    );
    expect(body(calls[0])).toEqual({ username: 'root', roleIds: ['1', '4'] });
    expect(body(calls[0])).not.toHaveProperty('superAdmin');
    // also when the signed-in account is only known by its name
    await updateAdmin(
      { id: '1', username: 'Root', roleIds: ['1'] },
      { roleIds: ['9'], superAdmin: true },
      { username: 'root' },
    );
    expect(body(calls[1])).toEqual({ username: 'Root', roleIds: ['1'] });
    // and when nothing is known about who is signed in
    await updateAdmin(
      { id: '1', username: 'x', roleIds: [] },
      { roleIds: ['9'], superAdmin: true },
      undefined,
    );
    expect(body(calls[2])).toEqual({ username: 'x', roleIds: [] });
  });

  it('builds the body of the update: the user name and the roles always, the flag only for another row and only when the patch holds it', () => {
    const target = { username: 'u', roleIds: ['1'] };
    expect(adminPatchBody(target, { roleIds: ['2'] }, false)).toEqual({
      username: 'u',
      roleIds: ['2'],
    });
    expect(adminPatchBody(target, { superAdmin: false }, false)).toEqual({
      username: 'u',
      roleIds: ['1'],
      superAdmin: false,
    });
    expect(adminPatchBody(target, { roleIds: ['2'], superAdmin: true }, true)).toEqual({
      username: 'u',
      roleIds: ['1'],
    });
  });

  it('copies the list of roles: changing the body does not change the row', () => {
    const target = { username: 'u', roleIds: ['1'] };
    adminPatchBody(target, {}, false).roleIds.push('2');
    expect(target.roleIds).toEqual(['1']);
  });

  it('switches the status, resets the password and the authenticator, and deletes', async () => {
    const calls = answer(null);
    await setAdminStatus('4', 'DISABLED');
    expect([calls[0].init.method, path(calls[0]), body(calls[0])]).toEqual([
      'POST',
      '/api/admin/admins/4/status',
      { status: 'DISABLED' },
    ]);
    await resetAdminPassword('4', ' new password 123 ');
    expect([calls[1].init.method, path(calls[1]), body(calls[1])]).toEqual([
      'POST',
      '/api/admin/admins/4/reset-password',
      { newPassword: ' new password 123 ' },
    ]);
    await resetAdminTotp('4');
    expect([calls[2].init.method, path(calls[2]), calls[2].init.body]).toEqual([
      'POST',
      '/api/admin/admins/4/reset-totp',
      undefined,
    ]);
    await deleteAdmin('4');
    expect([calls[3].init.method, path(calls[3])]).toEqual(['DELETE', '/api/admin/admins/4']);
  });
});

describe('the roles', () => {
  it('lists, reads all with pageSize 200, creates, updates, deletes', async () => {
    const calls = answer({ items: [], total: 0 });
    await listRoles({ page: 1, pageSize: 20 });
    await loadAllRoles();
    expect(query(calls[1])).toEqual({ page: '1', pageSize: '200' });
    expect(path(calls[1])).toBe('/api/admin/roles');
    await createRole({ name: 'Auditor', remark: null, permissionCodes: ['AUDIT:VIEW'] });
    expect(body(calls[2])).toEqual({
      name: 'Auditor',
      remark: null,
      permissionCodes: ['AUDIT:VIEW'],
    });
    await updateRole('7', { name: 'B', remark: 'r', permissionCodes: [] });
    expect([calls[3].init.method, path(calls[3]), body(calls[3])]).toEqual([
      'PUT',
      '/api/admin/roles/7',
      { name: 'B', remark: 'r', permissionCodes: [] },
    ]);
    await deleteRole('7');
    expect([calls[4].init.method, path(calls[4])]).toEqual(['DELETE', '/api/admin/roles/7']);
  });

  it('reads further pages while rows are missing and stops at an empty page', async () => {
    const pages = [
      { items: Array.from({ length: 200 }, (_, i) => ({ id: String(i) })), total: 230 },
      { items: Array.from({ length: 30 }, (_, i) => ({ id: String(200 + i) })), total: 230 },
    ];
    let n = 0;
    stubFetch(() => jsonResponse(200, envelope('200', pages[n++])));
    expect(await loadAllRoles()).toHaveLength(230);
    expect(n).toBe(2);
  });
});

describe('the permission tree', () => {
  it('reads the nodes from { items }, from a bare list, and never crashes on something else', async () => {
    answer({ items: [{ code: 'A' }] });
    expect(await listPermissions()).toEqual([{ code: 'A' }]);
    answer([{ code: 'B' }]);
    expect(await listPermissions()).toEqual([{ code: 'B' }]);
    answer('nonsense');
    expect(await listPermissions()).toEqual([]);
  });

  it('creates with the code, and puts the code in the path encoded for the other calls', async () => {
    const calls = answer({});
    await createPermission({
      code: 'CUSTOM:A',
      parent: null,
      type: 'MENU',
      sortOrder: 5,
      nameZh: 'a',
      nameEn: 'b',
    });
    expect(body(calls[0])).toEqual({
      code: 'CUSTOM:A',
      parent: null,
      type: 'MENU',
      sortOrder: 5,
      nameZh: 'a',
      nameEn: 'b',
    });
    await deletePermission('CUSTOM:A/B');
    expect([calls[1].init.method, path(calls[1])]).toEqual([
      'DELETE',
      '/api/admin/permissions/CUSTOM%3AA%2FB',
    ]);
  });

  it('always sends the parent: the one given for a custom node, null for a root; for a built-in node its own parent, whatever the patch holds (backend answer 87)', async () => {
    const calls = answer({});
    await updatePermission(
      'CUSTOM:A',
      { nameZh: 'a', nameEn: 'b', sortOrder: 2, parent: 'CUSTOM:B' },
      { builtin: false, parent: 'CUSTOM:C' },
    );
    expect(body(calls[0])).toEqual({ nameZh: 'a', nameEn: 'b', sortOrder: 2, parent: 'CUSTOM:B' });
    await updatePermission(
      'CUSTOM:A',
      { nameZh: 'a', nameEn: 'b', sortOrder: 2, parent: null },
      { builtin: false, parent: 'CUSTOM:C' },
    );
    expect(body(calls[1])).toEqual({ nameZh: 'a', nameEn: 'b', sortOrder: 2, parent: null });
    await updatePermission(
      'USER:VIEW',
      { nameZh: 'a', nameEn: 'b', sortOrder: 2, parent: 'CUSTOM:B' },
      { builtin: true, parent: 'USER:ROOT' },
    );
    expect(body(calls[2])).toEqual({ nameZh: 'a', nameEn: 'b', sortOrder: 2, parent: 'USER:ROOT' });
    expect(path(calls[2])).toBe('/api/admin/permissions/USER%3AVIEW');
    // a built-in root: null is sent, not left out
    await updatePermission(
      'ROOT:X',
      { nameZh: 'a', nameEn: 'b', sortOrder: 2, parent: null },
      { builtin: true, parent: null },
    );
    expect(body(calls[3])).toHaveProperty('parent', null);
  });
});

describe('the audit log', () => {
  it('sends the filters it was given and leaves out the empty ones', async () => {
    const calls = answer({ items: [], total: 0 });
    await listAuditLogs({
      page: 1,
      pageSize: 20,
      adminId: '3',
      action: 'USER_BAN',
      targetType: 'USER',
      targetId: '55',
      from: '2026-10-01T00:00:00Z',
      to: '2026-10-08T00:00:00Z',
    });
    expect(path(calls[0])).toBe('/api/admin/audit-logs');
    expect(query(calls[0])).toEqual({
      page: '1',
      pageSize: '20',
      adminId: '3',
      action: 'USER_BAN',
      targetType: 'USER',
      targetId: '55',
      from: '2026-10-01T00:00:00Z',
      to: '2026-10-08T00:00:00Z',
    });
    await listAuditLogs({ page: 1, pageSize: 20, action: '' });
    expect(query(calls[1])).toEqual({ page: '1', pageSize: '20' });
  });

  it('reads the choices of the action and the object type from /audit-logs/meta, values as they came, case included', async () => {
    const calls = answer({
      actions: ['USER_BAN', 'ñandú', 'app_version_publish'],
      targetTypes: ['NOTIFICATION', 'CosmeticItem', 'User'],
    });
    expect(await getAuditMeta()).toEqual({
      actions: ['USER_BAN', 'ñandú', 'app_version_publish'],
      targetTypes: ['NOTIFICATION', 'CosmeticItem', 'User'],
    });
    expect(calls[0].init.method).toBe('GET');
    expect(path(calls[0])).toBe('/api/admin/audit-logs/meta');
    expect(query(calls[0])).toEqual({});
  });

  it('reads an answer of the choices that is not what the contract says as empty lists, and drops what is not text', async () => {
    answer({ actions: ['A', 3, null, '', 'B'], targetTypes: 'x' });
    expect(await getAuditMeta()).toEqual({ actions: ['A', 'B'], targetTypes: [] });
    answer(null);
    expect(await getAuditMeta()).toEqual({ actions: [], targetTypes: [] });
  });

  it('reads the administrators to choose from at /audit-logs/admins, the id and the user name and nothing else, in the order they came', async () => {
    const calls = answer({
      items: [
        { id: '3', username: 'ñandú', status: 'ACTIVE', roles: [] },
        { id: 4, username: 'สมชาย' },
        { username: 'no id' },
        'x',
      ],
    });
    expect(await listAuditAdmins()).toEqual([
      { id: '3', username: 'ñandú' },
      { id: '4', username: 'สมชาย' },
    ]);
    expect(path(calls[0])).toBe('/api/admin/audit-logs/admins');
    expect(query(calls[0])).toEqual({});
    answer({});
    expect(await listAuditAdmins()).toEqual([]);
  });

  it('has no function that writes: nothing to edit or delete an audit row', async () => {
    const all = await import('./index');
    expect(
      Object.keys(all)
        .filter((name) => /audit/i.test(name))
        .sort(),
    ).toEqual(['getAuditMeta', 'listAuditAdmins', 'listAuditLogs']);
  });
});

describe('the type of a node on update', () => {
  it('is never sent: the backend answers 400 on type when it changes, and the page shows it fixed', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', {})));
    // a caller that passes a type along by mistake (the type system forbids it) is not obeyed
    await updatePermission(
      'CUSTOM:A',
      { nameZh: '甲', nameEn: 'A', sortOrder: 1, parent: null, type: 'MENU' } as never,
      { builtin: false, parent: null },
    );
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      nameZh: '甲',
      nameEn: 'A',
      sortOrder: 1,
      parent: null,
    });
  });
});
