import { describe, expect, it } from 'vitest';
import { avgSecondsText, countCell, percentText, ratioOf, undeterminedOf } from './reportFigures';

describe('ratioOf', () => {
  it('takes the ratio the server worked out when the denominator is above 0', () => {
    expect(ratioOf(0.0425, 4, 100)).toBe(0.0425);
    expect(ratioOf(0, 0, 100)).toBe(0);
  });

  it('is null whenever the denominator is 0, missing or not a number, whatever the server said', () => {
    expect(ratioOf(0.5, 5, 0)).toBeNull();
    expect(ratioOf(0.5, 5, null)).toBeNull();
    expect(ratioOf(0.5, 5, undefined)).toBeNull();
    expect(ratioOf(0.5, 5, Number.NaN)).toBeNull();
    expect(ratioOf(0.5, 5, -3)).toBeNull();
    expect(ratioOf(0.5, 5, '100' as never)).toBeNull();
  });

  it('is null for a null from the server, and works it out only when the server did not send the ratio at all', () => {
    expect(ratioOf(null, 4, 100)).toBeNull();
    expect(ratioOf(undefined, 4, 100)).toBeCloseTo(0.04, 10);
    expect(ratioOf(undefined, null, 100)).toBeNull();
    expect(ratioOf(undefined, 4, 0)).toBeNull();
  });

  it('is never negative and never not-a-number', () => {
    expect(ratioOf(-0.1, 4, 100)).toBeNull();
    expect(ratioOf(Number.NaN, 4, 100)).toBeNull();
    expect(ratioOf(Number.POSITIVE_INFINITY, 4, 100)).toBeNull();
    expect(ratioOf('0.5' as never, 4, 100)).toBeNull();
    expect(ratioOf(undefined, -4, 100)).toBeNull();
  });
});

describe('percentText', () => {
  it('writes a ratio as a percentage with two decimals, in the language', () => {
    expect(percentText(0.0425, 'en-US')).toBe('4.25%');
    expect(percentText(0.03, 'en-US')).toBe('3.00%');
    expect(percentText(1, 'en-US')).toBe('100.00%');
    expect(percentText(0, 'en-US')).toBe('0.00%');
    expect(percentText(0.12345, 'de-DE')).toContain('12,35');
  });

  it('writes a dash for a ratio that is not there', () => {
    expect(percentText(null, 'en-US')).toBe('—');
  });
});

describe('avgSecondsText', () => {
  it('writes seconds with two decimals and the unit, and a dash when there is none', () => {
    expect(avgSecondsText(7.5, 'en-US', 's')).toBe('7.50 s');
    expect(avgSecondsText(0, 'en-US', 's')).toBe('0.00 s');
    expect(avgSecondsText(null, 'en-US', 's')).toBe('—');
  });
});

describe('countCell', () => {
  it('writes a count with separators, 0 as 0, and a dash for anything that is not a count', () => {
    expect(countCell(1234567, 'en-US')).toBe('1,234,567');
    expect(countCell(0, 'en-US')).toBe('0');
    expect(countCell(null, 'en-US')).toBe('—');
    expect(countCell(undefined, 'en-US')).toBe('—');
    expect(countCell('5' as never, 'en-US')).toBe('—');
    expect(countCell(Number.NaN, 'en-US')).toBe('—');
  });

  it('writes a dash, not a negative number', () => {
    expect(countCell(-3, 'en-US')).toBe('—');
  });
});

describe('undeterminedOf', () => {
  it('is what the server says, and never below 0', () => {
    expect(undeterminedOf(5)).toBe(5);
    expect(undeterminedOf(0)).toBe(0);
    expect(undeterminedOf(-4)).toBe(0);
    expect(undeterminedOf(null)).toBeNull();
    expect(undeterminedOf(undefined)).toBeNull();
    expect(undeterminedOf('3' as never)).toBeNull();
  });
});
