import type { AdminRoute } from '../src/access/canAccess';
import { PERMISSION_CODES } from '../src/access/permissionCodes';
import { MENUS, ROUTE_ORDER } from './menus';

const MENU_KEYS: readonly string[] = Object.keys(MENUS);

function rank(order: readonly string[], value: string | undefined): number {
  const index = value === undefined ? -1 : order.indexOf(value);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

const isParameterPath = (path: string | undefined) =>
  path?.split('/').some((part) => part.startsWith(':')) ?? false;

function byRank<T>(key: (item: T) => number) {
  return (a: T, b: T) => {
    const [x, y] = [key(a), key(b)];
    return x === y ? 0 : x < y ? -1 : 1;
  };
}

/**
 * Joins the route lists of the modules into one menu tree.
 *
 * A route without a `path` is a menu group (built with `menuGroup`). Groups with the same `name`
 * from different modules become one group holding all their pages. The groups are put in the order
 * of the menus in spec 5.0 (`MENUS`), and the pages inside a group in the order of the route table
 * (`ROUTE_ORDER`), whichever module added them. Any route with a path that appears twice is an error.
 */
export function mergeMenus(modules: AdminRoute[][]): AdminRoute[] {
  const groups = new Map<string, AdminRoute>();
  const pages: AdminRoute[] = [];
  const paths = new Set<string>();
  for (const route of modules.flat()) {
    if (route.path !== undefined) {
      if (paths.has(route.path)) throw new Error(`route ${route.path} is defined twice`);
      paths.add(route.path);
      pages.push(route);
      continue;
    }
    if (!route.name) throw new Error('a route without a path must be a menu group with a name');
    const first = groups.get(route.name);
    if (!first) {
      groups.set(route.name, { ...route, routes: [...(route.routes ?? [])] });
    } else if (first.icon !== route.icon) {
      throw new Error(`menu ${route.name} is described with two different icons`);
    } else {
      first.routes = [...(first.routes ?? []), ...(route.routes ?? [])];
    }
  }
  const ordered = [...groups.values()].sort(byRank((group) => rank(MENU_KEYS, group.name)));
  for (const group of ordered) {
    group.routes = [...(group.routes ?? [])].sort(byRank((page) => rank(ROUTE_ORDER, page.path)));
    // A page with a parameter (`/users/:id`) goes after the pages with fixed paths: the router ranks
    // fixed segments first anyway, but the layout takes the title of the first path that matches,
    // so `/users/deletions` would be titled as a user.
    group.routes = [
      ...group.routes.filter((page) => !isParameterPath(page.path)),
      ...group.routes.filter((page) => isParameterPath(page.path)),
    ];
  }
  return [...ordered, ...pages];
}

/** The full table: no-layout pages, the root redirect, the menus in the order of the spec, the catch-all. */
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

/** Every route that opens a page inside the shell, in table order, with its access (null: sign-in only). */
export function flattenPages(routes: AdminRoute[]): PageRoute[] {
  const pages: PageRoute[] = [];
  for (const route of routes) {
    if (route.routes) pages.push(...flattenPages(route.routes));
    else if (
      route.path !== undefined &&
      route.component !== undefined &&
      route.redirect === undefined &&
      route.layout !== false &&
      route.path !== '*'
    ) {
      pages.push({ path: route.path, access: route.access ?? null });
    }
  }
  return pages;
}

/** What is wrong with a route table; an empty list means nothing. */
export function problemsIn(routes: AdminRoute[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  const visit = (level: AdminRoute[]) => {
    for (const route of level) {
      const label = route.path ?? `menu ${route.name ?? '(no name)'}`;
      if (route.path === undefined) {
        if (!route.name || !route.routes || route.routes.length === 0) {
          problems.push(
            `${label}: a route without a path must be a named menu group with children`,
          );
        }
      } else {
        if (seen.has(route.path)) problems.push(`path ${route.path} appears twice`);
        seen.add(route.path);
      }
      if (
        route.access !== undefined &&
        !(PERMISSION_CODES as readonly string[]).includes(route.access)
      ) {
        problems.push(`${label}: access "${route.access}" is not a permission code`);
      }
      if (route.name !== undefined && !route.component && !route.routes && !route.redirect) {
        problems.push(`${label}: has a name but no component, children or redirect`);
      }
      if (route.routes) visit(route.routes);
    }
  };
  visit(routes);
  return problems;
}
