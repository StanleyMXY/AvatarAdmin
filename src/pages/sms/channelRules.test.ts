import { describe, expect, it } from 'vitest';
import {
  apiUrlProblem,
  buildChannelBody,
  countryCodeProblem,
  normalizeCountries,
} from './channelRules';

describe('the address of a channel', () => {
  const hosts = ['sms.example.com', 'API.Example.org'];
  it('accepts https on a listed host, whatever the case of the host', () => {
    expect(apiUrlProblem('https://sms.example.com/v1/send', hosts)).toBeNull();
    expect(apiUrlProblem('https://SMS.example.com:8443/x?y=1', hosts)).toBeNull();
    expect(apiUrlProblem('https://api.example.org', hosts)).toBeNull();
  });
  it('names the problem: not https, not an address, a host that is not listed', () => {
    expect(apiUrlProblem('http://sms.example.com/', hosts)).toBe('NOT_HTTPS');
    expect(apiUrlProblem('ftp://sms.example.com/', hosts)).toBe('NOT_HTTPS');
    expect(apiUrlProblem('sms.example.com', hosts)).toBe('NOT_AN_URL');
    expect(apiUrlProblem('', hosts)).toBe('NOT_AN_URL');
    expect(apiUrlProblem('https://evil.example.net/', hosts)).toBe('HOST_NOT_ALLOWED');
    expect(apiUrlProblem('https://sms.example.com.evil.net/', hosts)).toBe('HOST_NOT_ALLOWED');
    expect(apiUrlProblem('https://user:pw@sms.example.com/', hosts)).toBe('HAS_USER_INFO');
  });
  it('does not check the host when the provider lists none: the backend decides', () => {
    expect(apiUrlProblem('https://anything.example.net/', [])).toBeNull();
    expect(apiUrlProblem('https://anything.example.net/', undefined)).toBeNull();
    expect(apiUrlProblem('http://anything.example.net/', [])).toBe('NOT_HTTPS');
  });
});

describe('country codes', () => {
  it('are two letters, in either case, and are written in capitals', () => {
    expect(countryCodeProblem('TH')).toBeNull();
    expect(countryCodeProblem('th')).toBeNull();
    expect(countryCodeProblem('THA')).toBe('INVALID');
    expect(countryCodeProblem('T')).toBe('INVALID');
    expect(countryCodeProblem('1A')).toBe('INVALID');
    expect(countryCodeProblem('ไทย')).toBe('INVALID');
    expect(normalizeCountries(['th', ' vn ', 'TH', 'id'])).toEqual(['TH', 'VN', 'ID']);
    expect(normalizeCountries(undefined)).toEqual([]);
    expect(normalizeCountries(null)).toEqual([]);
  });
});

describe('the body of a channel', () => {
  const values = {
    channelCode: ' gw_th ',
    name: '  ช่อง  ',
    providerCode: 'gateway-a',
    apiUrl: ' https://sms.example.com/v1 ',
    credentials: '',
    extConfig: '{"appId":"a","senderIds":{"TH":"AV"}}',
    countries: ['th', 'vn'],
    smsType: 'OTP' as const,
    priority: 5,
    enabled: true,
  };
  it('leaves the credentials out when the box is empty or only blanks, on a create and on an update', () => {
    expect('credentials' in buildChannelBody(values, 'create')).toBe(false);
    expect('credentials' in buildChannelBody({ ...values, credentials: '   ' }, 'create')).toBe(
      false,
    );
    expect('credentials' in buildChannelBody(values, 'update')).toBe(false);
    expect('credentials' in buildChannelBody({ ...values, credentials: undefined }, 'update')).toBe(
      false,
    );
    expect(
      'credentials' in
        buildChannelBody({ ...values, credentials: String.fromCharCode(0x3000) }, 'update'),
    ).toBe(false);
  });
  it('sends typed credentials once, without the blanks around them', () => {
    expect(buildChannelBody({ ...values, credentials: ' s3cret ' }, 'update')).toMatchObject({
      credentials: 's3cret',
    });
  });
  it('has the code and the switch on a create only, and the countries in capitals', () => {
    expect(buildChannelBody(values, 'create')).toEqual({
      channelCode: 'gw_th',
      name: 'ช่อง',
      providerCode: 'gateway-a',
      apiUrl: 'https://sms.example.com/v1',
      extConfig: { appId: 'a', senderIds: { TH: 'AV' } },
      countries: ['TH', 'VN'],
      smsType: 'OTP',
      priority: 5,
      enabled: true,
    });
    const update = buildChannelBody(values, 'update');
    expect('channelCode' in update).toBe(false);
    expect('enabled' in update).toBe(false);
  });
  it('sends null for an empty extension box and an empty list for all countries', () => {
    expect(buildChannelBody({ ...values, extConfig: '  ', countries: [] }, 'update')).toMatchObject(
      {
        extConfig: null,
        countries: [],
      },
    );
  });
});
