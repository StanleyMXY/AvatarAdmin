import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import { indexPages, matchPage } from '../../src/components/layout/pageIndex';
import enUS from '../../src/locales/en-US';
import zhCN from '../../src/locales/zh-CN';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import sessions from './sessions';

const mine = ['/sessions/list', '/sessions/analytics', '/sessions/quality'];
const pages = sessions.flatMap((group) => group.routes ?? []);

describe('the call routes (spec 5.0, call menu)', () => {
  it('are the three pages of the table with their permission codes and existing components', () => {
    expect(pages.map((p) => [p.path, p.name, p.access, p.component])).toEqual([
      ['/sessions/list', 'list', 'SESSION:VIEW', './sessions/list'],
      ['/sessions/analytics', 'analytics', 'STATS:VIEW', './sessions/analytics'],
      ['/sessions/quality', 'quality', 'STATS:VIEW', './sessions/quality'],
    ]);
    for (const page of pages) {
      expect(existsSync(`src/pages/${(page.component as string).slice(2)}.tsx`)).toBe(true);
    }
  });

  it('have no route for the details: they open in a drawer', () => {
    expect(pages.some((p) => /:id/.test(p.path ?? ''))).toBe(false);
  });

  it('sit in the call menu, in the order of the spec, in the assembled table', () => {
    expect(sessions.every((group) => group.key === 'sessions' && group.name === 'sessions')).toBe(
      true,
    );
    const paths = flattenPages(routes)
      .map((p) => p.path)
      .filter((p) => mine.includes(p as string));
    expect(paths).toEqual(mine);
  });

  it('have a menu text in both languages for each page', () => {
    for (const page of pages) {
      expect(zhCN[`menu.sessions.${page.name}`], page.name).toBeTruthy();
      expect(enUS[`menu.sessions.${page.name}`], page.name).toBeTruthy();
    }
    expect(zhCN['menu.sessions.list']).toBe('会话列表');
    expect(zhCN['menu.sessions.analytics']).toBe('通话分析');
    expect(zhCN['menu.sessions.quality']).toBe('通话质量');
  });

  it('show in the menu by the code of each page', () => {
    const menu = (permissions: string[]) =>
      filterMenu(sessions, access({ me: { superAdmin: false, permissions } }).canAccess)
        .flatMap((g) => g.routes ?? [])
        .map((r) => r.path);
    expect(menu(['SESSION:VIEW'])).toEqual(['/sessions/list']);
    expect(menu(['STATS:VIEW'])).toEqual(['/sessions/analytics', '/sessions/quality']);
    expect(menu(['STATS:EXPORT', 'STATS:LAND'])).toEqual([]);
  });

  it('open under their own titles', () => {
    const index = indexPages(routes);
    expect(matchPage(index, '/sessions/list')?.titleKey).toBe('menu.sessions.list');
    expect(matchPage(index, '/sessions/analytics')?.titleKey).toBe('menu.sessions.analytics');
    expect(matchPage(index, '/sessions/quality')?.titleKey).toBe('menu.sessions.quality');
  });
});
