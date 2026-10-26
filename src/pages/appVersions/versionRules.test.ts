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

describe('checkVersionCode: a whole number from 1, strictly above the version that is active', () => {
  it('accepts a whole number above the active one', () => {
    expect(checkVersionCode(121, 120).ok).toBe(true);
    expect(checkVersionCode(1, null).ok).toBe(true);
    expect(checkVersionCode(5, 4).ok).toBe(true);
  });
  it('refuses the active number and lower ones, with the number to beat', () => {
    expect(checkVersionCode(120, 120)).toEqual({
      ok: false,
      reasonKey: 'appVersions.rule.versionCodeAbove',
      values: { active: 120 },
    });
    expect(reason(checkVersionCode(119, 120))).toBe('appVersions.rule.versionCodeAbove');
    expect(reason(checkVersionCode(1, 1))).toBe('appVersions.rule.versionCodeAbove');
  });
  it('without an active version only the whole number from 1 counts', () => {
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
  it('treats an active number that is not a number as unknown', () => {
    expect(checkVersionCode(3, Number.NaN).ok).toBe(true);
    expect(checkVersionCode(3, undefined as unknown as null).ok).toBe(true);
  });
  it('property: ok exactly when it is a whole number from 1 and above the active one (every pair of a range)', () => {
    for (let value = -5; value <= 60; value += 1) {
      for (const active of [null, ...Array.from({ length: 61 }, (_, i) => i)]) {
        const expected = value >= 1 && (active === null || value > active);
        expect(checkVersionCode(value, active).ok, `${value} over ${active}`).toBe(expected);
      }
    }
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
    ];
    for (const key of keys) {
      expect(zhCN[key], key).toBeTruthy();
      expect(enUS[key], key).toBeTruthy();
    }
  });
});
