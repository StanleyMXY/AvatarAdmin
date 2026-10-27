import { describe, expect, it } from 'vitest';
import type { RetentionRow, StatDailyRow } from '../../services/stats/types';
import {
  axisGroupOf,
  DEFAULT_METRICS,
  RANGE_PRESETS,
  rangeOfPreset,
  TREND_METRICS,
  trendPoints,
} from './trendData';

const TODAY = '2026-10-26';
const WINDOW = { from: '2026-07-29', to: TODAY };

const daily = (statDate: string, over: Partial<StatDailyRow>): StatDailyRow =>
  ({
    statDate,
    dau: null,
    newAccountsRegistered: null,
    callSecondsTotal: null,
    ...over,
  }) as StatDailyRow;

const cohort = (cohortDate: string, d1: number | null, over: Partial<RetentionRow> = {}) =>
  ({
    cohortDate,
    retentionType: 'ACTIVE',
    platform: 'ALL',
    channelCode: 'ALL',
    cohortSize: 200,
    d1,
    ...over,
  }) as RetentionRow;

const points = (
  metric: Parameters<typeof trendPoints>[0]['metric'],
  range: { from: string; to: string },
  rows: StatDailyRow[] = [],
  retention: RetentionRow[] = [],
) => trendPoints({ metric, range, daily: rows, retention, window: WINDOW, today: TODAY });

describe('the metrics and the presets of the trend chart', () => {
  it('has the four metrics of the spec, the first two chosen at the start', () => {
    expect(TREND_METRICS).toEqual(['dau', 'newAccounts', 'callMinutes', 'd1']);
    expect(DEFAULT_METRICS).toEqual(['dau', 'newAccounts']);
  });

  it('has five presets: today, 7, 14, 30 days and a custom range', () => {
    expect(RANGE_PRESETS).toEqual(['today', 'last7', 'last14', 'last30', 'custom']);
  });

  it('counts the days of a preset back from the UTC day of the data, today included', () => {
    expect(rangeOfPreset('today', TODAY)).toEqual({ from: TODAY, to: TODAY });
    expect(rangeOfPreset('last7', TODAY)).toEqual({ from: '2026-10-20', to: TODAY });
    expect(rangeOfPreset('last14', TODAY)).toEqual({ from: '2026-10-13', to: TODAY });
    expect(rangeOfPreset('last30', TODAY)).toEqual({ from: '2026-09-27', to: TODAY });
    expect(rangeOfPreset('custom', TODAY)).toBeNull();
  });

  it('puts a percentage on its own axis and the numbers of people and minutes on the other', () => {
    expect(axisGroupOf('d1')).toBe('percent');
    expect(axisGroupOf('dau')).toBe('count');
    expect(axisGroupOf('newAccounts')).toBe('count');
    expect(axisGroupOf('callMinutes')).toBe('count');
  });
});

describe('trendPoints', () => {
  it('has one point for each day of the range, oldest first', () => {
    const result = points('dau', { from: '2026-10-24', to: '2026-10-26' }, [
      daily('2026-10-26', { dau: 3 }),
      daily('2026-10-24', { dau: 1 }),
      daily('2026-10-25', { dau: 2 }),
    ]);
    expect(result.map((p) => [p.statDate, p.value])).toEqual([
      ['2026-10-24', 1],
      ['2026-10-25', 2],
      ['2026-10-26', 3],
    ]);
  });

  it('puts the value of the same day one week earlier beside each day', () => {
    const result = points('dau', { from: '2026-10-25', to: '2026-10-26' }, [
      daily('2026-10-26', { dau: 30 }),
      daily('2026-10-25', { dau: 20 }),
      daily('2026-10-19', { dau: 300 }),
      daily('2026-10-18', { dau: 200 }),
    ]);
    expect(result.map((p) => p.lastWeek)).toEqual([200, 300]);
  });

  it('draws a day without a row from the past as 0 (spec 4.4) but a null column and today as a gap', () => {
    const result = points('dau', { from: '2026-10-23', to: '2026-10-26' }, [
      daily('2026-10-23', { dau: null }),
      daily('2026-10-25', { dau: 5 }),
    ]);
    expect(result.map((p) => p.value)).toEqual([null, 0, 5, null]);
  });

  it('has no value for days outside the 90 days that were loaded, not a 0', () => {
    const result = points('dau', { from: '2026-07-27', to: '2026-07-30' }, [
      daily('2026-07-29', { dau: 7 }),
      daily('2026-07-30', { dau: 8 }),
    ]);
    expect(result.map((p) => p.value)).toEqual([null, null, 7, 8]);
    // the week before 2026-07-29 is outside as well
    expect(result.map((p) => p.lastWeek)).toEqual([null, null, null, null]);
  });

  it('turns call seconds into minutes', () => {
    const result = points('callMinutes', { from: TODAY, to: TODAY }, [
      daily(TODAY, { callSecondsTotal: 150 }),
    ]);
    expect(result[0].value).toBe(2.5);
  });

  it('reads new accounts from the business columns', () => {
    const result = points('newAccounts', { from: TODAY, to: TODAY }, [
      daily(TODAY, { newAccountsRegistered: 9 }),
    ]);
    expect(result[0].value).toBe(9);
  });

  it('gives D1 retention in percent from the ACTIVE cohorts, a gap where the cohort or its d1 is missing', () => {
    const result = points(
      'd1',
      { from: '2026-10-22', to: '2026-10-26' },
      [],
      [
        cohort('2026-10-22', 50),
        cohort('2026-10-23', 0),
        cohort('2026-10-24', 70, { retentionType: 'CALL' }),
        cohort('2026-10-25', null),
      ],
    );
    expect(result.map((p) => p.value)).toEqual([25, 0, null, null, null]);
  });

  it('reads the D1 of the cohort one week earlier as last week', () => {
    const result = points(
      'd1',
      { from: '2026-10-25', to: '2026-10-25' },
      [],
      [cohort('2026-10-25', 80), cohort('2026-10-18', 40)],
    );
    expect(result[0]).toEqual({ statDate: '2026-10-25', value: 40, lastWeek: 20 });
  });

  it('has a gap for a cohort of size 0, never a NaN or an infinite value', () => {
    const result = points(
      'd1',
      { from: '2026-10-22', to: '2026-10-22' },
      [],
      [cohort('2026-10-22', 5, { cohortSize: 0 })],
    );
    expect(result[0].value).toBeNull();
  });

  it('has a gap for a count that cannot be right (negative)', () => {
    const result = points('dau', { from: '2026-10-25', to: '2026-10-25' }, [
      daily('2026-10-25', { dau: -4 }),
    ]);
    expect(result[0].value).toBeNull();
  });

  it('is empty for a range that ends before it starts', () => {
    expect(points('dau', { from: '2026-10-26', to: '2026-10-25' })).toEqual([]);
  });
});
