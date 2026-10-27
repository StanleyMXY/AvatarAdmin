import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import { indexPages, matchPage } from '../../src/components/layout/pageIndex';
import enUS from '../../src/locales/en-US';
import zhCN from '../../src/locales/zh-CN';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import moderation from './moderation';

const pages = moderation.flatMap((group) => group.routes ?? []);

describe('the moderation routes (spec 5.0, content moderation rows)', () => {
  it('are the four routes of the table with their permission codes and existing components', () => {
    expect(pages.map((p) => [p.path, p.name, p.access, p.component])).toEqual([
      ['/moderation/queue', 'queue', 'MODERATION:VIEW', './moderation/queue'],
      ['/moderation/:id', 'detail', 'MODERATION:VIEW', './moderation/detail'],
      ['/moderation/rules', 'rules', 'MODERATION:CONFIG', './moderation/rules'],
      ['/moderation/stats', 'stats', 'MODERATION:VIEW', './moderation/stats'],
    ]);
    for (const page of pages) {
      expect(existsSync(`src/pages/${(page.component as string).slice(2)}.tsx`)).toBe(true);
    }
  });

  it('sit in the moderation menu', () => {
    expect(moderation).toHaveLength(1);
    expect(moderation[0]).toMatchObject({ key: 'moderation', name: 'moderation' });
  });

  it('are in the assembled table in the order of the spec, the detail (with a parameter) after the fixed paths', () => {
    const paths = flattenPages(routes).map((p) => p.path);
    expect(paths.filter((p) => p?.startsWith('/moderation/'))).toEqual([
      '/moderation/queue',
      '/moderation/rules',
      '/moderation/stats',
      '/moderation/:id',
    ]);
  });

  it('have a menu text in both languages for each page', () => {
    for (const page of pages) {
      expect(zhCN[`menu.moderation.${page.name}`], page.name).toBeTruthy();
      expect(enUS[`menu.moderation.${page.name}`], page.name).toBeTruthy();
    }
  });

  it('keep the detail out of the menu, and show the rules page only to MODERATION:CONFIG', () => {
    const menu = (permissions: string[]) =>
      filterMenu(moderation, access({ me: { superAdmin: false, permissions } }).canAccess)
        .flatMap((g) => g.routes ?? [])
        .map((r) => r.path);
    expect(menu(['MODERATION:VIEW'])).toEqual(['/moderation/queue', '/moderation/stats']);
    expect(menu(['MODERATION:VIEW', 'MODERATION:CONFIG'])).toEqual([
      '/moderation/queue',
      '/moderation/rules',
      '/moderation/stats',
    ]);
    expect(menu(['MODERATION:REVIEW'])).toEqual([]);
    expect(menu([])).toEqual([]);
  });

  it('open the detail for an id and the fixed pages for their own names', () => {
    const index = indexPages(routes);
    expect(matchPage(index, '/moderation/5001')?.titleKey).toBe('menu.moderation.detail');
    expect(matchPage(index, '/moderation/rules')?.titleKey).toBe('menu.moderation.rules');
    expect(matchPage(index, '/moderation/queue')?.titleKey).toBe('menu.moderation.queue');
    expect(matchPage(index, '/moderation/stats')?.titleKey).toBe('menu.moderation.stats');
  });
});
