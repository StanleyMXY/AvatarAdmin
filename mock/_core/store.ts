// In-memory state of the mock backend. It lives as long as the dev server and is reset by
// restarting it. Passwords and the verification code here are fakes that only the mock
// backend accepts; they are listed in the README and are not secrets.
import { randomUUID } from 'node:crypto';
import type { PermissionCode } from '../../src/access/permissionCodes';
import { ALL_CODES, PRESET_PERMISSIONS } from './permissions';

export const FAKE_TOTP_CODE = '000000';
export const PASSWORD_MIN_LENGTH = 12;
export const TOKEN_TTL_HOURS = 8;
export const ENROLL_TTL_MINUTES = 10;
export const TOTP_MAX_FAILURES = 5;
export const TOTP_LOCKOUT_MINUTES = 15;

export type MockAdmin = {
  id: string;
  username: string;
  password: string;
  superAdmin: boolean;
  status: 'ACTIVE' | 'DISABLED';
  mustChangePassword: boolean;
  totpEnrolled: boolean;
  permissions: PermissionCode[];
  tokenVersion: number;
  totpFailures: number;
  lockedUntil: number;
};

type TokenRecord = { adminId: string; tokenVersion: number; expiresAt: number };
type EnrollRecord = { adminId: string; expiresAt: number };

export const store = {
  admins: new Map<string, MockAdmin>(),
  tokens: new Map<string, TokenRecord>(),
  enrollTokens: new Map<string, EnrollRecord>(),
};

/** The fake password of a preset administrator: `mock-password-<username>`. */
export const mockPassword = (username: string): string => `mock-password-${username}`;

const preset = (
  id: string,
  username: string,
  over: Partial<MockAdmin> & { permissions: PermissionCode[] },
): MockAdmin => ({
  id,
  username,
  password: mockPassword(username),
  superAdmin: false,
  status: 'ACTIVE',
  mustChangePassword: false,
  totpEnrolled: true,
  tokenVersion: 1,
  totpFailures: 0,
  lockedUntil: 0,
  ...over,
});

export function resetStore(): void {
  store.admins.clear();
  store.tokens.clear();
  store.enrollTokens.clear();
  const seed = [
    preset('1001', 'root', { superAdmin: true, permissions: [...ALL_CODES] }),
    preset('1002', 'support', { permissions: PRESET_PERMISSIONS.support }),
    preset('1003', 'finance', { permissions: PRESET_PERMISSIONS.finance }),
    preset('1004', 'reviewer', { permissions: PRESET_PERMISSIONS.reviewer }),
    preset('1005', 'newhire', {
      mustChangePassword: true,
      permissions: PRESET_PERMISSIONS.newhire,
    }),
    preset('1006', 'fresh', { totpEnrolled: false, permissions: PRESET_PERMISSIONS.fresh }),
  ];
  for (const admin of seed) store.admins.set(admin.id, admin);
}

resetStore();

export const findAdminByUsername = (username: string): MockAdmin | undefined =>
  [...store.admins.values()].find((admin) => admin.username === username);

export function issueToken(
  admin: MockAdmin,
  now = Date.now(),
): { token: string; expiresAt: string } {
  const token = `mock.${randomUUID()}`;
  const expiresAt = now + TOKEN_TTL_HOURS * 60 * 60 * 1000;
  store.tokens.set(token, { adminId: admin.id, tokenVersion: admin.tokenVersion, expiresAt });
  return { token, expiresAt: new Date(expiresAt).toISOString() };
}

export function issueEnrollToken(admin: MockAdmin, now = Date.now()): string {
  const token = `enroll.${randomUUID()}`;
  store.enrollTokens.set(token, {
    adminId: admin.id,
    expiresAt: now + ENROLL_TTL_MINUTES * 60 * 1000,
  });
  return token;
}

/** The administrator a bearer token belongs to, or undefined when it is unknown, expired, or no longer valid. */
export function adminForToken(token: string, now = Date.now()): MockAdmin | undefined {
  const record = store.tokens.get(token);
  if (!record || record.expiresAt <= now) return undefined;
  const admin = store.admins.get(record.adminId);
  if (admin?.status !== 'ACTIVE' || admin.tokenVersion !== record.tokenVersion) return undefined;
  return admin;
}
