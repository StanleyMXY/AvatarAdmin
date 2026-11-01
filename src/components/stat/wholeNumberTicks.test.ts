import { describe, expect, it } from 'vitest';
import { wholeNumberTicks } from './wholeNumberTicks';

describe('wholeNumberTicks', () => {
  it('gives a tick at every whole number for a small count, never 0.5 or 1.5', () => {
    expect(wholeNumberTicks(0, 2)).toEqual([0, 1, 2]);
    expect(wholeNumberTicks(0, 1)).toEqual([0, 1]);
    expect(wholeNumberTicks(0, 4)).toEqual([0, 1, 2, 3, 4]);
  });

  it('rounds the ends outward, so the largest value is still inside the axis', () => {
    expect(wholeNumberTicks(0, 2.4)).toEqual([0, 1, 2, 3]);
    expect(wholeNumberTicks(0.5, 1.5)).toEqual([0, 1, 2]);
  });

  it('steps by a round whole number when the counts are large, with a few ticks only', () => {
    expect(wholeNumberTicks(0, 1000)).toEqual([0, 500, 1000]);
    const ticks = wholeNumberTicks(0, 87);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(87);
    expect(ticks.length).toBeLessThanOrEqual(7);
    for (const tick of ticks) expect(Number.isInteger(tick)).toBe(true);
  });

  it('still gives an axis when every value is the same or the range is empty', () => {
    expect(wholeNumberTicks(0, 0)).toEqual([0, 1]);
    expect(wholeNumberTicks(3, 3)).toEqual([3, 4]);
  });

  it('ignores a range that is not numbers instead of looping', () => {
    expect(wholeNumberTicks(Number.NaN, 5)).toEqual([]);
    expect(wholeNumberTicks(0, Number.POSITIVE_INFINITY)).toEqual([]);
  });
});
