import { describe, expect, it } from 'vitest';
import { resolveInitialLocale } from './resolveLocale';

describe('resolveInitialLocale', () => {
  it('uses a saved valid choice before anything else', () => {
    expect(resolveInitialLocale('zh-CN', ['en-US'])).toBe('zh-CN');
    expect(resolveInitialLocale('en-US', ['zh-CN'])).toBe('en-US');
    expect(resolveInitialLocale('en-US', [])).toBe('en-US');
  });

  it('maps every browser language that starts with zh to zh-CN', () => {
    expect(resolveInitialLocale(null, ['zh-TW'])).toBe('zh-CN');
    expect(resolveInitialLocale(null, ['zh-Hans-CN'])).toBe('zh-CN');
    expect(resolveInitialLocale(null, ['zh'])).toBe('zh-CN');
    expect(resolveInitialLocale(null, ['ZH-hk'])).toBe('zh-CN');
    expect(resolveInitialLocale(null, ['zh_CN'])).toBe('zh-CN');
  });

  it('maps every other browser language, and none at all, to en-US', () => {
    expect(resolveInitialLocale(null, ['th-TH', 'en'])).toBe('en-US');
    expect(resolveInitialLocale(null, ['ar'])).toBe('en-US');
    expect(resolveInitialLocale(null, ['id-ID'])).toBe('en-US');
    expect(resolveInitialLocale(null, ['vi'])).toBe('en-US');
    expect(resolveInitialLocale(null, ['es-MX'])).toBe('en-US');
    expect(resolveInitialLocale(null, ['en-GB'])).toBe('en-US');
    expect(resolveInitialLocale(null, [])).toBe('en-US');
  });

  it('decides by the first (preferred) browser language', () => {
    expect(resolveInitialLocale(null, ['zh-CN', 'en'])).toBe('zh-CN');
    expect(resolveInitialLocale(null, ['th-TH', 'zh-CN'])).toBe('en-US');
  });

  it('does not take a language that merely contains the letters zh', () => {
    expect(resolveInitialLocale(null, ['zhx'])).toBe('en-US');
    expect(resolveInitialLocale(null, ['uzh'])).toBe('en-US');
  });

  it('ignores a saved value that is not one of the two interface languages', () => {
    expect(resolveInitialLocale('th-TH', ['zh-CN'])).toBe('zh-CN');
    expect(resolveInitialLocale('', ['en'])).toBe('en-US');
    expect(resolveInitialLocale('zh-cn', ['en'])).toBe('en-US');
    expect(resolveInitialLocale('zh', ['th'])).toBe('en-US');
    expect(resolveInitialLocale('null', ['zh'])).toBe('zh-CN');
  });
});
