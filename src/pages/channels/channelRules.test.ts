import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { checkChannelCode, checkPackageName, distributionsFor } from './channelRules';

const reason = (c: { ok: boolean; reasonKey?: string }) => (c.ok ? null : c.reasonKey);

describe('checkChannelCode: ^[a-z0-9_-]{2,32}$, not unknown, not one that exists', () => {
  it('accepts the codes of the pattern, at both ends of the length', () => {
    for (const code of ['ab', 'play', 'a_b-c9', '00', '--', '__', 'x'.repeat(32), 'partner-th']) {
      expect(checkChannelCode(code, []).ok, code).toBe(true);
    }
  });
  it('refuses anything else with the text of the pattern', () => {
    for (const code of [
      '',
      'a',
      'A1',
      'Play',
      'has space',
      'x'.repeat(33),
      'ก-ข',
      'a.b',
      'a/b',
      'a\nb',
      'ab\n',
      ' ab',
      'ab ',
      'ａｂ',
      'ab😀',
    ]) {
      expect(reason(checkChannelCode(code, [])), JSON.stringify(code)).toBe('channels.rule.code');
    }
  });
  it('refuses the reserved word unknown', () => {
    expect(reason(checkChannelCode('unknown', []))).toBe('channels.rule.codeReserved');
    // only exactly that word
    expect(checkChannelCode('unknown2', []).ok).toBe(true);
    expect(checkChannelCode('un-known', []).ok).toBe(true);
  });
  it('refuses a code the list has, without asking whether it is the same case', () => {
    expect(reason(checkChannelCode('play', ['play', 'direct']))).toBe('channels.rule.codeExists');
    expect(checkChannelCode('play2', ['play', 'direct']).ok).toBe(true);
  });
  it('puts the pattern before the rest, so an invalid code is not reported as taken', () => {
    expect(reason(checkChannelCode('Play', ['Play']))).toBe('channels.rule.code');
  });
});

describe('checkPackageName: none, or letters, digits, dots, hyphens and underscores', () => {
  it('accepts none and the names of Android and iOS', () => {
    for (const name of [
      '',
      'com.example.avatar',
      'app.example.play',
      'com.example.My-App_2',
      'a',
    ]) {
      expect(checkPackageName(name).ok, name).toBe(true);
    }
  });
  it('refuses spaces, slashes, other punctuation, control characters and letters of other scripts', () => {
    for (const name of [
      'com example',
      'com/example',
      'com\\example',
      'a\tb',
      'a\nb',
      'ก.ข',
      'a@b',
      'a$b',
      'a:b',
      'ab\n',
    ]) {
      expect(reason(checkPackageName(name)), JSON.stringify(name)).toBe(
        'channels.rule.packageName',
      );
    }
  });
});

describe('distributionsFor: a direct download is Android only', () => {
  it('offers both for Android and for no platform yet, and only the store for iOS', () => {
    expect(distributionsFor('ANDROID')).toEqual({ STORE: true, DIRECT: true });
    expect(distributionsFor(undefined)).toEqual({ STORE: true, DIRECT: true });
    expect(distributionsFor('IOS')).toEqual({ STORE: true, DIRECT: false });
  });
});

describe('the texts of the rules', () => {
  it('exist in both languages', () => {
    for (const key of [
      'channels.rule.code',
      'channels.rule.codeReserved',
      'channels.rule.codeExists',
      'channels.rule.packageName',
    ]) {
      expect(zhCN[key], key).toBeTruthy();
      expect(enUS[key], key).toBeTruthy();
    }
  });
});
