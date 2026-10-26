import { describe, expect, it } from 'vitest';
import {
  addLanguage,
  buildSendBody,
  type Entry,
  entryProblems,
  isLanguageTag,
  lengthOf,
  MAX_BODY,
  MAX_TITLE,
} from './compose';

const entry = (locale: string, title = 't', body = 'b'): Entry => ({ locale, title, body });
const IDEOGRAPHIC = String.fromCharCode(0x3000);
const ZWJ = String.fromCharCode(0x200d);

describe('lengthOf: trim with the contract definition, then count code points', () => {
  it('counts an emoji, a Thai word and an Arabic word by code points', () => {
    expect(lengthOf('😀')).toBe(1);
    expect(lengthOf('😀😀😀')).toBe(3);
    expect(lengthOf('ก็')).toBe(2);
    expect(lengthOf('مرحبا')).toBe(5);
    expect(lengthOf(['👨', '👩', '👧'].join(ZWJ))).toBe(5);
  });

  it('does not count the whitespace at either end, however it is written', () => {
    expect(lengthOf(`  ab ${IDEOGRAPHIC}`)).toBe(2);
    expect(lengthOf(' \n\t ')).toBe(0);
  });
});

describe('entryProblems: the title is 1 to 100 and the body 1 to 500 code points once trimmed', () => {
  it('accepts the limits exactly and refuses one more', () => {
    expect(entryProblems(entry('en', 'x'.repeat(MAX_TITLE), 'y'.repeat(MAX_BODY)))).toEqual({});
    expect(entryProblems(entry('en', 'x'.repeat(MAX_TITLE + 1), 'y'))).toEqual({
      title: 'TOO_LONG',
    });
    expect(entryProblems(entry('en', 'x', 'y'.repeat(MAX_BODY + 1)))).toEqual({ body: 'TOO_LONG' });
  });

  it('counts emoji and Thai by code points: 100 emoji pass, 101 do not (they are 200 and 202 UTF-16 units)', () => {
    expect(entryProblems(entry('en', '😀'.repeat(100), '😀'.repeat(500)))).toEqual({});
    expect(entryProblems(entry('en', '😀'.repeat(101), '😀'.repeat(501)))).toEqual({
      title: 'TOO_LONG',
      body: 'TOO_LONG',
    });
    expect(entryProblems(entry('th', 'ก'.repeat(100), 'ก'.repeat(500)))).toEqual({});
  });

  it('does not count the whitespace around the text against the limit', () => {
    expect(entryProblems(entry('en', ` ${'x'.repeat(100)}${IDEOGRAPHIC}`, 'y'))).toEqual({});
  });

  it('refuses an empty or whitespace-only text', () => {
    expect(entryProblems(entry('en', '', 'b'))).toEqual({ title: 'EMPTY_NOT_ALLOWED' });
    expect(entryProblems(entry('en', 't', ` ${IDEOGRAPHIC}\n`))).toEqual({
      body: 'EMPTY_NOT_ALLOWED',
    });
    expect(entryProblems(entry('ar', '', ''))).toEqual({
      title: 'EMPTY_NOT_ALLOWED',
      body: 'EMPTY_NOT_ALLOWED',
    });
  });
});

describe('isLanguageTag', () => {
  it('takes the tags of the contract and nothing else', () => {
    for (const tag of ['en', 'th', 'zh-Hans', 'zh-Hans-CN', 'es-419', 'ar', 'pt-BR', 'fil'])
      expect(isLanguageTag(tag), tag).toBe(true);
    for (const tag of [
      '',
      'e',
      'english',
      'en_US',
      'en-',
      '-en',
      'en us',
      'en-x',
      `en-${'a'.repeat(9)}`,
      'ไทย',
      'en-😀',
    ])
      expect(isLanguageTag(tag), tag).toBe(false);
    expect(
      isLanguageTag(`${'a'.repeat(2)}-${'b'.repeat(8)}-${'c'.repeat(8)}-${'d'.repeat(8)}`),
    ).toBe(true);
    expect(
      isLanguageTag(`${'a'.repeat(2)}-${'b'.repeat(8)}-${'c'.repeat(8)}-${'d'.repeat(9)}-e`),
    ).toBe(false);
  });

  it('allows 35 characters and no more', () => {
    const at35 = `en-${'a'.repeat(8)}-${'b'.repeat(8)}-${'c'.repeat(8)}-${'d'.repeat(5)}`;
    expect(at35.length).toBe(35);
    expect(isLanguageTag(at35)).toBe(true);
    expect(isLanguageTag(`${at35}e`)).toBe(false);
  });
});

describe('addLanguage', () => {
  it('adds an empty entry at the end and keeps en first', () => {
    const entries = addLanguage([entry('en')], ' th ');
    expect(entries.ok && entries.entries.map((e) => e.locale)).toEqual(['en', 'th']);
  });

  it('refuses a tag that is not valid, and one that is there already, whatever its case', () => {
    expect(addLanguage([entry('en')], 'english')).toEqual({
      ok: false,
      problem: 'INVALID_LANGUAGE_TAG',
    });
    expect(addLanguage([entry('en')], '')).toEqual({ ok: false, problem: 'INVALID_LANGUAGE_TAG' });
    expect(addLanguage([entry('en'), entry('th')], 'th')).toEqual({
      ok: false,
      problem: 'DUPLICATE',
    });
    expect(addLanguage([entry('en')], 'EN')).toEqual({ ok: false, problem: 'DUPLICATE' });
    expect(addLanguage([entry('en'), entry('zh-Hans')], 'zh-hans')).toEqual({
      ok: false,
      problem: 'DUPLICATE',
    });
  });
});

describe('buildSendBody', () => {
  const base = [entry('en', ' Hello ', ' Body '), entry('th', 'สวัสดี', 'ข้อความ')];

  it('sends the trimmed texts of every language and the recipients as given', () => {
    expect(
      buildSendBody({
        ids: ['a', 'b'],
        entries: base,
        link: { linkType: 'NONE', linkTarget: '' },
        push: false,
      }),
    ).toEqual({
      accountIds: ['a', 'b'],
      titleI18n: { en: 'Hello', th: 'สวัสดี' },
      bodyI18n: { en: 'Body', th: 'ข้อความ' },
      push: false,
    });
  });

  it('leaves both link fields out without a link, and sends them with one', () => {
    const none = buildSendBody({
      ids: ['a'],
      entries: base,
      link: { linkType: 'NONE', linkTarget: 'x' },
      push: true,
    });
    expect('linkType' in none).toBe(false);
    expect('linkTarget' in none).toBe(false);
    expect(none.push).toBe(true);
    expect(
      buildSendBody({
        ids: ['a'],
        entries: base,
        link: { linkType: 'SCREEN', linkTarget: 'store' },
        push: false,
      }),
    ).toMatchObject({ linkType: 'SCREEN', linkTarget: 'store' });
    expect(
      buildSendBody({
        ids: ['a'],
        entries: base,
        link: { linkType: 'URL', linkTarget: ' https://a.example/x ' },
        push: false,
      }),
    ).toMatchObject({ linkType: 'URL', linkTarget: 'https://a.example/x' });
  });
});
