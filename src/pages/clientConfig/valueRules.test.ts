import { describe, expect, it } from 'vitest';
import { cleanValue, validateValue } from './valueRules';

const IDEOGRAPHIC = String.fromCharCode(0x3000);
const NEL = String.fromCharCode(0x85);

describe('URL values (contract 26.1, link rule 1.7)', () => {
  it('accepts an https link', () => {
    expect(validateValue('URL', 'https://example.com/privacy')).toBeNull();
    expect(validateValue('URL', 'https://example.com:8443/a?b=1#c')).toBeNull();
    expect(validateValue('URL', 'https://[2001:db8::1]/x')).toBeNull();
  });

  it('refuses http://, and says it is the scheme', () => {
    expect(validateValue('URL', 'http://example.com')).toBe('NOT_HTTPS');
    expect(validateValue('URL', 'HTTPS://example.com')).toBe('NOT_HTTPS');
    expect(validateValue('URL', 'example.com')).toBe('NOT_HTTPS');
  });

  it('refuses an empty value and one that is only whitespace: an empty URL cannot be saved', () => {
    expect(validateValue('URL', '')).toBe('EMPTY_NOT_ALLOWED');
    expect(validateValue('URL', `  ${IDEOGRAPHIC}\n`)).toBe('EMPTY_NOT_ALLOWED');
    expect(validateValue('URL', undefined)).toBe('EMPTY_NOT_ALLOWED');
    expect(validateValue('URL', null)).toBe('EMPTY_NOT_ALLOWED');
  });

  it('refuses what the link rule refuses, by its reason', () => {
    expect(validateValue('URL', 'https://host:/x')).toBe('INVALID_PORT');
    expect(validateValue('URL', 'https://user@host/x')).toBe('INVALID_HOST');
    expect(validateValue('URL', 'https://münchen.de/x')).toBe('INVALID_HOST');
    expect(validateValue('URL', 'https://host/ä')).toBe('INVALID_PATH');
    expect(validateValue('URL', 'https://host/a b')).toBe('INVALID_PATH');
    expect(validateValue('URL', `https://host/${'a'.repeat(2048)}`)).toBe('TOO_LONG');
  });

  it('judges the trimmed text, which is also what is saved', () => {
    expect(validateValue('URL', '  https://example.com/x \n')).toBeNull();
    expect(cleanValue('URL', '  https://example.com/x \n')).toBe('https://example.com/x');
  });

  it('trims with the contract definition, not String.trim: a U+0085 at an end is whitespace', () => {
    expect(validateValue('URL', `${NEL}https://example.com/x${NEL}`)).toBeNull();
    expect(cleanValue('URL', `${NEL}https://example.com/x${NEL}`)).toBe('https://example.com/x');
    expect(validateValue('EMAIL', `${NEL}help@example.com${NEL}`)).toBeNull();
  });

  it('refuses a value that is not text', () => {
    expect(validateValue('URL', 5)).toBe('EMPTY_NOT_ALLOWED');
    expect(validateValue('URL', true)).toBe('EMPTY_NOT_ALLOWED');
    expect(validateValue('URL', ['https://a.example'])).toBe('EMPTY_NOT_ALLOWED');
  });
});

describe('EMAIL values', () => {
  it('accepts an address', () => {
    expect(validateValue('EMAIL', 'help@example.com')).toBeNull();
    expect(validateValue('EMAIL', ' help@example.com ')).toBeNull();
    expect(cleanValue('EMAIL', ' help@example.com ')).toBe('help@example.com');
  });

  it('refuses an empty value', () => {
    expect(validateValue('EMAIL', '')).toBe('EMPTY_NOT_ALLOWED');
    expect(validateValue('EMAIL', '   ')).toBe('EMPTY_NOT_ALLOWED');
  });

  it('refuses text that is not an address', () => {
    for (const text of [
      'help',
      'help@',
      '@example.com',
      'help@example',
      'a b@example.com',
      'a@b@example.com',
      'a@exa mple.com',
      `a@${'b'.repeat(250)}.com`,
    ]) {
      expect(validateValue('EMAIL', text), text).toBe('INVALID_EMAIL');
    }
  });
});

describe('STRING values', () => {
  it('accepts any text, also an empty one (an empty text is a value for a STRING)', () => {
    expect(validateValue('STRING', '')).toBeNull();
    expect(validateValue('STRING', 'Join me 🎉')).toBeNull();
    expect(validateValue('STRING', 'ก็'.repeat(2000))).toBeNull();
  });

  it('keeps the text exactly as typed', () => {
    expect(cleanValue('STRING', '  hello \n')).toBe('  hello \n');
  });

  it('refuses a value that is not text', () => {
    expect(validateValue('STRING', 3)).toBe('EMPTY_NOT_ALLOWED');
    expect(validateValue('STRING', null)).toBe('EMPTY_NOT_ALLOWED');
  });
});

describe('BOOLEAN values', () => {
  it('accepts true and false', () => {
    expect(validateValue('BOOLEAN', true)).toBeNull();
    expect(validateValue('BOOLEAN', false)).toBeNull();
  });

  it('refuses anything else', () => {
    for (const value of ['true', 1, 0, null, undefined]) {
      expect(validateValue('BOOLEAN', value), String(value)).toBe('NOT_BOOLEAN');
    }
  });
});

describe('INT values', () => {
  it('accepts a whole number, also zero and a negative one', () => {
    for (const value of [0, 1, -3, 200, 2 ** 31])
      expect(validateValue('INT', value), String(value)).toBeNull();
  });

  it('refuses a number with a fraction, NaN, infinity and an unsafe integer', () => {
    for (const value of [1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 60]) {
      expect(validateValue('INT', value), String(value)).toBe('NOT_AN_INTEGER');
    }
  });

  it('refuses nothing typed and text', () => {
    expect(validateValue('INT', null)).toBe('EMPTY_NOT_ALLOWED');
    expect(validateValue('INT', undefined)).toBe('EMPTY_NOT_ALLOWED');
    expect(validateValue('INT', '12')).toBe('NOT_AN_INTEGER');
  });
});

describe('STRING_LIST values', () => {
  it('are never accepted: the system derives them', () => {
    expect(validateValue('STRING_LIST', ['en'])).toBe('READ_ONLY');
  });
});

describe('a type the page does not know', () => {
  it('is not accepted either, and is left as it is', () => {
    expect(validateValue('TIMESTAMP', 'x')).toBe('READ_ONLY');
    expect(cleanValue('TIMESTAMP', 'x')).toBe('x');
  });
});
