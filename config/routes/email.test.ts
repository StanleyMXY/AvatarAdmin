import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import { indexPages, matchPage } from '../../src/components/layout/pageIndex';
import enUS from '../../src/locales/en-US';
import zhCN from '../../src/locales/zh-CN';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import email from './email';

const pages = email.flatMap((group) => group.routes ?? []);

describe('the e-mail template route (spec 5.0, e-mail menu)', () => {
  it('is the one page of the table, with the permission EMAIL:TEMPLATE and an existing component', () => {
    expect(pages.map((p) => [p.path, p.name, p.access, p.component])).toEqual([
      ['/email/templates', 'templates', 'EMAIL:TEMPLATE', './email/templates'],
    ]);
    expect(existsSync('src/pages/email/templates.tsx')).toBe(true);
  });

  it('sits in the email menu in the assembled table', () => {
    expect(email.every((group) => group.key === 'email' && group.name === 'email')).toBe(true);
    const paths = flattenPages(routes)
      .map((p) => p.path)
      .filter((p) => p === '/email/templates');
    expect(paths).toEqual(['/email/templates']);
  });

  it('has a menu text in both languages', () => {
    expect(zhCN['menu.email.templates']).toBeTruthy();
    expect(enUS['menu.email.templates']).toBeTruthy();
  });

  it('is shown to an administrator with EMAIL:TEMPLATE and to nobody else', () => {
    const menu = (permissions: string[]) =>
      filterMenu(email, access({ me: { superAdmin: false, permissions } }).canAccess)
        .flatMap((g) => g.routes ?? [])
        .map((r) => r.path);
    expect(menu(['EMAIL:TEMPLATE'])).toEqual(['/email/templates']);
    expect(menu(['SMS:TEMPLATE', 'CONFIG:MANAGE'])).toEqual([]);
  });

  it('open under their own titles', () => {
    const index = indexPages(routes);
    for (const page of pages) {
      expect(matchPage(index, page.path as string)?.titleKey).toBe(`menu.email.${page.name}`);
    }
  });
});
