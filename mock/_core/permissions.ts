import { PERMISSION_CODES, type PermissionCode } from '../../src/access/permissionCodes';
import enNames from '../../src/locales/en-US/permission';
import zhNames from '../../src/locales/zh-CN/permission';
import tree from './permissionTree.generated.json';

export const ALL_CODES: readonly PermissionCode[] = PERMISSION_CODES;

export type PermissionNode = {
  code: string;
  parent: string | null;
  type: 'MENU' | 'FUNCTION';
  sortOrder: number;
  nameZh: string;
  nameEn: string;
  builtin: boolean;
  createdByUsername: string | null;
};

/**
 * The built-in permission tree (contract 17.3): one MENU node for every page, the other codes of
 * the page as FUNCTION children. Parents and order come from spec table 5.0 (see
 * scripts/permissionTree.ts); the names are the ones in the language files.
 */
export const permissionNodes = (): PermissionNode[] =>
  (
    tree as { code: string; parent: string | null; type: 'MENU' | 'FUNCTION'; sortOrder: number }[]
  ).map((node) => ({
    ...node,
    nameZh: zhNames[`permission.${node.code}`],
    nameEn: enNames[`permission.${node.code}`],
    builtin: true,
    createdByUsername: null,
  }));

/** Permission sets of the preset administrators (the super administrator has every code). */
export const PRESET_PERMISSIONS: Record<string, PermissionCode[]> = {
  support: [
    'SESSION:VIEW',
    'USER:VIEW',
    'USER:BAN',
    'SUPPORT:VIEW',
    'SUPPORT:MANAGE',
    'COMPLAINT:VIEW',
    'NOTIFICATION:VIEW',
    'STATS:VIEW',
  ],
  finance: [
    'SUBSCRIPTION:VIEW',
    'SUBSCRIPTION:GRANT',
    'SUBSCRIPTION:CONFIG',
    'CREDIT:REVIEW',
    'FINANCE:VIEW',
    'COST:VIEW',
    'COST:PRICE',
    'STATS:VIEW',
    'STATS:EXPORT',
    'STATS:LAND',
  ],
  reviewer: [
    'MODERATION:VIEW',
    'MODERATION:REVIEW',
    'MODERATION:CONFIG',
    'COMPLAINT:VIEW',
    'COMPLAINT:MANAGE',
  ],
  newhire: ['USER:VIEW', 'STATS:VIEW'],
  fresh: ['STATS:VIEW', 'MONITOR:VIEW'],
};
