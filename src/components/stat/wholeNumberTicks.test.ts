import { describe, expect, it } from 'vitest';
import { wholeNumberTicks } from './wholeNumberTicks';

describe('wholeNumberTicks', () => {
  it('gives a tick at every whole number for a small count, never 0.5 or 1.5', () => {
    expect(wholeNumberTicks(0, 2)).toEqual([0, 1, 2]);
    expect(wholeNumberTicks(0, 1)).toEqual([0, 1]);
    expect(wholeNumberTicks(0, 4)).toEqual([0, 1, 2, 3, 4]);
  });

  it('keeps inside the range: no tick above the largest value or below the smallest', () => {
    expect(wholeNumberTicks(0, 2.4)).toEqual([0, 1, 2]);
    expect(wholeNumberTicks(0.5, 1.5)).toEqual([1]);
    expect(wholeNumberTicks(0.2, 0.8)).toEqual([]);
  });

  it('steps by a round whole number when the counts are large, with a few ticks only', () => {
    expect(wholeNumberTicks(0, 1000)).toEqual([0, 200, 400, 600, 800, 1000]);
    const ticks = wholeNumberTicks(0, 87);
    expect(ticks).toEqual([0, 20, 40, 60, 80]);
    expect(wholeNumberTicks(3, 17)).toEqual([5, 10, 15]);
    for (const tick of wholeNumberTicks(0, 123456)) expect(Number.isInteger(tick)).toBe(true);
  });

  it('gives the one tick of a range that is a single whole number', () => {
    expect(wholeNumberTicks(0, 0)).toEqual([0]);
    expect(wholeNumberTicks(3, 3)).toEqual([3]);
  });

  it('ignores a range that is not numbers instead of looping', () => {
    expect(wholeNumberTicks(Number.NaN, 5)).toEqual([]);
    expect(wholeNumberTicks(0, Number.POSITIVE_INFINITY)).toEqual([]);
  });
});
