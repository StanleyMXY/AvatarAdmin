import type { DayRange } from '../../components/stat/DateRangeUtc';
import { lastNDaysUtc } from '../../utils/utcDay';

/**
 * The range the three live pages start with: the last 7 UTC days, or fewer when the backend allows
 * fewer (`analytics.live_max_range_days`), so that the first ask is not refused.
 */
export function defaultRange(maxDays: number | null | undefined, days = 7): DayRange {
  const limit =
    typeof maxDays === 'number' && Number.isFinite(maxDays) && maxDays >= 1 ? maxDays : days;
  return lastNDaysUtc(Math.min(days, Math.floor(limit)));
}
