import { PERMISSION_CODES } from '../src/access/permissionCodes';
import { countCodePoints } from '../src/utils/codePoints';
import { trimSpec } from '../src/utils/trimSpec';
import { guard } from './_core/auth';
import { bodyOf, invalidRequest, MockHttpError, ok } from './_core/http';
import { paginateQuery } from './_core/paginate';
import { type MockAdmin, PASSWORD_MIN_LENGTH, store } from './_core/store';
import {
  adminView,
  descendantCodes,
  extraOf,
  type MockRole,
  syncAllPermissions,
  syncPermissions,
  systemState,
  writeAudit,
} from './_core/systemData';

// The system management endpoints (contract 17.3 and 17.4, system management row): administrators,
// roles, the writes of the permission tree (the read is in system.permissions.mock.ts) and the audit
// log. The protections are the contract's: nobody changes their own roles or super administrator
// flag, disables or deletes themselves, or takes the last enabled super administrator away; only a
// super administrator sets or clears the flag. The backend answers all of those protections 409
// INVALID_STATE with `data.status` (its answer 22; 403 ADMIN_FORBIDDEN is for the rules about what the
// operator holds and about super administrators), and the 409 does not say which rule it was.

type Detail = { ref: string; reason: string };
const refuse = (details: Detail[]): never => {
  throw invalidRequest(`invalid: ${details.map((d) => d.ref).join(', ')}`, details);
};
const forbidden = (message: string): never => {
  throw new MockHttpError(403, 'ADMIN_FORBIDDEN', message);
};

// The four rules "an administrator hands out and acts on only what they hold" (403 ADMIN_FORBIDDEN,
// `data` null, nothing changed). A super administrator is not bound by them. What an administrator
// holds is what `GET /me` lists for them (the union of the codes of their roles); a super
// administrator held by the target counts as holding every code. The order of the checks inside one
// route is the mock's own: the backend's order is not in the documents we have.
const SCOPE = {
  grant: 'Administrators can only grant permissions they hold',
  ownRole: 'Administrators cannot change a role they hold',
  role: 'Administrators can only change roles whose permissions they hold',
  admin: 'Administrators can only act on administrators whose permissions they hold',
} as const;

const heldCodes = (admin: MockAdmin): ReadonlySet<string> =>
  new Set<string>(admin.superAdmin ? PERMISSION_CODES : admin.permissions);

/** True when `operator` holds every one of `codes` (a super administrator holds all). */
const holdsAll = (operator: MockAdmin, codes: Iterable<string>): boolean => {
  if (operator.superAdmin) return true;
  const held = heldCodes(operator);
  return [...codes].every((code) => held.has(code));
};

const requireHolds = (operator: MockAdmin, codes: Iterable<string>, message: string): void => {
  if (!holdsAll(operator, codes)) forbidden(message);
};

/** The codes the roles give together. */
const codesOfRoles = (roleIds: readonly string[]): string[] =>
  roleIds.flatMap((id) => systemState.roles.get(id)?.permissionCodes ?? []);

/** Rule 4: the target administrator's codes must all be held by the operator. */
const requireHoldsTarget = (operator: MockAdmin, target: MockAdmin): void =>
  requireHolds(operator, heldCodes(target), SCOPE.admin);
const duplicate = (field: string): never => {
  throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The value exists already', { field });
};
/** 409 INVALID_STATE with the current status of the target: the own account, the last super administrator. */
const invalidState = (target: MockAdmin): never => {
  throw new MockHttpError(
    409,
    'INVALID_STATE',
    'The state of the administrator does not allow this',
    {
      status: target.status,
    },
  );
};
const notFound = (what: string): never => {
  throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', `${what} is not there`);
};

const adminOrFail = (id: string) => store.admins.get(id) ?? notFound('The administrator');

const enabledSupers = () =>
  [...store.admins.values()].filter((a) => a.superAdmin && a.status === 'ACTIVE');
/** Taking `id` out of the enabled super administrators (disable, delete, clear the flag) would leave none. */
const isLastEnabledSuper = (id: string): boolean => {
  const supers = enabledSupers();
  return supers.length === 1 && supers[0].id === id;
};

const newPasswordProblem = (value: unknown, username: string, ref: string): Detail | null => {
  // Passwords are compared and counted exactly as typed.
  if (typeof value !== 'string' || value === '') return { ref, reason: 'EMPTY_NOT_ALLOWED' };
  if (countCodePoints(value) < PASSWORD_MIN_LENGTH) return { ref, reason: 'OUT_OF_RANGE' };
  if (value === username) return { ref, reason: 'OUT_OF_RANGE' };
  return null;
};

const roleIdsOf = (value: unknown): string[] => {
  if (!Array.isArray(value) || !value.every((id) => typeof id === 'string'))
    return refuse([{ ref: 'roleIds', reason: 'OUT_OF_RANGE' }]);
  const ids = [...new Set(value as string[])];
  if (!ids.every((id) => systemState.roles.has(id)))
    return refuse([{ ref: 'roleIds', reason: 'OUT_OF_RANGE' }]);
  return ids;
};

const byCreatedDesc = <T extends { createdAt: string; id: string }>(a: T, b: T) =>
  b.createdAt.localeCompare(a.createdAt) || Number(b.id) - Number(a.id);

const roleView = (role: MockRole) => ({
  ...role,
  permissionCodes: [...role.permissionCodes].sort(),
});

/** The role name or the node code, trimmed the way the contract trims (1.9). */
const textOf = (value: unknown): string => (typeof value === 'string' ? trimSpec(value) : '');

function permissionCodesOf(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((code) => typeof code === 'string'))
    return refuse([{ ref: 'permissionCodes', reason: 'OUT_OF_RANGE' }]);
  const codes = [...new Set(value as string[])];
  // A code that is not a node of the tree is refused (contract 17.4); a custom node is allowed.
  if (!codes.every((code) => systemState.nodes.has(code)))
    return refuse([{ ref: 'permissionCodes', reason: 'OUT_OF_RANGE' }]);
  return codes.sort();
}

function roleFields(
  body: Record<string, unknown>,
  ownId?: string,
  authorize?: (codes: string[]) => void,
) {
  const name = textOf(body.name);
  const details: Detail[] = [];
  if (name === '') details.push({ ref: 'name', reason: 'EMPTY_NOT_ALLOWED' });
  if (details.length > 0) refuse(details);
  const permissionCodes = permissionCodesOf(body.permissionCodes ?? []);
  authorize?.(permissionCodes);
  const taken = [...systemState.roles.values()].some(
    (role) => role.id !== ownId && role.name.toLowerCase() === name.toLowerCase(),
  );
  if (taken) duplicate('name');
  const remark = textOf(body.remark);
  return {
    name,
    remark: remark === '' ? null : remark,
    permissionCodes,
  };
}

/** ASCII letters, digits and `_ : # / . -`, 1 to 128, case sensitive (backend answer 87). */
const NODE_CODE = /^[A-Za-z0-9_:#/.-]{1,128}$/;

/** Both names of a node: 1 to 100 code points each, no control characters; the first bad one is the 400. */
function nodeNames(body: Record<string, unknown>): { nameZh: string; nameEn: string } {
  const names = { nameZh: textOf(body.nameZh), nameEn: textOf(body.nameEn) };
  for (const ref of ['nameZh', 'nameEn'] as const) {
    if (names[ref] === '') refuse([{ ref, reason: 'EMPTY_NOT_ALLOWED' }]);
    if (countCodePoints(names[ref]) > 100) refuse([{ ref, reason: 'TOO_LONG' }]);
    if (/\p{Cc}/u.test(names[ref])) refuse([{ ref, reason: 'OUT_OF_RANGE' }]);
  }
  return names;
}

const sortedNodes = () => [...systemState.nodes.values()];

export default {
  // ---- administrators (ADMIN:MANAGE) ----
  'GET /api/admin/admins': guard('ADMIN:MANAGE', (req) => {
    const rows = [...store.admins.values()].map(adminView).sort(byCreatedDesc);
    return ok(paginateQuery(rows, req));
  }),

  'POST /api/admin/admins': guard('ADMIN:MANAGE', (req) => {
    const body = bodyOf(req);
    const username = textOf(body.username);
    const details: Detail[] = [];
    if (username === '') details.push({ ref: 'username', reason: 'EMPTY_NOT_ALLOWED' });
    const problem = newPasswordProblem(body.password, username, 'password');
    if (problem) details.push(problem);
    if (body.superAdmin !== undefined && typeof body.superAdmin !== 'boolean')
      details.push({ ref: 'superAdmin', reason: 'NOT_BOOLEAN' });
    if (details.length > 0) refuse(details);
    const roleIds = roleIdsOf(body.roleIds ?? []);
    if (body.superAdmin === true && !req.admin.superAdmin)
      forbidden('Only a super administrator sets the super administrator flag');
    requireHolds(req.admin, codesOfRoles(roleIds), SCOPE.grant);
    if ([...store.admins.values()].some((a) => a.username.toLowerCase() === username.toLowerCase()))
      duplicate('username');
    systemState.nextAdminId += 1;
    const id = String(systemState.nextAdminId);
    const admin = {
      id,
      username,
      password: body.password as string,
      superAdmin: body.superAdmin === true,
      status: 'ACTIVE' as const,
      mustChangePassword: true,
      totpEnrolled: false,
      permissions: [],
      tokenVersion: 1,
      totpFailures: 0,
      lockedUntil: 0,
    };
    store.admins.set(id, admin);
    systemState.extras.set(id, { roleIds, createdAt: new Date().toISOString(), lastLoginAt: null });
    syncPermissions(admin);
    // The detail names what was set, never the password.
    writeAudit(req.admin, 'ADMIN_CREATE', 'ADMIN', id, {
      username,
      roleIds,
      superAdmin: admin.superAdmin,
    });
    return ok(adminView(admin));
  }),

  // The update repeats the user name and the whole list of roles every time (backend answer 44): a
  // missing one is a 400, not "keep it". The flag is optional; the same value is not a change. The
  // order is the contract's (2392): the target exists, 403 for a super administrator target and for a
  // target with codes the operator lacks, the input, 403 for the flag and the roles handed out, 409 for
  // the own account (a changed set of roles or a changed flag), 409 for the last super administrator.
  'PUT /api/admin/admins/:id': guard('ADMIN:MANAGE', (req) => {
    const admin = adminOrFail(req.params.id);
    const body = bodyOf(req);
    requireHoldsTarget(req.admin, admin);
    const username = textOf(body.username);
    if (username === '') refuse([{ ref: 'username', reason: 'EMPTY_NOT_ALLOWED' }]);
    if (body.roleIds === undefined || body.roleIds === null)
      refuse([{ ref: 'roleIds', reason: 'EMPTY_NOT_ALLOWED' }]);
    const roleIds = roleIdsOf(body.roleIds);
    const given = body.superAdmin;
    if (given !== undefined && given !== null && typeof given !== 'boolean')
      refuse([{ ref: 'superAdmin', reason: 'NOT_BOOLEAN' }]);
    const current = extraOf(admin).roleIds;
    const rolesChanged =
      roleIds.length !== current.length || !roleIds.every((id) => current.includes(id));
    const flagChanged = typeof given === 'boolean' && given !== Boolean(admin.superAdmin);
    if (flagChanged && !req.admin.superAdmin)
      forbidden('Only a super administrator sets or clears the super administrator flag');
    if (rolesChanged) requireHolds(req.admin, codesOfRoles(roleIds), SCOPE.grant);
    if ((rolesChanged || flagChanged) && admin.id === req.admin.id) invalidState(admin);
    if (flagChanged && given === false && admin.superAdmin && isLastEnabledSuper(admin.id))
      invalidState(admin);
    if (
      [...store.admins.values()].some(
        (a) => a.id !== admin.id && a.username.toLowerCase() === username.toLowerCase(),
      )
    )
      duplicate('username');
    const before = adminView(admin);
    if (rolesChanged) extraOf(admin).roleIds = roleIds;
    if (flagChanged) admin.superAdmin = given as boolean;
    admin.username = username;
    if (rolesChanged || flagChanged) syncPermissions(admin);
    writeAudit(req.admin, 'ADMIN_UPDATE', 'ADMIN', admin.id, {
      username: username !== before.username ? { old: before.username, new: username } : undefined,
      roleIds: rolesChanged ? { old: before.roles.map((r) => r.id), new: roleIds } : undefined,
      superAdmin: flagChanged ? { old: before.superAdmin, new: admin.superAdmin } : undefined,
    });
    return ok(adminView(admin));
  }),

  // The status is checked first, then the administrator is looked up (backend answer 1), then the
  // protections: the own account answers 409 for either value, the last enabled super administrator
  // for DISABLED.
  'POST /api/admin/admins/:id/status': guard('ADMIN:MANAGE', (req) => {
    const status = bodyOf(req).status;
    if (status !== 'ACTIVE' && status !== 'DISABLED')
      refuse([{ ref: 'status', reason: 'OUT_OF_RANGE' }]);
    const admin = adminOrFail(req.params.id);
    requireHoldsTarget(req.admin, admin);
    if (admin.id === req.admin.id) invalidState(admin);
    if (
      status === 'DISABLED' &&
      admin.superAdmin &&
      admin.status === 'ACTIVE' &&
      isLastEnabledSuper(admin.id)
    )
      invalidState(admin);
    admin.status = status as 'ACTIVE' | 'DISABLED';
    // A disabled administrator's tokens are void at once.
    if (status === 'DISABLED') admin.tokenVersion += 1;
    writeAudit(req.admin, 'ADMIN_STATUS', 'ADMIN', admin.id, { status });
    return ok(adminView(admin));
  }),

  'POST /api/admin/admins/:id/reset-password': guard('ADMIN:MANAGE', (req) => {
    const admin = adminOrFail(req.params.id);
    requireHoldsTarget(req.admin, admin);
    const newPassword = bodyOf(req).newPassword;
    const problem = newPasswordProblem(newPassword, admin.username, 'newPassword');
    if (problem) refuse([problem]);
    admin.password = newPassword as string;
    admin.mustChangePassword = true;
    admin.tokenVersion += 1;
    writeAudit(req.admin, 'ADMIN_RESET_PASSWORD', 'ADMIN', admin.id, null);
    return ok(null);
  }),

  'POST /api/admin/admins/:id/reset-totp': guard('ADMIN:MANAGE', (req) => {
    const admin = adminOrFail(req.params.id);
    requireHoldsTarget(req.admin, admin);
    admin.totpEnrolled = false;
    admin.totpSecretUnreadable = false;
    admin.tokenVersion += 1;
    writeAudit(req.admin, 'ADMIN_RESET_TOTP', 'ADMIN', admin.id, null);
    return ok(null);
  }),

  'DELETE /api/admin/admins/:id': guard('ADMIN:MANAGE', (req) => {
    const admin = adminOrFail(req.params.id);
    requireHoldsTarget(req.admin, admin);
    if (admin.id === req.admin.id) invalidState(admin);
    if (admin.superAdmin && admin.status === 'ACTIVE' && isLastEnabledSuper(admin.id))
      invalidState(admin);
    store.admins.delete(admin.id);
    systemState.extras.delete(admin.id);
    // The audit rows of the administrator stay, with the name they were written with.
    writeAudit(req.admin, 'ADMIN_DELETE', 'ADMIN', admin.id, { username: admin.username });
    return ok(null);
  }),

  // ---- roles (ROLE:MANAGE; the list is also read for the role choice of the administrator form) ----
  'GET /api/admin/roles': guard(['ROLE:MANAGE', 'ADMIN:MANAGE'], (req) => {
    const rows = [...systemState.roles.values()].map(roleView).sort(byCreatedDesc);
    return ok(paginateQuery(rows, req));
  }),

  'POST /api/admin/roles': guard('ROLE:MANAGE', (req) => {
    const fields = roleFields(bodyOf(req), undefined, (codes) =>
      requireHolds(req.admin, codes, SCOPE.grant),
    );
    const id = String(systemState.nextRoleId++);
    const role: MockRole = { id, createdAt: new Date().toISOString(), ...fields };
    systemState.roles.set(id, role);
    writeAudit(req.admin, 'ROLE_CREATE', 'ROLE', id, {
      name: role.name,
      permissionCodes: role.permissionCodes,
    });
    return ok(roleView(role));
  }),

  'PUT /api/admin/roles/:id': guard('ROLE:MANAGE', (req) => {
    const role = systemState.roles.get(req.params.id) ?? notFound('The role');
    // A role the operator has themselves cannot be changed by them; the codes the role has now and the
    // codes asked for must all be held.
    if (!req.admin.superAdmin && extraOf(req.admin).roleIds.includes(role.id))
      forbidden(SCOPE.ownRole);
    requireHolds(req.admin, role.permissionCodes, SCOPE.role);
    const fields = roleFields(bodyOf(req), role.id, (codes) =>
      requireHolds(req.admin, codes, SCOPE.grant),
    );
    const old = role.permissionCodes;
    Object.assign(role, fields);
    syncAllPermissions();
    writeAudit(req.admin, 'ROLE_UPDATE', 'ROLE', role.id, {
      permissionCodes: {
        added: role.permissionCodes.filter((code) => !old.includes(code)),
        removed: old.filter((code) => !role.permissionCodes.includes(code)),
      },
    });
    return ok(roleView(role));
  }),

  'DELETE /api/admin/roles/:id': guard('ROLE:MANAGE', (req) => {
    const role = systemState.roles.get(req.params.id) ?? notFound('The role');
    requireHolds(req.admin, role.permissionCodes, SCOPE.role);
    const inUse = [...store.admins.values()].some((admin) =>
      extraOf(admin).roleIds.includes(role.id),
    );
    if (inUse)
      throw new MockHttpError(409, 'ROLE_IN_USE', 'The role is still given to administrators');
    systemState.roles.delete(role.id);
    writeAudit(req.admin, 'ROLE_DELETE', 'ROLE', role.id, { name: role.name });
    return ok(null);
  }),

  // ---- the writes of the permission tree (PERMISSION:MANAGE) ----
  // The checks stop at the first that fails, in the order code, type, parent, nameZh, nameEn, then the
  // order: one detail (backend answer 87). A code is 1 to 128 of ASCII letters, digits and `_ : # / . -`.
  'POST /api/admin/permissions': guard('PERMISSION:MANAGE', (req) => {
    const body = bodyOf(req);
    const code = textOf(body.code);
    if (code === '') refuse([{ ref: 'code', reason: 'EMPTY_NOT_ALLOWED' }]);
    if (countCodePoints(code) > 128) refuse([{ ref: 'code', reason: 'TOO_LONG' }]);
    if (!NODE_CODE.test(code)) refuse([{ ref: 'code', reason: 'OUT_OF_RANGE' }]);
    if (body.type !== 'MENU' && body.type !== 'FUNCTION')
      refuse([{ ref: 'type', reason: 'OUT_OF_RANGE' }]);
    const parent = body.parent === null || body.parent === undefined ? null : String(body.parent);
    if (parent !== null && !systemState.nodes.has(parent))
      refuse([{ ref: 'parent', reason: 'OUT_OF_RANGE' }]);
    const { nameZh, nameEn } = nodeNames(body);
    const sortOrder = body.sortOrder === undefined || body.sortOrder === null ? 0 : body.sortOrder;
    if (!Number.isInteger(sortOrder)) refuse([{ ref: 'sortOrder', reason: 'NOT_AN_INTEGER' }]);
    if (systemState.nodes.has(code)) duplicate('code');
    const node = {
      code,
      parent,
      type: body.type as 'MENU' | 'FUNCTION',
      sortOrder: sortOrder as number,
      nameZh,
      nameEn,
      builtin: false,
      createdByUsername: req.admin.username,
    };
    systemState.nodes.set(code, node);
    writeAudit(req.admin, 'PERMISSION_CREATE', 'PERMISSION', code, { parent, type: node.type });
    return ok(node);
  }),

  // An update has no "keep the parent": a missing parent is null, which moves a custom node to the root
  // and is refused for a built-in node that has a parent, so a client always sends the current one
  // (backend answers 87 and 88). The code and the type of the body must be the node's own, or absent.
  'PUT /api/admin/permissions/:code': guard('PERMISSION:MANAGE', (req) => {
    const node = systemState.nodes.get(req.params.code) ?? notFound('The permission node');
    const body = bodyOf(req);
    if (body.code !== undefined && body.code !== null && body.code !== node.code)
      refuse([{ ref: 'code', reason: 'OUT_OF_RANGE' }]);
    // The type of a node never changes (400 on `type`); writing the same type again is no change.
    if (body.type !== undefined && body.type !== null && body.type !== node.type)
      refuse([{ ref: 'type', reason: 'OUT_OF_RANGE' }]);
    const wanted = body.parent === undefined || body.parent === null ? null : String(body.parent);
    if (wanted !== node.parent) {
      // The parent of a built-in node cannot change: the checks of the application rely on it.
      if (node.builtin) refuse([{ ref: 'parent', reason: 'OUT_OF_RANGE' }]);
      // Not under itself, not under one of its own descendants (that would make a loop), and it exists.
      if (
        wanted !== null &&
        (!systemState.nodes.has(wanted) ||
          wanted === node.code ||
          descendantCodes(node.code).has(wanted))
      )
        refuse([{ ref: 'parent', reason: 'OUT_OF_RANGE' }]);
    }
    const { nameZh, nameEn } = nodeNames(body);
    const sortOrder =
      body.sortOrder === undefined || body.sortOrder === null ? node.sortOrder : body.sortOrder;
    if (!Number.isInteger(sortOrder)) refuse([{ ref: 'sortOrder', reason: 'NOT_AN_INTEGER' }]);
    node.nameZh = nameZh;
    node.nameEn = nameEn;
    node.sortOrder = sortOrder as number;
    node.parent = wanted;
    writeAudit(req.admin, 'PERMISSION_UPDATE', 'PERMISSION', node.code, {
      parent: wanted,
      sortOrder: node.sortOrder,
    });
    return ok(node);
  }),

  'DELETE /api/admin/permissions/:code': guard('PERMISSION:MANAGE', (req) => {
    const node = systemState.nodes.get(req.params.code) ?? notFound('The permission node');
    if (node.builtin || (PERMISSION_CODES as readonly string[]).includes(node.code))
      // Contract 3353: a built-in node is refused with INVALID_REQUEST (the contract gives no details).
      throw invalidRequest('A built-in node cannot be deleted', [
        { ref: 'code', reason: 'OUT_OF_RANGE' },
      ]);
    if (sortedNodes().some((other) => other.parent === node.code))
      throw new MockHttpError(409, 'PERMISSION_HAS_CHILDREN', 'The node has children');
    systemState.nodes.delete(node.code);
    // The grants of the node go with it (contract 17.3).
    for (const role of systemState.roles.values()) {
      role.permissionCodes = role.permissionCodes.filter((code) => code !== node.code);
    }
    writeAudit(req.admin, 'PERMISSION_DELETE', 'PERMISSION', node.code, null);
    return ok(null);
  }),

  // ---- the audit log (AUDIT:VIEW): read only ----
  'GET /api/admin/audit-logs': guard('AUDIT:VIEW', (req) => {
    const q = req.query;
    const text = (name: string): string | undefined =>
      typeof q[name] === 'string' && q[name] !== '' ? (q[name] as string) : undefined;
    const instant = (name: string): number | undefined => {
      const value = text(name);
      if (value === undefined) return undefined;
      const ms = Date.parse(value);
      if (Number.isNaN(ms)) return refuse([{ ref: name, reason: 'OUT_OF_RANGE' }]);
      return ms;
    };
    // The most the backend takes (characters, not UTF-16 units): longer text is 400, not "no match".
    for (const [name, limit] of [
      ['action', 64],
      ['targetType', 64],
      ['targetId', 255],
    ] as const) {
      const value = text(name);
      if (value !== undefined && countCodePoints(value) > limit)
        refuse([{ ref: name, reason: 'TOO_LONG' }]);
    }
    const from = instant('from');
    const to = instant('to');
    const rows = systemState.audit.filter(
      (row) =>
        (text('adminId') === undefined || row.adminId === text('adminId')) &&
        (text('action') === undefined || row.action === text('action')) &&
        (text('targetType') === undefined || row.targetType === text('targetType')) &&
        (text('targetId') === undefined || row.targetId === text('targetId')) &&
        // `from` is included, `to` is not
        (from === undefined || Date.parse(row.createdAt) >= from) &&
        (to === undefined || Date.parse(row.createdAt) < to),
    );
    rows.sort(byCreatedDesc);
    return ok(paginateQuery(rows, req));
  }),
};
