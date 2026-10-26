import { apiRequest } from '../../request/apiClient';
import { isOwnAccount } from './self';
import type {
  AdminCreateInput,
  AdminPatch,
  AdminRole,
  AdminStatus,
  AdminUser,
  AuditLog,
  AuditQuery,
  Page,
  Paging,
  PermissionCreateInput,
  PermissionNode,
  PermissionPatch,
  RoleInput,
} from './types';

export { isOwnAccount } from './self';
export * from './types';

const enc = encodeURIComponent;

/**
 * A list answer as a page. The contract says the lists are `{ items, total }`; a bare list, a page
 * without a total and an answer that is not a list at all are read as what they hold, never as a crash.
 */
function pageOf<T>(data: unknown): Page<T> {
  if (Array.isArray(data)) return { items: data as T[], total: data.length };
  const items = (data as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return { items: [], total: 0 };
  const total = (data as { total?: unknown }).total;
  return { items: items as T[], total: typeof total === 'number' ? total : items.length };
}

const readPage = async <T>(url: string, params: object): Promise<Page<T>> =>
  pageOf<T>(
    await apiRequest<unknown>({ method: 'GET', url, params: params as Record<string, unknown> }),
  );

const ALL_PAGE_SIZE = 200;
const ALL_MAX_PAGES = 50;

/**
 * Every row of a paged list, 200 per read (the largest page). It stops at `total` rows or at an
 * empty page, so an answer whose total is wrong cannot make it loop.
 */
async function loadAll<T>(read: (paging: Paging) => Promise<Page<T>>): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= ALL_MAX_PAGES; page += 1) {
    const answer = await read({ page, pageSize: ALL_PAGE_SIZE });
    rows.push(...answer.items);
    if (answer.items.length === 0 || rows.length >= answer.total) break;
  }
  return rows;
}

// ---- administrators (ADMIN:MANAGE) ----

export const listAdmins = (query: Paging): Promise<Page<AdminUser>> => readPage('/admins', query);

/** Every administrator: the guard for "the last enabled super administrator" needs all of them. */
export const loadAllAdmins = (): Promise<AdminUser[]> => loadAll(listAdmins);

/**
 * The initial password is sent exactly as typed (no trimming, no hashing in the browser). The
 * answer is not read for a password: the backend does not send one, and nothing here would show it.
 */
export const createAdmin = (input: AdminCreateInput): Promise<AdminUser> =>
  apiRequest({
    method: 'POST',
    url: '/admins',
    body: {
      username: input.username,
      password: input.password,
      roleIds: input.roleIds,
      superAdmin: input.superAdmin,
    },
  });

/**
 * The body of `PUT /admins/{id}`. A person cannot change their own roles or super administrator flag
 * (contract 17.4), so for the own row nothing of them is in the body, whatever the form held; the
 * form disables the controls, this is the second line.
 */
export function adminPatchBody(patch: AdminPatch, own: boolean): AdminPatch {
  const body: AdminPatch = {};
  if (own) return body;
  if (patch.roleIds !== undefined) body.roleIds = [...patch.roleIds];
  if (patch.superAdmin !== undefined) body.superAdmin = patch.superAdmin;
  return body;
}

export function updateAdmin(
  target: { id: string; username?: string },
  patch: AdminPatch,
  me: { id?: string; username?: string } | undefined,
): Promise<AdminUser> {
  return apiRequest({
    method: 'PUT',
    url: `/admins/${enc(target.id)}`,
    body: adminPatchBody(patch, isOwnAccount(me, target)),
  });
}

export const setAdminStatus = (id: string, status: AdminStatus): Promise<unknown> =>
  apiRequest({ method: 'POST', url: `/admins/${enc(id)}/status`, body: { status } });

/** Sets the password the administrator must change at the next sign-in. The password is sent as typed. */
export const resetAdminPassword = (id: string, newPassword: string): Promise<unknown> =>
  apiRequest({ method: 'POST', url: `/admins/${enc(id)}/reset-password`, body: { newPassword } });

export const resetAdminTotp = (id: string): Promise<unknown> =>
  apiRequest({ method: 'POST', url: `/admins/${enc(id)}/reset-totp` });

export const deleteAdmin = (id: string): Promise<unknown> =>
  apiRequest({ method: 'DELETE', url: `/admins/${enc(id)}` });

// ---- roles (ROLE:MANAGE; reading also ADMIN:MANAGE, for the role choice of the administrator form) ----

export const listRoles = (query: Paging): Promise<Page<AdminRole>> => readPage('/roles', query);

/** The options of the role choice: `pageSize=200` and further pages if there are more. */
export const loadAllRoles = (): Promise<AdminRole[]> => loadAll(listRoles);

export const createRole = (input: RoleInput): Promise<AdminRole> =>
  apiRequest({ method: 'POST', url: '/roles', body: input });

/** The permission codes replace the role's whole set. */
export const updateRole = (id: string, input: RoleInput): Promise<AdminRole> =>
  apiRequest({ method: 'PUT', url: `/roles/${enc(id)}`, body: input });

/** 409 ROLE_IN_USE while an administrator still has the role. */
export const deleteRole = (id: string): Promise<unknown> =>
  apiRequest({ method: 'DELETE', url: `/roles/${enc(id)}` });

// ---- permission tree (read: ROLE:MANAGE or PERMISSION:MANAGE; write: PERMISSION:MANAGE) ----

/** The nodes of the tree: `{ items }` as the contract's list rule says, or a bare list. */
export async function listPermissions(): Promise<PermissionNode[]> {
  return pageOf<PermissionNode>(await apiRequest<unknown>({ method: 'GET', url: '/permissions' }))
    .items;
}

export const createPermission = (input: PermissionCreateInput): Promise<PermissionNode> =>
  apiRequest({ method: 'POST', url: '/permissions', body: input });

/** The code and the type never change; a built-in node does not get a new parent either. */
export const updatePermission = (
  code: string,
  patch: PermissionPatch,
  node: { builtin: boolean },
): Promise<PermissionNode> => {
  const body: PermissionPatch = {
    nameZh: patch.nameZh,
    nameEn: patch.nameEn,
    sortOrder: patch.sortOrder,
  };
  if (!node.builtin && patch.parent !== undefined) body.parent = patch.parent;
  return apiRequest({ method: 'PUT', url: `/permissions/${enc(code)}`, body });
};

/** 409 PERMISSION_HAS_CHILDREN while the node has children. */
export const deletePermission = (code: string): Promise<unknown> =>
  apiRequest({ method: 'DELETE', url: `/permissions/${enc(code)}` });

// ---- audit log (AUDIT:VIEW): read only ----

export const listAuditLogs = (query: AuditQuery): Promise<Page<AuditLog>> =>
  readPage('/audit-logs', query);
