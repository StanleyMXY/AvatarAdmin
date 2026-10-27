import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRESET_PERMISSIONS } from '../mock/_core/permissions';
import { parseRouteTable } from '../scripts/routeInventory';
import access from '../src/access';
import { type AccessMe, type AdminRoute, canAccess, filterMenu } from '../src/access/canAccess';
import { flattenPages, problemsIn } from './assembleRoutes';
import routes from './routes';

// Spec section 12, first item: an administrator with some permission codes sees in the menu only
// the pages they may open; a direct address to a page they may not open gets the permission page
// (Umi asks the access object for the route's `access`); a super administrator sees every menu.
// The expected pages come from table 5.0 of the spec snapshot, not from the routes under test.
const SPEC = readFileSync('docs/shared-snapshots/admin-frontend-design.md', 'utf8');
const table = parseRouteTable(SPEC).routes;

const leaves = (list: AdminRoute[]): AdminRoute[] =>
  list.flatMap((route) => (route.routes ? leaves(route.routes) : [route]));
const hiddenPaths = new Set(
  leaves(routes)
    .filter((route) => route.hideInMenu === true)
    .map((route) => route.path),
);

const adminOf = (codes: readonly string[], superAdmin = false): AccessMe => ({
  superAdmin,
  permissions: codes,
});
const menuPaths = (me: AccessMe) =>
  leaves(filterMenu(routes, (code) => canAccess(me, code))).map((route) => route.path);

describe('the real route tree against the spec route table', () => {
  it('has every page of table 5.0 once, no other page, and the access code of its row', () => {
    const pages = flattenPages(routes);
    const specByPath = new Map(table.map((row) => [row.path, row.access]));
    expect(pages.map((page) => page.path).sort()).toEqual([...specByPath.keys()].sort());
    for (const page of pages) expect(page.access, page.path).toBe(specByPath.get(page.path));
    expect(problemsIn(routes)).toEqual([]);
  });
});

describe('what each kind of administrator sees', () => {
  const visibleInSpec = (codes: readonly string[]) =>
    table
      .filter((row) => row.access === null || codes.includes(row.access))
      .map((row) => row.path)
      .filter((path) => !hiddenPaths.has(path));

  it('a super administrator sees every page that is a menu entry', () => {
    const all = table.map((row) => row.path).filter((path) => !hiddenPaths.has(path));
    expect(menuPaths(adminOf([], true)).sort()).toEqual(all.sort());
    expect(all.length).toBeGreaterThan(60);
  });

  it('an administrator with no code sees only the pages that need a sign-in alone', () => {
    const seen = menuPaths(adminOf([]));
    expect(seen.sort()).toEqual(visibleInSpec([]).sort());
    expect(seen).toContain('/dashboard');
    expect(seen.length).toBeLessThan(5);
  });

  it.each(Object.keys(PRESET_PERMISSIONS))(
    'the preset administrator %s sees exactly the pages of the codes they hold',
    (name) => {
      const codes = PRESET_PERMISSIONS[name];
      const seen = menuPaths(adminOf(codes));
      expect(seen.sort()).toEqual(visibleInSpec(codes).sort());
      expect(seen.length).toBeGreaterThan(1);
    },
  );

  it('a parent menu is shown only with a visible page inside it', () => {
    const tree = filterMenu(routes, (code) => canAccess(adminOf(['USER:VIEW']), code));
    for (const group of tree) expect(group.routes?.length ?? 0).toBeGreaterThan(0);
    expect(tree.length).toBeLessThan(routes.length);
  });

  it('a page behind a code is denied by the access object to an administrator without it, hidden pages included', () => {
    const rules = access({ me: { ...adminOf(['STATS:VIEW']), mustChangePassword: false } });
    const denied = flattenPages(routes).filter((page) => page.access !== null);
    expect(denied.length).toBeGreaterThan(60);
    for (const page of denied) {
      expect(rules[page.access as keyof typeof rules], page.path).toBe(
        page.access === 'STATS:VIEW',
      );
    }
  });

  it('the access object lets a super administrator into every page, and nobody into anything before the account is known', () => {
    const rules = access({ me: adminOf([], true) });
    for (const page of flattenPages(routes))
      if (page.access) expect(rules[page.access as keyof typeof rules], page.path).toBe(true);
    const nobody = access(undefined);
    for (const page of flattenPages(routes))
      if (page.access) expect(nobody[page.access as keyof typeof nobody], page.path).toBe(false);
  });
});
