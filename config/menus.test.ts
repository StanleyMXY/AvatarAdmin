import { readFileSync } from 'node:fs';
import * as icons from '@ant-design/icons';
import { describe, expect, it } from 'vitest';
import { parseRouteTable } from '../scripts/routeInventory';
import { MENUS, ROUTE_ORDER } from './menus';

const table = parseRouteTable(
  readFileSync('docs/shared-snapshots/admin-frontend-design.md', 'utf8'),
);

describe('MENUS', () => {
  it('has one menu for each first-level menu of table 5.0, 23 of them', () => {
    const inSpec = [...new Set(table.routes.map((r) => r.menu))];
    expect(inSpec).toHaveLength(23);
    expect(Object.keys(MENUS)).toHaveLength(inSpec.length);
  });

  it('uses an icon that exists in @ant-design/icons, and a different one for each menu', () => {
    for (const icon of Object.values(MENUS)) expect(Object.keys(icons)).toContain(icon);
    expect(new Set(Object.values(MENUS)).size).toBe(Object.keys(MENUS).length);
  });

  it('has plain identifiers as keys (they become language keys)', () => {
    for (const key of Object.keys(MENUS)) expect(key).toMatch(/^[a-z][A-Za-z]*$/);
  });
});

describe('ROUTE_ORDER', () => {
  it('is the page routes of table 5.0 in the order of the table', () => {
    expect([...ROUTE_ORDER]).toEqual(table.routes.map((r) => r.path));
  });

  it('puts /users/abuse before /users/:id, as the plan requires', () => {
    expect(ROUTE_ORDER.indexOf('/users/abuse')).toBeLessThan(ROUTE_ORDER.indexOf('/users/:id'));
  });

  it('lists the pages of the activity menu with the invite rewards last, and the audit log last in the system menu', () => {
    const inMenu = (menu: string) => table.routes.filter((r) => r.menu === menu).map((r) => r.path);
    expect(inMenu('活动管理').at(-1)).toBe('/invite/rewards');
    expect(inMenu('系统管理').at(-1)).toBe('/system/audit');
  });
});
