import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import { indexPages, matchPage } from '../../src/components/layout/pageIndex';
import enUS from '../../src/locales/en-US';
import zhCN from '../../src/locales/zh-CN';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import system from './system';

const mine = ['/system/admins', '/system/roles', '/system/permissions', '/system/audit'];
const pages = system.flatMap((group) => group.routes ?? []);

describe('the system management routes (spec 5.0, system management rows except app versions and channel packages)', () => {
  it('are the four pages of the table, each with its permission code and an existing component', () => {
    expect(pages.map((p) => [p.path, p.name, p.access, p.component])).toEqual([
      ['/system/admins', 'admins', 'ADMIN:MANAGE', './system/admins'],
      ['/system/roles', 'roles', 'ROLE:MANAGE', './system/roles'],
      ['/system/permissions', 'permissions', 'PERMISSION:MANAGE', './system/permissions'],
      ['/system/audit', 'audit', 'AUDIT:VIEW', './system/audit'],
    ]);
    for (const page of pages) {
      expect(existsSync(`src/pages/${(page.component as string).slice(2)}.tsx`), page.path).toBe(
        true,
      );
    }
  });

  it('sit in the system menu, which the app version and channel package modules share, in the order of the spec', () => {
    expect(system).toHaveLength(1);
    expect(system[0]).toMatchObject({ key: 'system', name: 'system' });
    const paths = flattenPages(routes)
      .map((p) => p.path)
      .filter((p) => mine.includes(p as string));
    expect(paths).toEqual(mine);
  });

  it('have a menu text in both languages for each page', () => {
    for (const page of pages) {
      const key = `menu.system.${page.name}`;
      expect(zhCN[key], key).toBeTruthy();
      expect(enUS[key], key).toBeTruthy();
    }
  });

  it('show each page in the menu only to the administrator who holds its code', () => {
    const menu = (permissions: string[], superAdmin = false) =>
      filterMenu(system, access({ me: { superAdmin, permissions } }).canAccess)
        .flatMap((g) => g.routes ?? [])
        .map((r) => r.path);
    expect(menu(['ADMIN:MANAGE'])).toEqual(['/system/admins']);
    expect(menu(['ROLE:MANAGE'])).toEqual(['/system/roles']);
    expect(menu(['PERMISSION:MANAGE'])).toEqual(['/system/permissions']);
    expect(menu(['AUDIT:VIEW'])).toEqual(['/system/audit']);
    // reading the tree is possible with ROLE:MANAGE, but the page of the tree is for PERMISSION:MANAGE
    expect(menu(['ROLE:MANAGE', 'AUDIT:VIEW'])).toEqual(['/system/roles', '/system/audit']);
    expect(menu(['USER:VIEW'])).toEqual([]);
    expect(menu([], true)).toEqual(mine);
  });

  it('are found by the page index with the permission that opens them', () => {
    const index = indexPages(routes);
    for (const [path, code] of [
      ['/system/admins', 'ADMIN:MANAGE'],
      ['/system/roles', 'ROLE:MANAGE'],
      ['/system/permissions', 'PERMISSION:MANAGE'],
      ['/system/audit', 'AUDIT:VIEW'],
    ]) {
      expect(matchPage(index, path)?.access, path).toBe(code);
    }
  });
});
