import type { DayRange } from '../../components/stat/DateRangeUtc';
import { lastNDaysUtc } from '../../utils/utcDay';

/**
 * The range a report page starts with: the last `days` (7 by default) UTC days, or fewer when the
 * backend allows fewer (`stats.max_range_days` for the statistics pages, `analytics.live_max_range_days`
 * for the live event pages), so that the first ask is not refused. Today is the last day.
 */
export function defaultRange(maxDays: number | null | undefined, days = 7): DayRange {
  const limit =
    typeof maxDays === 'number' && Number.isFinite(maxDays) && maxDays >= 1 ? maxDays : days;
  return lastNDaysUtc(Math.min(days, Math.floor(limit)));
}
