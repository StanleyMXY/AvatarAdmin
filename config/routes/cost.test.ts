import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import { indexPages, matchPage } from '../../src/components/layout/pageIndex';
import enUS from '../../src/locales/en-US';
import zhCN from '../../src/locales/zh-CN';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import cost from './cost';

const mine = ['/cost/report', '/cost/prices'];
const pages = cost.flatMap((group) => group.routes ?? []);

describe('the cost routes (spec 5.0, cost menu)', () => {
  it('are the two pages of the table with COST:VIEW and existing components', () => {
    expect(pages.map((p) => [p.path, p.name, p.access, p.component])).toEqual([
      ['/cost/report', 'report', 'COST:VIEW', './cost/report'],
      ['/cost/prices', 'prices', 'COST:VIEW', './cost/prices'],
    ]);
    for (const page of pages) {
      expect(existsSync(`src/pages/${(page.component as string).slice(2)}.tsx`)).toBe(true);
    }
  });

  it('sit in the cost menu, in the order of the spec, in the assembled table', () => {
    expect(cost.every((group) => group.key === 'cost' && group.name === 'cost')).toBe(true);
    const paths = flattenPages(routes)
      .map((p) => p.path)
      .filter((p) => mine.includes(p as string));
    expect(paths).toEqual(mine);
  });

  it('have a menu text in both languages for each page', () => {
    for (const page of pages) {
      expect(zhCN[`menu.cost.${page.name}`], page.name).toBeTruthy();
      expect(enUS[`menu.cost.${page.name}`], page.name).toBeTruthy();
    }
    expect(zhCN['menu.cost.report']).toBe('成本报表');
    expect(zhCN['menu.cost.prices']).toBe('价格');
  });

  it('show in the menu with COST:VIEW only: COST:PRICE alone, or the export and landing codes, show nothing', () => {
    const menu = (permissions: string[]) =>
      filterMenu(cost, access({ me: { superAdmin: false, permissions } }).canAccess)
        .flatMap((g) => g.routes ?? [])
        .map((r) => r.path);
    expect(menu(['COST:VIEW'])).toEqual(mine);
    expect(menu(['COST:PRICE'])).toEqual([]);
    expect(menu(['STATS:VIEW', 'STATS:EXPORT', 'STATS:LAND'])).toEqual([]);
  });

  it('open under their own titles', () => {
    const index = indexPages(routes);
    expect(matchPage(index, '/cost/report')?.titleKey).toBe('menu.cost.report');
    expect(matchPage(index, '/cost/prices')?.titleKey).toBe('menu.cost.prices');
  });
});
