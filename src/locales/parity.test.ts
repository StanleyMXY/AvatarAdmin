import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MENUS } from '../../config/menus';
import routes from '../../config/routes';
import type { AdminRoute } from '../access/canAccess';
import { PERMISSION_CODES } from '../access/permissionCodes';
import en from './en-US';
import zh from './zh-CN';

// Every file that goes into the aggregate language object, by name.
const MODULES = [
  'auth',
  'stats',
  'config',
  'companionship',
  'subscriptions',
  'credits',
  'memory',
  'monitor',
  'support',
  'avatar',
  'complaints',
  'moderation',
  'users',
  'sessions',
  'analytics',
  'dashboard',
  'push',
  'invite',
  'activity',
  'campaign',
  'cost',
  'ads',
  'sms',
  'email',
  'appVersions',
  'channels',
  'notifications',
  'clientConfig',
  'system',
];
const SHARED = ['error', 'reason', 'permission', 'pages', 'menu'];
const LANGUAGES = ['zh-CN', 'en-US'] as const;

const load = async (language: string, name: string): Promise<Record<string, string>> =>
  (await import(/* @vite-ignore */ `./${language}/${name}`)).default;

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]).sort();

describe('the two aggregate language objects', () => {
  it('have the same keys', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });

  it('keep Chinese characters out of the English texts, except the language names', () => {
    const cjk = /[\u3400-\u9fff\uf900-\ufaff]/;
    const allowed = new Set(['pages.lang.zhCN']);
    for (const [key, text] of Object.entries(en)) {
      if (!allowed.has(key)) expect(text, key).not.toMatch(cjk);
    }
  });

  it('have no empty text', () => {
    for (const dict of [zh, en]) {
      for (const [key, text] of Object.entries(dict)) expect(text.trim(), key).not.toBe('');
    }
  });

  it('use flat dotted keys', () => {
    for (const key of Object.keys(zh))
      expect(key, key).toMatch(/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_:-]+)+$/);
  });

  it('use the same placeholders in both languages for every key', () => {
    for (const key of Object.keys(zh))
      expect(placeholders(zh[key]), key).toEqual(placeholders(en[key]));
  });
});

describe('the files behind them', () => {
  it.each(LANGUAGES)('%s: every module has a file and so do the shared ones', async (language) => {
    for (const name of [...MODULES, ...SHARED]) {
      const dict = await load(language, name);
      expect(typeof dict, `${language}/${name}`).toBe('object');
    }
  });

  it.each(LANGUAGES)(
    '%s: no key is defined in two files (one would silently replace the other)',
    async (language) => {
      const seen = new Map<string, string>();
      for (const name of [...MODULES, ...SHARED]) {
        for (const key of Object.keys(await load(language, name))) {
          expect(seen.has(key), `${key} in ${name} and in ${seen.get(key)}`).toBe(false);
          seen.set(key, name);
        }
      }
    },
  );

  it.each(LANGUAGES)(
    '%s: the aggregate holds everything in the files and nothing else',
    async (language) => {
      const all: Record<string, string> = {};
      for (const name of [...MODULES, ...SHARED]) Object.assign(all, await load(language, name));
      expect(language === 'zh-CN' ? zh : en).toEqual(all);
    },
  );

  it.each(LANGUAGES)(
    '%s: the folder holds exactly the files in the list, so none is left out',
    (language) => {
      const files = readdirSync(join(process.cwd(), 'src/locales', language))
        .filter((file) => /\.ts$/.test(file) && !/\.test\.ts$/.test(file))
        .map((file) => file.replace(/\.ts$/, ''));
      expect(files.sort()).toEqual([...MODULES, ...SHARED].sort());
    },
  );

  it('both languages have the same file keys, file by file', async () => {
    for (const name of [...MODULES, ...SHARED]) {
      expect(Object.keys(await load('zh-CN', name)).sort(), name).toEqual(
        Object.keys(await load('en-US', name)).sort(),
      );
    }
  });
});

describe('what the shell needs to be there', () => {
  it('has a menu text for every first-level menu', () => {
    for (const key of Object.keys(MENUS)) {
      expect(zh[`menu.${key}`], key).toBeTruthy();
      expect(en[`menu.${key}`], key).toBeTruthy();
    }
  });

  it('has menu.<name> for every route that has a name, as far as the routes exist', () => {
    const visit = (list: AdminRoute[], chain: string[]) => {
      for (const route of list) {
        const next = route.name ? [...chain, route.name] : chain;
        if (route.name) {
          expect(zh[`menu.${next.join('.')}`], next.join('.')).toBeTruthy();
          expect(en[`menu.${next.join('.')}`], next.join('.')).toBeTruthy();
        }
        if (route.routes) visit(route.routes, next);
      }
    };
    visit(routes, []);
  });

  it('has permission.<code> for every permission code, in both languages', () => {
    for (const code of PERMISSION_CODES) {
      expect(zh[`permission.${code}`], code).toBeTruthy();
      expect(en[`permission.${code}`], code).toBeTruthy();
    }
  });

  it('has the texts the shell and the request layer use', () => {
    const keys = [
      'pages.theme.dim',
      'pages.theme.deep',
      'pages.theme.light',
      'pages.lang.zhCN',
      'pages.lang.enUS',
      'pages.header.changePassword',
      'pages.header.logout',
      'pages.tabs.refresh',
      'pages.tabs.close',
      'pages.tabs.closeOthers',
      'pages.tabs.closeAll',
      'pages.tabs.closeLeft',
      'pages.tabs.closeRight',
      'pages.403.title',
      'pages.403.subtitle',
      'pages.403.back',
      'pages.404.title',
      'pages.404.subtitle',
      'pages.404.back',
      'error.NETWORK_ERROR',
      'error.ADMIN_FORBIDDEN',
    ];
    for (const key of keys) {
      expect(zh[key], key).toBeTruthy();
      expect(en[key], key).toBeTruthy();
    }
  });

  it('writes the language names in their own language in both files, so a reader finds them in either', () => {
    expect(zh['pages.lang.zhCN']).toBe(en['pages.lang.zhCN']);
    expect(zh['pages.lang.enUS']).toBe(en['pages.lang.enUS']);
  });
});
