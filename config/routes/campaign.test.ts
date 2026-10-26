import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import enUS from '../../src/locales/en-US';
import zhCN from '../../src/locales/zh-CN';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import campaign from './campaign';

const pages = campaign.flatMap((group) => group.routes ?? []);

const EXPECTED = [
  ['/campaign/stats', 'stats', 'ATTRIBUTION:VIEW', './campaign/stats'],
  ['/campaign/accounts', 'accounts', 'ATTRIBUTION:MANAGE', './campaign/accounts'],
  ['/campaign/attribution', 'attribution', 'ATTRIBUTION:VIEW', './campaign/attribution'],
  ['/campaign/settings', 'settings', 'ATTRIBUTION:MANAGE', './campaign/settings'],
] as const;

const pathsFor = (permissions: string[]) =>
  filterMenu(campaign, access({ me: { superAdmin: false, permissions } }).canAccess)
    .flatMap((g) => g.routes ?? [])
    .map((r) => r.path);

describe('the routes of the campaign menu (spec 5.0)', () => {
  it('is one menu named campaign', () => {
    expect(campaign).toHaveLength(1);
    expect(campaign[0].name).toBe('campaign');
  });

  it.each(EXPECTED)(
    'has %s with name %s, code %s and an existing component',
    (path, name, code, component) => {
      expect(pages.find((p) => p.path === path)).toMatchObject({ name, access: code, component });
      expect(existsSync(`src/pages/${component.slice(2)}.tsx`)).toBe(true);
    },
  );

  it('has the four pages in the order of the spec and no route for anything else', () => {
    expect(pages.map((p) => p.path)).toEqual(EXPECTED.map((e) => e[0]));
  });

  it('is in the assembled table in the order of the spec', () => {
    const paths = flattenPages(routes).map((p) => p.path);
    const mine = EXPECTED.map((e) => e[0]) as string[];
    expect(paths.filter((p) => mine.includes(p ?? ''))).toEqual(mine);
  });

  it('has a menu text in both languages for every page', () => {
    for (const [, name] of EXPECTED) {
      expect(zhCN[`menu.campaign.${name}`], name).toBeTruthy();
      expect(enUS[`menu.campaign.${name}`], name).toBeTruthy();
    }
  });

  it.each(EXPECTED)(
    'shows %s only to an administrator with %s, and a route is not reachable without it',
    (path, _name, code) => {
      expect(pathsFor([code])).toContain(path);
      expect(pathsFor(['USER:VIEW'])).not.toContain(path);
    },
  );

  it('keeps the accounts, the costs and the parameters from an administrator who can only view', () => {
    const viewer = pathsFor(['ATTRIBUTION:VIEW']);
    expect(viewer).toEqual(['/campaign/stats', '/campaign/attribution']);
    expect(viewer).not.toContain('/campaign/accounts');
    expect(viewer).not.toContain('/campaign/settings');
  });

  it('keeps the reports from an administrator who can only manage', () => {
    expect(pathsFor(['ATTRIBUTION:MANAGE'])).toEqual(['/campaign/accounts', '/campaign/settings']);
  });

  it('shows all four to the super administrator', () => {
    const all = filterMenu(
      campaign,
      access({ me: { superAdmin: true, permissions: [] } }).canAccess,
    )
      .flatMap((g) => g.routes ?? [])
      .map((r) => r.path);
    expect(all).toEqual(EXPECTED.map((e) => e[0]));
  });
});
