import { describe, expect, it } from 'vitest';
import type { GuestCohortRow } from '../../../services/stats/types';
import {
  buildConversionDistribution,
  buildConversionStack,
  dailyConversionRate,
} from './conversion';

const row = (cohortDate: string, cohortSize: number, cells: Partial<GuestCohortRow>) =>
  ({
    cohortDate,
    cohortSize,
    d0: null,
    d1: null,
    d2: null,
    d3: null,
    d5: null,
    d7: null,
    d14: null,
    d30: null,
    ...cells,
  }) as GuestCohortRow;

// A: every column is due. Cumulative 10, 15, 18, 20, 24, 27, 30, 33.
const A = row('2026-09-01', 100, {
  d0: 10,
  d1: 15,
  d2: 18,
  d3: 20,
  d5: 24,
  d7: 27,
  d14: 30,
  d30: 33,
});
// B: due until D3 only.
const B = row('2026-10-23', 80, { d0: 4, d1: 6, d2: 7, d3: 9 });

const asMap = (list: { bucket: string; devices: number }[]) =>
  Object.fromEntries(list.map((b) => [b.bucket, b.devices]));

describe('buildConversionDistribution', () => {
  it('has the eight buckets in order, also for no rows', () => {
    const keys = ['D0', 'D1', 'D2', 'D3', 'D4-D5', 'D6-D7', 'D8-D14', 'D15-D30'];
    expect(buildConversionDistribution([]).map((b) => b.bucket)).toEqual(keys);
    expect(buildConversionDistribution([]).every((b) => b.devices === 0)).toBe(true);
    expect(buildConversionDistribution([A]).map((b) => b.bucket)).toEqual(keys);
  });

  it('is the difference of neighbouring columns for one cohort that is fully due', () => {
    expect(asMap(buildConversionDistribution([A]))).toEqual({
      D0: 10,
      D1: 5,
      D2: 3,
      D3: 2,
      'D4-D5': 4,
      'D6-D7': 3,
      'D8-D14': 3,
      'D15-D30': 3,
    });
  });

  it('adds the cohorts and leaves the cells that are not due out of every bucket', () => {
    expect(asMap(buildConversionDistribution([A, B]))).toEqual({
      D0: 14,
      D1: 7,
      D2: 4,
      D3: 4,
      'D4-D5': 4,
      'D6-D7': 3,
      'D8-D14': 3,
      'D15-D30': 3,
    });
  });

  it('sums to the last due cumulative value of each cohort', () => {
    const total = buildConversionDistribution([A, B]).reduce((sum, b) => sum + b.devices, 0);
    expect(total).toBe(33 + 9);
    expect(buildConversionDistribution([B]).reduce((sum, b) => sum + b.devices, 0)).toBe(9);
  });

  it('counts a cohort that is not due at all as nothing, and keeps a real zero as zero', () => {
    const future = row('2026-10-27', 50, {});
    expect(buildConversionDistribution([future]).every((b) => b.devices === 0)).toBe(true);
    const zero = row('2026-10-01', 50, {
      d0: 0,
      d1: 0,
      d2: 0,
      d3: 0,
      d5: 2,
      d7: 2,
      d14: 2,
      d30: 2,
    });
    expect(asMap(buildConversionDistribution([zero]))['D4-D5']).toBe(2);
  });

  it('does not count a bucket whose earlier column is missing', () => {
    // d2 is not known although d3 is: D3 has no usable start, so it is not guessed.
    const odd = row('2026-10-01', 10, { d0: 1, d1: 2, d3: 5 });
    const result = asMap(buildConversionDistribution([odd]));
    expect(result.D3).toBe(0);
    expect(result.D2).toBe(0);
    expect(result.D1).toBe(1);
  });
});

describe('buildConversionStack', () => {
  it('gives each due segment of each cohort: same day, next day, day 2, day 3 and later', () => {
    expect(buildConversionStack([A, B])).toEqual([
      { cohortDate: '2026-09-01', segment: 'D0', devices: 10 },
      { cohortDate: '2026-09-01', segment: 'D1', devices: 5 },
      { cohortDate: '2026-09-01', segment: 'D2', devices: 3 },
      { cohortDate: '2026-09-01', segment: 'D3-later', devices: 15 },
      { cohortDate: '2026-10-23', segment: 'D0', devices: 4 },
      { cohortDate: '2026-10-23', segment: 'D1', devices: 2 },
      { cohortDate: '2026-10-23', segment: 'D2', devices: 1 },
      { cohortDate: '2026-10-23', segment: 'D3-later', devices: 2 },
    ]);
  });

  it('leaves out a segment that is not due, and a cohort with nothing due', () => {
    const early = row('2026-10-25', 10, { d0: 2, d1: 3 });
    expect(buildConversionStack([early, row('2026-10-27', 5, {})])).toEqual([
      { cohortDate: '2026-10-25', segment: 'D0', devices: 2 },
      { cohortDate: '2026-10-25', segment: 'D1', devices: 1 },
    ]);
  });

  it('adds up, per cohort, to its last due cumulative value', () => {
    for (const cohort of [A, B]) {
      const sum = buildConversionStack([cohort]).reduce((s, b) => s + b.devices, 0);
      expect(sum).toBe(cohort.d30 ?? cohort.d3);
    }
  });
});

describe('dailyConversionRate', () => {
  it('is converted over new, a dash (null) for no new devices, 0 for a real zero', () => {
    expect(dailyConversionRate({ guestDevicesNew: 200, guestDevicesConverted: 50 })).toBe(0.25);
    expect(dailyConversionRate({ guestDevicesNew: 0, guestDevicesConverted: 5 })).toBeNull();
    expect(dailyConversionRate({ guestDevicesNew: 40, guestDevicesConverted: 0 })).toBe(0);
  });

  it('may be above 100%: it is not the rate of one batch of devices', () => {
    expect(dailyConversionRate({ guestDevicesNew: 10, guestDevicesConverted: 15 })).toBe(1.5);
  });
});
