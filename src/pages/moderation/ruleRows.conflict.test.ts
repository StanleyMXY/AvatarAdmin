import { describe, expect, it } from 'vitest';
import type { TextRule } from '../../services/moderation';
import { sameRules, toRows } from './ruleRows';

const rule = (over: Partial<TextRule> = {}): TextRule => ({
  id: 'r1',
  pattern: 'คำต้องห้าม',
  matchMode: 'SUBSTRING',
  level: 'REVIEW',
  note: 'ملاحظة',
  ...over,
});

describe('sameRules: is the list the one that was read', () => {
  it('is the same for the same rules, whatever the row keys the page gave them', () => {
    expect(
      sameRules(toRows([rule(), rule({ id: 'r2' })]), toRows([rule(), rule({ id: 'r2' })])),
    ).toBe(true);
  });

  it('reads a missing note as an empty one', () => {
    expect(sameRules(toRows([rule({ note: null })]), toRows([rule({ note: '' })]))).toBe(true);
  });

  it.each([
    ['a changed pattern', [rule({ pattern: 'other' })]],
    ['a changed mode', [rule({ matchMode: 'WORD' })]],
    ['a changed level', [rule({ level: 'BLOCK' })]],
    ['a changed note', [rule({ note: 'x' })]],
    ['a changed id', [rule({ id: 'r9' })]],
    ['one rule fewer', []],
    ['one rule more', [rule(), rule({ id: 'r2' })]],
  ])('is not the same with %s', (_, other) => {
    expect(sameRules(toRows([rule()]), toRows(other))).toBe(false);
  });

  it('is not the same when the order changed', () => {
    const a = rule({ id: 'a' });
    const b = rule({ id: 'b', pattern: 'b' });
    expect(sameRules(toRows([a, b]), toRows([b, a]))).toBe(false);
  });
});
