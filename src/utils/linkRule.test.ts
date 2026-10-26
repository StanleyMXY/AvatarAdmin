import { describe, expect, it } from 'vitest';
import { validateServerLink } from './linkRule';

const REASONS = ['NOT_HTTPS', 'INVALID_HOST', 'INVALID_PORT', 'INVALID_PATH', 'TOO_LONG'];

function reject(value: string, opts?: { maxLength?: number }) {
  const result = validateServerLink(value, opts);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('unreachable');
  expect(REASONS).toContain(result.reasonKey);
  return result.reasonKey;
}

function accept(value: string, opts?: { maxLength?: number }) {
  expect(validateServerLink(value, opts)).toEqual({ ok: true });
}

describe('validateServerLink: scheme (contract 1.7)', () => {
  it('accepts a lower-case https link', () => accept('https://example.com'));

  it('rejects upper-case HTTPS://', () => {
    expect(reject('HTTPS://example.com')).toBe('NOT_HTTPS');
  });

  it('rejects http, other schemes and a missing scheme', () => {
    expect(reject('http://example.com')).toBe('NOT_HTTPS');
    expect(reject('ftp://example.com')).toBe('NOT_HTTPS');
    expect(reject('example.com')).toBe('NOT_HTTPS');
    expect(reject('//example.com')).toBe('NOT_HTTPS');
    expect(reject('')).toBe('NOT_HTTPS');
  });

  it('rejects anything before the scheme, a leading space first', () => {
    expect(reject(' https://example.com')).toBe('NOT_HTTPS');
    expect(reject('\thttps://example.com')).toBe('NOT_HTTPS');
    expect(reject('​https://example.com')).toBe('NOT_HTTPS');
  });
});

describe('validateServerLink: host', () => {
  it('accepts letters, digits, dot, underscore and hyphen, starting with a letter or digit', () => {
    accept('https://a.example.com');
    accept('https://my-host_1.example.com');
    accept('https://1.2.3.4');
    accept('https://9lives.example');
    accept('https://localhost');
  });

  it('accepts an internationalised domain only in punycode', () => {
    accept('https://xn--bcher-kva.example');
    expect(reject('https://bücher.example')).toBe('INVALID_HOST');
    expect(reject('https://ตัวอย่าง.ไทย')).toBe('INVALID_HOST');
    expect(reject('https://مثال.إختبار')).toBe('INVALID_HOST');
  });

  it('accepts an IPv6 address in brackets, with and without port and path', () => {
    accept('https://[2001:db8::1]');
    accept('https://[::1]:8443/x');
    accept('https://[2001:db8::1]/a?b=c');
  });

  it('rejects an IPv6 address without brackets or with broken brackets', () => {
    expect(reject('https://2001:db8::1/')).toBe('INVALID_PORT');
    expect(reject('https://[2001:db8::1')).toBe('INVALID_HOST');
    expect(reject('https://[]')).toBe('INVALID_HOST');
    expect(reject('https://[zz]')).toBe('INVALID_HOST');
  });

  it('rejects an empty host', () => {
    expect(reject('https://')).toBe('INVALID_HOST');
    expect(reject('https:///x')).toBe('INVALID_HOST');
    expect(reject('https://:443/x')).toBe('INVALID_HOST');
  });

  it('rejects user information', () => {
    expect(reject('https://user@example.com')).toBe('INVALID_HOST');
    expect(reject('https://user:pw@example.com/x')).toBe('INVALID_HOST');
  });

  it('rejects a host that starts with a dot or hyphen or holds other characters', () => {
    expect(reject('https://.example.com')).toBe('INVALID_HOST');
    expect(reject('https://-example.com')).toBe('INVALID_HOST');
    expect(reject('https://exa mple.com')).toBe('INVALID_HOST');
    expect(reject('https://exa\tmple.com')).toBe('INVALID_HOST');
    expect(reject('https://example.com‮')).toBe('INVALID_HOST');
    expect(reject('https://exa*mple.com')).toBe('INVALID_HOST');
  });
});

describe('validateServerLink: port', () => {
  it('accepts 1 to 5 digits', () => {
    accept('https://example.com:1');
    accept('https://example.com:443/x');
    accept('https://example.com:65535');
    accept('https://example.com:99999');
  });

  it('rejects an empty port', () => {
    expect(reject('https://example.com:/x')).toBe('INVALID_PORT');
    expect(reject('https://example.com:')).toBe('INVALID_PORT');
  });

  it('rejects six digits and non-digits', () => {
    expect(reject('https://example.com:123456')).toBe('INVALID_PORT');
    expect(reject('https://example.com:80a')).toBe('INVALID_PORT');
    expect(reject('https://example.com:-1')).toBe('INVALID_PORT');
  });
});

describe('validateServerLink: path, query, fragment', () => {
  it('accepts printable ASCII, with percent-encoding for everything else', () => {
    accept('https://example.com/');
    accept('https://example.com/a/b/c.html?x=1&y=%E4%BD%A0#frag');
    accept('https://example.com/caf%C3%A9');
    accept('https://example.com?x=1');
    accept('https://example.com#top');
    accept('https://example.com/!"#$%&\'()*+,-./:;<=>?@[]^_`{|}~');
  });

  it('rejects non-ASCII characters in the path, query or fragment', () => {
    expect(reject('https://example.com/café')).toBe('INVALID_PATH');
    expect(reject('https://example.com/ไทย')).toBe('INVALID_PATH');
    expect(reject('https://example.com/?q=مرحبا')).toBe('INVALID_PATH');
    expect(reject('https://example.com/#ñ')).toBe('INVALID_PATH');
    expect(reject('https://example.com/😀')).toBe('INVALID_PATH');
  });

  it('rejects a backslash anywhere after the host', () => {
    expect(reject('https://example.com/a\\b')).toBe('INVALID_PATH');
    expect(reject('https://example.com\\a')).toBe('INVALID_HOST');
  });

  it('rejects whitespace, control and invisible characters', () => {
    expect(reject('https://example.com/a b')).toBe('INVALID_PATH');
    expect(reject('https://example.com/a\tb')).toBe('INVALID_PATH');
    expect(reject('https://example.com/a\nb')).toBe('INVALID_PATH');
    expect(reject('https://example.com/a\u0000b')).toBe('INVALID_PATH');
    expect(reject('https://example.com/a\u007Fb')).toBe('INVALID_PATH');
    expect(reject('https://example.com/‮evil')).toBe('INVALID_PATH');
    expect(reject('https://example.com/a​b')).toBe('INVALID_PATH');
    expect(reject('https://example.com/ ')).toBe('INVALID_PATH');
  });
});

describe('validateServerLink: total length', () => {
  const link = (total: number) =>
    `https://example.com/${'a'.repeat(total - 'https://example.com/'.length)}`;

  it('accepts 2048 characters and rejects 2049 with TOO_LONG by default', () => {
    expect(link(2048)).toHaveLength(2048);
    accept(link(2048));
    expect(link(2049)).toHaveLength(2049);
    expect(reject(link(2049))).toBe('TOO_LONG');
  });

  it('takes another limit from the options', () => {
    accept(link(100), { maxLength: 100 });
    expect(reject(link(101), { maxLength: 100 })).toBe('TOO_LONG');
    accept(link(3000), { maxLength: 4096 });
  });

  it('gives a structural reason before the length reason', () => {
    expect(reject(`http://example.com/${'a'.repeat(3000)}`)).toBe('NOT_HTTPS');
    expect(reject(`https://example.com/é${'a'.repeat(3000)}`)).toBe('INVALID_PATH');
  });
});

describe('validateServerLink: every rejection carries one of the five link reason codes', () => {
  const bad = [
    '',
    ' ',
    'https:',
    'https:/',
    'https://[',
    'https://a b',
    'https://a:b',
    'https://a/\u0001',
    'https://a/\uD83D',
    `https://a/${'é'.repeat(5)}`,
    'javascript:alert(1)',
    'https://example.com/\r\n',
  ];
  it.each(bad)('rejects %j with a known code', (value) => {
    reject(value);
  });
});
