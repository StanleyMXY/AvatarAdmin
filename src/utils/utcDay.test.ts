import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { withTimeZone } from '../../tests/withTimeZone';
import {
  daysBetween,
  lastNDaysUtc,
  pickedDay,
  todayUtc,
  utcDayRangeToInstants,
  yesterdayUtc,
} from './utcDay';

const ZONES = ['Asia/Singapore', 'America/Los_Angeles'];
// 17:30 UTC on the 21st: already 01:30 on the 22nd in Singapore, 10:30 on the 21st in Los Angeles.
const NOW = new Date('2026-10-21T17:30:00Z');

describe.each(ZONES)('UTC day helpers in %s', (zone) => {
  it('todayUtc and yesterdayUtc follow UTC, not the local day', () => {
    withTimeZone(zone, () => {
      expect(todayUtc(NOW)).toBe('2026-10-21');
      expect(yesterdayUtc(NOW)).toBe('2026-10-20');
    });
  });

  it('is right in the first hours of the UTC day and just before its end', () => {
    withTimeZone(zone, () => {
      expect(todayUtc(new Date('2026-10-22T00:00:00Z'))).toBe('2026-10-22');
      expect(todayUtc(new Date('2026-10-21T23:59:59.999Z'))).toBe('2026-10-21');
      expect(yesterdayUtc(new Date('2026-10-22T00:00:00Z'))).toBe('2026-10-21');
    });
  });

  it('crosses month and year boundaries', () => {
    withTimeZone(zone, () => {
      expect(yesterdayUtc(new Date('2026-11-01T03:00:00Z'))).toBe('2026-10-31');
      expect(yesterdayUtc(new Date('2027-01-01T00:30:00Z'))).toBe('2026-12-31');
      expect(yesterdayUtc(new Date('2028-03-01T10:00:00Z'))).toBe('2028-02-29');
    });
  });

  it('is not moved by the days on which the zone changes its clock (a day of 23 or 25 hours)', () => {
    withTimeZone(zone, () => {
      // America/Los_Angeles: clocks go forward on 2026-03-08 and back on 2026-11-01.
      expect(yesterdayUtc(new Date('2026-03-09T00:30:00Z'))).toBe('2026-03-08');
      expect(yesterdayUtc(new Date('2026-03-08T07:30:00Z'))).toBe('2026-03-07');
      expect(yesterdayUtc(new Date('2026-03-08T11:30:00Z'))).toBe('2026-03-07');
      expect(yesterdayUtc(new Date('2026-11-02T00:30:00Z'))).toBe('2026-11-01');
      expect(yesterdayUtc(new Date('2026-11-01T08:30:00Z'))).toBe('2026-10-31');
      expect(yesterdayUtc(new Date('2026-11-01T09:30:00Z'))).toBe('2026-10-31');
      // Europe: 2026-03-29 and 2026-10-25.
      expect(yesterdayUtc(new Date('2026-03-30T00:30:00Z'))).toBe('2026-03-29');
      expect(yesterdayUtc(new Date('2026-10-26T00:30:00Z'))).toBe('2026-10-25');
    });
  });

  it('lastNDaysUtc counts whole UTC days across a clock change', () => {
    withTimeZone(zone, () => {
      expect(lastNDaysUtc(30, new Date('2026-11-02T00:30:00Z'))).toEqual({
        from: '2026-10-04',
        to: '2026-11-02',
      });
      expect(lastNDaysUtc(7, new Date('2026-03-09T00:30:00Z'))).toEqual({
        from: '2026-03-03',
        to: '2026-03-09',
      });
      expect(lastNDaysUtc(30, new Date('2026-03-09T00:30:00Z'))).toEqual({
        from: '2026-02-08',
        to: '2026-03-09',
      });
      expect(daysBetween('2026-10-04', '2026-11-02')).toHaveLength(30);
      expect(daysBetween('2026-02-08', '2026-03-09')).toHaveLength(30);
    });
  });

  it('pickedDay uses the calendar day that was picked, whatever the zone', () => {
    withTimeZone(zone, () => {
      expect(pickedDay(dayjs('2026-10-21'))).toBe('2026-10-21');
      expect(pickedDay(dayjs('2026-10-21T00:00:00'))).toBe('2026-10-21');
      expect(pickedDay(dayjs('2026-10-21T23:59:59'))).toBe('2026-10-21');
      expect(pickedDay(dayjs('2026-01-05'))).toBe('2026-01-05');
    });
  });

  it('lastNDaysUtc(7) holds seven calendar days including today', () => {
    withTimeZone(zone, () => {
      expect(lastNDaysUtc(7, NOW)).toEqual({ from: '2026-10-15', to: '2026-10-21' });
      expect(daysBetween('2026-10-15', '2026-10-21')).toHaveLength(7);
      expect(lastNDaysUtc(1, NOW)).toEqual({ from: '2026-10-21', to: '2026-10-21' });
    });
  });

  it('utcDayRangeToInstants gives the same result in every zone', () => {
    withTimeZone(zone, () => {
      expect(utcDayRangeToInstants('2026-10-21', '2026-10-21')).toEqual({
        from: '2026-10-21T00:00:00Z',
        to: '2026-10-22T00:00:00Z',
      });
    });
  });
});

describe('daysBetween', () => {
  it('lists every day from start to end, both included', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });

  it('gives one day when both ends are the same and none when the start is later', () => {
    expect(daysBetween('2026-10-21', '2026-10-21')).toEqual(['2026-10-21']);
    expect(daysBetween('2026-10-22', '2026-10-21')).toEqual([]);
  });

  it('is not affected by a daylight-saving change in the local zone', () => {
    withTimeZone('America/Los_Angeles', () => {
      expect(daysBetween('2026-03-07', '2026-03-10')).toEqual([
        '2026-03-07',
        '2026-03-08',
        '2026-03-09',
        '2026-03-10',
      ]);
      expect(daysBetween('2026-11-01', '2026-11-02')).toEqual(['2026-11-01', '2026-11-02']);
    });
  });

  it('includes 29 February in a leap year', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toEqual([
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
  });

  it('refuses text that is not a YYYY-MM-DD calendar day', () => {
    expect(() => daysBetween('2026-13-01', '2026-13-02')).toThrow(RangeError);
    expect(() => daysBetween('2026-02-30', '2026-03-01')).toThrow(RangeError);
    expect(() => daysBetween('21/10/2026', '22/10/2026')).toThrow(RangeError);
    expect(() => daysBetween('', '')).toThrow(RangeError);
  });
});

describe('utcDayRangeToInstants', () => {
  it('makes the end exclusive: the start of the day after the last picked day', () => {
    expect(utcDayRangeToInstants('2026-10-21', '2026-10-23')).toEqual({
      from: '2026-10-21T00:00:00Z',
      to: '2026-10-24T00:00:00Z',
    });
  });

  it('rolls over month, year and leap day', () => {
    expect(utcDayRangeToInstants('2026-10-31', '2026-10-31').to).toBe('2026-11-01T00:00:00Z');
    expect(utcDayRangeToInstants('2026-12-31', '2026-12-31').to).toBe('2027-01-01T00:00:00Z');
    expect(utcDayRangeToInstants('2028-02-29', '2028-02-29').to).toBe('2028-03-01T00:00:00Z');
  });

  it('refuses text that is not a calendar day', () => {
    expect(() => utcDayRangeToInstants('2026-10-21', 'tomorrow')).toThrow(RangeError);
  });
});
