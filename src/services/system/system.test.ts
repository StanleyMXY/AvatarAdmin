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
  isOwnAccount,
  listAdmins,
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

  it('puts the id in the path encoded, and sends only what the patch holds', async () => {
    const calls = answer({});
    await updateAdmin(
      { id: 'a/b', username: 'x' },
      { roleIds: ['3'], superAdmin: true },
      { id: '1' },
    );
    expect(calls[0].init.method).toBe('PUT');
    expect(path(calls[0])).toBe('/api/admin/admins/a%2Fb');
    expect(body(calls[0])).toEqual({ roleIds: ['3'], superAdmin: true });
    await updateAdmin({ id: '5', username: 'x' }, { roleIds: [] }, { id: '1' });
    expect(body(calls[1])).toEqual({ roleIds: [] });
  });

  it('never sends the roles or the super administrator flag of the own row, whatever the patch holds', async () => {
    const calls = answer({});
    await updateAdmin(
      { id: '1', username: 'root' },
      { roleIds: ['9'], superAdmin: false },
      { id: '1', username: 'root' },
    );
    const sent = body(calls[0]);
    expect(sent).not.toHaveProperty('roleIds');
    expect(sent).not.toHaveProperty('superAdmin');
    // also when the signed-in account is only known by its name
    await updateAdmin(
      { id: '1', username: 'Root' },
      { roleIds: ['9'], superAdmin: true },
      { username: 'root' },
    );
    expect(body(calls[1])).toEqual({});
    // and when nothing is known about who is signed in
    await updateAdmin({ id: '1', username: 'x' }, { roleIds: ['9'], superAdmin: true }, undefined);
    expect(body(calls[2])).toEqual({});
  });

  it('builds the patch body without a field that is undefined', () => {
    expect(adminPatchBody({ roleIds: ['1'] }, false)).toEqual({ roleIds: ['1'] });
    expect(adminPatchBody({ superAdmin: false }, false)).toEqual({ superAdmin: false });
    expect(adminPatchBody({ roleIds: ['1'], superAdmin: true }, true)).toEqual({});
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

  it('sends the parent for a custom node and never for a built-in one', async () => {
    const calls = answer({});
    await updatePermission(
      'CUSTOM:A',
      { nameZh: 'a', nameEn: 'b', sortOrder: 2, parent: 'CUSTOM:B' },
      { builtin: false },
    );
    expect(body(calls[0])).toEqual({ nameZh: 'a', nameEn: 'b', sortOrder: 2, parent: 'CUSTOM:B' });
    await updatePermission(
      'USER:VIEW',
      { nameZh: 'a', nameEn: 'b', sortOrder: 2, parent: 'CUSTOM:B' },
      { builtin: true },
    );
    expect(body(calls[1])).toEqual({ nameZh: 'a', nameEn: 'b', sortOrder: 2 });
    expect(path(calls[1])).toBe('/api/admin/permissions/USER%3AVIEW');
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

  it('has no function that writes: nothing to edit or delete an audit row', async () => {
    const all = await import('./index');
    expect(Object.keys(all).filter((name) => /audit/i.test(name))).toEqual(['listAuditLogs']);
  });
});
