import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localeConfig } from '../../config/localeConfig';
import { currentLocale, rememberLocale, resetActiveLocaleForTests } from './activeLocale';

const languages = (list: string[]) =>
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(list);
const storageDenied = () => {
  const denied = () => {
    throw new DOMException('denied', 'SecurityError');
  };
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied);
};

beforeEach(() => {
  localStorage.clear();
  resetActiveLocaleForTests();
});
afterEach(() => vi.restoreAllMocks());

describe('the language in use', () => {
  it('is the saved choice, else the language of the browser (zh is zh-CN, the rest en-US)', () => {
    languages(['th-TH']);
    expect(currentLocale()).toBe('en-US');
    languages(['zh-TW']);
    expect(currentLocale()).toBe('zh-CN');
    localStorage.setItem('umi_locale', 'en-US');
    expect(currentLocale()).toBe('en-US');
  });

  it('is kept in memory and in localStorage once chosen', () => {
    languages(['en']);
    rememberLocale('zh-CN');
    expect(currentLocale()).toBe('zh-CN');
    expect(localStorage.getItem('umi_locale')).toBe('zh-CN');
  });

  it('still changes when the browser refuses all storage: the choice lives in memory until the page is closed', () => {
    languages(['en']);
    storageDenied();
    expect(currentLocale()).toBe('en-US');
    expect(() => rememberLocale('zh-CN')).not.toThrow();
    expect(currentLocale()).toBe('zh-CN');
    expect(() => rememberLocale('en-US')).not.toThrow();
    expect(currentLocale()).toBe('en-US');
  });

  it('tells Umi not to read or write localStorage itself', () => {
    // Umi's own reading and writing of localStorage throws in some browsers before the language
    // is changed at all; with it off, the functions above are the only place that touches it.
    expect(localeConfig.useLocalStorage).toBe(false);
  });
});
