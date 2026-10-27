import type { RetentionRow, StatDailyRow } from '../../services/stats/types';
import { daysBetween, lastNDaysUtc } from '../../utils/utcDay';
import { cleanFigure, dailySeries, shiftDay } from './cardChange';

/** The metrics of the trend chart, in the order of the spec (5.1). */
export const TREND_METRICS = ['dau', 'newAccounts', 'callMinutes', 'd1'] as const;
export type TrendMetric = (typeof TREND_METRICS)[number];

export const DEFAULT_METRICS: TrendMetric[] = ['dau', 'newAccounts'];

export const RANGE_PRESETS = ['today', 'last7', 'last14', 'last30', 'custom'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

const PRESET_DAYS = { today: 1, last7: 7, last14: 14, last30: 30 } as const;

/** The days of a preset counted back from `today` (a UTC day), today included; `custom` has none. */
export function rangeOfPreset(
  preset: RangePreset,
  today: string,
): { from: string; to: string } | null {
  if (preset === 'custom') return null;
  return lastNDaysUtc(PRESET_DAYS[preset], new Date(`${today}T00:00:00Z`));
}

/** Which axis a metric belongs to: people and minutes share one, a percentage has its own. */
export const axisGroupOf = (metric: TrendMetric): 'count' | 'percent' =>
  metric === 'd1' ? 'percent' : 'count';

export type TrendPoint = { statDate: string; value: number | null; lastWeek: number | null };

type Input = {
  metric: TrendMetric;
  range: { from: string; to: string };
  daily: StatDailyRow[];
  retention: RetentionRow[];
  /** The days that were loaded: a day outside is not known, it is not 0. */
  window: { from: string; to: string };
  today: string;
};

/** D1 in percent per cohort day, as `d1 * 100 / size`; null for a cohort without a d1 or without accounts. */
function d1Percent(rows: RetentionRow[]): Map<string, number | null> {
  const byDay = new Map<string, number | null>();
  for (const row of rows) {
    if ((row.retentionType ?? 'ACTIVE') !== 'ACTIVE') continue;
    if ((row.platform ?? 'ALL') !== 'ALL' || (row.channelCode ?? 'ALL') !== 'ALL') continue;
    const d1 = cleanFigure(row.d1);
    const size = cleanFigure(row.cohortSize);
    byDay.set(row.cohortDate, d1 === null || !size ? null : (d1 * 100) / size);
  }
  return byDay;
}

/**
 * One value per day of the range, oldest first, with the value of the same day one week earlier.
 * A past day inside the loaded days that has no row is 0 (spec 4.4); a day whose column is null,
 * today before its row exists, a day outside the loaded days, and a cohort that does not exist are
 * gaps, because they are not known and 0 would say something else.
 */
export function trendPoints({
  metric,
  range,
  daily,
  retention,
  window,
  today,
}: Input): TrendPoint[] {
  const known =
    metric === 'd1'
      ? d1Percent(retention)
      : new Map(dailySeries(daily, metric).map((point) => [point.date, point.value]));

  const valueOn = (day: string | null): number | null => {
    if (day === null || day < window.from || day > window.to) return null;
    if (known.has(day)) return known.get(day) ?? null;
    return metric === 'd1' || day === today ? null : 0;
  };

  return daysBetween(range.from, range.to).map((statDate) => ({
    statDate,
    value: valueOn(statDate),
    lastWeek: valueOn(shiftDay(statDate, -7)),
  }));
}
