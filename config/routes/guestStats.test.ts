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

const mine = (path: string | undefined) => path === '/stat/guest';
const pages = stats.flatMap((group) => group.routes ?? []).filter((p) => mine(p.path));

describe('the guest statistics route (spec 5.0, statistics menu)', () => {
  it('is one route with STATS:VIEW and an existing component, in the statistics menu', () => {
    expect(pages.map((p) => [p.path, p.name, p.access, p.component])).toEqual([
      ['/stat/guest', 'guest', 'STATS:VIEW', './stat/guest'],
    ]);
    expect(existsSync('src/pages/stat/guest.tsx')).toBe(true);
    expect(stats.every((group) => group.key === 'stats' && group.name === 'stats')).toBe(true);
  });

  it('leaves the daily and retention routes where they are', () => {
    const paths = stats.flatMap((group) => group.routes ?? []).map((p) => p.path);
    expect(paths).toEqual(
      expect.arrayContaining(['/stat/daily', '/stat/retention', '/stat/guest']),
    );
  });

  it('is in the assembled table after the daily and retention reports', () => {
    const paths = flattenPages(routes)
      .map((p) => p.path)
      .filter((p) => p?.startsWith('/stat/'));
    expect(paths).toEqual(['/stat/daily', '/stat/retention', '/stat/guest']);
  });

  it('has a menu text in both languages', () => {
    expect(zhCN['menu.stats.guest']).toBeTruthy();
    expect(enUS['menu.stats.guest']).toBeTruthy();
  });

  it('shows in the menu only with STATS:VIEW', () => {
    const menu = (permissions: string[]) =>
      filterMenu(stats, access({ me: { superAdmin: false, permissions } }).canAccess)
        .flatMap((g) => g.routes ?? [])
        .map((r) => r.path)
        .filter(mine);
    expect(menu(['STATS:VIEW'])).toEqual(['/stat/guest']);
    expect(menu(['STATS:EXPORT', 'STATS:LAND', 'CONFIG:MANAGE'])).toEqual([]);
    expect(menu([])).toEqual([]);
  });

  it('opens under its own title', () => {
    expect(matchPage(indexPages(routes), '/stat/guest')?.titleKey).toBe('menu.stats.guest');
  });
});
