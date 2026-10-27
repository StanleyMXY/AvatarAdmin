import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import { indexPages, matchPage } from '../../src/components/layout/pageIndex';
import enUS from '../../src/locales/en-US';
import zhCN from '../../src/locales/zh-CN';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import notifications from './notifications';

const pages = notifications.flatMap((group) => group.routes ?? []);

describe('the notification route (spec 5.0, 用户 menu)', () => {
  it('is one page, /users/notifications, opened with NOTIFICATION:VIEW, with an existing component', () => {
    expect(pages.map((p) => [p.path, p.name, p.access, p.component])).toEqual([
      ['/users/notifications', 'notifications', 'NOTIFICATION:VIEW', './notifications/list'],
    ]);
    expect(existsSync('src/pages/notifications/list.tsx')).toBe(true);
  });

  it('sits in the users menu, after the deletion tasks, in the assembled table', () => {
    expect(notifications.every((group) => group.key === 'users' && group.name === 'users')).toBe(
      true,
    );
    const paths = flattenPages(routes)
      .map((p) => p.path as string)
      .filter((p) => p.startsWith('/users/'));
    expect(paths.indexOf('/users/notifications')).toBeGreaterThan(
      paths.indexOf('/users/deletions'),
    );
  });

  it('has a menu text in both languages', () => {
    expect(zhCN['menu.users.notifications']).toBeTruthy();
    expect(enUS['menu.users.notifications']).toBeTruthy();
  });

  it('is in the menu for NOTIFICATION:VIEW only: the send code opens nothing', () => {
    const menu = (permissions: string[]) =>
      filterMenu(notifications, access({ me: { superAdmin: false, permissions } }).canAccess)
        .flatMap((g) => g.routes ?? [])
        .map((r) => r.path);
    expect(menu(['NOTIFICATION:VIEW'])).toEqual(['/users/notifications']);
    expect(menu(['NOTIFICATION:SEND'])).toEqual([]);
  });

  it('opens under its own title', () => {
    const index = indexPages(routes);
    expect(matchPage(index, '/users/notifications')?.titleKey).toBe('menu.users.notifications');
  });
});
