import { guard } from './_core/auth';
import { bodyOf, fail, invalidRequest, MockHttpError, ok, toUmi } from './_core/http';
import { currentMeta } from './_core/meta';
import { ALL_CODES } from './_core/permissions';
import {
  FAKE_TOTP_CODE,
  findAdminByUsername,
  issueEnrollToken,
  issueToken,
  type MockAdmin,
  PASSWORD_MIN_LENGTH,
  store,
  TOTP_LOCKOUT_MINUTES,
  TOTP_MAX_FAILURES,
} from './_core/store';

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

function requireFields(body: Record<string, unknown>, names: string[]): void {
  const missing = names.filter((name) => text(body[name]) === '');
  if (missing.length > 0) {
    throw invalidRequest(
      `missing: ${missing.join(', ')}`,
      missing.map((ref) => ({ ref, reason: 'EMPTY_NOT_ALLOWED' })),
    );
  }
}

function lockedFor(admin: MockAdmin, now: number): number {
  return Math.max(0, Math.ceil((admin.lockedUntil - now) / 1000));
}

function rejectLocked(admin: MockAdmin, now = Date.now()): void {
  const seconds = lockedFor(admin, now);
  if (seconds > 0) {
    // Contract 1.4 lists no waiting time for this lock (2270): no data, no Retry-After.
    throw new MockHttpError(429, 'RATE_LIMITED', 'Too many wrong verification codes');
  }
}

/** Counts a wrong code; the fifth in a row locks the user name for a while (contract 17.2). */
function wrongCode(admin: MockAdmin, now = Date.now(), enrollToken?: string): never {
  admin.totpFailures += 1;
  if (admin.totpFailures >= TOTP_MAX_FAILURES) {
    admin.totpFailures = 0;
    if (enrollToken) store.enrollTokens.delete(enrollToken); // too many wrong codes: the enrollment token is void
    admin.lockedUntil = now + TOTP_LOCKOUT_MINUTES * 60 * 1000;
    rejectLocked(admin, now);
  }
  throw new MockHttpError(
    401,
    'ADMIN_TOTP_INVALID',
    'The verification code is wrong, used or expired',
  );
}

const otpauthUri = (username: string) =>
  `otpauth://totp/AvatarApp:${encodeURIComponent(username)}?secret=MOCKMOCKMOCKMOCK&issuer=AvatarApp&algorithm=SHA1&digits=6&period=30`;

const meOf = (admin: MockAdmin) => ({
  id: admin.id,
  username: admin.username,
  superAdmin: admin.superAdmin,
  mustChangePassword: admin.mustChangePassword,
  permissions: admin.superAdmin ? [...ALL_CODES] : [...admin.permissions],
  passwordMinLength: PASSWORD_MIN_LENGTH,
});

export default {
  'POST /api/admin/auth/login': toUmi((req) => {
    const body = bodyOf(req);
    requireFields(body, ['username', 'password']);
    const admin = findAdminByUsername(text(body.username));
    if (admin) rejectLocked(admin);
    if (admin?.status !== 'ACTIVE' || admin.password !== text(body.password)) {
      return fail(401, 'ADMIN_INVALID_CREDENTIALS', 'Incorrect username or password');
    }
    if (!admin.totpEnrolled) {
      return ok({
        status: 'ENROLL_REQUIRED',
        enrollToken: issueEnrollToken(admin),
        otpauthUri: otpauthUri(admin.username),
      });
    }
    const totp = text(body.totp);
    if (totp === '') return fail(401, 'ADMIN_TOTP_REQUIRED', 'A verification code is required');
    // A secret that cannot be decrypted answers like a wrong code and counts like one (contract: 401 ADMIN_TOTP_INVALID).
    if (totp !== FAKE_TOTP_CODE || admin.totpSecretUnreadable) return wrongCode(admin);
    admin.totpFailures = 0;
    return ok(issueToken(admin));
  }),

  'POST /api/admin/auth/totp/enroll': toUmi((req) => {
    const body = bodyOf(req);
    requireFields(body, ['enrollToken', 'totp']);
    const record = store.enrollTokens.get(text(body.enrollToken));
    const admin =
      record && record.expiresAt > Date.now() ? store.admins.get(record.adminId) : undefined;
    if (admin?.status !== 'ACTIVE') {
      return fail(401, 'ADMIN_INVALID_TOKEN', 'The enrollment token is invalid or expired');
    }
    rejectLocked(admin);
    if (admin.enrollSecretUnreadable) {
      // The pending secret cannot be decrypted: the token is void and the person signs in again.
      store.enrollTokens.delete(text(body.enrollToken));
      return fail(401, 'ADMIN_INVALID_TOKEN', 'The enrollment token is invalid or expired');
    }
    if (text(body.totp) !== FAKE_TOTP_CODE)
      return wrongCode(admin, Date.now(), text(body.enrollToken));
    store.enrollTokens.delete(text(body.enrollToken));
    admin.totpEnrolled = true;
    admin.totpFailures = 0;
    return ok(issueToken(admin));
  }),

  'POST /api/admin/auth/change-password': guard(
    null,
    (req) => {
      const body = bodyOf(req);
      requireFields(body, ['oldPassword', 'newPassword']);
      const { admin } = req;
      if (text(body.oldPassword) !== admin.password) {
        return fail(401, 'ADMIN_INVALID_CREDENTIALS', 'The old password is wrong');
      }
      const next = text(body.newPassword);
      if ([...next].length < PASSWORD_MIN_LENGTH) {
        throw invalidRequest(`newPassword must have at least ${PASSWORD_MIN_LENGTH} characters`, [
          { ref: 'newPassword', reason: 'OUT_OF_RANGE' },
        ]);
      }
      if (next === admin.username) {
        throw invalidRequest('newPassword must differ from the user name', [
          { ref: 'newPassword', reason: 'OUT_OF_RANGE' },
        ]);
      }
      admin.password = next;
      admin.mustChangePassword = false;
      admin.tokenVersion += 1; // every issued token stops working
      return ok(null);
    },
    { allowMustChange: true },
  ),

  'GET /api/admin/me': guard(null, (req) => ok(meOf(req.admin)), { allowMustChange: true }),

  // The fields that repeat a setting follow it as saved (see currentMeta).
  'GET /api/admin/meta': guard(null, () => ok(currentMeta())),
};
