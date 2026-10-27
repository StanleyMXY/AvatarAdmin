import { describe, expect, it } from 'vitest';
import type { AdminRoute } from '../src/access/canAccess';
import { assembleRoutes, flattenPages, mergeMenus, problemsIn } from './assembleRoutes';
import { menuGroup } from './menus';

const page = (path: string, access?: AdminRoute['access']): AdminRoute => ({
  path,
  name: path.replace(/\W+/g, '_'),
  component: `.${path}`,
  access,
});

describe('mergeMenus', () => {
  it('puts the menus in the order of the spec whichever module comes first', () => {
    const merged = mergeMenus([
      [menuGroup('system', [page('/system/audit')])],
      [menuGroup('users', [page('/users/list')])],
      [menuGroup('dashboard', [page('/dashboard')])],
    ]);
    expect(merged.map((g) => g.name)).toEqual(['dashboard', 'users', 'system']);
  });

  it('joins the pages of two modules that share one menu into one group', () => {
    const merged = mergeMenus([
      [menuGroup('users', [page('/users/list')])],
      [menuGroup('users', [page('/users/notifications')])],
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].routes?.map((r) => r.path)).toEqual(['/users/list', '/users/notifications']);
  });

  it('lets a menu hold pages with unrelated path prefixes (activity holds /act/... and /invite/rewards)', () => {
    const merged = mergeMenus([
      [
        menuGroup('invite', [page('/invite/codes')]),
        menuGroup('activity', [page('/invite/rewards')]),
      ],
      [menuGroup('activity', [page('/act/act-signin-config')])],
    ]);
    const activity = merged.find((g) => g.name === 'activity');
    expect(activity?.routes?.map((r) => r.path)).toEqual([
      '/act/act-signin-config',
      '/invite/rewards',
    ]);
    expect(merged.map((g) => g.name)).toEqual(['invite', 'activity']);
  });

  it('puts the pages of a menu in the order of the route table, also across modules', () => {
    const merged = mergeMenus([
      [menuGroup('system', [page('/system/audit'), page('/system/admins')])],
      [menuGroup('system', [page('/system/channels'), page('/system/app-versions')])],
    ]);
    expect(merged[0].routes?.map((r) => r.path)).toEqual([
      '/system/admins',
      '/system/app-versions',
      '/system/channels',
      '/system/audit',
    ]);
  });

  it('puts a page with a parameter (/users/:id) after the pages with fixed paths of its menu, so the layout does not take its title for the others', () => {
    const merged = mergeMenus([
      [menuGroup('users', [page('/users/list'), page('/users/abuse'), page('/users/:id')])],
      [menuGroup('users', [page('/users/deletions')])],
      [menuGroup('users', [page('/users/notifications')])],
    ]);
    expect(merged[0].routes?.map((r) => r.path)).toEqual([
      '/users/list',
      '/users/abuse',
      '/users/deletions',
      '/users/notifications',
      '/users/:id',
    ]);
    const moderation = mergeMenus([
      [
        menuGroup('moderation', [
          page('/moderation/queue'),
          page('/moderation/:id'),
          page('/moderation/rules'),
          page('/moderation/stats'),
        ]),
      ],
    ]);
    expect(moderation[0].routes?.map((r) => r.path)).toEqual([
      '/moderation/queue',
      '/moderation/rules',
      '/moderation/stats',
      '/moderation/:id',
    ]);
  });

  it('keeps pages that are not in the table after the known ones, in the given order', () => {
    const merged = mergeMenus([
      [menuGroup('users', [page('/users/zzz'), page('/users/list'), page('/users/aaa')])],
    ]);
    expect(merged[0].routes?.map((r) => r.path)).toEqual([
      '/users/list',
      '/users/zzz',
      '/users/aaa',
    ]);
  });

  it('puts groups with unknown names after the known menus, in the given order', () => {
    const merged = mergeMenus([
      [{ name: 'other', routes: [page('/o/1')] }],
      [menuGroup('users', [page('/users/list')])],
      [{ name: 'another', routes: [page('/a/1')] }],
    ]);
    expect(merged.map((g) => g.name)).toEqual(['users', 'other', 'another']);
  });

  it('does not change the arrays the modules export', () => {
    const own = menuGroup('users', [page('/users/list')]);
    const before = JSON.stringify(own);
    mergeMenus([[own], [menuGroup('users', [page('/users/notifications')])]]);
    expect(JSON.stringify(own)).toBe(before);
    expect(own.routes).toHaveLength(1);
  });

  it('passes a page with a path through, after the menus', () => {
    const merged = mergeMenus([[page('/standalone')], [menuGroup('users', [page('/users/list')])]]);
    expect(merged.map((r) => r.path ?? r.name)).toEqual(['users', '/standalone']);
  });

  it('refuses a path that appears twice at the top', () => {
    expect(() => mergeMenus([[page('/x')], [page('/x')]])).toThrow(/\/x/);
  });

  it('refuses a group without a name and a group with two icons', () => {
    expect(() => mergeMenus([[{ routes: [page('/a')] }]])).toThrow(/name/);
    expect(() =>
      mergeMenus([
        [{ name: 'g', icon: 'A', routes: [page('/a')] }],
        [{ name: 'g', icon: 'B', routes: [page('/b')] }],
      ]),
    ).toThrow(/g/);
  });

  it('accepts empty modules', () => {
    expect(mergeMenus([[], [], []])).toEqual([]);
  });
});

describe('assembleRoutes', () => {
  it('puts the no-layout routes first, then the redirect, then the menus, then the catch-all', () => {
    const routes = assembleRoutes({
      auth: [{ path: '/user/login', layout: false, component: './user/login' }],
      modules: [[menuGroup('dashboard', [page('/dashboard')])]],
    });
    expect(routes.map((r) => r.path ?? r.name)).toEqual(['/user/login', '/', 'dashboard', '*']);
    expect(routes[1]).toMatchObject({ path: '/', redirect: '/dashboard' });
    expect(routes.at(-1)).toMatchObject({ path: '*', component: './404' });
  });

  it('works with nothing but empty modules', () => {
    const routes = assembleRoutes({ auth: [], modules: [[], []] });
    expect(routes.map((r) => r.path)).toEqual(['/', '*']);
  });
});

describe('menuGroup', () => {
  it('gives the group a key, the name of the menu and its icon', () => {
    const group = menuGroup('users', [page('/users/list')]);
    expect(group).toMatchObject({ key: 'users', name: 'users', icon: 'UserOutlined' });
    expect(group.path).toBeUndefined();
  });
});

describe('flattenPages', () => {
  it('lists every route that opens a page, with its access, and skips groups, redirects, no-layout routes and the catch-all', () => {
    const pages = flattenPages(
      assembleRoutes({
        auth: [{ path: '/user/login', layout: false, component: './user/login' }],
        modules: [
          [
            menuGroup('dashboard', [page('/dashboard')]),
            menuGroup('users', [page('/users/list', 'USER:VIEW')]),
          ],
        ],
      }),
    );
    expect(pages).toEqual([
      { path: '/dashboard', access: null },
      { path: '/users/list', access: 'USER:VIEW' },
    ]);
  });

  it('does not count a route that has children as a page, nor one without a component', () => {
    expect(
      flattenPages([
        { path: '/a', name: 'a', component: './a', routes: [page('/a/b')] },
        { path: '/c', name: 'c' },
      ]),
    ).toEqual([{ path: '/a/b', access: null }]);
  });
});

describe('problemsIn', () => {
  it('finds nothing wrong in a good table', () => {
    expect(
      problemsIn([menuGroup('users', [page('/users/list', 'USER:VIEW'), page('/users/:id')])]),
    ).toEqual([]);
  });

  it('finds an access value that is not a permission code, also an empty one', () => {
    expect(problemsIn([{ ...page('/a'), access: 'NOT:A_CODE' as never }])).toEqual([
      expect.stringContaining('NOT:A_CODE'),
    ]);
    expect(problemsIn([{ ...page('/a'), access: '' as never }])).toHaveLength(1);
  });

  it('finds two routes with one path, also when one is in a group', () => {
    const problems = problemsIn([page('/a'), menuGroup('users', [page('/a')])]);
    expect(problems.join('\n')).toContain('/a');
  });

  it('finds a named route that has neither a component nor children nor a redirect', () => {
    expect(problemsIn([{ path: '/a', name: 'a' }]).join('\n')).toContain('/a');
    expect(problemsIn([{ path: '/a', name: 'a', redirect: '/b' }])).toEqual([]);
  });

  it('finds a route without a path that is not a menu group', () => {
    expect(problemsIn([{ component: './x' }]).join('\n')).toMatch(/menu/);
    expect(problemsIn([{ name: 'g', routes: [] }]).join('\n')).toMatch(/menu g/);
    expect(problemsIn([{ routes: [page('/a')] }]).join('\n')).toMatch(/menu/);
  });

  it('accepts parameter routes in any place: the router ranks fixed segments first', () => {
    expect(problemsIn([menuGroup('users', [page('/users/:id'), page('/users/abuse')])])).toEqual(
      [],
    );
  });
});
