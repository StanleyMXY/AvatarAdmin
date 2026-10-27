import { describe, expect, it } from 'vitest';
import { cleanTexts, languageName, languageTags, pickText } from './localized';

describe('languageTags', () => {
  it('starts with English, adds the supported languages and the tags the value has, once each', () => {
    expect(languageTags(['zh-Hans', 'en'], { th: 'x', en: 'y' })).toEqual(['en', 'zh-Hans', 'th']);
    expect(languageTags(null, undefined)).toEqual(['en']);
  });
});

describe('cleanTexts', () => {
  it('trims with the contract set (the ideographic space and the no-break space too) and drops the empty ones', () => {
    const pad = String.fromCharCode(0x3000, 0xa0, 0x20);
    expect(cleanTexts({ en: `${pad}Hello${pad}`, th: pad, ar: '' })).toEqual({ en: 'Hello' });
  });

  it('keeps Thai, Arabic and emoji as they are', () => {
    expect(cleanTexts({ th: ' สวัสดี ', ar: 'مرحبا 🌟' })).toEqual({ th: 'สวัสดี', ar: 'مرحبا 🌟' });
  });
});

describe('pickText', () => {
  const names = { en: 'Dress', 'zh-Hans': '连衣裙', th: 'ชุด' };
  it('takes the interface language, Chinese through its script tag', () => {
    expect(pickText(names, 'zh-CN')).toBe('连衣裙');
    expect(pickText(names, 'en-US')).toBe('Dress');
  });
  it('falls back to English, then to the first language there is, then to nothing', () => {
    expect(pickText({ en: 'Dress', th: 'ชุด' }, 'zh-CN')).toBe('Dress');
    expect(pickText({ th: 'ชุด', ar: 'فستان' }, 'en-US')).toBe('فستان');
    expect(pickText({}, 'en-US')).toBeNull();
    expect(pickText(null, 'en-US')).toBeNull();
    expect(pickText({ en: '' }, 'en-US')).toBeNull();
  });
});

describe('languageName', () => {
  it('names a language in the interface language and gives back the tag when it is not a tag', () => {
    expect(languageName('th', 'en-US')).toBe('Thai');
    expect(languageName('not a tag !!', 'en-US')).toBe('not a tag !!');
  });
});
