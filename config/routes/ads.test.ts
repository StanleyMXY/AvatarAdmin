import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import { indexPages, matchPage } from '../../src/components/layout/pageIndex';
import enUS from '../../src/locales/en-US';
import zhCN from '../../src/locales/zh-CN';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import ads from './ads';

const mine = ['/ads/campaigns', '/ads/placements', '/ads/units', '/ads/creatives', '/ads/report'];
const pages = ads.flatMap((group) => group.routes ?? []);

describe('the in-app ad routes (spec 5.0, in-app ad menu)', () => {
  it('are the five pages of the table, each with the permission of its resource and an existing component', () => {
    expect(pages.map((p) => [p.path, p.name, p.access, p.component])).toEqual([
      ['/ads/campaigns', 'campaigns', 'ADS:CAMPAIGN', './ads/campaigns'],
      ['/ads/placements', 'placements', 'ADS:PLACEMENT', './ads/placements'],
      ['/ads/units', 'units', 'ADS:UNIT', './ads/units'],
      ['/ads/creatives', 'creatives', 'ADS:CREATIVE', './ads/creatives'],
      ['/ads/report', 'report', 'ADS:REPORT', './ads/report'],
    ]);
    for (const page of pages) {
      expect(existsSync(`src/pages/${(page.component as string).slice(2)}.tsx`)).toBe(true);
    }
  });

  it('sit in the ads menu, in the order of the spec, in the assembled table', () => {
    expect(ads.every((group) => group.key === 'ads' && group.name === 'ads')).toBe(true);
    const paths = flattenPages(routes)
      .map((p) => p.path)
      .filter((p) => mine.includes(p as string));
    expect(paths).toEqual(mine);
  });

  it('have a menu text in both languages for each page', () => {
    for (const page of pages) {
      expect(zhCN[`menu.ads.${page.name}`], page.name).toBeTruthy();
      expect(enUS[`menu.ads.${page.name}`], page.name).toBeTruthy();
    }
    expect(zhCN['menu.ads.placements']).toBe('广告位与全局设置');
    expect(enUS['menu.ads.report']).toBe('Ad report');
  });

  it('show each page in the menu with its own code only: the codes of the other four pages open nothing', () => {
    const menu = (permissions: string[]) =>
      filterMenu(ads, access({ me: { superAdmin: false, permissions } }).canAccess)
        .flatMap((g) => g.routes ?? [])
        .map((r) => r.path);
    expect(menu(['ADS:CAMPAIGN'])).toEqual(['/ads/campaigns']);
    expect(menu(['ADS:PLACEMENT'])).toEqual(['/ads/placements']);
    expect(menu(['ADS:UNIT'])).toEqual(['/ads/units']);
    expect(menu(['ADS:CREATIVE'])).toEqual(['/ads/creatives']);
    expect(menu(['ADS:REPORT'])).toEqual(['/ads/report']);
    expect(menu(['ADS:UNIT', 'ADS:REPORT'])).toEqual(['/ads/units', '/ads/report']);
    expect(menu(['STATS:VIEW', 'STATS:EXPORT', 'STATS:LAND', 'CONFIG:MANAGE'])).toEqual([]);
  });

  it('open under their own titles', () => {
    const index = indexPages(routes);
    for (const page of pages) {
      expect(matchPage(index, page.path as string)?.titleKey).toBe(`menu.ads.${page.name}`);
    }
  });
});
