import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { formatDuration, secondsSince } from './duration';

const en = (id: string, values: Record<string, string | number> = {}) =>
  (enUS[id] as string).replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));
const zh = (id: string, values: Record<string, string | number> = {}) =>
  (zhCN[id] as string).replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));

describe('formatDuration', () => {
  it.each([
    [0, '0 s'],
    [40, '40 s'],
    [60, '1 min'],
    [61, '1 min 1 s'],
    [3_600, '1 h'],
    [3 * 3_600 + 20 * 60 + 5, '3 h 20 min'],
    [86_400, '1 d'],
    [3 * 86_400 + 4 * 3_600 + 59 * 60, '3 d 4 h'],
    [90 * 86_400, '90 d'],
    [12.9, '12 s'],
  ])('writes %s seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds, en, 'en-US')).toBe(expected);
  });

  it('groups the digits by the locale and uses the words of the language', () => {
    expect(formatDuration(1234 * 86_400, en, 'en-US')).toBe('1,234 d');
    expect(formatDuration(2 * 86_400 + 3 * 3_600, zh, 'zh-CN')).toBe('2 天 3 小时');
  });

  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY, -5])(
    'writes %s as a dash',
    (value) => {
      expect(formatDuration(value, en, 'en-US')).toBe('—');
    },
  );
});

describe('secondsSince', () => {
  const now = Date.parse('2026-10-26T12:00:00Z');
  it('counts whole seconds, never negative, and gives null for text that is not a time', () => {
    expect(secondsSince('2026-10-26T11:59:00Z', now)).toBe(60);
    expect(secondsSince('2026-10-26T12:00:05Z', now)).toBe(0);
    expect(secondsSince('soon', now)).toBeNull();
  });
});
