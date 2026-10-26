import { describe, expect, it } from 'vitest';
import { withTimeZone } from '../../tests/withTimeZone';
import { formatBytes, formatInstant } from './format';

describe('formatInstant', () => {
  const ISO = '2026-10-21T17:30:00Z';

  it('shows the instant in the browser time zone', () => {
    const sg = withTimeZone('Asia/Singapore', () => formatInstant(ISO, 'en-US'));
    const la = withTimeZone('America/Los_Angeles', () => formatInstant(ISO, 'en-US'));
    expect(sg).toContain('10/22/2026');
    expect(sg).toContain('01:30');
    expect(la).toContain('10/21/2026');
    expect(la).toContain('10:30');
  });

  it('formats by locale', () => {
    const zh = withTimeZone('Asia/Singapore', () => formatInstant(ISO, 'zh-CN'));
    const en = withTimeZone('Asia/Singapore', () => formatInstant(ISO, 'en-US'));
    expect(zh).toContain('2026');
    expect(zh).not.toBe(en);
  });

  it('accepts an offset and fractional seconds', () => {
    const a = withTimeZone('UTC', () => formatInstant('2026-10-21T18:30:00+01:00', 'en-US'));
    const b = withTimeZone('UTC', () => formatInstant('2026-10-21T17:30:00.123Z', 'en-US'));
    expect(a).toBe(b);
  });

  it('returns what it cannot parse unchanged, and never prints Invalid Date', () => {
    for (const bad of ['', 'not a date', '2026-13-45T00:00:00Z', 'ไม่ใช่วันที่']) {
      expect(formatInstant(bad, 'en-US')).toBe(bad);
    }
  });
});

describe('formatBytes', () => {
  it('uses 1024-based steps and the labels B, KB, MB and GB', () => {
    expect(formatBytes(0, 'en-US')).toBe('0 B');
    expect(formatBytes(512, 'en-US')).toBe('512 B');
    expect(formatBytes(1024, 'en-US')).toBe('1 KB');
    expect(formatBytes(1048576, 'en-US')).toBe('1 MB');
    expect(formatBytes(2097152, 'en-US')).toBe('2 MB');
    expect(formatBytes(209715200, 'en-US')).toBe('200 MB');
    expect(formatBytes(1073741824, 'en-US')).toBe('1 GB');
  });

  it('keeps up to two decimals', () => {
    expect(formatBytes(1536, 'en-US')).toBe('1.5 KB');
    expect(formatBytes(1048576 + 52429, 'en-US')).toBe('1.05 MB');
  });

  it('uses the decimal separator of the locale', () => {
    expect(formatBytes(1536, 'es-ES')).toContain('1,5');
    expect(formatBytes(1536, 'zh-CN')).toContain('1.5');
  });

  it('gives the same MB value in the two interface languages', () => {
    expect(formatBytes(2097152, 'zh-CN')).toBe('2 MB');
    expect(formatBytes(2097152, 'en-US')).toBe('2 MB');
  });

  it('does not print NaN or a negative size for bad input', () => {
    expect(formatBytes(Number.NaN, 'en-US')).toBe('—');
    expect(formatBytes(-1, 'en-US')).toBe('—');
    expect(formatBytes(Number.POSITIVE_INFINITY, 'en-US')).toBe('—');
  });
});
