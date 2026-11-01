import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import { indexPages, matchPage } from '../../src/components/layout/pageIndex';
import enUS from '../../src/locales/en-US';
import zhCN from '../../src/locales/zh-CN';
import { QUICK_LINKS } from '../../src/pages/dashboard/QuickLinks';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import dashboard from './dashboard';

const pages = dashboard.flatMap((group) => group.routes ?? []);

describe('the overview route (spec 5.0 and 5.1)', () => {
  it('is /dashboard in the 总览 menu with an existing component and no permission code', () => {
    expect(dashboard).toHaveLength(1);
    expect(dashboard[0]).toMatchObject({ key: 'dashboard', name: 'dashboard' });
    expect(pages).toHaveLength(1);
    expect(pages[0].path).toBe('/dashboard');
    expect(pages[0].access).toBeUndefined();
    expect(existsSync(`src/pages/${(pages[0].component as string).slice(2)}.tsx`)).toBe(true);
  });

  it('is the first page of the assembled table and needs only a sign-in', () => {
    const flat = flattenPages(routes);
    expect(flat[0]).toEqual({ path: '/dashboard', access: null });
  });

  it('shows in the menu for an administrator without any permission', () => {
    const menu = filterMenu(
      dashboard,
      access({ me: { superAdmin: false, permissions: [] } }).canAccess,
    );
    expect(menu.flatMap((g) => g.routes ?? []).map((r) => r.path)).toEqual(['/dashboard']);
  });

  it('has a menu text in both languages and opens under it', () => {
    expect(zhCN['menu.dashboard']).toBeTruthy();
    expect(enUS['menu.dashboard']).toBeTruthy();
    expect(zhCN[`menu.dashboard.${pages[0].name}`]).toBeTruthy();
    expect(enUS[`menu.dashboard.${pages[0].name}`]).toBeTruthy();
    const index = indexPages(routes);
    expect(matchPage(index, '/dashboard')?.titleKey).toBe(`menu.dashboard.${pages[0].name}`);
  });

  it('has quick links that ask for the permission of their target page, and every target is in the table (a link that opens the 404 page is a defect)', () => {
    const table = flattenPages(routes);
    const found = QUICK_LINKS.filter((link) => table.some((page) => page.path === link.to));
    expect(found.map((link) => link.to)).toEqual(QUICK_LINKS.map((link) => link.to));
    for (const link of found) {
      expect(table.find((page) => page.path === link.to)?.access, link.to).toBe(link.code);
    }
    // the card links of the overview go to pages that exist
    for (const to of ['/monitor/alerts', '/moderation/queue']) {
      expect(
        table.some((page) => page.path === to),
        to,
      ).toBe(true);
    }
  });
});
