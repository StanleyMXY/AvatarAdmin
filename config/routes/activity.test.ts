import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import enUS from '../../src/locales/en-US';
import zhCN from '../../src/locales/zh-CN';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import activity from './activity';

// Only the six pages of the sign-in and daily task modules: the reward settings page (INVITE:CONFIG)
// is added to the same menu by the invite routes and is not looked at here.
const EXPECTED = [
  ['/act/act-signin-config', 'signinConfig', 'CHECKIN:VIEW', './activity/signinConfig'],
  ['/act/act-signin-record', 'signinRecord', 'CHECKIN:VIEW', './activity/signinRecord'],
  ['/act/act-signin-stats', 'signinStats', 'STATS:VIEW', './activity/signinStats'],
  ['/act/act-task-config', 'taskConfig', 'TASK:VIEW', './activity/taskConfig'],
  ['/act/act-task-record', 'taskRecord', 'TASK:VIEW', './activity/taskRecord'],
  ['/act/act-task-stats', 'taskStats', 'STATS:VIEW', './activity/taskStats'],
] as const;
const MINE = EXPECTED.map((e) => e[0]) as string[];

const pages = activity.flatMap((group) => group.routes ?? []);
const mine = (paths: (string | undefined)[]) => paths.filter((p) => MINE.includes(p ?? ''));

describe('the routes of the sign-in and daily task pages (spec 5.0)', () => {
  it('are one group of the activity menu', () => {
    expect(activity).toHaveLength(1);
    expect(activity[0].name).toBe('activity');
    expect(activity[0].key).toBe('activity');
  });

  it.each(EXPECTED)(
    'has %s with name %s, code %s and an existing component',
    (path, name, code, component) => {
      expect(pages.find((p) => p.path === path)).toMatchObject({ name, access: code, component });
      expect(existsSync(`src/pages/${component.slice(2)}.tsx`)).toBe(true);
    },
  );

  it('has the six pages in the order of the table and nothing else', () => {
    expect(pages.map((p) => p.path)).toEqual(MINE);
  });

  it('are in the assembled table in the order of the spec, inside the activity menu', () => {
    expect(mine(flattenPages(routes).map((p) => p.path))).toEqual(MINE);
    const menu = (routes as { key?: string; routes?: { path?: string }[] }[]).find(
      (r) => r.key === 'activity',
    );
    expect(mine((menu?.routes ?? []).map((p) => p.path))).toEqual(MINE);
  });

  it('have a menu text in both languages for every page', () => {
    for (const [, name] of EXPECTED) {
      expect(zhCN[`menu.activity.${name}`], name).toBeTruthy();
      expect(enUS[`menu.activity.${name}`], name).toBeTruthy();
    }
  });

  it.each(EXPECTED)(
    'shows %s only to an administrator with %s, and a route is not reachable without it',
    (path, _name, code) => {
      const withCode = access({ me: { superAdmin: false, permissions: [code] } }).canAccess;
      const without = access({ me: { superAdmin: false, permissions: ['USER:VIEW'] } }).canAccess;
      const seen = (canAccess: typeof withCode) =>
        filterMenu(activity, canAccess)
          .flatMap((g) => g.routes ?? [])
          .map((r) => r.path);
      expect(seen(withCode)).toContain(path);
      expect(seen(without)).not.toContain(path);
    },
  );

  it('keep the statistics pages from an administrator who only manages, and the others from one who only reads statistics', () => {
    const manage = access({
      me: { superAdmin: false, permissions: ['CHECKIN:MANAGE', 'TASK:MANAGE'] },
    }).canAccess;
    expect(
      mine(
        filterMenu(activity, manage)
          .flatMap((g) => g.routes ?? [])
          .map((r) => r.path),
      ),
    ).toEqual([]);
    const stats = access({ me: { superAdmin: false, permissions: ['STATS:VIEW'] } }).canAccess;
    expect(
      mine(
        filterMenu(activity, stats)
          .flatMap((g) => g.routes ?? [])
          .map((r) => r.path),
      ),
    ).toEqual(['/act/act-signin-stats', '/act/act-task-stats']);
  });
});
