import { describe, expect, it } from 'vitest';
import {
  apiUrlProblem,
  buildChannelBody,
  countryCodeProblem,
  credentialsProblem,
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
    credentials: {} as Record<string, string | undefined>,
    extConfig: '{"appId":"a","senderIds":{"TH":"AV"}}',
    countries: ['th', 'vn'],
    smsType: 'OTP' as const,
    priority: 5,
    enabled: true,
  };
  it('leaves the credentials out when nothing is typed, or every field is blank, on a create and on an update', () => {
    const blank = String.fromCharCode(0x3000);
    const names = ['apiKey', 'apiSecret'];
    expect('credentials' in buildChannelBody(values, 'create', names)).toBe(false);
    expect('credentials' in buildChannelBody({ ...values, credentials: {} }, 'create', names)).toBe(
      false,
    );
    expect(
      'credentials' in
        buildChannelBody(
          { ...values, credentials: { apiKey: '   ', apiSecret: blank } },
          'create',
          names,
        ),
    ).toBe(false);
    expect('credentials' in buildChannelBody(values, 'update', names)).toBe(false);
    expect(
      'credentials' in buildChannelBody({ ...values, credentials: undefined }, 'update', names),
    ).toBe(false);
  });
  it('sends exactly the names of the provider once, as text without the blanks around them, when every one is filled', () => {
    expect(
      buildChannelBody(
        { ...values, credentials: { apiKey: ' s3cret ', apiSecret: 'ñandú ผู้ใช้ مفتاح' } },
        'update',
        ['apiKey', 'apiSecret'],
      ),
    ).toMatchObject({ credentials: { apiKey: 's3cret', apiSecret: 'ñandú ผู้ใช้ مفتاح' } });
  });
  it('sends no name the provider does not declare, whatever the form holds (a value typed for another provider is not carried over)', () => {
    const body = buildChannelBody(
      { ...values, credentials: { apiKey: 'k', old: 'typed for the provider before' } },
      'update',
      ['apiKey'],
    ) as { credentials: Record<string, unknown> };
    expect(body.credentials).toEqual({ apiKey: 'k' });
  });
  it('sends no credentials when only some of the names are filled (the form refuses that first), or when the provider declares none', () => {
    expect(
      'credentials' in
        buildChannelBody({ ...values, credentials: { apiKey: 'k' } }, 'update', [
          'apiKey',
          'apiSecret',
        ]),
    ).toBe(false);
    expect(
      'credentials' in buildChannelBody({ ...values, credentials: { apiKey: 'k' } }, 'update', []),
    ).toBe(false);
    expect(
      'credentials' in buildChannelBody({ ...values, credentials: { apiKey: 'k' } }, 'update'),
    ).toBe(false);
  });
  it('never sends a null, a missing or a number as a value or a name', () => {
    const body = buildChannelBody({ ...values, credentials: { a: 'b' } }, 'update', ['a']) as {
      credentials: Record<string, unknown>;
    };
    for (const [name, value] of Object.entries(body.credentials)) {
      expect(typeof name).toBe('string');
      expect(name).not.toBe('');
      expect(typeof value).toBe('string');
    }
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
  it('sends {} on an update and null on a create for an empty extension box, and an empty list for all countries', () => {
    // On an update null means "unchanged" (answers 6, 78): only {} clears the extension.
    expect(buildChannelBody({ ...values, extConfig: '  ', countries: [] }, 'update')).toMatchObject(
      {
        extConfig: {},
        countries: [],
      },
    );
    expect(buildChannelBody({ ...values, extConfig: '  ', countries: [] }, 'create')).toMatchObject(
      {
        extConfig: null,
        countries: [],
      },
    );
  });
  it('never sends null for a field of an update: null would keep the stored value', () => {
    const body = buildChannelBody({ ...values, extConfig: '', countries: [] }, 'update');
    for (const [name, value] of Object.entries(body)) {
      expect(value, name).not.toBeNull();
      expect(value, name).not.toBeUndefined();
    }
  });
});

describe('the credential fields of a provider', () => {
  const names = ['apiKey', 'apiSecret'];
  it('has no problem when every field is filled, or when all are blank and the saved ones may stay', () => {
    expect(credentialsProblem({ apiKey: 'a', apiSecret: 'b' }, names, false)).toBeNull();
    expect(credentialsProblem({}, names, false)).toBeNull();
    expect(credentialsProblem(undefined, names, false)).toBeNull();
    expect(credentialsProblem({ apiKey: ' ', apiSecret: '' }, names, false)).toBeNull();
  });
  it('wants the rest when only some are filled, and names the ones that are missing', () => {
    expect(credentialsProblem({ apiKey: 'a' }, names, false)).toEqual({
      kind: 'INCOMPLETE',
      missing: ['apiSecret'],
    });
    expect(credentialsProblem({ apiKey: ' ', apiSecret: 'b' }, names, false)).toEqual({
      kind: 'INCOMPLETE',
      missing: ['apiKey'],
    });
  });
  it('wants every field when the saved credentials cannot stay (another provider), and names all of them', () => {
    expect(credentialsProblem({}, names, true)).toEqual({ kind: 'REQUIRED', missing: names });
    expect(credentialsProblem({ apiKey: 'a' }, names, true)).toEqual({
      kind: 'INCOMPLETE',
      missing: ['apiSecret'],
    });
    expect(credentialsProblem({ apiKey: 'a', apiSecret: 'b' }, names, true)).toBeNull();
  });
  it('has no problem for a provider that needs none, or one that is not known', () => {
    expect(credentialsProblem({ x: 'typed' }, [], true)).toBeNull();
    expect(credentialsProblem({}, [], true)).toBeNull();
  });
});
