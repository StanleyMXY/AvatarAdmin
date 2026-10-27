import { describe, expect, it } from 'vitest';
import { DASH, formatCount, formatPercent, safeRatio } from './ratio';

describe('safeRatio', () => {
  it('divides when both are usable', () => {
    expect(safeRatio(1, 4)).toBe(0.25);
    expect(safeRatio(0, 5)).toBe(0);
    expect(safeRatio(3, 2)).toBe(1.5);
  });

  it('gives null for a zero, empty or non-finite denominator', () => {
    expect(safeRatio(5, 0)).toBeNull();
    expect(safeRatio(5, null)).toBeNull();
    expect(safeRatio(5, undefined)).toBeNull();
    expect(safeRatio(5, Number.NaN)).toBeNull();
    expect(safeRatio(5, Number.POSITIVE_INFINITY)).toBeNull();
    expect(safeRatio(0, 0)).toBeNull();
  });

  it('gives null for an empty or non-finite numerator', () => {
    expect(safeRatio(null, 5)).toBeNull();
    expect(safeRatio(undefined, 5)).toBeNull();
    expect(safeRatio(Number.NaN, 5)).toBeNull();
    expect(safeRatio(Number.POSITIVE_INFINITY, 5)).toBeNull();
  });
});

describe('formatPercent', () => {
  it('shows an empty ratio as a dash and zero as 0%', () => {
    expect(DASH).toBe('—');
    expect(formatPercent(null, 'en-US')).toBe('—');
    expect(formatPercent(0, 'en-US')).toBe('0%');
    expect(formatPercent(0, 'en-US')).not.toBe(formatPercent(null, 'en-US'));
  });

  it('formats with the locale and the number of digits', () => {
    expect(formatPercent(0.25, 'en-US')).toBe('25%');
    expect(formatPercent(0.1234, 'en-US')).toBe('12.3%');
    expect(formatPercent(0.1234, 'en-US', 2)).toBe('12.34%');
    expect(formatPercent(0.1234, 'en-US', 0)).toBe('12%');
    expect(formatPercent(0.5, 'zh-CN')).toBe('50%');
    expect(formatPercent(0.1234, 'id-ID')).toBe(
      new Intl.NumberFormat('id-ID', {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(0.1234),
    );
  });

  it('uses the digits of the locale (Arabic, Thai)', () => {
    expect(formatPercent(0.5, 'ar-EG')).toBe(
      new Intl.NumberFormat('ar-EG', { style: 'percent' }).format(0.5),
    );
    expect(formatPercent(0.5, 'th-TH')).toBe('50%');
  });

  it('never prints NaN, Infinity or null', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, null]) {
      const text = formatPercent(bad, 'en-US');
      expect(text).toBe('—');
      expect(text).not.toMatch(/NaN|Infinity|null/);
    }
    expect(formatPercent(safeRatio(3, 0), 'en-US')).toBe('—');
    expect(formatPercent(safeRatio(null, 3), 'en-US')).toBe('—');
  });
});

describe('formatCount', () => {
  it('groups digits by locale', () => {
    expect(formatCount(1234567, 'en-US')).toBe('1,234,567');
    expect(formatCount(1234567, 'es-ES')).toBe(new Intl.NumberFormat('es-ES').format(1234567));
    expect(formatCount(0, 'en-US')).toBe('0');
  });

  it('shows a missing or non-finite count as a dash', () => {
    expect(formatCount(null, 'en-US')).toBe('—');
    expect(formatCount(undefined, 'en-US')).toBe('—');
    expect(formatCount(Number.NaN, 'en-US')).toBe('—');
    expect(formatCount(Number.POSITIVE_INFINITY, 'en-US')).toBe('—');
  });
});
