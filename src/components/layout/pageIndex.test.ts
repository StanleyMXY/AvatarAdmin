import { describe, expect, it } from 'vitest';
import type { AdminRoute } from '../../access/canAccess';
import { indexPages, matchPage } from './pageIndex';

const routes: AdminRoute[] = [
  { path: '/user/login', layout: false, component: './login' },
  { path: '/', redirect: '/dashboard' },
  {
    key: 'users',
    name: 'users',
    routes: [
      // The parameter route comes first on purpose: a fixed address must still win.
      {
        path: '/users/:id',
        name: 'detail',
        component: './detail',
        access: 'USER:VIEW',
        hideInMenu: true,
      },
      { path: '/users/abuse', name: 'abuse', component: './abuse', access: 'ABUSE:VIEW' },
      { path: '/users/list', name: 'list', component: './list', access: 'USER:VIEW' },
    ],
  },
  { path: '/standalone', name: 'standalone', component: './standalone' },
  { path: '*', component: './404' },
];

describe('indexPages', () => {
  const pages = indexPages(routes);

  it('lists the pages that open inside the shell, with menu and page names in the title key', () => {
    expect(pages.map((p) => [p.path, p.titleKey])).toEqual([
      ['/users/:id', 'menu.users.detail'],
      ['/users/abuse', 'menu.users.abuse'],
      ['/users/list', 'menu.users.list'],
      ['/standalone', 'menu.standalone'],
    ]);
  });

  it('leaves out menu groups, redirects, no-layout pages and the catch-all', () => {
    const paths = pages.map((p) => p.path);
    for (const out of ['/user/login', '/', '*']) expect(paths).not.toContain(out);
  });

  it('keeps the access code of a page, and none for a page that needs only a sign-in', () => {
    expect(pages.find((p) => p.path === '/users/list')?.access).toBe('USER:VIEW');
    expect(pages.find((p) => p.path === '/standalone')?.access).toBeUndefined();
  });

  it('gives an empty list for no routes', () => {
    expect(indexPages([])).toEqual([]);
  });
});

describe('matchPage', () => {
  const pages = indexPages(routes);

  it('finds the page of an address', () => {
    expect(matchPage(pages, '/users/list')?.titleKey).toBe('menu.users.list');
    expect(matchPage(pages, '/standalone')?.titleKey).toBe('menu.standalone');
  });

  it('lets a fixed address win over a parameter route that is listed first', () => {
    expect(matchPage(pages, '/users/abuse')?.path).toBe('/users/abuse');
    expect(matchPage(pages, '/users/12345')?.path).toBe('/users/:id');
  });

  it('matches a parameter segment with any one segment, Thai, Arabic and encoded text included', () => {
    for (const id of ['42', 'สมชาย', 'أحمد', '%E4%BD%A0', 'a-b_c']) {
      expect(matchPage(pages, `/users/${id}`)?.path).toBe('/users/:id');
    }
  });

  it('needs the same number of segments', () => {
    expect(matchPage(pages, '/users')).toBeUndefined();
    expect(matchPage(pages, '/users/1/2')).toBeUndefined();
    expect(matchPage(pages, '/')).toBeUndefined();
  });

  it('finds nothing for an address that is no page, however it looks', () => {
    for (const path of ['/nowhere', '/users/list/extra', '/user/login', '']) {
      expect(matchPage(pages, path)).toBeUndefined();
    }
  });

  it('is not fooled by a doubled or a trailing slash', () => {
    expect(matchPage(pages, '//users///list/')?.path).toBe('/users/list');
  });
});
