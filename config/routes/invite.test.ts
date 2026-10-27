import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import enUS from '../../src/locales/en-US';
import zhCN from '../../src/locales/zh-CN';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import invite from './invite';

const group = (key: string) => invite.find((g) => g.key === key);
const pagesOf = (key: string) => group(key)?.routes ?? [];

describe('the invite routes (spec 5.0 and 5.12)', () => {
  it('are four pages in the invite menu with INVITE:VIEW and existing components', () => {
    expect(pagesOf('invite').map((p) => [p.path, p.name, p.access, p.component])).toEqual([
      ['/invite/codes', 'codes', 'INVITE:VIEW', './invite/codes'],
      ['/invite/records', 'records', 'INVITE:VIEW', './invite/records'],
      ['/invite/stats', 'stats', 'INVITE:VIEW', './invite/stats'],
      ['/invite/share-stats', 'shareStats', 'INVITE:VIEW', './invite/shareStats'],
    ]);
  });

  it('put the reward settings under the activity menu with INVITE:CONFIG, as table 5.0 does', () => {
    expect(pagesOf('activity').map((p) => [p.path, p.name, p.access, p.component])).toEqual([
      ['/invite/rewards', 'inviteRewards', 'INVITE:CONFIG', './invite/rewards'],
    ]);
    expect(invite.map((g) => g.key).sort()).toEqual(['activity', 'invite']);
  });

  it('point at components that exist', () => {
    for (const page of [...pagesOf('invite'), ...pagesOf('activity')]) {
      expect(existsSync(`src/pages/${(page.component as string).slice(2)}.tsx`), page.path).toBe(
        true,
      );
    }
  });

  it('are in the assembled table in the order of the spec, the rewards page among the activity pages', () => {
    const paths = flattenPages(routes).map((p) => p.path);
    expect(paths.filter((p) => p?.startsWith('/invite/'))).toEqual([
      '/invite/codes',
      '/invite/records',
      '/invite/stats',
      '/invite/share-stats',
      '/invite/rewards',
    ]);
    const tops = (routes as { key?: string; routes?: { path?: string }[] }[]).flatMap((r) =>
      r.key === 'activity' ? (r.routes ?? []).map((p) => p.path) : [],
    );
    expect(tops).toContain('/invite/rewards');
  });

  it('have a menu text in both languages for each page', () => {
    for (const page of pagesOf('invite')) {
      expect(zhCN[`menu.invite.${page.name}`], page.name).toBeTruthy();
      expect(enUS[`menu.invite.${page.name}`], page.name).toBeTruthy();
    }
    for (const page of pagesOf('activity')) {
      expect(zhCN[`menu.activity.${page.name}`], page.name).toBeTruthy();
      expect(enUS[`menu.activity.${page.name}`], page.name).toBeTruthy();
    }
  });

  it('show the four pages to INVITE:VIEW and the rewards page only to INVITE:CONFIG', () => {
    const shown = (permissions: string[]) => {
      const rules = access({ me: { superAdmin: false, permissions } });
      return filterMenu(invite, rules.canAccess).flatMap((g) =>
        (g.routes ?? []).map((r) => r.path),
      );
    };
    expect(shown(['INVITE:VIEW'])).toEqual([
      '/invite/codes',
      '/invite/records',
      '/invite/stats',
      '/invite/share-stats',
    ]);
    expect(shown(['INVITE:CONFIG'])).toEqual(['/invite/rewards']);
    expect(shown([])).toEqual([]);
  });
});
