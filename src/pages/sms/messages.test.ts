import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IntlMessageFormat } from 'intl-messageformat';
import { describe, expect, it } from 'vitest';
import enEmail from '../../locales/en-US/email';
import enSms from '../../locales/en-US/sms';
import zhEmail from '../../locales/zh-CN/email';
import zhSms from '../../locales/zh-CN/sms';

// react-intl writes a message that does not parse to the console and shows its source, so a broken
// message is not seen by a test that renders a page: a placeholder written with braces, like {code},
// is the usual cause.
const SETS = [
  ['en-US sms', enSms, 'en-US'],
  ['zh-CN sms', zhSms, 'zh-CN'],
  ['en-US email', enEmail, 'en-US'],
  ['zh-CN email', zhEmail, 'zh-CN'],
] as const;

describe('the texts of the SMS and e-mail pages', () => {
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

  it('write {code}, {minutes} and {appName} as they are, braces included, when they name a placeholder', () => {
    const shown = (text: string, values: Record<string, string> = {}) =>
      new IntlMessageFormat(text, 'en-US').format(values);
    expect(shown(enSms['sms.templates.contentMissingCode'], { placeholder: '{code}' })).toContain(
      '{code}',
    );
    expect(
      shown(enSms['sms.templates.contentHelp'], {
        required: '{code}',
        placeholders: '{code}, {minutes}, {appName}',
      }),
    ).toContain('{minutes}');
    expect(shown(enEmail['email.templates.missing'], { list: '{code}' })).toContain('{code}');
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
    for (const [dir, prefix, en, zh] of [
      ['src/pages/sms', 'sms', enSms, zhSms],
      ['src/pages/email', 'email', enEmail, zhEmail],
    ] as const) {
      const used = new Set<string>();
      for (const file of sourceFiles(dir)) {
        const source = readFileSync(file, 'utf8');
        for (const match of source.matchAll(new RegExp(`'(${prefix}\\.[A-Za-z0-9_.]+)'`, 'g'))) {
          used.add(match[1]);
        }
      }
      expect(used.size, dir).toBeGreaterThan(20);
      for (const key of used) {
        // A key that ends in a dot-prefix is built from a code (a status, a type): the page adds the code.
        if (key.endsWith('.')) continue;
        const hasText = (messages: Record<string, string>) =>
          key in messages || Object.keys(messages).some((k) => k.startsWith(`${key}.`));
        expect(hasText(en), `${key} in en-US`).toBe(true);
        expect(hasText(zh), `${key} in zh-CN`).toBe(true);
      }
    }
  });

  it('has no text that offers to show a verification code', () => {
    for (const [, messages] of SETS) {
      for (const [key, text] of Object.entries(messages)) {
        expect(`${key} ${text}`, key).not.toMatch(
          /view (the )?(verification )?code|show (the )?code|reveal|查看验证码|查看验证/i,
        );
      }
    }
  });
});
