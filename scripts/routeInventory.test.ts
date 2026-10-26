import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PERMISSION_CODES } from '../src/access/permissionCodes';
import { compareRoutes, parseRouteTable } from './routeInventory';

const SPEC = 'docs/shared-snapshots/admin-frontend-design.md';

describe('parseRouteTable on the spec snapshot', () => {
  const table = parseRouteTable(readFileSync(SPEC, 'utf8'));

  it('reads the 73 rows of table 5.0', () => {
    expect(table.rows).toBe(73);
  });

  it('skips the export row, which has no page route', () => {
    expect(table.rowsWithoutRoute).toHaveLength(1);
    expect(table.rowsWithoutRoute[0]).toContain('导出');
    expect(table.routes.map((r) => r.path)).not.toContain('/stats/export/{name}');
  });

  it('finds 83 page routes, each path once', () => {
    expect(table.routes).toHaveLength(83);
    expect(new Set(table.routes.map((r) => r.path)).size).toBe(83);
  });

  it('gives a row with several routes the same access for each', () => {
    const access = (path: string) => table.routes.find((r) => r.path === path)?.access;
    expect(access('/moderation/queue')).toBe('MODERATION:VIEW');
    expect(access('/moderation/:id')).toBe('MODERATION:VIEW');
    expect(access('/stat/daily')).toBe('STATS:VIEW');
    expect(access('/stat/guest')).toBe('STATS:VIEW');
    expect(access('/act/act-signin-config')).toBe('CHECKIN:VIEW');
    expect(access('/act/act-signin-record')).toBe('CHECKIN:VIEW');
    expect(access('/monitor/alerts')).toBe('MONITOR:VIEW');
  });

  it('takes the first code of the cell as the page access, not the codes for single actions', () => {
    const access = (path: string) => table.routes.find((r) => r.path === path)?.access;
    expect(access('/users/list')).toBe('USER:VIEW');
    expect(access('/subscriptions/entitlements')).toBe('SUBSCRIPTION:VIEW');
    expect(access('/subscriptions/events')).toBe('SUBSCRIPTION:VIEW');
    expect(access('/subscriptions/stats')).toBe('FINANCE:VIEW');
    expect(access('/sms/records')).toBe('SMS:RECORD');
    expect(access('/cost/prices')).toBe('COST:VIEW');
  });

  it('gives the dashboard no access code (sign-in is enough)', () => {
    expect(table.routes.find((r) => r.path === '/dashboard')?.access).toBeNull();
  });

  it('carries the menu name down over the empty cells', () => {
    const menu = (path: string) => table.routes.find((r) => r.path === path)?.menu;
    expect(menu('/users/abuse')).toBe('用户');
    expect(menu('/invite/rewards')).toBe('活动管理');
    expect(menu('/system/audit')).toBe('系统管理');
  });

  it('every access in the table is one of the 79 permission codes', () => {
    for (const route of table.routes) {
      if (route.access !== null) expect(PERMISSION_CODES).toContain(route.access);
    }
  });

  it('fails loudly when the table cannot be found', () => {
    expect(() => parseRouteTable('# nothing here')).toThrow(/5\.0/);
  });

  it('fails loudly on a row that does not have four cells', () => {
    const broken = [
      '### 5.0 路由总表',
      '',
      '| 菜单 | 页面（路由） | access | 接口 |',
      '|---|---|---|---|',
      '| a | `/x` | `A:B` |',
      '',
    ].join('\n');
    expect(() => parseRouteTable(broken)).toThrow(/cells/);
  });
});

describe('compareRoutes', () => {
  const spec = [
    { path: '/a', access: 'USER:VIEW' as string | null, menu: 'm' },
    { path: '/b', access: null, menu: 'm' },
    { path: '/c', access: 'STATS:VIEW' as string | null, menu: 'm' },
  ];

  it('reports nothing for an exact match', () => {
    const result = compareRoutes(spec, [
      { path: '/a', access: 'USER:VIEW' },
      { path: '/b', access: null },
      { path: '/c', access: 'STATS:VIEW' },
    ]);
    expect(result).toEqual({ missing: [], extra: [], accessMismatch: [] });
  });

  it('reports a route in the table that is not in the routes', () => {
    const result = compareRoutes(spec, [
      { path: '/a', access: 'USER:VIEW' },
      { path: '/b', access: null },
    ]);
    expect(result.missing).toEqual(['/c']);
  });

  it('reports a route that is not in the table', () => {
    const result = compareRoutes(spec, [
      { path: '/a', access: 'USER:VIEW' },
      { path: '/b', access: null },
      { path: '/c', access: 'STATS:VIEW' },
      { path: '/d', access: null },
    ]);
    expect(result.extra).toEqual(['/d']);
  });

  it('reports a different access, also when one side has none', () => {
    const result = compareRoutes(spec, [
      { path: '/a', access: 'USER:BAN' },
      { path: '/b', access: 'USER:VIEW' },
      { path: '/c', access: null },
    ]);
    expect(result.accessMismatch).toEqual([
      { path: '/a', spec: 'USER:VIEW', routes: 'USER:BAN' },
      { path: '/b', spec: null, routes: 'USER:VIEW' },
      { path: '/c', spec: 'STATS:VIEW', routes: null },
    ]);
  });

  it('can be limited to paths starting with a prefix, for one module', () => {
    const result = compareRoutes(spec, [{ path: '/a', access: 'USER:VIEW' }], { prefixes: ['/a'] });
    expect(result).toEqual({ missing: [], extra: [], accessMismatch: [] });
  });
});

describe('check-route-inventory.ts', { timeout: 60_000 }, () => {
  const run = (args: string[]) =>
    spawnSync('npx', ['tsx', 'scripts/check-route-inventory.ts', ...args], { encoding: 'utf8' });

  it('exits 1 and lists the missing routes while the modules are still empty', () => {
    const result = run([SPEC]);
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/missing \(83\)/i);
    expect(result.stdout).toContain('/users/list');
  });

  it('exits 1 and prints usage without the spec path', () => {
    const result = run([]);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toMatch(/usage/i);
  });

  it('limits the check to a prefix with --prefix', () => {
    const result = run([SPEC, '--prefix', '/users']);
    expect(result.stdout).toMatch(/missing \((\d+)\)/i);
    expect(result.stdout).toContain('/users/list');
    expect(result.stdout).not.toContain('/sms/records');
  });
});
