import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IntlMessageFormat } from 'intl-messageformat';
import { describe, expect, it } from 'vitest';
import enClient from '../../locales/en-US/clientConfig';
import enNotifications from '../../locales/en-US/notifications';
import zhClient from '../../locales/zh-CN/clientConfig';
import zhNotifications from '../../locales/zh-CN/notifications';

// react-intl writes a message that does not parse to the console and shows its source, so a broken
// message is not seen by a test that renders a page: a placeholder written with braces, like {link},
// is the usual cause.
const SETS = [
  ['en-US clientConfig', enClient, 'en-US'],
  ['zh-CN clientConfig', zhClient, 'zh-CN'],
  ['en-US notifications', enNotifications, 'en-US'],
  ['zh-CN notifications', zhNotifications, 'zh-CN'],
] as const;

describe('the texts of the client configuration and notification pages', () => {
  for (const [name, messages, locale] of SETS) {
    it(`${name}: every message is a valid message and can be filled in`, () => {
      for (const [key, text] of Object.entries(messages)) {
        const values = Object.fromEntries(
          [...text.matchAll(/\{(\w+)[,}]/g)].map((match) => [match[1], 3]),
        );
        let formatted: unknown;
        expect(() => {
          formatted = new IntlMessageFormat(text, locale).format(values);
        }, key).not.toThrow();
        expect(typeof formatted, key).toBe('string');
      }
    });
  }

  it('write the placeholders {link} and {code} of the share text as they are, braces included', () => {
    for (const messages of [enClient, zhClient]) {
      const locale = messages === enClient ? 'en-US' : 'zh-CN';
      const shown = new IntlMessageFormat(
        messages['clientConfig.inviteShareText.desc'],
        locale,
      ).format({});
      expect(shown).toContain('{link}');
      expect(shown).toContain('{code}');
    }
  });

  it('have no key for inviteShareSubtitle (the key was deleted)', () => {
    for (const [, messages] of SETS) {
      expect(Object.keys(messages).filter((key) => key.includes('inviteShareSubtitle'))).toEqual(
        [],
      );
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

  it('have a text, in both languages, for every key that the pages ask for', () => {
    for (const [dir, prefix, en, zh] of [
      ['src/pages/clientConfig', 'clientConfig', enClient, zhClient],
      ['src/pages/notifications', 'notifications', enNotifications, zhNotifications],
    ] as const) {
      const used = new Set<string>();
      for (const file of sourceFiles(dir)) {
        const source = readFileSync(file, 'utf8');
        for (const match of source.matchAll(new RegExp(`'(${prefix}\\.[A-Za-z0-9_.]+)'`, 'g'))) {
          used.add(match[1]);
        }
      }
      expect(used.size, dir).toBeGreaterThan(15);
      for (const key of used) {
        // A key that ends with a dot is built from a code (a type, a source): the page adds the code.
        if (key.endsWith('.')) continue;
        const hasText = (messages: Record<string, string>) =>
          key in messages || Object.keys(messages).some((k) => k.startsWith(`${key}.`));
        expect(hasText(en), `${key} in en-US`).toBe(true);
        expect(hasText(zh), `${key} in zh-CN`).toBe(true);
      }
    }
  });
});
