import { useAccess } from '@umijs/max';
import type { ReactNode } from 'react';

type Access = { canAccess: (code?: string) => boolean };

/** Shows `children` only to an administrator who holds `code` (a super administrator always does). */
export function Can({
  code,
  children,
  fallback = null,
}: {
  code: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const access = useAccess() as unknown as Access;
  return <>{access.canAccess(code) ? children : fallback}</>;
}
