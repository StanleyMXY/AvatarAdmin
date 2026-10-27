import type { Page } from '../../request/errors';

export type { Page };

/** `AdminUser.status` (contract 17.4): the only two values. */
export type AdminStatus = 'ACTIVE' | 'DISABLED';

export type AdminRoleRef = { id: string; name: string };

/**
 * A row of `GET /admins` (contract 17.4 appendix, row 15). The backend never sends the password
 * hash, the authenticator secret or the token version, and neither does anything here read them.
 */
export type AdminUser = {
  id: string;
  username: string;
  superAdmin: boolean;
  status: AdminStatus;
  mustChangePassword: boolean;
  totpEnrolledAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  roles: AdminRoleRef[];
};

/** A row of `GET /roles`: `permissionCodes` ascending. */
export type AdminRole = {
  id: string;
  name: string;
  remark: string | null;
  createdAt: string;
  permissionCodes: string[];
};

export type PermissionType = 'MENU' | 'FUNCTION';

/** A node of `GET /permissions` (contract 17.3). `parent` null is a root. */
export type PermissionNode = {
  code: string;
  parent: string | null;
  type: PermissionType;
  sortOrder: number;
  nameZh: string | null;
  nameEn: string | null;
  builtin: boolean;
};

/** A row of `GET /audit-logs`. `detail` has no fixed type in the contract: it can be text, an object, a number. */
export type AuditLog = {
  id: string;
  adminId: string | null;
  /** The name at the time of writing; it does not follow a rename and survives the delete. */
  adminUsername: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: unknown;
  createdAt: string;
};

export type Paging = { page: number; pageSize: number };

export type AuditQuery = Paging & {
  adminId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  from?: string;
  to?: string;
};

/** What the create form collects. The password goes to the server as typed. */
export type AdminCreateInput = {
  username: string;
  password: string;
  roleIds: string[];
  superAdmin: boolean;
};

/**
 * What the edit form may change. The username cannot be changed after creation, so it is not here.
 * `roleIds` is left out when the role list could not be read (sending `[]` would take every role away),
 * `superAdmin` is left out for an administrator who is not a super administrator.
 */
export type AdminPatch = { roleIds?: string[]; superAdmin?: boolean };

export type RoleInput = { name: string; remark: string | null; permissionCodes: string[] };

export type PermissionCreateInput = {
  code: string;
  parent: string | null;
  type: PermissionType;
  sortOrder: number;
  nameZh: string;
  nameEn: string;
};

/** A built-in node may change names and order only; a custom node may also change its parent. */
export type PermissionPatch = {
  nameZh: string;
  nameEn: string;
  sortOrder: number;
  parent?: string | null;
};
