import { describe, expect, it } from 'vitest';
import { checkDepth, defaultDepth, depthLimit } from './chainRules';

describe('depthLimit', () => {
  it('is the configured limit when it is a whole number of 1 or more, else not known', () => {
    expect(depthLimit(5)).toBe(5);
    expect(depthLimit(1)).toBe(1);
    for (const bad of [0, -2, 2.5, null, undefined, '5', Number.NaN]) {
      expect(depthLimit(bad), String(bad)).toBeNull();
    }
  });
});

describe('defaultDepth', () => {
  it('is 3, or the limit when that is smaller', () => {
    expect(defaultDepth(5)).toBe(3);
    expect(defaultDepth(null)).toBe(3);
    expect(defaultDepth(2)).toBe(2);
    expect(defaultDepth(1)).toBe(1);
  });
});

describe('checkDepth', () => {
  it('accepts a whole number from 1 to the limit', () => {
    expect(checkDepth(1, 5)).toBe(true);
    expect(checkDepth(5, 5)).toBe(true);
    expect(checkDepth(3, null)).toBe(true);
  });
  it('refuses 0, a number above the limit, a fraction, NaN and no number', () => {
    expect(checkDepth(0, 5)).toBe(false);
    expect(checkDepth(6, 5)).toBe(false);
    expect(checkDepth(2.5, 5)).toBe(false);
    expect(checkDepth(Number.NaN, 5)).toBe(false);
    expect(checkDepth(null, 5)).toBe(false);
    expect(checkDepth(-1, null)).toBe(false);
  });
  it('has no upper bound when the limit is not known (the backend decides)', () => {
    expect(checkDepth(500, null)).toBe(true);
  });
});
