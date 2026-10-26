import { useAccess } from '@umijs/max';
import type { ReactNode } from 'react';
import type { PermissionCode } from '../access/permissionCodes';

type Access = { canAccess: (code?: string) => boolean };

/** Shows `children` only to an administrator who holds `code` (a super administrator always does). */
export function Can({
  code,
  children,
  fallback = null,
}: {
  code: PermissionCode;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const access = useAccess() as unknown as Access;
  return <>{access.canAccess(code) ? children : fallback}</>;
}
