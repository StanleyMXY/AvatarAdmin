import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IntlMessageFormat } from 'intl-messageformat';
import { describe, expect, it } from 'vitest';
import enAppVersions from '../../locales/en-US/appVersions';
import enChannels from '../../locales/en-US/channels';
import zhAppVersions from '../../locales/zh-CN/appVersions';
import zhChannels from '../../locales/zh-CN/channels';

// react-intl writes a message that does not parse to the console and shows its source, so a broken
// message is not seen by a test that renders a page: an angle bracket (taken for a tag) or a brace
// that is not a placeholder is the usual cause.
const SETS = [
  ['en-US appVersions', enAppVersions, 'en-US'],
  ['zh-CN appVersions', zhAppVersions, 'zh-CN'],
  ['en-US channels', enChannels, 'en-US'],
  ['zh-CN channels', zhChannels, 'zh-CN'],
] as const;

describe('the texts of the app version and channel package pages', () => {
  for (const [name, messages, locale] of SETS) {
    it(`${name}: every message is a valid message and can be filled in`, () => {
      for (const [key, text] of Object.entries(messages)) {
        const values = Object.fromEntries(
          [...text.matchAll(/\{(\w+)\}/g)].map((match) => [match[1], 'x']),
        );
        let formatted: unknown;
        expect(() => {
          formatted = new IntlMessageFormat(text, locale).format(values);
        }, key).not.toThrow();
        expect(typeof formatted, key).toBe('string');
      }
    });
  }

  it('write the placeholders of the two languages the same', () => {
    const names = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [en, zh] of [
      [enAppVersions, zhAppVersions],
      [enChannels, zhChannels],
    ] as const) {
      for (const key of Object.keys(en)) expect(names(zh[key]), key).toEqual(names(en[key]));
    }
  });

  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? sourceFiles(join(dir, entry.name))
        : /\.(ts|tsx)$/.test(entry.name) &&
            !/\.test\./.test(entry.name) &&
            entry.name !== 'testSetup.ts'
          ? [join(dir, entry.name)]
          : [],
    );

  it('has a text, in both languages, for every key that the pages ask for', () => {
    const used = new Set<string>();
    const sets: [string, Record<string, string>, Record<string, string>][] = [
      ['appVersions', enAppVersions, zhAppVersions],
      ['channels', enChannels, zhChannels],
    ];
    for (const [prefix, en, zh] of sets) {
      for (const dir of ['src/pages/appVersions', 'src/pages/channels']) {
        for (const file of sourceFiles(dir)) {
          const source = readFileSync(file, 'utf8');
          for (const match of source.matchAll(new RegExp(`'(${prefix}\\.[A-Za-z0-9_.]+)'`, 'g'))) {
            used.add(match[1]);
          }
        }
      }
      const mine = [...used].filter((key) => key.startsWith(`${prefix}.`));
      expect(mine.length, prefix).toBeGreaterThan(20);
      for (const key of mine) {
        // A key that ends in a dot is built from a code (a status, a platform): the page adds the code.
        if (key.endsWith('.')) continue;
        const has = (messages: Record<string, string>) =>
          key in messages || Object.keys(messages).some((k) => k.startsWith(`${key}.`));
        expect(has(en), `${key} in en-US`).toBe(true);
        expect(has(zh), `${key} in zh-CN`).toBe(true);
      }
    }
  });

  it('keeps no text that no page asks for (a text nobody shows is a text nobody checks)', () => {
    const source = [...sourceFiles('src/pages/appVersions'), ...sourceFiles('src/pages/channels')]
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    const dynamic = [
      'appVersions.platform.',
      'appVersions.distribution.',
      'appVersions.status.',
      'channels.platform.',
      'channels.distribution.',
      'appVersions.storeUrl.',
      'appVersions.rule.',
      'channels.rule.',
    ];
    for (const key of [...Object.keys(enAppVersions), ...Object.keys(enChannels)]) {
      if (key.startsWith('menu.')) continue;
      if (dynamic.some((prefix) => key.startsWith(prefix))) continue;
      expect(source.includes(`'${key}'`), key).toBe(true);
    }
  });
});
