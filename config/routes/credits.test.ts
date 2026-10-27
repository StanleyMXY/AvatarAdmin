import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import credits from './credits';

const pages = credits.flatMap((group) => group.routes ?? []);

describe('the credit routes (spec 5.0, subscriptions and credits, credit rows)', () => {
  it('are the five pages with the paths and permission codes of the table', () => {
    expect(pages.map((p) => [p.path, p.access, p.component])).toEqual([
      ['/credits/products', 'SUBSCRIPTION:CONFIG', './credits/products'],
      ['/credits/requests', 'SUBSCRIPTION:VIEW', './credits/requests'],
      ['/credits/accounts', 'SUBSCRIPTION:VIEW', './credits/accounts'],
      ['/credits/transactions', 'SUBSCRIPTION:VIEW', './credits/transactions'],
      ['/credits/stats', 'FINANCE:VIEW', './credits/stats'],
    ]);
  });

  it('sit in the subscriptions menu, which the subscription module shares', () => {
    expect(credits).toHaveLength(1);
    expect(credits[0]).toMatchObject({ key: 'subscriptions', name: 'subscriptions' });
  });

  it('are in the assembled table, after the subscription pages by the order of the spec', () => {
    const paths = flattenPages(routes).map((p) => p.path);
    for (const page of pages) expect(paths).toContain(page.path);
    const order = paths.filter((p) => p?.startsWith('/credits/'));
    expect(order).toEqual(pages.map((p) => p.path));
  });

  it('show no accounts page and no transactions page to an administrator without SUBSCRIPTION:VIEW', () => {
    const can = (permissions: string[]) => {
      const rules = access({ me: { superAdmin: false, permissions } });
      return filterMenu(credits, rules.canAccess)
        .flatMap((g) => g.routes ?? [])
        .map((r) => r.path);
    };
    expect(can(['FINANCE:VIEW', 'SUBSCRIPTION:GRANT', 'CREDIT:REVIEW'])).toEqual([
      '/credits/stats',
    ]);
    expect(can(['SUBSCRIPTION:VIEW'])).toEqual([
      '/credits/requests',
      '/credits/accounts',
      '/credits/transactions',
    ]);
    expect(can([])).toEqual([]);
  });

  it('show the pack page only to SUBSCRIPTION:CONFIG and the statistics only to FINANCE:VIEW', () => {
    const rules = (permissions: string[]) => access({ me: { superAdmin: false, permissions } });
    expect(rules(['SUBSCRIPTION:CONFIG'])['SUBSCRIPTION:CONFIG']).toBe(true);
    const only = (permissions: string[]) =>
      filterMenu(credits, rules(permissions).canAccess)
        .flatMap((g) => g.routes ?? [])
        .map((r) => r.path);
    expect(only(['SUBSCRIPTION:CONFIG'])).toEqual(['/credits/products']);
    expect(only(['FINANCE:VIEW'])).toEqual(['/credits/stats']);
  });
});
