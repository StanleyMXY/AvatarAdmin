import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import enUS from '../../src/locales/en-US';
import zhCN from '../../src/locales/zh-CN';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import users from './users';

const pages = users.flatMap((group) => group.routes ?? []);

describe('the user routes (spec 5.0, user rows except notifications)', () => {
  it('are the four pages with the paths, permission codes and components of the table', () => {
    expect(pages.map((p) => [p.path, p.access, p.component])).toEqual([
      ['/users/list', 'USER:VIEW', './users/list'],
      ['/users/abuse', 'ABUSE:VIEW', './users/abuse'],
      ['/users/:id', 'USER:VIEW', './users/detail'],
      ['/users/deletions', 'USER:DELETION', './users/deletions'],
    ]);
    for (const page of pages) {
      expect(existsSync(`src/pages/${(page.component as string).slice(2)}.tsx`), page.path).toBe(
        true,
      );
    }
  });

  it('sit in the users menu, which the notification module shares, and the detail is not a menu entry', () => {
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ key: 'users', name: 'users' });
    expect(pages.find((p) => p.path === '/users/:id')?.hideInMenu).toBe(true);
    expect(pages.filter((p) => p.hideInMenu !== true).map((p) => p.path)).toEqual([
      '/users/list',
      '/users/abuse',
      '/users/deletions',
    ]);
  });

  it('are in the assembled table in the order of the spec', () => {
    const paths = flattenPages(routes).map((p) => p.path);
    const mine = paths.filter((p) => p?.startsWith('/users/'));
    expect(mine.filter((p) => p !== '/users/notifications')).toEqual([
      '/users/list',
      '/users/abuse',
      '/users/:id',
      '/users/deletions',
    ]);
  });

  it('have a menu text in both languages for every page', () => {
    for (const page of pages) {
      const key = `menu.users.${page.name}`;
      expect(zhCN[key], key).toBeTruthy();
      expect(enUS[key], key).toBeTruthy();
    }
  });

  it('show each menu entry only to the administrator who holds its code', () => {
    const shown = (permissions: string[]) => {
      const rules = access({ me: { superAdmin: false, permissions } });
      return filterMenu(users, rules.canAccess)
        .flatMap((g) => g.routes ?? [])
        .map((r) => r.path);
    };
    expect(shown(['USER:VIEW'])).toEqual(['/users/list']);
    expect(shown(['ABUSE:VIEW'])).toEqual(['/users/abuse']);
    expect(shown(['USER:DELETION'])).toEqual(['/users/deletions']);
    expect(shown(['USER:BAN', 'USER:EXPORT'])).toEqual([]);
    expect(shown(['USER:VIEW', 'ABUSE:VIEW', 'USER:DELETION'])).toEqual([
      '/users/list',
      '/users/abuse',
      '/users/deletions',
    ]);
  });
});
