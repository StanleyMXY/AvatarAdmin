import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import { indexPages, matchPage } from '../../src/components/layout/pageIndex';
import enUS from '../../src/locales/en-US';
import zhCN from '../../src/locales/zh-CN';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import stats from './stats';

const mine: (string | undefined)[] = ['/stat/daily', '/stat/retention'];
const pages = stats.flatMap((group) => group.routes ?? []).filter((p) => mine.includes(p.path));

describe('the daily and retention routes (spec 5.0, statistics menu)', () => {
  it('are the two routes of the table with STATS:VIEW and existing components', () => {
    expect(pages.map((p) => [p.path, p.name, p.access, p.component])).toEqual([
      ['/stat/daily', 'daily', 'STATS:VIEW', './stat/daily'],
      ['/stat/retention', 'retention', 'STATS:VIEW', './stat/retention'],
    ]);
    for (const page of pages) {
      expect(existsSync(`src/pages/${(page.component as string).slice(2)}.tsx`)).toBe(true);
    }
  });

  it('sit in the statistics menu', () => {
    expect(stats.every((group) => group.key === 'stats' && group.name === 'stats')).toBe(true);
  });

  it('are in the assembled table in the order of the spec', () => {
    const paths = flattenPages(routes)
      .map((p) => p.path)
      .filter((p) => mine.includes(p));
    expect(paths).toEqual(mine);
  });

  it('have a menu text in both languages for each page', () => {
    for (const page of pages) {
      expect(zhCN[`menu.stats.${page.name}`], page.name).toBeTruthy();
      expect(enUS[`menu.stats.${page.name}`], page.name).toBeTruthy();
    }
  });

  it('show in the menu only with STATS:VIEW', () => {
    const menu = (permissions: string[]) =>
      filterMenu(stats, access({ me: { superAdmin: false, permissions } }).canAccess)
        .flatMap((g) => g.routes ?? [])
        .map((r) => r.path)
        .filter((p) => mine.includes(p));
    expect(menu(['STATS:VIEW'])).toEqual(mine);
    expect(menu(['STATS:EXPORT', 'STATS:LAND'])).toEqual([]);
    expect(menu([])).toEqual([]);
  });

  it('open under their own titles', () => {
    const index = indexPages(routes);
    expect(matchPage(index, '/stat/daily')?.titleKey).toBe('menu.stats.daily');
    expect(matchPage(index, '/stat/retention')?.titleKey).toBe('menu.stats.retention');
  });
});
