import { describe, expect, it } from 'vitest';
import { trimSpec } from './trimSpec';

// Contract section 1.9: the 29 code points that Python's str.strip() removes.
const SPEC_WHITESPACE: number[] = [
  ...range(0x09, 0x0d),
  ...range(0x1c, 0x1f),
  0x20,
  0x85,
  0xa0,
  0x1680,
  ...range(0x2000, 0x200a),
  0x2028,
  0x2029,
  0x202f,
  0x205f,
  0x3000,
];

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

describe('trimSpec', () => {
  it('lists exactly 29 code points in this test', () => {
    expect(new Set(SPEC_WHITESPACE).size).toBe(29);
    expect(SPEC_WHITESPACE).toHaveLength(29);
  });

  it.each(SPEC_WHITESPACE.map((cp) => [`U+${cp.toString(16).toUpperCase().padStart(4, '0')}`, cp]))(
    'removes %s at both ends',
    (_label, cp) => {
      const ch = String.fromCodePoint(cp as number);
      expect(trimSpec(`${ch}x${ch}`)).toBe('x');
      expect(trimSpec(`${ch}${ch}x${ch}${ch}`)).toBe('x');
    },
  );

  it('removes a code point if and only if it is one of the 29, checked over the whole BMP', () => {
    const inSet = new Set(SPEC_WHITESPACE);
    const wrong: number[] = [];
    for (let cp = 0; cp <= 0xffff; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      const ch = String.fromCodePoint(cp);
      const removed = trimSpec(`${ch}x${ch}`) === 'x';
      if (removed !== inSet.has(cp)) wrong.push(cp);
    }
    expect(wrong).toEqual([]);
  });

  it('keeps zero-width space, BOM and direction marks (format characters are not whitespace here)', () => {
    for (const ch of ['\u200B', '\uFEFF', '\u200E', '\u200F', '\u202E', '\u2060', '\u180E']) {
      expect(trimSpec(`${ch}x${ch}`)).toBe(`${ch}x${ch}`);
    }
  });

  it('differs from String.prototype.trim where the contract says the built-in is wrong', () => {
    // trim() leaves these four behind ...
    expect('\u0085x'.trim()).toBe('\u0085x');
    expect('\u001Cx'.trim()).toBe('\u001Cx');
    expect('\u001Fx'.trim()).toBe('\u001Fx');
    // ... and trimSpec removes them
    expect(trimSpec('\u0085x')).toBe('x');
    expect(trimSpec('\u001Cx')).toBe('x');
    expect(trimSpec('\u001Fx')).toBe('x');
    // trim() removes the BOM, trimSpec keeps it
    expect('\uFEFFx'.trim()).toBe('x');
    expect(trimSpec('\uFEFFx')).toBe('\uFEFFx');
  });

  it('only touches the ends, never the middle', () => {
    expect(trimSpec(' a \u3000 b\u00A0c ')).toBe('a \u3000 b\u00A0c');
    expect(trimSpec('a\tb')).toBe('a\tb');
  });

  it('turns an all-whitespace or empty string into the empty string', () => {
    expect(trimSpec('')).toBe('');
    expect(trimSpec(' \t\n\u3000\u0085')).toBe('');
  });

  it('keeps text in other scripts intact around the removed ends', () => {
    expect(trimSpec('\u3000ภาษาไทย\u00A0')).toBe('ภาษาไทย');
    expect(trimSpec(' مرحبا بالعالم\u2003')).toBe('مرحبا بالعالم');
    expect(trimSpec('\t😀\n')).toBe('😀');
    expect(trimSpec(' Xin chào ')).toBe('Xin chào');
  });

  it('is idempotent', () => {
    const once = trimSpec(' \u2003 hola \u0085');
    expect(trimSpec(once)).toBe(once);
  });
});
