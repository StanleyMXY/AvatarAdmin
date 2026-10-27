import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import access from '../../src/access';
import { filterMenu } from '../../src/access/canAccess';
import { indexPages, matchPage } from '../../src/components/layout/pageIndex';
import enUS from '../../src/locales/en-US';
import zhCN from '../../src/locales/zh-CN';
import { flattenPages } from '../assembleRoutes';
import routes from '../routes';
import clientConfig from './clientConfig';

const pages = clientConfig.flatMap((group) => group.routes ?? []);

describe('the client configuration route (spec 5.0, 系统配置 menu)', () => {
  it('is one page, /config/client, opened with CLIENTCONFIG:VIEW, with an existing component', () => {
    expect(pages.map((p) => [p.path, p.name, p.access, p.component])).toEqual([
      ['/config/client', 'client', 'CLIENTCONFIG:VIEW', './clientConfig/list'],
    ]);
    expect(existsSync('src/pages/clientConfig/list.tsx')).toBe(true);
  });

  it('sits in the config menu, after the backend parameters, in the assembled table', () => {
    expect(clientConfig.every((group) => group.key === 'config' && group.name === 'config')).toBe(
      true,
    );
    const paths = flattenPages(routes)
      .map((p) => p.path as string)
      .filter((p) => p.startsWith('/config'));
    expect(paths).toEqual(['/config', '/config/client']);
  });

  it('has a menu text in both languages', () => {
    expect(zhCN['menu.config.client']).toBeTruthy();
    expect(enUS['menu.config.client']).toBeTruthy();
  });

  it('is in the menu for CLIENTCONFIG:VIEW only: the manage code opens nothing', () => {
    const menu = (permissions: string[]) =>
      filterMenu(clientConfig, access({ me: { superAdmin: false, permissions } }).canAccess)
        .flatMap((g) => g.routes ?? [])
        .map((r) => r.path);
    expect(menu(['CLIENTCONFIG:VIEW'])).toEqual(['/config/client']);
    expect(menu(['CLIENTCONFIG:MANAGE'])).toEqual([]);
  });

  it('opens under its own title', () => {
    const index = indexPages(routes);
    expect(matchPage(index, '/config/client')?.titleKey).toBe('menu.config.client');
  });
});
