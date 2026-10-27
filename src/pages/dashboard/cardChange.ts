import type { RetentionRow, StatDailyRow } from '../../services/stats/types';

/** One day of a card's metric: `date` is a UTC calendar day `YYYY-MM-DD`, `value` is null when not known. */
export type SeriesPoint = { date: string; value: number | null };

export type CardChange = {
  /** The value on the day asked for; null when there is none. */
  current: number | null;
  /** Against the day before, in percent (or percentage points); null when it cannot be told. */
  vsYesterday: number | null;
  /** Against the same day one week before, in percent (or percentage points); null when it cannot be told. */
  vs7DaysAgo: number | null;
};

/**
 * `relative`: the change as a percentage of the earlier value (a count). `points`: the series holds
 * ratios (0.42 is 42%) and the change is the difference in percentage points.
 */
export type ChangeKind = 'relative' | 'points';

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The UTC calendar day `n` days after `day` (before, when negative); null when `day` is not a real day. */
export function shiftDay(day: string, n: number): string | null {
  const match = DAY.exec(day);
  if (!match) return null;
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, date);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== date) {
    return null;
  }
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** A figure that can be a count or a ratio: finite and not below 0. Anything else is "not known". */
export const cleanFigure = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

function changeAgainst(
  current: number | null,
  earlier: number | null,
  kind: ChangeKind,
): number | null {
  // An earlier value of 0 (or none) leaves nothing to compare with: a dash, not +∞ or 0%.
  if (current === null || earlier === null || earlier <= 0) return null;
  return kind === 'points' ? (current - earlier) * 100 : ((current - earlier) / earlier) * 100;
}

/**
 * The value of `today` and how it compares with the day before and with the same day a week
 * earlier. The series can be in any order; days it does not have, and values that are null,
 * negative or not finite, count as not known.
 */
export function computeCardChange(
  series: Array<{ date: string; value: number | null }>,
  today: string,
  kind: ChangeKind = 'relative',
): CardChange {
  const none: CardChange = { current: null, vsYesterday: null, vs7DaysAgo: null };
  const yesterday = shiftDay(today, -1);
  const weekAgo = shiftDay(today, -7);
  if (yesterday === null || weekAgo === null) return none;
  const byDay = new Map<string, number | null>();
  for (const point of series) byDay.set(point.date, cleanFigure(point.value));
  const current = byDay.get(today) ?? null;
  return {
    current,
    vsYesterday: changeAgainst(current, byDay.get(yesterday) ?? null, kind),
    vs7DaysAgo: changeAgainst(current, byDay.get(weekAgo) ?? null, kind),
  };
}

/** The account retention rows of all platforms and channels: what the D1 card and the chart read. */
const isActiveAll = (row: RetentionRow): boolean =>
  (row.retentionType ?? 'ACTIVE') === 'ACTIVE' &&
  (row.platform ?? 'ALL') === 'ALL' &&
  (row.channelCode ?? 'ALL') === 'ALL';

const hasD1 = (row: RetentionRow): boolean => cleanFigure(row.d1) !== null;

/**
 * The newest ACTIVE cohort whose `d1` has a value. The newest cohorts have none yet (the first day
 * after them has not been counted), so this is the latest D1 that is known. A `d1` of 0 is a value.
 */
export function latestCohortWithD1(rows: RetentionRow[]): RetentionRow | null {
  let latest: RetentionRow | null = null;
  for (const row of rows) {
    if (!isActiveAll(row) || !hasD1(row) || !DAY.test(row.cohortDate)) continue;
    if (latest === null || row.cohortDate > latest.cohortDate) latest = row;
  }
  return latest;
}

/** D1 retention per cohort as a ratio; null where the cohort has no d1 yet or no accounts. */
export function retentionD1Series(rows: RetentionRow[]): SeriesPoint[] {
  return rows.filter(isActiveAll).map((row) => {
    const d1 = cleanFigure(row.d1);
    const size = cleanFigure(row.cohortSize);
    return { date: row.cohortDate, value: d1 === null || !size ? null : d1 / size };
  });
}

/** The metrics of the daily cards. */
export type DailyMetric =
  | 'dau'
  | 'newAccounts'
  | 'callMinutes'
  | 'newSubscriptions'
  | 'guestConverted';

const dailyFigure = (row: StatDailyRow, metric: DailyMetric): number | null => {
  switch (metric) {
    case 'dau':
      return cleanFigure(row.dau);
    case 'newAccounts':
      return cleanFigure(row.newAccountsRegistered);
    case 'callMinutes': {
      const seconds = cleanFigure(row.callSecondsTotal);
      return seconds === null ? null : seconds / 60;
    }
    case 'newSubscriptions':
      return cleanFigure(row.newSubscriptions);
    case 'guestConverted':
      return cleanFigure(row.guestDevicesConverted);
  }
};

/** One metric of the daily rows by day (`callSecondsTotal` is shown in minutes). */
export function dailySeries(rows: StatDailyRow[], metric: DailyMetric): SeriesPoint[] {
  return rows.map((row) => ({ date: row.statDate, value: dailyFigure(row, metric) }));
}
