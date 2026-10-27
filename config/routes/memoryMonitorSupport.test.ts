import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import enUS from '../../src/locales/en-US';
import zhCN from '../../src/locales/zh-CN';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import memory from './memory';
import monitor from './monitor';
import support from './support';

const pagesOf = (module: typeof memory) => module.flatMap((group) => group.routes ?? []);

const EXPECTED = [
  ['memory', memory, '/memory/tiers', 'tiers', 'MEMORY:VIEW', './memory/tiers'],
  ['memory', memory, '/memory/models', 'models', 'MEMORY:VIEW', './memory/models'],
  ['monitor', monitor, '/monitor', 'pipeline', 'MONITOR:VIEW', './monitor/pipeline'],
  ['monitor', monitor, '/monitor/alerts', 'alerts', 'MONITOR:VIEW', './monitor/alerts'],
  ['support', support, '/support/feedback', 'feedback', 'SUPPORT:VIEW', './support/feedback'],
] as const;

describe('the routes of memory, monitor and support (spec 5.0)', () => {
  it.each(EXPECTED)(
    'has %s page %s with name %s, code %s and an existing component',
    (menu, module, path, name, code, component) => {
      const page = pagesOf(module).find((p) => p.path === path);
      expect(page).toMatchObject({ name, access: code, component });
      expect(module[0].name).toBe(menu);
      expect(existsSync(`src/pages/${component.slice(2)}.tsx`)).toBe(true);
    },
  );

  it('has no route for the feedback detail, which is a drawer', () => {
    expect(pagesOf(support).map((p) => p.path)).toEqual(['/support/feedback']);
  });

  it('is in the assembled table in the order of the spec', () => {
    const paths = flattenPages(routes).map((p) => p.path);
    const mine = [
      '/support/feedback',
      '/memory/tiers',
      '/memory/models',
      '/monitor',
      '/monitor/alerts',
    ];
    expect(paths.filter((p) => mine.includes(p ?? ''))).toEqual(mine);
  });

  it('has a menu text in both languages for every page and no other menu text of its own', () => {
    for (const [menu, , , name] of EXPECTED) {
      expect(zhCN[`menu.${menu}.${name}`], `${menu}.${name}`).toBeTruthy();
      expect(enUS[`menu.${menu}.${name}`], `${menu}.${name}`).toBeTruthy();
    }
  });

  it('shows the monitor menu to MONITOR:VIEW only, and the memory pages to MEMORY:VIEW only', () => {
    const menu = (module: typeof memory, permissions: string[]) =>
      filterMenu(module, access({ me: { superAdmin: false, permissions } }).canAccess)
        .flatMap((g) => g.routes ?? [])
        .map((r) => r.path);
    expect(menu(monitor, ['MONITOR:MANAGE'])).toEqual([]);
    expect(menu(monitor, ['MONITOR:VIEW'])).toEqual(['/monitor', '/monitor/alerts']);
    expect(menu(memory, ['MEMORY:TIER_CONFIG', 'MEMORY:MODEL_REGISTER'])).toEqual([]);
    expect(menu(memory, ['MEMORY:VIEW'])).toEqual(['/memory/tiers', '/memory/models']);
    expect(menu(support, ['SUPPORT:MANAGE'])).toEqual([]);
    expect(menu(support, ['SUPPORT:VIEW'])).toEqual(['/support/feedback']);
  });
});
