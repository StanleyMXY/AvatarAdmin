import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import { indexPages, matchPage } from '../../src/components/layout/pageIndex';
import enUS from '../../src/locales/en-US';
import zhCN from '../../src/locales/zh-CN';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import sms from './sms';

const mine = ['/sms/channels', '/sms/templates', '/sms/records'];
const pages = sms.flatMap((group) => group.routes ?? []);

describe('the SMS routes (spec 5.0, SMS menu)', () => {
  it('are the three pages of the table, each with the permission of its resource and an existing component', () => {
    expect(pages.map((p) => [p.path, p.name, p.access, p.component])).toEqual([
      ['/sms/channels', 'channels', 'SMS:CHANNEL', './sms/channels'],
      ['/sms/templates', 'templates', 'SMS:TEMPLATE', './sms/templates'],
      ['/sms/records', 'records', 'SMS:RECORD', './sms/records'],
    ]);
    for (const page of pages) {
      expect(existsSync(`src/pages/${(page.component as string).slice(2)}.tsx`)).toBe(true);
    }
  });

  it('sit in the sms menu, in the order of the spec, in the assembled table', () => {
    expect(sms.every((group) => group.key === 'sms' && group.name === 'sms')).toBe(true);
    const paths = flattenPages(routes)
      .map((p) => p.path)
      .filter((p) => mine.includes(p as string));
    expect(paths).toEqual(mine);
  });

  it('have a menu text in both languages for each page', () => {
    for (const page of pages) {
      expect(zhCN[`menu.sms.${page.name}`], page.name).toBeTruthy();
      expect(enUS[`menu.sms.${page.name}`], page.name).toBeTruthy();
    }
  });

  it('show each page in the menu with its own code only: the export and phone codes open nothing', () => {
    const menu = (permissions: string[]) =>
      filterMenu(sms, access({ me: { superAdmin: false, permissions } }).canAccess)
        .flatMap((g) => g.routes ?? [])
        .map((r) => r.path);
    expect(menu(['SMS:CHANNEL'])).toEqual(['/sms/channels']);
    expect(menu(['SMS:TEMPLATE'])).toEqual(['/sms/templates']);
    expect(menu(['SMS:RECORD'])).toEqual(['/sms/records']);
    expect(menu(['SMS:CHANNEL', 'SMS:RECORD'])).toEqual(['/sms/channels', '/sms/records']);
    expect(menu(['SMS:CHANNEL:CONFIG', 'SMS:RECORD:EXPORT', 'SMS:RECORD:PHONE_VIEW'])).toEqual([]);
  });

  it('open under their own titles', () => {
    const index = indexPages(routes);
    for (const page of pages) {
      expect(matchPage(index, page.path as string)?.titleKey).toBe(`menu.sms.${page.name}`);
    }
  });
});
