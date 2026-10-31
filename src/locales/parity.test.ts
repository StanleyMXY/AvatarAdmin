import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MENUS } from '../../config/menus';
import routes from '../../config/routes';
import { parseConfigRows } from '../../scripts/configKeys';
import { errorTable, reasonCodes } from '../../scripts/contractErrors';
import { extractPermissionCodes, parseExclusions } from '../../scripts/permissionCodes';
import type { AdminRoute } from '../access/canAccess';
import { PERMISSION_CODES } from '../access/permissionCodes';
import { indexPages } from '../components/layout/pageIndex';
import configKeys from '../pages/config/configKeys.generated.json';
import { EXTRA_CONFIG_KEYS } from '../pages/config/configSchema';
import en from './en-US';
import errorCodes from './errorCodes.generated.json';
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
  'guestStats',
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

// The full set, each part checked against its source of truth and not against a list written here:
// the route table in config/routes, the permission codes the two shared documents name, the error
// table of contract 1.4 (with the reason codes of its INVALID_REQUEST row) and the key table of
// contract 17.5.
const SNAPSHOTS = 'docs/shared-snapshots';
const contractText = () =>
  readFileSync(join(process.cwd(), SNAPSHOTS, 'backend-task-java-backend.md'), 'utf8');
const specText = () =>
  readFileSync(join(process.cwd(), SNAPSHOTS, 'admin-frontend-design.md'), 'utf8');
const dictOf = (language: (typeof LANGUAGES)[number]) => (language === 'zh-CN' ? zh : en);

describe('full coverage of the texts against the sources of truth', () => {
  it.each(LANGUAGES)('%s: every page route has a menu.<chain> text', (language) => {
    const pages = indexPages(routes);
    expect(pages.length).toBeGreaterThan(70);
    for (const page of pages)
      expect(dictOf(language)[page.titleKey], `${page.path} -> ${page.titleKey}`).toBeTruthy();
  });

  it('gives every page route a name of its own (otherwise its tab would carry the title of its parent)', () => {
    const unnamed: string[] = [];
    const visit = (list: AdminRoute[]) => {
      for (const route of list) {
        if (route.routes) visit(route.routes);
        else if (
          route.path !== undefined &&
          route.component !== undefined &&
          route.layout !== false &&
          route.path !== '*' &&
          !route.name
        )
          unnamed.push(route.path);
      }
    };
    visit(routes);
    expect(unnamed).toEqual([]);
  });

  it.each(LANGUAGES)(
    '%s: every permission code the two documents name has permission.<code>',
    (language) => {
      const exclusions = parseExclusions(
        readFileSync(
          join(process.cwd(), 'docs/superpowers/handoff/permission-code-exclusions.txt'),
          'utf8',
        ),
      );
      const { codes } = extractPermissionCodes(specText(), contractText(), exclusions);
      expect(codes.length).toBeGreaterThan(70);
      expect([...codes].sort()).toEqual([...PERMISSION_CODES].sort());
      for (const code of codes)
        expect(dictOf(language)[`permission.${code}`]?.trim(), code).toBeTruthy();
    },
  );

  it.each(LANGUAGES)('%s: every error code of contract table 1.4 has error.<code>', (language) => {
    const { codes, unread } = errorTable(contractText());
    expect(unread).toEqual([]);
    expect(codes.length).toBeGreaterThan(70);
    expect(codes).toEqual(errorCodes);
    for (const code of codes) expect(dictOf(language)[`error.${code}`]?.trim(), code).toBeTruthy();
  });

  it.each(LANGUAGES)(
    '%s: every reason code of the contract has reason.<code>, and no other has one',
    (language) => {
      const dict = dictOf(language);
      const reasons = reasonCodes(contractText());
      expect(reasons.length).toBeGreaterThanOrEqual(14);
      for (const code of reasons) expect(dict[`reason.${code}`]?.trim(), code).toBeTruthy();
      const have = Object.keys(dict)
        .filter((key) => key.startsWith('reason.'))
        .map((key) => key.slice('reason.'.length));
      expect(have.sort()).toEqual([...reasons].sort());
    },
  );

  it.each(LANGUAGES)(
    '%s: every configuration key of contract 17.5 and every backend extra key has a name and a description',
    (language) => {
      const dict = dictOf(language);
      const rows = parseConfigRows(contractText());
      expect(rows.length).toBe(225);
      expect(rows.map((r) => r.key)).toEqual(configKeys.map((k) => k.key));
      expect(EXTRA_CONFIG_KEYS).toHaveLength(25);
      for (const key of [...rows.map((r) => r.key), ...EXTRA_CONFIG_KEYS]) {
        expect(dict[`config.${key}.label`]?.trim(), `${key} label`).toBeTruthy();
        expect(dict[`config.${key}.desc`]?.trim(), `${key} desc`).toBeTruthy();
      }
    },
  );

  it.each(LANGUAGES)(
    '%s: every group of the configuration keys has a title, and no key text is left over',
    (language) => {
      const dict = dictOf(language);
      const keys = [...parseConfigRows(contractText()).map((r) => r.key), ...EXTRA_CONFIG_KEYS];
      for (const group of new Set(keys.map((key) => key.split('.')[0])))
        expect(dict[`config.group.${group}`]?.trim(), group).toBeTruthy();
      const known = new Set(keys);
      const leftover = Object.keys(dict)
        .map((id) => /^config\.(.+)\.(label|desc|risk)$/.exec(id)?.[1])
        .filter((key): key is string => key !== undefined && !known.has(key));
      expect(leftover).toEqual([]);
    },
  );

  it('has a risk text for each of the seven risk keys in both languages', () => {
    const risky = [
      'chat.conversation_languages',
      'chat.model_tiers_allowed',
      'complaint.likeness_due_hours',
      'guest.call_minutes_total',
      'guest.device_retention_days',
      'moderation.underage_reject_below_age',
      'render.cloud_enabled',
    ];
    for (const key of risky) {
      expect(zh[`config.${key}.risk`]?.trim(), key).toBeTruthy();
      expect(en[`config.${key}.risk`]?.trim(), key).toBeTruthy();
    }
  });

  it.each(LANGUAGES)(
    '%s: no key or text holds a hidden format character (zero-width, direction marks, BOM)',
    (language) => {
      const dict = dictOf(language);
      for (const [key, text] of Object.entries(dict)) {
        expect(text, key).not.toMatch(/[\p{Cf}\u2028\u2029]/u);
        expect(key, key).not.toMatch(/[\p{Cf}\s]/u);
      }
    },
  );
});
