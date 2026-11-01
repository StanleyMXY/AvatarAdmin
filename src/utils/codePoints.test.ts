import { describe, expect, it } from 'vitest';
import { clipCodePoints, countCodePoints, lengthWithin } from './codePoints';

describe('countCodePoints', () => {
  it('counts a code point outside the BMP once, not as two UTF-16 units', () => {
    expect('😀'.length).toBe(2);
    expect(countCodePoints('😀')).toBe(1);
    expect(countCodePoints('a😀b')).toBe(3);
  });

  it('counts by code point, not by grapheme', () => {
    // Thai consonant plus a combining vowel mark: two code points, one grapheme.
    expect(countCodePoints('ก็')).toBe(2);
    // A regional-indicator pair (a flag): two code points.
    expect(countCodePoints('🇹🇭')).toBe(2);
    // Man, ZWJ, woman, ZWJ, girl: five code points.
    expect(countCodePoints('👨\u200D👩\u200D👧')).toBe(5);
  });

  it('counts Arabic letters and the lam-alef ligature character by code point', () => {
    expect(countCodePoints('مرحبا')).toBe(5);
    expect(countCodePoints('لا')).toBe(2);
    expect(countCodePoints('ﻻ')).toBe(1);
  });

  it('counts text in the other target languages', () => {
    expect(countCodePoints('Terima kasih')).toBe(12);
    expect(countCodePoints('Xin chào')).toBe(8);
    expect(countCodePoints('¿Cómo estás?')).toBe(12);
    expect(countCodePoints('你好，世界')).toBe(5);
    expect(countCodePoints('สวัสดี')).toBe(6);
  });

  it('handles the empty string and a long string without spaces', () => {
    expect(countCodePoints('')).toBe(0);
    expect(countCodePoints('x'.repeat(100000))).toBe(100000);
  });

  it('counts a lone surrogate as one code point', () => {
    expect(countCodePoints('\uD800')).toBe(1);
  });
});

describe('lengthWithin', () => {
  it('trims with the contract definition before counting', () => {
    expect(lengthWithin(' a ', 1, 1)).toBe(true);
    expect(lengthWithin('\u3000a\u0085', 1, 1)).toBe(true);
    // The zero-width space is not whitespace, so it counts.
    expect(lengthWithin('\u200Ba', 1, 1)).toBe(false);
  });

  it('gives length 0 to an all-whitespace string', () => {
    expect(lengthWithin('   \t\u3000', 1, 10)).toBe(false);
    expect(lengthWithin('   \t\u3000', 0, 10)).toBe(true);
  });

  it('accepts both bounds and rejects one past either', () => {
    expect(lengthWithin('ab', 2, 4)).toBe(true);
    expect(lengthWithin('abcd', 2, 4)).toBe(true);
    expect(lengthWithin('a', 2, 4)).toBe(false);
    expect(lengthWithin('abcde', 2, 4)).toBe(false);
  });

  it('counts emoji as one each, so 4 emoji fit a limit of 4', () => {
    expect(lengthWithin('😀😀😀😀', 1, 4)).toBe(true);
    expect(lengthWithin('😀😀😀😀😀', 1, 4)).toBe(false);
  });

  it('counts Thai combining marks and Arabic ligature characters one by one', () => {
    expect(lengthWithin('ก็ก็', 1, 4)).toBe(true);
    expect(lengthWithin('ก็ก็ก', 1, 4)).toBe(false);
    expect(lengthWithin('لالا', 1, 4)).toBe(true);
    expect(lengthWithin('لالالا', 1, 4)).toBe(false);
  });
});

describe('clipCodePoints', () => {
  it('leaves a text that fits as it is, also at exactly the limit', () => {
    expect(clipCodePoints('abc', 3)).toBe('abc');
    expect(clipCodePoints('', 3)).toBe('');
  });

  it('cuts a longer text to the limit and adds an ellipsis', () => {
    expect(clipCodePoints('abcdef', 3)).toBe('abc…');
    expect(clipCodePoints('ก'.repeat(5000), 60)).toBe(`${'ก'.repeat(60)}…`);
  });

  it('counts code points, so an emoji is not cut in half', () => {
    expect(clipCodePoints('😀😀😀😀', 2)).toBe('😀😀…');
    expect(clipCodePoints('😀😀', 2)).toBe('😀😀');
  });
});
