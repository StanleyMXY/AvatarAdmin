import type { AdminRoute } from '../src/access/canAccess';
import { PERMISSION_CODES } from '../src/access/permissionCodes';

/**
 * Joins the route lists of the modules into one menu tree. Several modules can share a menu (the
 * "users" menu also holds the notifications page): each of them writes the menu entry with the same
 * `path`, `name` and `icon` and its own children, and the children are joined in module order. A
 * menu keeps the position where it first appeared. Any other route that appears twice is an error.
 */
export function mergeMenus(modules: AdminRoute[][]): AdminRoute[] {
  const merged: AdminRoute[] = [];
  const byPath = new Map<string, AdminRoute>();
  for (const route of modules.flat()) {
    const first = byPath.get(route.path);
    if (!first) {
      const entry = route.routes ? { ...route, routes: [...route.routes] } : route;
      merged.push(entry);
      byPath.set(route.path, entry);
      continue;
    }
    if (!route.routes || !first.routes) {
      throw new Error(`route ${route.path} is defined twice and is not a menu`);
    }
    if (first.name !== route.name || first.icon !== route.icon) {
      throw new Error(`menu ${route.path} is described differently by two modules (name or icon)`);
    }
    first.routes.push(...route.routes);
  }
  return merged;
}

/** The full table: no-layout pages, the root redirect, the menus in the given order, the catch-all. */
export function assembleRoutes(parts: {
  auth: AdminRoute[];
  modules: AdminRoute[][];
}): AdminRoute[] {
  return [
    ...parts.auth,
    { path: '/', redirect: '/dashboard' },
    ...mergeMenus(parts.modules),
    { path: '*', component: './404' },
  ];
}

export type PageRoute = { path: string; access: string | null };

const opensPage = (route: AdminRoute) =>
  route.component !== undefined &&
  route.redirect === undefined &&
  route.layout !== false &&
  route.path !== '*';

/** Every route that opens a page inside the shell, in table order, with its access (null: sign-in only). */
export function flattenPages(routes: AdminRoute[]): PageRoute[] {
  const pages: PageRoute[] = [];
  for (const route of routes) {
    if (route.routes) pages.push(...flattenPages(route.routes));
    else if (opensPage(route)) pages.push({ path: route.path, access: route.access ?? null });
  }
  return pages;
}

const lastSegment = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const parentOf = (path: string) => path.slice(0, path.lastIndexOf('/'));

/** What is wrong with a route table; an empty list means nothing. */
export function problemsIn(routes: AdminRoute[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  const visit = (level: AdminRoute[]) => {
    level.forEach((route, index) => {
      if (seen.has(route.path)) problems.push(`path ${route.path} appears twice`);
      seen.add(route.path);
      if (
        route.access !== undefined &&
        !(PERMISSION_CODES as readonly string[]).includes(route.access)
      ) {
        problems.push(`${route.path}: access "${route.access}" is not a permission code`);
      }
      if (route.name !== undefined && !route.component && !route.routes && !route.redirect) {
        problems.push(`${route.path}: has a name but no component, children or redirect`);
      }
      // A parameter route placed earlier would swallow the fixed route behind it.
      if (route.path !== '*' && !lastSegment(route.path).startsWith(':')) {
        const swallowedBy = level
          .slice(0, index)
          .find(
            (earlier) =>
              parentOf(earlier.path) === parentOf(route.path) &&
              lastSegment(earlier.path).startsWith(':'),
          );
        if (swallowedBy)
          problems.push(
            `${route.path} comes after ${swallowedBy.path}, which would match it first`,
          );
      }
      if (route.routes) visit(route.routes);
    });
  };
  visit(routes);
  return problems;
}
