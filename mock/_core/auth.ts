import type { PermissionCode } from '../../src/access/permissionCodes';
import { type AdminReq, header, MockHttpError, type MockReq, type Reply, toUmi } from './http';
import { adminForToken, type MockAdmin } from './store';

const BEARER = /^Bearer (\S+)$/;

/** The administrator of the request's bearer token; throws 401 ADMIN_INVALID_TOKEN when there is none. */
export function authenticate(req: MockReq, now = Date.now()): MockAdmin {
  const match = BEARER.exec(header(req, 'authorization') ?? '');
  const admin = match ? adminForToken(match[1], now) : undefined;
  if (!admin)
    throw new MockHttpError(
      401,
      'ADMIN_INVALID_TOKEN',
      'The administrator token is invalid, expired or missing',
    );
  return admin;
}

/** A list means "any of these"; the super administrator passes every check. */
export function hasPermission(
  admin: MockAdmin,
  required: PermissionCode | PermissionCode[],
): boolean {
  if (admin.superAdmin) return true;
  const codes = Array.isArray(required) ? required : [required];
  return codes.some((code) => admin.permissions.includes(code));
}

/**
 * Wraps a handler of the mock backend: valid token (else 401 ADMIN_INVALID_TOKEN), then, while the
 * administrator must change the password, only handlers marked `allowMustChange` run (else 403
 * ADMIN_FORBIDDEN), then the permission (else 403 ADMIN_FORBIDDEN; `null` needs only a sign-in).
 * The handler gets `req.admin`.
 */
export function guard(
  required: PermissionCode | PermissionCode[] | null,
  handler: (req: AdminReq) => Reply | Promise<Reply>,
  options: { allowMustChange?: boolean } = {},
) {
  return toUmi((req) => {
    const admin = authenticate(req);
    if (admin.mustChangePassword && !options.allowMustChange) {
      throw new MockHttpError(403, 'ADMIN_FORBIDDEN', 'The password must be changed first');
    }
    if (required !== null && !hasPermission(admin, required)) {
      throw new MockHttpError(
        403,
        'ADMIN_FORBIDDEN',
        'The administrator lacks the permission for this endpoint',
      );
    }
    const adminReq = req as AdminReq;
    adminReq.admin = admin;
    return handler(adminReq);
  });
}
