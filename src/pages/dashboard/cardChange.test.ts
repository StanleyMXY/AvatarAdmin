import { describe, expect, it } from 'vitest';
import { withTimeZone } from '../../../tests/withTimeZone';
import type { RetentionRow, StatDailyRow } from '../../services/stats/types';
import {
  changeFinality,
  computeCardChange,
  dailySeries,
  latestCohortWithD1,
  retentionD1Series,
  shiftDay,
} from './cardChange';

const TODAY = '2026-10-26';
const at = (values: Record<string, number | null>) =>
  Object.entries(values).map(([date, value]) => ({ date, value }));

describe('shiftDay', () => {
  it('moves a UTC calendar day over month, year and leap day boundaries', () => {
    expect(shiftDay('2026-10-26', -1)).toBe('2026-10-25');
    expect(shiftDay('2026-10-26', -7)).toBe('2026-10-19');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDay('2028-03-01', -1)).toBe('2028-02-29');
    expect(shiftDay('2027-01-03', -7)).toBe('2026-12-27');
    expect(shiftDay('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('gives null for something that is not a calendar day', () => {
    expect(shiftDay('2026-02-30', -1)).toBeNull();
    expect(shiftDay('yesterday', -1)).toBeNull();
    expect(shiftDay('', -1)).toBeNull();
  });
});

describe('computeCardChange: percent change', () => {
  it('gives the value of the day and the percent change against yesterday and 7 days ago', () => {
    const change = computeCardChange(
      at({ '2026-10-26': 120, '2026-10-25': 100, '2026-10-19': 80 }),
      TODAY,
    );
    expect(change.current).toBe(120);
    expect(change.vsYesterday).toBeCloseTo(20, 10);
    expect(change.vs7DaysAgo).toBeCloseTo(50, 10);
  });

  it('is negative for a fall and -100 when the day is 0 against a day with numbers', () => {
    const fall = computeCardChange(at({ '2026-10-26': 80, '2026-10-25': 100 }), TODAY);
    expect(fall.vsYesterday).toBeCloseTo(-20, 10);
    const zero = computeCardChange(at({ '2026-10-26': 0, '2026-10-25': 100 }), TODAY);
    expect(zero.current).toBe(0);
    expect(zero.vsYesterday).toBe(-100);
  });

  it('is 0 when nothing changed', () => {
    expect(computeCardChange(at({ '2026-10-26': 50, '2026-10-25': 50 }), TODAY).vsYesterday).toBe(
      0,
    );
  });

  it('is null when the day before is missing, null or 0, each comparison on its own', () => {
    const missing = computeCardChange(at({ '2026-10-26': 10, '2026-10-19': 5 }), TODAY);
    expect(missing.vsYesterday).toBeNull();
    expect(missing.vs7DaysAgo).toBeCloseTo(100, 10);

    const nullYesterday = computeCardChange(at({ '2026-10-26': 10, '2026-10-25': null }), TODAY);
    expect(nullYesterday.vsYesterday).toBeNull();

    const zeroYesterday = computeCardChange(at({ '2026-10-26': 10, '2026-10-25': 0 }), TODAY);
    expect(zeroYesterday.vsYesterday).toBeNull();

    const zeroLastWeek = computeCardChange(
      at({ '2026-10-26': 10, '2026-10-25': 5, '2026-10-19': 0 }),
      TODAY,
    );
    expect(zeroLastWeek.vsYesterday).toBeCloseTo(100, 10);
    expect(zeroLastWeek.vs7DaysAgo).toBeNull();
  });

  it('does not turn 0 over 0 into a change', () => {
    const change = computeCardChange(at({ '2026-10-26': 0, '2026-10-25': 0 }), TODAY);
    expect(change.current).toBe(0);
    expect(change.vsYesterday).toBeNull();
  });

  it('has no value and no change when the day itself is missing or null', () => {
    expect(computeCardChange(at({ '2026-10-25': 100 }), TODAY)).toEqual({
      current: null,
      vsYesterday: null,
      vs7DaysAgo: null,
    });
    expect(computeCardChange(at({ '2026-10-26': null, '2026-10-25': 100 }), TODAY)).toEqual({
      current: null,
      vsYesterday: null,
      vs7DaysAgo: null,
    });
    expect(computeCardChange([], TODAY)).toEqual({
      current: null,
      vsYesterday: null,
      vs7DaysAgo: null,
    });
  });

  it('never turns a number that cannot be right into a negative or non-finite figure', () => {
    const bad = computeCardChange(
      at({ '2026-10-26': Number.NaN, '2026-10-25': 100, '2026-10-19': 100 }),
      TODAY,
    );
    expect(bad).toEqual({ current: null, vsYesterday: null, vs7DaysAgo: null });
    const negativeToday = computeCardChange(at({ '2026-10-26': -5, '2026-10-25': 100 }), TODAY);
    expect(negativeToday.current).toBeNull();
    expect(negativeToday.vsYesterday).toBeNull();
    const negativeBefore = computeCardChange(at({ '2026-10-26': 5, '2026-10-25': -100 }), TODAY);
    expect(negativeBefore.current).toBe(5);
    expect(negativeBefore.vsYesterday).toBeNull();
    const infinite = computeCardChange(
      at({ '2026-10-26': 5, '2026-10-25': Number.POSITIVE_INFINITY }),
      TODAY,
    );
    expect(infinite.vsYesterday).toBeNull();
  });

  it('does not depend on the order of the series and reads the days across month ends', () => {
    const change = computeCardChange(
      at({ '2026-02-22': 40, '2026-03-01': 60, '2026-02-28': 50 }),
      '2026-03-01',
    );
    expect(change.current).toBe(60);
    expect(change.vsYesterday).toBeCloseTo(20, 10);
    expect(change.vs7DaysAgo).toBeCloseTo(50, 10);
  });

  it('answers with nothing for a day that is not a calendar day', () => {
    expect(computeCardChange(at({ '2026-10-26': 1 }), 'not-a-day')).toEqual({
      current: null,
      vsYesterday: null,
      vs7DaysAgo: null,
    });
  });

  it('does not change with the time zone of the browser', () => {
    const series = at({ '2026-10-26': 120, '2026-10-25': 100, '2026-10-19': 80 });
    const base = computeCardChange(series, TODAY);
    for (const tz of ['Pacific/Auckland', 'America/Los_Angeles', 'Asia/Kolkata']) {
      expect(withTimeZone(tz, () => computeCardChange(series, TODAY))).toEqual(base);
    }
  });

  it('leaves the series it was given as it was', () => {
    const series = at({ '2026-10-26': 120, '2026-10-25': 100 });
    const copy = JSON.stringify(series);
    computeCardChange(series, TODAY);
    expect(JSON.stringify(series)).toBe(copy);
  });
});

describe('computeCardChange: percentage points for a ratio', () => {
  it('gives the difference in points, not a relative change', () => {
    const change = computeCardChange(
      at({ '2026-10-26': 0.42, '2026-10-25': 0.4, '2026-10-19': 0.5 }),
      TODAY,
      'points',
    );
    expect(change.current).toBe(0.42);
    expect(change.vsYesterday).toBeCloseTo(2, 10);
    expect(change.vs7DaysAgo).toBeCloseTo(-8, 10);
  });

  it('is null when the earlier day is missing, null or 0, like the percent change', () => {
    const change = computeCardChange(at({ '2026-10-26': 0.42, '2026-10-25': 0 }), TODAY, 'points');
    expect(change.vsYesterday).toBeNull();
    expect(change.vs7DaysAgo).toBeNull();
    expect(
      computeCardChange(at({ '2026-10-26': 0.42, '2026-10-25': null }), TODAY, 'points')
        .vsYesterday,
    ).toBeNull();
  });
});

const cohort = (
  cohortDate: string,
  d1: number | null,
  over: Partial<RetentionRow> = {},
): RetentionRow => ({
  cohortDate,
  retentionType: 'ACTIVE',
  platform: 'ALL',
  channelCode: 'ALL',
  cohortSize: 100,
  d1,
  d3: null,
  d5: null,
  d7: null,
  d14: null,
  d21: null,
  d30: null,
  d60: null,
  d90: null,
  ...over,
});

describe('latestCohortWithD1', () => {
  it('takes the newest ACTIVE cohort whose d1 has a value, whatever order the rows come in', () => {
    const rows = [
      cohort('2026-10-23', 30),
      cohort('2026-10-25', null),
      cohort('2026-10-24', 35),
      cohort('2026-10-22', 28),
    ];
    expect(latestCohortWithD1(rows)?.cohortDate).toBe('2026-10-24');
    expect(latestCohortWithD1([...rows].reverse())?.cohortDate).toBe('2026-10-24');
  });

  it('counts a d1 of 0 as a value: nobody came back is a result, not a missing one', () => {
    expect(
      latestCohortWithD1([cohort('2026-10-24', 0), cohort('2026-10-23', 30)])?.cohortDate,
    ).toBe('2026-10-24');
  });

  it('does not take a CALL cohort, even a newer one', () => {
    const rows = [
      cohort('2026-10-24', 20, { retentionType: 'CALL' }),
      cohort('2026-10-22', 30, { retentionType: 'ACTIVE' }),
    ];
    expect(latestCohortWithD1(rows)?.cohortDate).toBe('2026-10-22');
  });

  it('does not take a row of one platform or one channel when the rows of all are asked for', () => {
    const rows = [
      cohort('2026-10-24', 20, { platform: 'ANDROID' }),
      cohort('2026-10-24', 21, { channelCode: 'play' }),
      cohort('2026-10-22', 30),
    ];
    expect(latestCohortWithD1(rows)?.cohortDate).toBe('2026-10-22');
  });

  it('reads a row without a type as ACTIVE (the request asks for ACTIVE)', () => {
    const { retentionType: _type, ...bare } = cohort('2026-10-24', 20);
    expect(latestCohortWithD1([bare as RetentionRow])?.cohortDate).toBe('2026-10-24');
  });

  it('gives null when no cohort has a d1 yet', () => {
    expect(latestCohortWithD1([])).toBeNull();
    expect(latestCohortWithD1([cohort('2026-10-25', null)])).toBeNull();
    expect(latestCohortWithD1([cohort('2026-10-25', Number.NaN)])).toBeNull();
  });
});

describe('retentionD1Series', () => {
  it('is d1 over the cohort size for each ACTIVE cohort, null where it cannot be told', () => {
    const rows = [
      cohort('2026-10-24', 35),
      cohort('2026-10-23', 0),
      cohort('2026-10-22', 5, { cohortSize: 0 }),
      cohort('2026-10-25', null),
      cohort('2026-10-21', 10, { retentionType: 'CALL' }),
    ];
    expect(retentionD1Series(rows)).toEqual([
      { date: '2026-10-24', value: 0.35 },
      { date: '2026-10-23', value: 0 },
      { date: '2026-10-22', value: null },
      { date: '2026-10-25', value: null },
    ]);
  });
});

const daily = (statDate: string, over: Partial<StatDailyRow>): StatDailyRow =>
  ({ statDate, ...over }) as StatDailyRow;

describe('dailySeries', () => {
  it('reads one metric from the daily rows; call minutes are call seconds over 60; null stays null', () => {
    const rows = [
      daily('2026-10-26', { dau: 10, callSecondsTotal: 90, newAccountsRegistered: null }),
      daily('2026-10-25', { dau: 0, callSecondsTotal: null, newAccountsRegistered: 4 }),
    ];
    expect(dailySeries(rows, 'dau')).toEqual([
      { date: '2026-10-26', value: 10 },
      { date: '2026-10-25', value: 0 },
    ]);
    expect(dailySeries(rows, 'callMinutes')).toEqual([
      { date: '2026-10-26', value: 1.5 },
      { date: '2026-10-25', value: null },
    ]);
    expect(dailySeries(rows, 'newAccounts').map((p) => p.value)).toEqual([null, 4]);
  });

  it('reads new subscriptions and converted guest devices', () => {
    const rows = [daily('2026-10-26', { newSubscriptions: 3, guestDevicesConverted: 7 })];
    expect(dailySeries(rows, 'newSubscriptions')[0].value).toBe(3);
    expect(dailySeries(rows, 'guestConverted')[0].value).toBe(7);
  });

  it('turns a number that cannot be a count (negative, not finite) into null', () => {
    const rows = [daily('2026-10-26', { dau: -3, callSecondsTotal: Number.NaN })];
    expect(dailySeries(rows, 'dau')[0].value).toBeNull();
    expect(dailySeries(rows, 'callMinutes')[0].value).toBeNull();
  });
});

describe('changeFinality: which comparisons of a card may be judged as a rise or a fall', () => {
  it('is false for both when the day of the card is today: today is not over', () => {
    expect(changeFinality(TODAY, TODAY)).toEqual({ yesterday: false, weekAgo: false });
  });

  it('is true for both when the card shows a complete day, because the earlier days are complete too', () => {
    expect(changeFinality('2026-10-25', TODAY)).toEqual({ yesterday: true, weekAgo: true });
  });

  it('keeps the D1 of the cohort of yesterday provisional (its figure is counted today) and settles the cohort before', () => {
    expect(changeFinality('2026-10-25', TODAY, 1)).toEqual({ yesterday: false, weekAgo: false });
    expect(changeFinality('2026-10-24', TODAY, 1)).toEqual({ yesterday: true, weekAgo: true });
  });

  it('is false for a day that is not a calendar day', () => {
    expect(changeFinality('not-a-day', TODAY)).toEqual({ yesterday: false, weekAgo: false });
  });
});
