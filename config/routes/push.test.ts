import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import enUS from '../../src/locales/en-US';
import zhCN from '../../src/locales/zh-CN';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import push from './push';

const pages = push.flatMap((group) => group.routes ?? []);

const EXPECTED = [
  ['/push/templates', 'templates', 'PUSH:TEMPLATE', './push/templates'],
  ['/push/tasks', 'tasks', 'PUSH:SEND', './push/tasks'],
  ['/push/schedules', 'schedules', 'PUSH:SEND', './push/schedules'],
  ['/push/records', 'records', 'PUSH:VIEW', './push/records'],
  ['/push/stats', 'stats', 'STATS:VIEW', './push/stats'],
  ['/push/recall', 'recall', 'PUSH:CONFIG', './push/recall'],
] as const;

describe('the routes of the push menu (spec 5.0)', () => {
  it('is one menu named push', () => {
    expect(push).toHaveLength(1);
    expect(push[0].name).toBe('push');
  });

  it.each(EXPECTED)(
    'has %s with name %s, code %s and an existing component',
    (path, name, code, component) => {
      expect(pages.find((p) => p.path === path)).toMatchObject({ name, access: code, component });
      expect(existsSync(`src/pages/${component.slice(2)}.tsx`)).toBe(true);
    },
  );

  it('has the six pages in the order of the spec and no route for the record detail, which opens in the row', () => {
    expect(pages.map((p) => p.path)).toEqual(EXPECTED.map((e) => e[0]));
  });

  it('is in the assembled table in the order of the spec', () => {
    const paths = flattenPages(routes).map((p) => p.path);
    const mine = EXPECTED.map((e) => e[0]) as string[];
    expect(paths.filter((p) => mine.includes(p ?? ''))).toEqual(mine);
  });

  it('has a menu text in both languages for every page', () => {
    for (const [, name] of EXPECTED) {
      expect(zhCN[`menu.push.${name}`], name).toBeTruthy();
      expect(enUS[`menu.push.${name}`], name).toBeTruthy();
    }
  });

  it.each(EXPECTED)(
    'shows %s only to an administrator with %s, and a route is not reachable without it',
    (path, _name, code) => {
      const withCode = access({ me: { superAdmin: false, permissions: [code] } }).canAccess;
      const without = access({ me: { superAdmin: false, permissions: ['USER:VIEW'] } }).canAccess;
      expect(
        filterMenu(push, withCode)
          .flatMap((g) => g.routes ?? [])
          .map((r) => r.path),
      ).toContain(path);
      expect(
        filterMenu(push, without)
          .flatMap((g) => g.routes ?? [])
          .map((r) => r.path),
      ).not.toContain(path);
    },
  );

  it('keeps the recall parameters from an administrator who can only send or only see', () => {
    for (const code of ['PUSH:SEND', 'PUSH:VIEW', 'PUSH:TEMPLATE', 'STATS:VIEW'] as const) {
      const canAccess = access({ me: { superAdmin: false, permissions: [code] } }).canAccess;
      expect(
        filterMenu(push, canAccess)
          .flatMap((g) => g.routes ?? [])
          .map((r) => r.path),
        code,
      ).not.toContain('/push/recall');
    }
  });
});
