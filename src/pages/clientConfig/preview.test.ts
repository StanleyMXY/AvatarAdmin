import { describe, expect, it } from 'vitest';
import type { ClientConfigItem } from '../../services/clientConfig';
import { resolvePreview } from './preview';

const item = (
  values: Record<string, unknown>,
  over: Partial<ClientConfigItem> = {},
): ClientConfigItem => ({
  key: 'privacyPolicyUrl',
  type: 'URL',
  localized: true,
  readOnly: false,
  configured: Object.keys(values).length > 0,
  defaultValue: null,
  values: values as ClientConfigItem['values'],
  updatedBy: null,
  updatedByUsername: null,
  updatedAt: null,
  ...over,
});

describe('resolvePreview: the value the client gets for one requested language (contract 26.1)', () => {
  const full = item({ '': 'D', th: 'T', 'zh-Hans': 'ZH', ar: 'A' });

  it('uses the value of the language when the key has it', () => {
    expect(resolvePreview(full, 'th')).toEqual({ source: 'LANGUAGE', matched: 'th', value: 'T' });
    expect(resolvePreview(full, 'AR')).toEqual({ source: 'LANGUAGE', matched: 'ar', value: 'A' });
  });

  it('matches a regional tag to the language of the key, and the other way round', () => {
    expect(resolvePreview(full, 'th-TH')).toMatchObject({ source: 'LANGUAGE', matched: 'th' });
    expect(resolvePreview(item({ 'th-TH': 'T' }), 'th')).toMatchObject({
      source: 'LANGUAGE',
      matched: 'th-TH',
    });
    expect(resolvePreview(full, 'zh-CN')).toMatchObject({ source: 'LANGUAGE', matched: 'zh-Hans' });
  });

  it('prefers the full match to the match of the main language', () => {
    const both = item({ th: 'T', 'th-TH': 'TT', '': 'D' });
    expect(resolvePreview(both, 'th-TH')).toMatchObject({ matched: 'th-TH', value: 'TT' });
  });

  it('among several entries of one language, takes one that is a prefix of the request first', () => {
    const many = item({ zh: 'Z', 'zh-Hant': 'ZT', 'zh-Hans': 'ZS' });
    expect(resolvePreview(many, 'zh-Hant-TW')).toMatchObject({ matched: 'zh-Hant' });
  });

  it('among several entries of one language, a request with more subtags finds the entry that is its prefix, not the one that sorts first', () => {
    const regional = item({ 'pt-BR': 'BR', 'pt-PT': 'PT' });
    expect(resolvePreview(regional, 'pt-PT-1996')).toMatchObject({ matched: 'pt-PT', value: 'PT' });
    expect(resolvePreview(regional, 'pt-BR-1996')).toMatchObject({ matched: 'pt-BR', value: 'BR' });
  });

  it('among several entries of Chinese, picks the script the request implies', () => {
    const many = item({ 'zh-Hant': 'ZT', 'zh-Hans': 'ZS' });
    expect(resolvePreview(many, 'zh-TW')).toMatchObject({ matched: 'zh-Hant' });
    expect(resolvePreview(many, 'zh-HK')).toMatchObject({ matched: 'zh-Hant' });
    expect(resolvePreview(many, 'zh-CN')).toMatchObject({ matched: 'zh-Hans' });
    expect(resolvePreview(many, 'zh')).toMatchObject({ matched: 'zh-Hans' });
    expect(resolvePreview(many, 'zh-Hant')).toMatchObject({ matched: 'zh-Hant' });
  });

  it('falls back to the default value of the key when the language has none', () => {
    expect(resolvePreview(full, 'es')).toEqual({ source: 'DEFAULT', matched: '', value: 'D' });
    expect(resolvePreview(full, '')).toEqual({ source: 'DEFAULT', matched: '', value: 'D' });
  });

  it('falls back to the registered default when the key has no default value row', () => {
    const registered = item({ th: 'T' }, { defaultValue: 'REG' });
    expect(resolvePreview(registered, 'es')).toEqual({
      source: 'DEFAULT',
      matched: null,
      value: 'REG',
    });
  });

  it('is "not configured" when there is nothing at all, and the entry is not shown in the app', () => {
    expect(resolvePreview(item({}), 'th')).toEqual({ source: 'UNSET', matched: null, value: null });
    expect(resolvePreview(item({ th: 'T' }), 'es')).toEqual({
      source: 'UNSET',
      matched: null,
      value: null,
    });
  });

  it('knows false, zero and the empty text as values, not as nothing', () => {
    const flag = item({ '': false }, { type: 'BOOLEAN', localized: false });
    expect(resolvePreview(flag, 'th')).toEqual({ source: 'DEFAULT', matched: '', value: false });
    expect(resolvePreview(item({ '': 0 }, { type: 'INT' }), 'th').value).toBe(0);
    expect(resolvePreview(item({ '': '' }, { type: 'STRING' }), 'th')).toEqual({
      source: 'DEFAULT',
      matched: '',
      value: '',
    });
    expect(resolvePreview(item({}, { type: 'INT', defaultValue: 0 }), 'th').value).toBe(0);
  });

  it('ignores the language rows of a key that is not localized', () => {
    const plain = item({ '': 'D', th: 'T' }, { localized: false });
    expect(resolvePreview(plain, 'th')).toEqual({ source: 'DEFAULT', matched: '', value: 'D' });
  });

  it('copes with values that are not an object', () => {
    for (const values of [null, undefined, 'x', 5, ['a']]) {
      expect(
        resolvePreview(item({}, { values: values as never }), 'th').source,
        String(values),
      ).toBe('UNSET');
    }
  });

  it('copes with a request that is empty or has odd characters', () => {
    expect(resolvePreview(full, '  ').source).toBe('DEFAULT');
    expect(resolvePreview(full, 'ไทย-😀').source).toBe('DEFAULT');
  });
});
