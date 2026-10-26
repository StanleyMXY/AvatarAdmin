import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US/activity';
import zhCN from '../../locales/zh-CN/activity';
import { codeText, countText, instantText, plainOrDash, type Translator } from './texts';

// Kana, CJK ideographs and Hangul, written as code points so that this file has none of them.
const CJK_OR_HANGUL = new RegExp(
  `[${String.fromCharCode(0x3040)}-${String.fromCharCode(0x30ff)}${String.fromCharCode(0x3400)}-${String.fromCharCode(0x9fff)}${String.fromCharCode(0xac00)}-${String.fromCharCode(0xd7af)}]`,
);

const SOURCES = readdirSync(__dirname)
  .filter(
    (f) =>
      /\.tsx?$/.test(f) &&
      !/\.test\.tsx?$/.test(f) &&
      f !== 'testSetup.ts' &&
      f !== 'statsTestSetup.ts',
  )
  .map((f) => readFileSync(join(__dirname, f), 'utf8'));
const all = SOURCES.join('\n');

// 'activity.signin.new' written out, and `activity.task.type.${x}` written as a template (a prefix).
const literals = [...all.matchAll(/['"`](activity\.[A-Za-z0-9_.]+)['"`]/g)].map((m) => m[1]);
const prefixes = [...all.matchAll(/`(activity\.[A-Za-z0-9_.]*)\$\{/g)].map((m) => m[1]);

describe('the texts of the activity pages', () => {
  it('every text a page asks for is in both language files', () => {
    expect(literals.length).toBeGreaterThan(50);
    for (const key of literals) {
      // A name like `activity.task.type` is the start of a family of texts that a helper completes.
      const family = (list: Record<string, string>) =>
        list[key] !== undefined || Object.keys(list).some((k) => k.startsWith(`${key}.`));
      expect(family(zhCN), `zh-CN ${key}`).toBe(true);
      expect(family(enUS), `en-US ${key}`).toBe(true);
    }
    for (const prefix of prefixes) {
      expect(
        Object.keys(zhCN).some((k) => k.startsWith(prefix)),
        `zh-CN ${prefix}`,
      ).toBe(true);
      expect(
        Object.keys(enUS).some((k) => k.startsWith(prefix)),
        `en-US ${prefix}`,
      ).toBe(true);
    }
  });

  it('every text of the two files is used by a page, so none is left over', () => {
    for (const key of Object.keys(enUS).filter((k) => k.startsWith('activity.'))) {
      const used =
        literals.some((l) => l === key || key.startsWith(`${l}.`)) ||
        prefixes.some((p) => key.startsWith(p));
      expect(used, key).toBe(true);
    }
  });

  it('the two files have the same keys and the same placeholders, and the English has no Chinese or Japanese or Korean letters', () => {
    expect(Object.keys(enUS).sort()).toEqual(Object.keys(zhCN).sort());
    const holes = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(enUS)) {
      expect(holes(zhCN[key]), key).toEqual(holes(enUS[key]));
      expect(enUS[key], key).not.toMatch(CJK_OR_HANGUL);
    }
  });
});

const intl: Translator = {
  locale: 'en-US',
  messages: { 'activity.task.type.call_seconds': 'x' },
  formatMessage: ({ id }) => `<${id}>`,
};

describe('the text helpers', () => {
  it('codeText gives the words of a known code, the code itself for a code the language file does not know, and nothing for nothing', () => {
    expect(codeText(intl, 'activity.task.type', 'call_seconds')).toBe(
      '<activity.task.type.call_seconds>',
    );
    expect(codeText(intl, 'activity.task.type', 'brand_new')).toBe('brand_new');
    expect(codeText(intl, 'activity.task.type', null)).toBe('');
    expect(codeText(intl, 'activity.task.type', { a: 1 })).toBe('{"a":1}');
    // A code that is the name of an object property is not a known code.
    expect(codeText(intl, 'activity.task.type', 'constructor')).toBe('constructor');
  });

  it('countText writes a number, 0 included, and a dash for anything else', () => {
    expect(countText('en-US', 0)).toBe('0');
    expect(countText('en-US', 12345)).toBe('12,345');
    for (const value of [null, undefined, '5', {}, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(countText('en-US', value)).toBe('—');
    }
  });

  it('instantText writes an instant in the language, a dash for nothing and anything that is not text', () => {
    expect(instantText('en-US', null)).toBe('—');
    expect(instantText('en-US', '')).toBe('—');
    expect(instantText('en-US', 5)).toBe('—');
    expect(instantText('en-US', '2026-10-26T01:02:03Z')).toMatch(/2026/);
  });

  it('plainOrDash writes any value as text and nothing as a dash', () => {
    expect(plainOrDash(null)).toBe('—');
    expect(plainOrDash('')).toBe('—');
    expect(plainOrDash(0)).toBe('0');
    expect(plainOrDash({ a: 1 })).toBe('{"a":1}');
  });
});
