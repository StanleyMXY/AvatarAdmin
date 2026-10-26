import { describe, expect, it } from 'vitest';
import type { AdminRoute } from '../src/access/canAccess';
import { assembleRoutes, flattenPages, mergeMenus, problemsIn } from './assembleRoutes';

const leaf = (path: string, access?: AdminRoute['access']): AdminRoute => ({
  path,
  name: path.replace(/\W+/g, '_'),
  component: `.${path}`,
  access,
});

describe('mergeMenus', () => {
  it('keeps menus in the order of first appearance', () => {
    const merged = mergeMenus([
      [{ path: '/a', name: 'a', routes: [leaf('/a/1')] }],
      [{ path: '/b', name: 'b', routes: [leaf('/b/1')] }],
    ]);
    expect(merged.map((r) => r.path)).toEqual(['/a', '/b']);
  });

  it('joins the children of two modules that share one menu, in module order', () => {
    const merged = mergeMenus([
      [{ path: '/users', name: 'users', routes: [leaf('/users/list'), leaf('/users/:id')] }],
      [{ path: '/users', name: 'users', routes: [leaf('/users/notifications')] }],
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].routes?.map((r) => r.path)).toEqual([
      '/users/list',
      '/users/:id',
      '/users/notifications',
    ]);
  });

  it('keeps the position of the first module that mentions the menu', () => {
    const merged = mergeMenus([
      [
        { path: '/invite', name: 'invite', routes: [leaf('/invite/codes')] },
        { path: '/act', name: 'act', routes: [leaf('/invite/rewards')] },
      ],
      [{ path: '/campaign', name: 'campaign', routes: [leaf('/campaign/stats')] }],
      [{ path: '/act', name: 'act', routes: [leaf('/act/signin')] }],
    ]);
    expect(merged.map((r) => r.path)).toEqual(['/invite', '/act', '/campaign']);
  });

  it('passes single routes through and does not merge routes without children', () => {
    const merged = mergeMenus([[leaf('/companionship')], [leaf('/dashboard')]]);
    expect(merged.map((r) => r.path)).toEqual(['/companionship', '/dashboard']);
  });

  it('refuses two modules that describe one menu differently', () => {
    expect(() =>
      mergeMenus([
        [{ path: '/users', name: 'users', icon: 'user', routes: [leaf('/users/a')] }],
        [{ path: '/users', name: 'people', icon: 'user', routes: [leaf('/users/b')] }],
      ]),
    ).toThrow(/\/users/);
    expect(() =>
      mergeMenus([
        [{ path: '/users', name: 'users', icon: 'user', routes: [leaf('/users/a')] }],
        [{ path: '/users', name: 'users', icon: 'team', routes: [leaf('/users/b')] }],
      ]),
    ).toThrow(/\/users/);
  });

  it('refuses a repeated route that is not a menu', () => {
    expect(() => mergeMenus([[leaf('/x')], [leaf('/x')]])).toThrow(/\/x/);
  });

  it('accepts empty modules', () => {
    expect(mergeMenus([[], [], []])).toEqual([]);
  });
});

describe('assembleRoutes', () => {
  it('puts the no-layout routes first, then the redirect, then the menus, then the catch-all', () => {
    const routes = assembleRoutes({
      auth: [{ path: '/user/login', layout: false, component: './user/login' }],
      modules: [[{ path: '/dashboard', name: 'dashboard', component: './dashboard' }]],
    });
    expect(routes.map((r) => r.path)).toEqual(['/user/login', '/', '/dashboard', '*']);
    expect(routes[1]).toMatchObject({ path: '/', redirect: '/dashboard' });
    expect(routes.at(-1)).toMatchObject({ path: '*' });
  });

  it('works with nothing but empty modules', () => {
    const routes = assembleRoutes({ auth: [], modules: [[], []] });
    expect(routes.map((r) => r.path)).toEqual(['/', '*']);
  });
});

describe('flattenPages', () => {
  it('lists every route that opens a page, with its access, and skips menus, redirects and no-layout routes', () => {
    const pages = flattenPages(
      assembleRoutes({
        auth: [{ path: '/user/login', layout: false, component: './user/login' }],
        modules: [
          [
            { path: '/dashboard', name: 'dashboard', component: './dashboard' },
            { path: '/users', name: 'users', routes: [leaf('/users/list', 'USER:VIEW')] },
          ],
        ],
      }),
    );
    expect(pages).toEqual([
      { path: '/dashboard', access: null },
      { path: '/users/list', access: 'USER:VIEW' },
    ]);
  });
});

describe('problemsIn', () => {
  const ok = [
    leaf('/a/x', 'USER:VIEW'),
    { path: '/b', name: 'b', routes: [leaf('/b/1')] },
  ] as AdminRoute[];

  it('finds nothing wrong in a good table', () => {
    expect(problemsIn(ok)).toEqual([]);
  });

  it('finds an access value that is not a permission code', () => {
    expect(problemsIn([{ ...leaf('/a'), access: 'NOT:A_CODE' as never }])).toEqual([
      expect.stringContaining('NOT:A_CODE'),
    ]);
  });

  it('finds two routes with one path', () => {
    const problems = problemsIn([leaf('/a'), { path: '/m', name: 'm', routes: [leaf('/a')] }]);
    expect(problems.join('\n')).toContain('/a');
  });

  it('finds a named route that has neither a component nor children nor a redirect', () => {
    expect(problemsIn([{ path: '/a', name: 'a' }]).join('\n')).toContain('/a');
    expect(problemsIn([{ path: '/a', name: 'a', redirect: '/b' }])).toEqual([]);
  });

  it('finds a parameter route placed before a fixed route of the same level', () => {
    const problems = problemsIn([
      { path: '/users', name: 'users', routes: [leaf('/users/:id'), leaf('/users/abuse')] },
    ]);
    expect(problems.join('\n')).toContain('/users/abuse');
    expect(
      problemsIn([
        { path: '/users', name: 'users', routes: [leaf('/users/abuse'), leaf('/users/:id')] },
      ]),
    ).toEqual([]);
  });

  it('does not mistake siblings with different parents for a clash', () => {
    expect(problemsIn([leaf('/a/:id'), leaf('/b/fixed')])).toEqual([]);
  });
});
