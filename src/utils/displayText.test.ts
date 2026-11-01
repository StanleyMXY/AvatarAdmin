import { describe, expect, it } from 'vitest';
import { codeText, countText, instantText, orDash } from './displayText';

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
});

describe('countText', () => {
  it('writes thousands in the language of the page, and a dash for what is not a number', () => {
    expect(countText('en-US', 1234567)).toBe('1,234,567');
    expect(countText('en-US', 0)).toBe('0');
    expect(countText('en-US', '12')).toBe('—');
    expect(countText('en-US', null)).toBe('—');
    expect(countText('en-US', undefined)).toBe('—');
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
  });
});
