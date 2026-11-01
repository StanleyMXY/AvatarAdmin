import { describe, expect, it } from 'vitest';
import type { AdminRoute } from '../../access/canAccess';
import { indexPages, matchPage, pageIdentifier, titleWithIdentifier } from './pageIndex';

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

describe('pageIdentifier', () => {
  const pages = indexPages(routes);
  const id = (path: string) => pageIdentifier(pages, path);

  it('is the value of the parameter of a parameter route', () => {
    expect(id('/users/42')).toBe('42');
    expect(id('/users/42/')).toBe('42');
  });

  it('is nothing for a page with a fixed address, even when a parameter route could match it', () => {
    expect(id('/users/list')).toBeUndefined();
    expect(id('/users/abuse')).toBeUndefined();
    expect(id('/standalone')).toBeUndefined();
    expect(id('/nowhere/42')).toBeUndefined();
  });

  it('shows Thai, Arabic and emoji values as they are, decoded', () => {
    expect(id(`/users/${encodeURIComponent('สมชาย')}`)).toBe('สมชาย');
    expect(id(`/users/${encodeURIComponent('١٢٣')}`)).toBe('١٢٣');
    expect(id(`/users/${encodeURIComponent('😀7')}`)).toBe('😀7');
  });

  it('keeps a value that cannot be decoded as it is', () => {
    expect(id('/users/%E0%A4%A')).toBe('%E0%A4%A');
  });

  it('removes direction and control characters that could disguise the title', () => {
    const bidi = String.fromCharCode(0x202e);
    expect(id(`/users/${encodeURIComponent(`4${bidi}2`)}`)).toBe('42');
    expect(
      id(`/users/${encodeURIComponent(`4${String.fromCharCode(0)}${String.fromCharCode(10)}2`)}`),
    ).toBe('42');
  });

  it('removes every character that sets or isolates the direction of text, the Arabic letter mark among them', () => {
    const controls = [
      0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068,
      0x2069,
    ];
    for (const code of controls) {
      const mark = String.fromCharCode(code);
      expect(id(`/users/${encodeURIComponent(`ab${mark}c`)}`), code.toString(16)).toBe('abc');
    }
  });

  it('is nothing when nothing is left of the value', () => {
    expect(id(`/users/${encodeURIComponent(String.fromCharCode(0x200f))}`)).toBeUndefined();
  });

  it('cuts a long value to 20 characters, counting code points, and marks the cut', () => {
    const long = 'a'.repeat(5000);
    expect(id(`/users/${long}`)).toBe(`${'a'.repeat(19)}…`);
    const emoji = '😀'.repeat(30);
    expect(id(`/users/${encodeURIComponent(emoji)}`)).toBe(`${'😀'.repeat(19)}…`);
    expect(id(`/users/${'b'.repeat(20)}`)).toBe('b'.repeat(20));
  });
});

describe('titleWithIdentifier', () => {
  it('joins the title and the identifier with a middle dot', () => {
    expect(titleWithIdentifier('User detail', '42')).toBe('User detail · 42');
    expect(titleWithIdentifier('用户详情', '42')).toBe('用户详情 · 42');
  });

  it('leaves the title alone without an identifier', () => {
    expect(titleWithIdentifier('User list', undefined)).toBe('User list');
  });
});
