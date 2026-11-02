import { describe, expect, it } from 'vitest';
import { count, pairedRate, rateOf, sumCounts } from './numbers';

describe('count', () => {
  it('accepts a finite number that is not negative', () => {
    expect(count(0)).toBe(0);
    expect(count(12)).toBe(12);
    expect(count(2.5)).toBe(2.5);
  });
  it('turns everything else into null: negative, NaN, infinity, text, null, undefined, objects', () => {
    for (const bad of [
      -1,
      -0.001,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      '5',
      null,
      undefined,
      {},
      [],
      true,
    ]) {
      expect(count(bad), String(bad)).toBeNull();
    }
  });
});

describe('sumCounts', () => {
  it('adds the numbers that are valid and ignores the rest', () => {
    expect(sumCounts([1, 2, null, -5, 'x', 4])).toBe(7);
  });
  it('is null when no value is valid (nothing known), and 0 only when a 0 was really sent', () => {
    expect(sumCounts([])).toBeNull();
    expect(sumCounts([null, -1, undefined])).toBeNull();
    expect(sumCounts([0, null])).toBe(0);
  });
});

describe('rateOf', () => {
  it('divides a valid count by a valid positive count', () => {
    expect(rateOf(30, 1500)).toBeCloseTo(0.02, 10);
    expect(rateOf(0, 10)).toBe(0);
  });
  it('is null for a zero, missing or negative denominator, and for a missing or negative numerator', () => {
    expect(rateOf(5, 0)).toBeNull();
    expect(rateOf(5, null)).toBeNull();
    expect(rateOf(5, undefined)).toBeNull();
    expect(rateOf(5, -3)).toBeNull();
    expect(rateOf(-3, 10)).toBeNull();
    expect(rateOf(null, 10)).toBeNull();
    expect(rateOf(Number.NaN, 10)).toBeNull();
  });
});

describe('pairedRate', () => {
  const rows = [
    { a: 5, b: 20 },
    { a: 10, b: null },
    { a: 4, b: 0 },
  ];
  it('sets a against b only over the rows that have both, so a row without b adds nothing to a', () => {
    expect(pairedRate([rows[0], rows[1]], 'a', 'b')).toBe(0.25);
  });
  it('is null when the earlier sum is 0, when no row has both, and for nothing', () => {
    expect(pairedRate([rows[2]], 'a', 'b')).toBeNull();
    expect(pairedRate([rows[1]], 'a', 'b')).toBeNull();
    expect(pairedRate([], 'a', 'b')).toBeNull();
  });
  it('does not take a negative or a text as a count', () => {
    expect(
      pairedRate(
        [
          { a: 5, b: -1 },
          { a: 1, b: 'x' },
        ],
        'a',
        'b',
      ),
    ).toBeNull();
  });
});
