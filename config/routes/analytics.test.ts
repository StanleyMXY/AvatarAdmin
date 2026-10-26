import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import { indexPages, matchPage } from '../../src/components/layout/pageIndex';
import enUS from '../../src/locales/en-US';
import zhCN from '../../src/locales/zh-CN';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import analytics from './analytics';

const pages = analytics.flatMap((group) => group.routes ?? []);

describe('the analytics routes (spec 5.0 and 5.6)', () => {
  it('are the three pages with ANALYTICS:VIEW and existing components', () => {
    expect(pages.map((p) => [p.path, p.name, p.access, p.component])).toEqual([
      ['/analytics/summary', 'summary', 'ANALYTICS:VIEW', './analytics/summary'],
      ['/analytics/detail', 'detail', 'ANALYTICS:VIEW', './analytics/detail'],
      ['/analytics/funnel', 'funnel', 'ANALYTICS:VIEW', './analytics/funnel'],
    ]);
    for (const page of pages) {
      expect(existsSync(`src/pages/${(page.component as string).slice(2)}.tsx`)).toBe(true);
    }
  });

  it('sit in the analytics menu', () => {
    expect(analytics).toHaveLength(1);
    expect(analytics[0]).toMatchObject({ key: 'analytics', name: 'analytics' });
  });

  it('are in the assembled table in the order of the spec', () => {
    const paths = flattenPages(routes).map((p) => p.path);
    expect(paths.filter((p) => p?.startsWith('/analytics/'))).toEqual(pages.map((p) => p.path));
  });

  it('have a menu text in both languages for each page', () => {
    for (const page of pages) {
      expect(zhCN[`menu.analytics.${page.name}`], page.name).toBeTruthy();
      expect(enUS[`menu.analytics.${page.name}`], page.name).toBeTruthy();
    }
  });

  it('show all three pages to ANALYTICS:VIEW and none to anyone else', () => {
    const menu = (permissions: string[]) =>
      filterMenu(analytics, access({ me: { superAdmin: false, permissions } }).canAccess)
        .flatMap((g) => g.routes ?? [])
        .map((r) => r.path);
    expect(menu(['ANALYTICS:VIEW'])).toEqual(pages.map((p) => p.path));
    expect(menu(['ANALYTICS:FUNNEL_MANAGE', 'ANALYTICS:IP_VIEW'])).toEqual([]);
    expect(menu([])).toEqual([]);
  });

  it('are found by the page index', () => {
    const index = indexPages(routes);
    for (const name of ['summary', 'detail', 'funnel']) {
      expect(matchPage(index, `/analytics/${name}`)?.titleKey).toBe(`menu.analytics.${name}`);
    }
  });
});
