import { type AccessMe, canAccess } from './access/canAccess';
import type { PermissionCode } from './access/permissionCodes';

export type AccessRules = Record<PermissionCode, boolean> & {
  /** For buttons and columns: `useAccess().canAccess('USER:BAN')`. No code means "signed in". */
  canAccess: (code?: string) => boolean;
};

/**
 * Umi's access factory. A route's `access` string is looked up as a key of the returned object, so
 * the object answers any key with the permission check instead of listing the 79 codes.
 */
export default function access(initialState?: { me?: AccessMe }): AccessRules {
  const me = initialState?.me;
  const rules = new Proxy({} as AccessRules, {
    get(_target, property) {
      if (typeof property !== 'string') return undefined;
      if (property === 'canAccess') return (code?: string) => canAccess(me, code);
      if (property === 'toJSON') return undefined;
      return canAccess(me, property);
    },
  });
  return rules;
}
