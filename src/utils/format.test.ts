import { describe, expect, it } from 'vitest';
import { withTimeZone } from '../../tests/withTimeZone';
import { formatBytes, formatBytesPair, formatInstant } from './format';

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

  it('leaves a statistics day and a time without a zone alone: they are not instants', () => {
    for (const notAnInstant of [
      '2026-10-21',
      '2026-10-21T10:00:00',
      '2026-10-21T10:00',
      '2026-10-21 10:00:00Z',
      '1761040800000',
    ]) {
      expect(withTimeZone('Asia/Singapore', () => formatInstant(notAnInstant, 'en-US'))).toBe(
        notAnInstant,
      );
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

describe('formatBytes near a multiple of 1024', () => {
  it('does not print 1,024 of a unit: a value that rounds up to the next step is written in that step', () => {
    expect(formatBytes(1048575, 'en-US')).toBe('1 MB');
    expect(formatBytes(1023.999 * 1024, 'en-US')).toBe('1 MB');
    expect(formatBytes(1024 ** 3 - 1, 'en-US')).toBe('1 GB');
    expect(formatBytes(1023, 'en-US')).toBe('1,023 B');
    expect(formatBytes(1024 * 1023.99, 'en-US')).toBe('1,023.99 KB');
  });

  it('stays in KB at the largest unit-free value that still rounds to 1023.99', () => {
    expect(formatBytes(1048000, 'en-US')).toBe('1,023.44 KB');
  });
});

describe('formatBytesPair', () => {
  it('gives the same texts as formatBytes when they differ', () => {
    expect(formatBytesPair(3_000_000, 2_097_152, 'en-US')).toEqual(['2.86 MB', '2 MB']);
    expect(formatBytesPair(512, 1024, 'zh-CN')).toEqual(['512 B', '1 KB']);
  });

  it('never prints one text for two different sizes: a file one byte over the limit says so', () => {
    const [actual, limit] = formatBytesPair(1048577, 1048576, 'en-US');
    expect(actual).not.toBe(limit);
    expect(actual).toBe('1,048,577 B');
    expect(limit).toBe('1,048,576 B');
  });

  it('uses the digits of the language for the exact count', () => {
    const [actual, limit] = formatBytesPair(2097153, 2097152, 'es-ES');
    expect(actual).toBe('2.097.153 B');
    expect(limit).toBe('2.097.152 B');
  });

  it('keeps the short form when the two sizes are equal', () => {
    expect(formatBytesPair(2097152, 2097152, 'en-US')).toEqual(['2 MB', '2 MB']);
  });

  it('writes a dash for a value that is not a size and leaves the other alone', () => {
    expect(formatBytesPair(Number.NaN, 1048576, 'en-US')).toEqual(['—', '1 MB']);
    expect(formatBytesPair(1048577, -1, 'en-US')).toEqual(['1 MB', '—']);
  });
});
