// In-memory state of the system management endpoints of the mock backend (contract 17.3 and 17.4):
// roles, what the administrators of the sign-in store have besides what the sign-in needs (their
// roles, the date they were made, the last sign-in), the permission tree and the audit log. It hangs
// on `globalThis` like the rest of the mock state (see store.ts), so saving a mock file does not lose
// it. The administrators themselves stay in the sign-in store: an administrator made here can sign in,
// and what the roles give is what its permissions are. Not a mock file itself: Umi's loader reads
// every file in mock/.
import { PERMISSION_CODES, type PermissionCode } from '../../src/access/permissionCodes';
import { type PermissionNode, PRESET_PERMISSIONS, permissionNodes } from './permissions';
import { type MockAdmin, store } from './store';

export type MockRole = {
  id: string;
  name: string;
  remark: string | null;
  createdAt: string;
  permissionCodes: string[];
};

export type AdminExtra = { roleIds: string[]; createdAt: string; lastLoginAt: string | null };

export type MockAuditLog = {
  id: string;
  adminId: string | null;
  adminUsername: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: unknown;
  createdAt: string;
};

type SystemStore = {
  roles: Map<string, MockRole>;
  extras: Map<string, AdminExtra>;
  nodes: Map<string, PermissionNode>;
  audit: MockAuditLog[];
  nextRoleId: number;
  nextAdminId: number;
  nextAuditId: number;
};

const SEED_AT = '2026-09-01T08:00:00Z';

/** The roles of the preset administrators, one each, with names in several languages. */
const PRESET_ROLES: { id: string; name: string; admin: string; codes: PermissionCode[] }[] = [
  { id: '1', name: 'Soporte al cliente', admin: '1002', codes: PRESET_PERMISSIONS.support },
  { id: '2', name: '财务审核', admin: '1003', codes: PRESET_PERMISSIONS.finance },
  { id: '3', name: 'ผู้ตรวจสอบเนื้อหา', admin: '1004', codes: PRESET_PERMISSIONS.reviewer },
  { id: '4', name: 'Pengguna baru', admin: '1005', codes: PRESET_PERMISSIONS.newhire },
  { id: '5', name: 'Quan sát hệ thống', admin: '1006', codes: PRESET_PERMISSIONS.fresh },
];

const seedRoles = (): MockRole[] => [
  ...PRESET_ROLES.map((role) => ({
    id: role.id,
    name: role.name,
    remark: null,
    createdAt: SEED_AT,
    permissionCodes: [...role.codes].sort(),
  })),
  // Not given to anyone: it can be deleted.
  {
    id: '6',
    name: 'المدققون',
    remark: 'يقرأ سجل التدقيق فقط 🔍',
    createdAt: SEED_AT,
    permissionCodes: ['AUDIT:VIEW'],
  },
  // The people who look after roles and the permission tree.
  {
    id: '7',
    name: 'Role managers',
    remark: null,
    createdAt: SEED_AT,
    permissionCodes: ['PERMISSION:MANAGE', 'ROLE:MANAGE'],
  },
];

const seedExtras = (): [string, AdminExtra][] => [
  ['1001', { roleIds: [], createdAt: '2026-08-01T08:00:00Z', lastLoginAt: '2026-10-26T01:00:00Z' }],
  ...PRESET_ROLES.map((role, i): [string, AdminExtra] => [
    role.admin,
    {
      roleIds: [role.id],
      createdAt: `2026-08-0${i + 2}T08:00:00Z`,
      lastLoginAt: i % 2 === 0 ? `2026-10-2${i}T09:30:00Z` : null,
    },
  ]),
];

/** Rows of the audit log as the backend writes them: the name is the one of the moment of writing. */
const seedAudit = (): MockAuditLog[] => {
  const rows: Omit<MockAuditLog, 'id'>[] = [
    {
      adminId: '1001',
      adminUsername: 'root',
      action: 'USER_BAN',
      targetType: 'USER',
      targetId: '10000000001',
      detail: { reason: 'Spam', status: 'BANNED' },
      createdAt: '2026-10-25T08:00:00Z',
    },
    {
      // The administrator was called "old-support" then and is "support" now.
      adminId: '1002',
      adminUsername: 'old-support',
      action: 'USER_UNBAN',
      targetType: 'USER',
      targetId: '10000000002',
      detail: 'ยกเลิกการระงับบัญชี',
      createdAt: '2026-10-24T08:00:00Z',
    },
    {
      // The administrator was deleted later: the row keeps the name.
      adminId: '9999',
      adminUsername: 'gone-admin',
      action: 'ROLE_UPDATE',
      targetType: 'ROLE',
      targetId: '3',
      detail: { permissionCodes: { added: ['MODERATION:VIEW'], removed: [] } },
      createdAt: '2026-10-23T08:00:00Z',
    },
    {
      // An old row without a name: the id is all there is.
      adminId: '1003',
      adminUsername: null,
      action: 'CONFIG_UPDATE',
      targetType: 'CONFIG',
      targetId: 'ads.enabled',
      detail: { old: false, new: true },
      createdAt: '2026-10-22T08:00:00Z',
    },
    {
      adminId: '1001',
      adminUsername: 'root',
      action: 'USER_VIEW_AVATAR',
      targetType: 'AVATAR_ASSET',
      targetId: '555',
      detail: null,
      createdAt: '2026-10-21T08:00:00Z',
    },
    {
      adminId: '1004',
      adminUsername: 'reviewer',
      action: 'MODERATION_REVIEW',
      targetType: 'MODERATION_RECORD',
      targetId: '8001',
      detail: 'مراجعة المحتوى: مقبول ✅',
      createdAt: '2026-10-20T08:00:00Z',
    },
    {
      adminId: '1001',
      adminUsername: 'root',
      action: 'PUSH_TASK_CREATE',
      targetType: 'PUSH_TASK',
      targetId: '77',
      detail: 42,
      createdAt: '2026-10-19T08:00:00Z',
    },
    {
      adminId: '1001',
      adminUsername: 'root',
      action: 'CAMPAIGN_UPDATE',
      targetType: 'CAMPAIGN',
      targetId: '12',
      // A backend that wrongly put a credential into the detail: the page must not show it.
      detail: { name: 'Q4', facebookAccessToken: 'EAAB-secret-token-value', password: 'hunter2!' },
      createdAt: '2026-10-18T08:00:00Z',
    },
    {
      adminId: '1001',
      adminUsername: 'root',
      action: 'NOTIFICATION_SEND',
      targetType: 'NOTIFICATION',
      targetId: null,
      detail: ['Gracias', 'Cảm ơn', 'Terima kasih', '谢谢'],
      createdAt: '2026-10-17T08:00:00Z',
    },
    {
      adminId: '1001',
      adminUsername: 'root',
      action: 'USER_BAN',
      targetType: 'USER',
      targetId: '10000000003',
      detail: 'x'.repeat(5000),
      createdAt: '2026-10-16T08:00:00Z',
    },
  ];
  // Older rows of the routine kind, so that the list has more than one page.
  for (let i = 0; i < 30; i += 1) {
    rows.push({
      adminId: i % 2 === 0 ? '1001' : '1002',
      adminUsername: i % 2 === 0 ? 'root' : 'support',
      action: i % 3 === 0 ? 'USER_BAN' : i % 3 === 1 ? 'USER_UNBAN' : 'SUBSCRIPTION_GRANT',
      targetType: i % 3 === 2 ? 'ACCOUNT' : 'USER',
      targetId: String(10000000010 + i),
      detail: { note: `row ${i}` },
      createdAt: new Date(Date.parse('2026-10-15T08:00:00Z') - i * 3_600_000).toISOString(),
    });
  }
  return rows.map((row, i) => ({ ...row, id: String(5000 - i) }));
};

/** The built-in tree (nothing custom: custom nodes are made by the page or the tests). */
const seedNodes = (): Map<string, PermissionNode> =>
  new Map(permissionNodes().map((node) => [node.code, node]));

const holder = globalThis as { __avatarAdminMockSystem?: SystemStore };

function fresh(): SystemStore {
  return {
    roles: new Map(seedRoles().map((role) => [role.id, role])),
    extras: new Map(seedExtras()),
    nodes: seedNodes(),
    audit: seedAudit(),
    nextRoleId: 8,
    nextAdminId: 2001,
    nextAuditId: 6000,
  };
}

holder.__avatarAdminMockSystem ??= fresh();
export const systemState: SystemStore = holder.__avatarAdminMockSystem;

/** Puts the sample data back. Call it after `resetStore()` of the sign-in store. */
export function resetSystemStore(): void {
  const next = fresh();
  systemState.roles = next.roles;
  systemState.extras = next.extras;
  systemState.nodes = next.nodes;
  systemState.audit = next.audit;
  systemState.nextRoleId = next.nextRoleId;
  systemState.nextAdminId = next.nextAdminId;
  systemState.nextAuditId = next.nextAuditId;
  // The preset administrators of the sign-in store have the permissions their roles give.
  for (const admin of store.admins.values()) syncPermissions(admin);
}

/**
 * What an administrator has besides the sign-in data. One that the sign-in store knows and this
 * state does not (the sign-in store was reset on its own) starts with the role of its preset, if any.
 */
export function extraOf(admin: MockAdmin): AdminExtra {
  let extra = systemState.extras.get(admin.id);
  if (!extra) {
    const preset = PRESET_ROLES.find((role) => role.admin === admin.id);
    extra = {
      roleIds: preset ? [preset.id] : [],
      createdAt: SEED_AT,
      lastLoginAt: null,
    };
    systemState.extras.set(admin.id, extra);
  }
  return extra;
}

const knownCodes: ReadonlySet<string> = new Set(PERMISSION_CODES);

/**
 * The permissions of an administrator are the codes of its roles that the application checks: a
 * custom node can be given to a role and has no effect (contract 17.3). A super administrator has
 * all of them and nothing here changes that.
 */
export function syncPermissions(admin: MockAdmin): void {
  if (admin.superAdmin) {
    admin.permissions = [...PERMISSION_CODES];
    return;
  }
  const codes = new Set<string>();
  for (const roleId of extraOf(admin).roleIds) {
    for (const code of systemState.roles.get(roleId)?.permissionCodes ?? []) {
      if (knownCodes.has(code)) codes.add(code);
    }
  }
  admin.permissions = [...codes].sort() as PermissionCode[];
}

/** Gives every administrator the permissions its roles give now (after a role changed). */
export function syncAllPermissions(): void {
  for (const admin of store.admins.values()) syncPermissions(admin);
}

export function adminView(admin: MockAdmin) {
  const extra = extraOf(admin);
  const roles = extra.roleIds
    .map((id) => systemState.roles.get(id))
    .filter((role): role is MockRole => role !== undefined)
    .map((role) => ({ id: role.id, name: role.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    id: admin.id,
    username: admin.username,
    superAdmin: admin.superAdmin,
    status: admin.status,
    mustChangePassword: admin.mustChangePassword,
    totpEnrolledAt: admin.totpEnrolled ? '2026-08-02T08:00:00Z' : null,
    lastLoginAt: extra.lastLoginAt,
    createdAt: extra.createdAt,
    roles,
  };
}

/** The audit row of a write: the name is the one of this moment, and it is never changed afterwards. */
export function writeAudit(
  admin: MockAdmin,
  action: string,
  targetType: string,
  targetId: string,
  detail: unknown,
): void {
  systemState.nextAuditId += 1;
  systemState.audit.unshift({
    id: String(systemState.nextAuditId),
    adminId: admin.id,
    adminUsername: admin.username,
    action,
    targetType,
    targetId,
    detail,
    createdAt: new Date().toISOString(),
  });
}

/** The code and every code below it in the tree. */
export function descendantCodes(code: string): Set<string> {
  const found = new Set<string>();
  const stack = [code];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const node of systemState.nodes.values()) {
      if (node.parent === current && !found.has(node.code)) {
        found.add(node.code);
        stack.push(node.code);
      }
    }
  }
  return found;
}
