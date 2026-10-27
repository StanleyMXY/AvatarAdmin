import { describe, expect, it } from 'vitest';
import { contrastRatio, pickOnPrimary } from './contrast';

describe('contrastRatio', () => {
  it('gives 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#0ABAB5', '#0ABAB5')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#FFFFFF', '#0ABAB5')).toBeCloseTo(
      contrastRatio('#0ABAB5', '#FFFFFF'),
      10,
    );
  });

  it('matches the spec figures: white on #0ABAB5 about 2.4, #06201F on it about 7', () => {
    expect(contrastRatio('#FFFFFF', '#0ABAB5')).toBeGreaterThan(2.3);
    expect(contrastRatio('#FFFFFF', '#0ABAB5')).toBeLessThan(2.5);
    expect(contrastRatio('#06201F', '#0ABAB5')).toBeGreaterThan(6.9);
    expect(contrastRatio('#06201F', '#0ABAB5')).toBeLessThan(7.2);
  });

  it('accepts lower case and three-digit hex', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#0abab5', '#FFFFFF')).toBeCloseTo(
      contrastRatio('#0ABAB5', '#FFFFFF'),
      10,
    );
  });

  it('throws on a value that is not a hex colour', () => {
    expect(() => contrastRatio('teal', '#000000')).toThrow(TypeError);
    expect(() => contrastRatio('#12345', '#000000')).toThrow(TypeError);
    expect(() => contrastRatio('#GGGGGG', '#000000')).toThrow(TypeError);
    expect(() => contrastRatio('', '#000000')).toThrow(TypeError);
  });
});

describe('pickOnPrimary', () => {
  it('puts the dark text on the default primary colour, at 4.5 or better', () => {
    const text = pickOnPrimary('#0ABAB5');
    expect(text).toBe('#06201F');
    expect(contrastRatio(text, '#0ABAB5')).toBeGreaterThanOrEqual(4.5);
  });

  it('also uses the dark text on the hover colour', () => {
    expect(pickOnPrimary('#3DCBC7')).toBe('#06201F');
  });

  it('uses white on a dark primary colour', () => {
    expect(pickOnPrimary('#0B3B8C')).toBe('#FFFFFF');
    expect(pickOnPrimary('#089A96')).toBe(
      contrastRatio('#FFFFFF', '#089A96') > contrastRatio('#06201F', '#089A96')
        ? '#FFFFFF'
        : '#06201F',
    );
    expect(pickOnPrimary('#000000')).toBe('#FFFFFF');
  });

  it('uses the dark text on white', () => {
    expect(pickOnPrimary('#FFFFFF')).toBe('#06201F');
  });

  it('always picks whichever of the two has the higher ratio', () => {
    for (const hex of [
      '#2563EB',
      '#16A34A',
      '#DC2626',
      '#F59E0B',
      '#7C3AED',
      '#475569',
      '#E2E8F0',
    ]) {
      const picked = pickOnPrimary(hex);
      const other = picked === '#06201F' ? '#FFFFFF' : '#06201F';
      expect(contrastRatio(picked, hex)).toBeGreaterThanOrEqual(contrastRatio(other, hex));
    }
  });
});
