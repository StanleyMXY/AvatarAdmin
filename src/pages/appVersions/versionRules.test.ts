import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import {
  changelogTags,
  checkChangelog,
  checkMinVersionCode,
  checkVersionCode,
  checkVersionName,
  cleanChangelog,
  highestLiveCode,
  highestOtherCode,
} from './versionRules';

const reason = (check: { ok: boolean; reasonKey?: string }) => (check.ok ? null : check.reasonKey);
const NBSP = String.fromCharCode(0xa0);
const IDEOGRAPHIC_SPACE = String.fromCharCode(0x3000);

describe('checkVersionName (x.y.z)', () => {
  it('accepts three numbers with dots', () => {
    for (const name of ['1.0.0', '0.0.1', '12.345.6789', '001.002.003']) {
      expect(checkVersionName(name).ok, name).toBe(true);
    }
  });
  it('refuses anything else', () => {
    for (const name of [
      '',
      '1',
      '1.0',
      '1.0.0.0',
      '1.0.',
      '.1.0',
      '1..0',
      'v1.0.0',
      '1.0.0-beta',
      '1.0.0 ',
      ' 1.0.0',
      `1.0.0${NBSP}`,
      '1.0.0\n',
      '1,0,0',
      'a.b.c',
      '１.０.０',
      '١.٠.٠',
      '-1.0.0',
      '1.-1.0',
      '1.0.0+5',
    ]) {
      expect(reason(checkVersionName(name)), JSON.stringify(name)).toBe(
        'appVersions.rule.versionName',
      );
    }
  });
});

describe('checkVersionCode: a whole number from 1, strictly above the number it has to beat', () => {
  it('accepts a whole number above the number to beat', () => {
    expect(checkVersionCode(121, 120).ok).toBe(true);
    expect(checkVersionCode(1, null).ok).toBe(true);
    expect(checkVersionCode(5, 4).ok).toBe(true);
  });
  it('refuses the number to beat and lower ones, and gives the number to beat', () => {
    expect(checkVersionCode(120, 120)).toEqual({
      ok: false,
      reasonKey: 'appVersions.rule.versionCodeAbove',
      values: { max: 120 },
    });
    expect(reason(checkVersionCode(119, 120))).toBe('appVersions.rule.versionCodeAbove');
    expect(reason(checkVersionCode(1, 1))).toBe('appVersions.rule.versionCodeAbove');
  });
  it('with no number to beat only the whole number from 1 counts', () => {
    for (const value of [
      0,
      -1,
      1.5,
      Number.NaN,
      null,
      undefined,
      '12',
      Number.POSITIVE_INFINITY,
      2 ** 60,
    ]) {
      expect(reason(checkVersionCode(value, null)), String(value)).toBe(
        'appVersions.rule.versionCodeWhole',
      );
    }
  });
  it('treats a number to beat that is not a number as unknown', () => {
    expect(checkVersionCode(3, Number.NaN).ok).toBe(true);
    expect(checkVersionCode(3, undefined as unknown as null).ok).toBe(true);
  });
  it('property: ok exactly when it is a whole number from 1 and above the number to beat (every pair of a range)', () => {
    for (let value = -5; value <= 60; value += 1) {
      for (const active of [null, ...Array.from({ length: 61 }, (_, i) => i)]) {
        const expected = value >= 1 && (active === null || value > active);
        expect(checkVersionCode(value, active).ok, `${value} over ${active}`).toBe(expected);
      }
    }
  });
});

// Contract 24.2 (new version): the number of a new version or of an edited draft must beat every
// other version of the channel (drafts and taken-down ones too); the number to activate must beat
// every version that has been live (ACTIVE or ARCHIVED).
describe('highestOtherCode and highestLiveCode: the numbers a version has to beat', () => {
  const channel = [
    { id: 'a', versionCode: 100, status: 'ARCHIVED' },
    { id: 'b', versionCode: 110, status: 'ACTIVE' },
    { id: 'c', versionCode: 120, status: 'DRAFT' },
    { id: 'd', versionCode: 115, status: 'ARCHIVED' },
  ];
  it('a new version has to beat the highest of all, a draft among them', () => {
    expect(highestOtherCode(channel, null)).toBe(120);
  });
  it('an edited draft does not have to beat itself', () => {
    expect(highestOtherCode(channel, 'c')).toBe(115);
    expect(highestOtherCode([channel[2]], 'c')).toBeNull();
  });
  it('an activation has to beat the highest that was live: active and taken down, never a draft', () => {
    expect(highestLiveCode(channel)).toBe(115);
    expect(highestLiveCode([channel[2]])).toBeNull();
  });
  it('a channel with no version, or only rows without a usable number, has nothing to beat', () => {
    expect(highestOtherCode([], null)).toBeNull();
    expect(highestLiveCode([])).toBeNull();
    const odd = [
      { id: 'x', versionCode: '120', status: 'ACTIVE' },
      { id: 'y', versionCode: null, status: 'ARCHIVED' },
      { id: 'z', versionCode: Number.NaN, status: 'DRAFT' },
    ];
    expect(highestOtherCode(odd, null)).toBeNull();
    expect(highestLiveCode(odd)).toBeNull();
  });
  it('a state that is not one of the three counts as not live', () => {
    expect(highestLiveCode([{ id: 'q', versionCode: 900, status: 'SOMETHING' }])).toBeNull();
  });
});

// Answers 91: the numbers are 32-bit integers in the backend, so the top is 2147483647, not 2^53 - 1.
describe('the top of the numbers: 2147483647', () => {
  it('takes 2147483647 and refuses the next number and the numbers up to 2^53 - 1, for the version number and the minimum', () => {
    expect(checkVersionCode(2_147_483_647, null).ok).toBe(true);
    expect(checkMinVersionCode(2_147_483_647, null).ok).toBe(true);
    expect(checkMinVersionCode(2_147_483_647, 2_147_483_647).ok).toBe(true);
    for (const value of [2_147_483_648, 4_294_967_296, Number.MAX_SAFE_INTEGER]) {
      expect(reason(checkVersionCode(value, null)), String(value)).toBe(
        'appVersions.rule.versionCodeWhole',
      );
      expect(reason(checkMinVersionCode(value, null)), String(value)).toBe(
        'appVersions.rule.minWhole',
      );
    }
  });
  it('says the range in the words of both languages', () => {
    expect(enUS['appVersions.rule.versionCodeWhole']).toContain('2147483647');
    expect(zhCN['appVersions.rule.versionCodeWhole']).toContain('2147483647');
    expect(enUS['appVersions.rule.minWhole']).toContain('2147483647');
    expect(zhCN['appVersions.rule.minWhole']).toContain('2147483647');
  });
});

describe('checkVersionName: at most 32 characters', () => {
  it('accepts 32 and refuses 33', () => {
    const name = (length: number) => `1.2.${'3'.repeat(length - 4)}`;
    expect(name(32)).toHaveLength(32);
    expect(checkVersionName(name(32)).ok).toBe(true);
    expect(reason(checkVersionName(name(33)))).toBe('appVersions.rule.versionName');
  });
});

describe('checkMinVersionCode: from 1, and not above the version number', () => {
  it('accepts 1 up to the version number', () => {
    expect(checkMinVersionCode(1, 120).ok).toBe(true);
    expect(checkMinVersionCode(120, 120).ok).toBe(true);
    expect(checkMinVersionCode(60, 120).ok).toBe(true);
  });
  it('refuses 0, negatives, fractions and anything above the version number', () => {
    expect(reason(checkMinVersionCode(0, 120))).toBe('appVersions.rule.minWhole');
    expect(reason(checkMinVersionCode(-3, 120))).toBe('appVersions.rule.minWhole');
    expect(reason(checkMinVersionCode(1.5, 120))).toBe('appVersions.rule.minWhole');
    expect(reason(checkMinVersionCode(null, 120))).toBe('appVersions.rule.minWhole');
    expect(checkMinVersionCode(121, 120)).toEqual({
      ok: false,
      reasonKey: 'appVersions.rule.minAbove',
      values: { versionCode: 120 },
    });
  });
  it('does not compare with a version number that is not there', () => {
    expect(checkMinVersionCode(5, null).ok).toBe(true);
    expect(checkMinVersionCode(5, Number.NaN).ok).toBe(true);
    expect(reason(checkMinVersionCode(0, null))).toBe('appVersions.rule.minWhole');
  });
  it('property: ok exactly when 1 <= min <= versionCode (every pair of a range)', () => {
    for (let min = -5; min <= 60; min += 1) {
      for (let code = 1; code <= 60; code += 1) {
        expect(checkMinVersionCode(min, code).ok, `${min} of ${code}`).toBe(
          min >= 1 && min <= code,
        );
      }
    }
  });
});

describe('the update notes: English is needed', () => {
  it('refuses notes without en, or with an en that is only blank', () => {
    expect(reason(checkChangelog({}))).toBe('appVersions.rule.changelogEn');
    expect(reason(checkChangelog({ th: 'ปรับปรุง' }))).toBe('appVersions.rule.changelogEn');
    expect(reason(checkChangelog({ en: '' }))).toBe('appVersions.rule.changelogEn');
    expect(reason(checkChangelog({ en: ` \n${NBSP}${IDEOGRAPHIC_SPACE}` }))).toBe(
      'appVersions.rule.changelogEn',
    );
    expect(reason(checkChangelog({ 'en-US': 'Fixes' }))).toBe('appVersions.rule.changelogEn');
    expect(reason(checkChangelog(undefined))).toBe('appVersions.rule.changelogEn');
  });
  // Answers 91: an object of at most 30 languages; a key is [A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*, at most 35
  // characters; a text has 1 to 4000 code points; any language is taken, the list of supported ones is not asked.
  it('takes a text of 4000 code points of any script and refuses 4001, naming the language', () => {
    for (const ch of ['a', 'ก', '字', '😀']) {
      expect(checkChangelog({ en: ch.repeat(4000) }).ok, ch).toBe(true);
    }
    const long = checkChangelog({ en: 'ok', th: 'ก'.repeat(4001) });
    expect(long).toEqual({
      ok: false,
      reasonKey: 'appVersions.rule.changelogTooLong',
      values: { tag: 'th' },
    });
    expect(reason(checkChangelog({ en: '😀'.repeat(4001) }))).toBe(
      'appVersions.rule.changelogTooLong',
    );
  });
  it('counts the text after the ends are cut, the way it is sent', () => {
    expect(checkChangelog({ en: ` ${'a'.repeat(4000)} ` }).ok).toBe(true);
  });
  it('takes 30 languages and refuses 31; a language left empty is not counted', () => {
    const tags = (n: number) =>
      Object.fromEntries(
        Array.from({ length: n }, (_, i) => [
          `x${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`,
          'text',
        ]),
      );
    const thirty = { en: 'a', ...tags(29) };
    expect(Object.keys(thirty)).toHaveLength(30);
    expect(checkChangelog(thirty).ok).toBe(true);
    expect(reason(checkChangelog({ ...thirty, ...tags(30), zz: 'one more' }))).toBe(
      'appVersions.rule.changelogTooMany',
    );
    expect(checkChangelog({ ...thirty, yy: '   ' }).ok).toBe(true);
  });
  it('refuses a language key that is not of the form, or longer than 35 characters, naming it', () => {
    for (const tag of [
      'e',
      'english',
      'en_US',
      'en-',
      'en--US',
      '1en',
      'en-U',
      `en-${'a'.repeat(33)}`,
    ]) {
      expect(checkChangelog({ en: 'a', [tag]: 'text' }), tag).toEqual({
        ok: false,
        reasonKey: 'appVersions.rule.changelogKey',
        values: { tag },
      });
    }
    for (const tag of ['th', 'zh-Hans', 'es-419', 'fil', 'ar-EG', 'sr-Latn-RS', 'de-CH-1996']) {
      expect(checkChangelog({ en: 'a', [tag]: 'text' }).ok, tag).toBe(true);
    }
  });
  it('accepts notes with en', () => {
    expect(checkChangelog({ en: 'Fixes' }).ok).toBe(true);
    expect(checkChangelog({ en: '修复', th: '' }).ok).toBe(true);
  });
  it('cleanChangelog trims with the contract set and leaves out empty languages', () => {
    expect(
      cleanChangelog({ en: ` Fixes${NBSP}`, th: '  ', ar: 'تحسينات', 'zh-Hans': '修复\n' }),
    ).toEqual({
      en: 'Fixes',
      ar: 'تحسينات',
      'zh-Hans': '修复',
    });
    expect(cleanChangelog(undefined)).toEqual({});
  });
  it('changelogTags: English first, then the supported languages, then any the notes already have', () => {
    expect(changelogTags(['zh-Hans', 'th', 'en'], { ar: 'x', th: 'y' })).toEqual([
      'en',
      'zh-Hans',
      'th',
      'ar',
    ]);
    expect(changelogTags(undefined, undefined)).toEqual(['en']);
    expect(changelogTags(null, { 'es-419': 'x' })).toEqual(['en', 'es-419']);
  });
});

describe('the texts of the rules', () => {
  it('exist in both languages', () => {
    const keys = [
      'appVersions.rule.versionName',
      'appVersions.rule.versionCodeWhole',
      'appVersions.rule.versionCodeAbove',
      'appVersions.rule.minWhole',
      'appVersions.rule.minAbove',
      'appVersions.rule.changelogEn',
      'appVersions.rule.changelogTooLong',
      'appVersions.rule.changelogTooMany',
      'appVersions.rule.changelogKey',
    ];
    for (const key of keys) {
      expect(zhCN[key], key).toBeTruthy();
      expect(enUS[key], key).toBeTruthy();
    }
  });
});
