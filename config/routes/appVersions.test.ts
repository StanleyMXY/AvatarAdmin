import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import { indexPages, matchPage } from '../../src/components/layout/pageIndex';
import enUS from '../../src/locales/en-US';
import zhCN from '../../src/locales/zh-CN';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import appVersions from './appVersions';
import channels from './channels';

const versionPages = appVersions.flatMap((group) => group.routes ?? []);
const channelPages = channels.flatMap((group) => group.routes ?? []);
const pages = [...versionPages, ...channelPages];

describe('the app version and channel package routes (spec 5.0, system menu)', () => {
  it('are the two pages of the table, each with its permission and an existing component', () => {
    expect(versionPages.map((p) => [p.path, p.name, p.access, p.component])).toEqual([
      ['/system/app-versions', 'appVersions', 'APPVERSION:VIEW', './appVersions/versions'],
    ]);
    expect(channelPages.map((p) => [p.path, p.name, p.access, p.component])).toEqual([
      ['/system/channels', 'channels', 'CHANNEL:MANAGE', './channels/channels'],
    ]);
    for (const page of pages) {
      expect(existsSync(`src/pages/${(page.component as string).slice(2)}.tsx`)).toBe(true);
    }
  });

  it('sit in the system menu, in the order of the spec, in the assembled table', () => {
    for (const group of [...appVersions, ...channels]) {
      expect(group.key).toBe('system');
      expect(group.name).toBe('system');
    }
    const paths = flattenPages(routes)
      .map((p) => p.path)
      .filter((p) => p === '/system/app-versions' || p === '/system/channels');
    expect(paths).toEqual(['/system/app-versions', '/system/channels']);
  });

  it('have a menu text in both languages for each page', () => {
    for (const page of pages) {
      expect(zhCN[`menu.system.${page.name}`], String(page.name)).toBeTruthy();
      expect(enUS[`menu.system.${page.name}`], String(page.name)).toBeTruthy();
    }
  });

  it('show each page in the menu for its own code only: managing or activating opens no page', () => {
    const menu = (permissions: string[]) =>
      filterMenu(
        [...appVersions, ...channels],
        access({ me: { superAdmin: false, permissions } }).canAccess,
      )
        .flatMap((g) => g.routes ?? [])
        .map((r) => r.path);
    expect(menu(['APPVERSION:VIEW'])).toEqual(['/system/app-versions']);
    expect(menu(['CHANNEL:MANAGE'])).toEqual(['/system/channels']);
    expect(menu(['APPVERSION:VIEW', 'CHANNEL:MANAGE'])).toEqual([
      '/system/app-versions',
      '/system/channels',
    ]);
    expect(menu(['APPVERSION:MANAGE', 'APPVERSION:ACTIVATE'])).toEqual([]);
  });

  it('open under their own titles', () => {
    const index = indexPages(routes);
    for (const page of pages) {
      expect(matchPage(index, page.path as string)?.titleKey).toBe(`menu.system.${page.name}`);
    }
  });
});
