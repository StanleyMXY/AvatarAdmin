import { describe, expect, it } from 'vitest';
import { nameProblem } from './avatarName';

describe('nameProblem (contract 2.5.1)', () => {
  it('accepts names in the languages of the product, with emoji, and a name of exactly 30 code points', () => {
    for (const name of [
      'Mira',
      'สวัสดีครับ',
      'مرحبا بك',
      'Nguyễn Thị',
      'Señora Ñandú',
      '小美',
      'Luna 😀',
    ]) {
      expect(nameProblem(name), name).toBeNull();
    }
    expect(nameProblem('😀'.repeat(30))).toBeNull();
    expect(nameProblem('ب'.repeat(30))).toBeNull();
  });

  it('counts code points, not UTF-16 units: 31 emoji are too long, 30 are not', () => {
    expect(nameProblem('😀'.repeat(31))).toBe('TOO_LONG');
  });

  it('trims with the contract set before it counts: a name of spaces is empty', () => {
    expect(nameProblem(String.fromCharCode(0x3000, 0xa0, 0x20, 0x85))).toBe('EMPTY');
    expect(nameProblem(undefined)).toBe('EMPTY');
    expect(nameProblem(`${'x'.repeat(30)}${String.fromCharCode(0x3000)}`)).toBeNull();
  });

  it('refuses control characters and bidirectional overrides and isolates, but keeps the joiners of Arabic, Persian and Indic scripts', () => {
    expect(nameProblem(`a${String.fromCharCode(7)}b`)).toBe('FORBIDDEN_CHARACTER');
    expect(nameProblem(`a${String.fromCharCode(0x202e)}b`)).toBe('FORBIDDEN_CHARACTER');
    expect(nameProblem(`a${String.fromCharCode(0x2067)}b`)).toBe('FORBIDDEN_CHARACTER');
    expect(nameProblem(`می${String.fromCharCode(0x200c)}خواهم`)).toBeNull();
  });
});
