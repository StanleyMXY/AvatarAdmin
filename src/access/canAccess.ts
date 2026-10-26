import type { PermissionCode } from './permissionCodes';

/** What the access check needs to know about the signed-in administrator (`GET /me`). */
export type AccessMe = { superAdmin: boolean; permissions: readonly string[] };

/**
 * A route as `config/routes` writes it. `access` is a permission code and is what Umi's access
 * plugin looks up; a route without it needs only a sign-in. A route without `name`, with
 * `hideInMenu`, a `redirect` or `layout: false` is never a menu entry.
 */
export type AdminRoute = {
  path: string;
  name?: string;
  icon?: string;
  component?: string;
  access?: PermissionCode;
  routes?: AdminRoute[];
  redirect?: string;
  layout?: false;
  hideInMenu?: boolean;
};

/**
 * One check for routes, menu entries, tabs and buttons. No code means a signed-in administrator is
 * enough; a super administrator passes every code; otherwise the code must be in the list exactly
 * (no prefix, no wildcard, case sensitive).
 */
export function canAccess(me: AccessMe | undefined, code: string | undefined): boolean {
  if (!me) return false;
  if (!code) return true;
  if (me.superAdmin) return true;
  return Array.isArray(me.permissions) && me.permissions.includes(code);
}

const isMenuEntry = (route: AdminRoute): boolean =>
  route.name !== undefined &&
  route.hideInMenu !== true &&
  route.redirect === undefined &&
  route.layout !== false;

/**
 * The part of the route tree the administrator may see in the menu: entries without permission
 * go, and a parent without a visible child goes with them. Order is kept; the input is not changed.
 */
export function filterMenu(routes: AdminRoute[], can: (code?: string) => boolean): AdminRoute[] {
  const visible: AdminRoute[] = [];
  for (const route of routes) {
    if (!isMenuEntry(route) || !can(route.access)) continue;
    if (route.routes) {
      const children = filterMenu(route.routes, can);
      if (children.length > 0) visible.push({ ...route, routes: children });
    } else {
      visible.push(route);
    }
  }
  return visible;
}
