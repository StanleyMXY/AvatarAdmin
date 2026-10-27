import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import subscriptions from './subscriptions';

const pages = subscriptions.flatMap((group) => group.routes ?? []);
const rulesOf = (permissions: string[], superAdmin = false) =>
  access({ me: { superAdmin, permissions } });
const visible = (permissions: string[], superAdmin = false) =>
  filterMenu(subscriptions, rulesOf(permissions, superAdmin).canAccess)
    .flatMap((g) => g.routes ?? [])
    .map((r) => r.path);

describe('the subscription routes (spec 5.0, subscriptions and credits, the first six rows)', () => {
  it('are the six pages with the paths, names and permission codes of the table', () => {
    expect(pages.map((p) => [p.path, p.name, p.access, p.component])).toEqual([
      ['/subscriptions/list', 'list', 'SUBSCRIPTION:VIEW', './subscriptions/list'],
      [
        '/subscriptions/entitlements',
        'entitlements',
        'SUBSCRIPTION:VIEW',
        './subscriptions/entitlements',
      ],
      ['/subscriptions/gates', 'gates', 'SUBSCRIPTION:VIEW', './subscriptions/gates'],
      ['/subscriptions/products', 'products', 'SUBSCRIPTION:VIEW', './subscriptions/products'],
      ['/subscriptions/events', 'events', 'SUBSCRIPTION:VIEW', './subscriptions/events'],
      ['/subscriptions/stats', 'stats', 'FINANCE:VIEW', './subscriptions/stats'],
    ]);
  });

  it('point at page files that exist', () => {
    for (const page of pages) {
      const file = `src/pages/${(page.component as string).replace('./', '')}.tsx`;
      expect(existsSync(file), file).toBe(true);
    }
  });

  it('are one menu, 订阅与额度, which the credit pages share', () => {
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]).toMatchObject({ key: 'subscriptions', name: 'subscriptions' });
  });

  it('are in the assembled table, before the credit pages', () => {
    const paths = flattenPages(routes).map((p) => p.path as string);
    for (const page of pages) expect(paths).toContain(page.path);
    const own = paths.filter((p) => p.startsWith('/subscriptions/'));
    expect(own).toEqual(pages.map((p) => p.path));
    expect(paths.indexOf('/subscriptions/stats')).toBeLessThan(paths.indexOf('/credits/products'));
  });
});

describe('who gets in', () => {
  const four = [
    '/subscriptions/entitlements',
    '/subscriptions/gates',
    '/subscriptions/products',
    '/subscriptions/events',
  ];

  it('lets SUBSCRIPTION:VIEW into the list and the four pages, and not into the statistics', () => {
    expect(visible(['SUBSCRIPTION:VIEW'])).toEqual(['/subscriptions/list', ...four]);
  });

  it('gives the four pages a 403 when SUBSCRIPTION:VIEW is missing, whatever else the administrator holds', () => {
    const others = ['SUBSCRIPTION:CONFIG', 'SUBSCRIPTION:GRANT', 'FINANCE:VIEW', 'CREDIT:REVIEW'];
    for (const path of four) {
      const code = pages.find((p) => p.path === path)?.access as string;
      expect(rulesOf(others).canAccess(code), path).toBe(false);
      expect(rulesOf(['SUBSCRIPTION:VIEW']).canAccess(code), path).toBe(true);
    }
    expect(visible(others)).toEqual(['/subscriptions/stats']);
  });

  it('does not make the write codes a way in: CONFIG and GRANT alone open nothing but the codes they are', () => {
    expect(visible(['SUBSCRIPTION:CONFIG'])).toEqual([]);
    expect(visible(['SUBSCRIPTION:GRANT'])).toEqual([]);
  });

  it('opens the statistics to FINANCE:VIEW only', () => {
    expect(visible(['FINANCE:VIEW'])).toEqual(['/subscriptions/stats']);
    expect(visible(['SUBSCRIPTION:VIEW'])).not.toContain('/subscriptions/stats');
  });

  it('opens every page to a super administrator and none to nobody', () => {
    expect(visible([], true)).toEqual(pages.map((p) => p.path));
    expect(visible([])).toEqual([]);
  });
});
