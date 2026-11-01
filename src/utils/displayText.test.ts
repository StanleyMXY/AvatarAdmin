import { describe, expect, it } from 'vitest';
import { adminText, codeText, countText, instantText, orDash } from './displayText';

const intl = {
  messages: { 'x.OPEN': 'Open' } as Record<string, unknown>,
  formatMessage: ({ id }: { id: string }) => (id === 'x.OPEN' ? 'Open' : id),
};

describe('codeText', () => {
  it('gives the text of a code that the language file knows, else the code itself, never nothing', () => {
    expect(codeText(intl, 'x', 'OPEN')).toBe('Open');
    expect(codeText(intl, 'x', 'NEW_KIND')).toBe('NEW_KIND');
    expect(codeText(intl, 'x', '')).toBe('');
    expect(codeText(intl, 'x', 5)).toBe('');
    expect(codeText(intl, 'x', null)).toBe('');
  });

  it('writes a code that is not text out as text only when it is told to', () => {
    const out = { writeOut: true };
    expect(codeText(intl, 'x', 5, out)).toBe('5');
    expect(codeText(intl, 'x', { a: 1 }, out)).toBe('{"a":1}');
    expect(codeText(intl, 'x', null, out)).toBe('');
    expect(codeText(intl, 'x', undefined, out)).toBe('');
    expect(codeText(intl, 'x', 'OPEN', out)).toBe('Open');
    expect(codeText(intl, 'x', 'NEW_KIND', out)).toBe('NEW_KIND');
    // A number whose digits are a known code takes the text of that code.
    expect(codeText({ ...intl, messages: { 'x.5': 'Five' } }, 'x', 5, out)).toBe('x.5');
  });

  it('does not take the name of an object property for a known code', () => {
    expect(codeText(intl, 'x', 'constructor')).toBe('constructor');
    expect(codeText(intl, 'x', '__proto__')).toBe('__proto__');
    expect(codeText(intl, '', 'constructor')).toBe('constructor');
    // An empty code is nothing, even where the language file has a text for the bare prefix.
    expect(codeText({ ...intl, messages: { 'x.': 'Bare' } }, 'x', '')).toBe('');
  });
});

describe('countText', () => {
  it('writes thousands in the language of the page, and a dash for what is not a number', () => {
    expect(countText('en-US', 1234567)).toBe('1,234,567');
    expect(countText('en-US', 0)).toBe('0');
    expect(countText('en-US', '12')).toBe('—');
    expect(countText('en-US', null)).toBe('—');
    expect(countText('en-US', undefined)).toBe('—');
    for (const value of [{}, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(countText('en-US', value)).toBe('—');
    }
    expect(countText('th-TH', 1234567)).toBe('1,234,567');
    expect(countText('es-ES', 12345)).toBe('12.345');
  });
});

describe('instantText', () => {
  it('writes an instant and a dash for nothing or for what is not text', () => {
    expect(instantText('en-US', '')).toBe('—');
    expect(instantText('en-US', null)).toBe('—');
    expect(instantText('en-US', 12)).toBe('—');
    expect(instantText('en-US', '2026-10-25T10:00:00Z')).toMatch(/2026/);
  });
});

describe('orDash', () => {
  it('writes any type as text and a dash for nothing', () => {
    expect(orDash('abc')).toBe('abc');
    expect(orDash(42)).toBe('42');
    expect(orDash({ a: 1 })).toBe('{"a":1}');
    expect(orDash('')).toBe('—');
    expect(orDash(null)).toBe('—');
    expect(orDash(undefined)).toBe('—');
    expect(orDash(0)).toBe('0');
  });
});

describe('adminText', () => {
  it('writes the name, else the first eight characters of the id, else a dash', () => {
    expect(adminText('Aroon สมชาย', 'abcdef0123456789')).toBe('Aroon สมชาย');
    expect(adminText(null, 'abcdef0123456789')).toBe('abcdef01');
    expect(adminText('', 'abcdef0123456789')).toBe('abcdef01');
    expect(adminText(undefined, 12345678901)).toBe('12345678');
    expect(adminText('', '')).toBe('—');
    expect(adminText(null, null)).toBe('—');
  });
});
