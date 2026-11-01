import { describe, expect, it } from 'vitest';
import {
  type Coverage,
  isLastEnglishFallbackTemplate,
  isLastOtpChannel,
  isLastOtpTemplate,
  keepsCoverage,
  keepsEnglishFallback,
} from './lastOtp';

const ch = (id: string, countries: string[] | null, over: Partial<Coverage> = {}): Coverage => ({
  id,
  enabled: true,
  smsType: 'OTP',
  countries,
  ...over,
});

describe('the blanks around a country, a language or a country of a template', () => {
  const NEL = String.fromCharCode(0x85);
  const IDEOGRAPHIC = String.fromCharCode(0x3000);

  it('are those of the contract, so that U+0085 and the ideographic space do not make a different country', () => {
    const padded = (code: string) => `${NEL}${code}${IDEOGRAPHIC}`;
    expect(
      isLastOtpChannel(ch('1', [padded('th')]), [ch('1', [padded('th')]), ch('2', ['TH'])]),
    ).toBe(false);
  });

  it('are those of the contract for the language and the country of a template', () => {
    const template = (locale: string, country: string) => ({
      id: '1',
      enabled: true,
      smsType: 'OTP',
      locale,
      country,
    });
    expect(isLastEnglishFallbackTemplate(template(`${NEL}EN${IDEOGRAPHIC}`, `${NEL}`), [])).toBe(
      true,
    );
  });
});

describe('the last enabled OTP channel that covers a country', () => {
  it('is the only enabled OTP channel', () => {
    expect(isLastOtpChannel(ch('1', ['TH']), [ch('1', ['TH'])])).toBe(true);
    expect(isLastOtpChannel(ch('1', []), [ch('1', [])])).toBe(true);
    expect(isLastOtpChannel(ch('1', null), [ch('1', null)])).toBe(true);
  });

  it('is not the last when another enabled OTP channel covers all its countries', () => {
    expect(isLastOtpChannel(ch('1', ['TH']), [ch('1', ['TH']), ch('2', ['TH', 'VN'])])).toBe(false);
    expect(
      isLastOtpChannel(ch('1', ['TH', 'VN']), [
        ch('1', ['TH', 'VN']),
        ch('2', ['TH']),
        ch('3', ['VN']),
      ]),
    ).toBe(false);
    expect(isLastOtpChannel(ch('1', ['TH']), [ch('1', ['TH']), ch('2', [])])).toBe(false);
    expect(isLastOtpChannel(ch('1', []), [ch('1', []), ch('2', [])])).toBe(false);
  });

  it('is the last for a country that no other covers, even when the others cover more', () => {
    expect(isLastOtpChannel(ch('1', ['TH', 'ID']), [ch('1', ['TH', 'ID']), ch('2', ['TH'])])).toBe(
      true,
    );
    // A channel for all countries is the last for the countries the others do not name.
    expect(isLastOtpChannel(ch('1', []), [ch('1', []), ch('2', ['TH'])])).toBe(true);
  });

  it('does not count channels that are off or are not OTP', () => {
    expect(
      isLastOtpChannel(ch('1', ['TH']), [ch('1', ['TH']), ch('2', ['TH'], { enabled: false })]),
    ).toBe(true);
    expect(
      isLastOtpChannel(ch('1', ['TH']), [
        ch('1', ['TH']),
        ch('2', ['TH'], { smsType: 'MARKETING' }),
      ]),
    ).toBe(true);
  });

  it('is never the last when it is off or is not OTP itself: it holds no coverage to lose', () => {
    expect(
      isLastOtpChannel(ch('1', ['TH'], { enabled: false }), [ch('1', ['TH'], { enabled: false })]),
    ).toBe(false);
    expect(
      isLastOtpChannel(ch('1', ['TH'], { smsType: 'MARKETING' }), [
        ch('1', ['TH'], { smsType: 'MARKETING' }),
      ]),
    ).toBe(false);
  });

  it('reads country codes without regard to case and ignores entries that are not text', () => {
    expect(isLastOtpChannel(ch('1', ['th']), [ch('1', ['th']), ch('2', ['TH'])])).toBe(false);
    expect(
      isLastOtpChannel(ch('1', ['TH']), [ch('1', ['TH']), ch('2', [5 as unknown as string])]),
    ).toBe(true);
  });
});

describe('a change that keeps the coverage', () => {
  const all = [ch('1', ['TH', 'ID']), ch('2', ['TH'])];
  it('keeps it when the type stays OTP and the countries still hold those only this channel serves', () => {
    expect(keepsCoverage(all[0], { smsType: 'OTP', countries: ['ID', 'VN'] }, all)).toBe(true);
    expect(keepsCoverage(all[0], { smsType: 'OTP', countries: [] }, all)).toBe(true);
    expect(keepsCoverage(all[0], { smsType: 'OTP', countries: ['TH', 'ID'] }, all)).toBe(true);
  });
  it('loses it when the type leaves OTP, or when a country only this channel serves is dropped', () => {
    expect(keepsCoverage(all[0], { smsType: 'MARKETING', countries: ['TH', 'ID'] }, all)).toBe(
      false,
    );
    expect(keepsCoverage(all[0], { smsType: 'OTP', countries: ['TH'] }, all)).toBe(false);
  });
  it('a channel for all countries loses it when it is narrowed to a list, if no other one serves all', () => {
    const only = ch('1', []);
    expect(keepsCoverage(only, { smsType: 'OTP', countries: ['TH'] }, [only])).toBe(false);
    expect(keepsCoverage(only, { smsType: 'OTP', countries: [] }, [only])).toBe(true);
  });
  it('is always kept for a channel that was not the last one', () => {
    const both = [ch('1', ['TH']), ch('2', ['TH'])];
    expect(keepsCoverage(both[0], { smsType: 'MARKETING', countries: [] }, both)).toBe(true);
  });
});

describe('the last enabled OTP template', () => {
  const t = (id: string, over = {}) => ({ id, enabled: true, smsType: 'OTP', ...over });
  it('is the only enabled OTP template', () => {
    expect(isLastOtpTemplate(t('1'), [t('1')])).toBe(true);
    expect(isLastOtpTemplate(t('1'), [t('1'), t('2')])).toBe(false);
    expect(
      isLastOtpTemplate(t('1'), [
        t('1'),
        t('2', { enabled: false }),
        t('3', { smsType: 'MARKETING' }),
      ]),
    ).toBe(true);
  });
  it('is never the last when it is off or is not OTP itself', () => {
    expect(isLastOtpTemplate(t('1', { enabled: false }), [t('1', { enabled: false })])).toBe(false);
    expect(
      isLastOtpTemplate(t('1', { smsType: 'MARKETING' }), [t('1', { smsType: 'MARKETING' })]),
    ).toBe(false);
  });
});

describe('the last enabled English OTP template for every country', () => {
  const t = (id: string, over = {}) => ({
    id,
    enabled: true,
    smsType: 'OTP',
    locale: 'en',
    country: '',
    ...over,
  });
  it('is the only enabled OTP template in en, whatever the case, with no country', () => {
    expect(isLastEnglishFallbackTemplate(t('1'), [t('1'), t('2', { locale: 'th' })])).toBe(true);
    expect(
      isLastEnglishFallbackTemplate(t('1', { locale: 'EN' }), [t('1', { locale: 'EN' })]),
    ).toBe(true);
    expect(
      isLastEnglishFallbackTemplate(t('1', { country: null }), [t('1', { country: null })]),
    ).toBe(true);
  });
  it('is not the last when another template qualifies', () => {
    expect(isLastEnglishFallbackTemplate(t('1'), [t('1'), t('2', { locale: 'EN' })])).toBe(false);
  });
  it('does not count en-GB, en-US, a template with a country, one that is off, or one that is not OTP', () => {
    const others = [
      t('2', { locale: 'en-GB' }),
      t('3', { locale: 'en-US' }),
      t('4', { country: 'TH' }),
      t('5', { enabled: false }),
      t('6', { smsType: 'MARKETING' }),
    ];
    expect(isLastEnglishFallbackTemplate(t('1'), [t('1'), ...others])).toBe(true);
  });
  it('is never the last for a template that does not qualify itself', () => {
    for (const over of [
      { locale: 'en-GB' },
      { country: 'TH' },
      { enabled: false },
      { smsType: 'MARKETING' },
    ]) {
      expect(isLastEnglishFallbackTemplate(t('1', over), [t('1', over)])).toBe(false);
    }
  });
  it('is kept by an edit that leaves it enabled, OTP, en and without a country', () => {
    const all = [t('1')];
    expect(keepsEnglishFallback(t('1'), { smsType: 'OTP', locale: ' EN ', country: '' }, all)).toBe(
      true,
    );
    expect(keepsEnglishFallback(t('1'), { smsType: 'OTP', locale: 'th', country: '' }, all)).toBe(
      false,
    );
    expect(keepsEnglishFallback(t('1'), { smsType: 'OTP', locale: 'en', country: 'th' }, all)).toBe(
      false,
    );
    expect(
      keepsEnglishFallback(t('1'), { smsType: 'MARKETING', locale: 'en', country: '' }, all),
    ).toBe(false);
    // not the last one: any edit keeps it
    expect(
      keepsEnglishFallback(t('1'), { smsType: 'OTP', locale: 'th', country: '' }, [t('1'), t('2')]),
    ).toBe(true);
  });
});
