// Which statistics days are complete ("settled") and which are still being counted ("provisional").
//
// The rule, in one place for the overview, the daily report and the call quality page:
//
//   A day is COMPLETE when its UTC date is earlier than the UTC date of today. Today is not.
//
// Both dates are UTC calendar days written `YYYY-MM-DD`, the same days as `utcDay.ts`: "today" is
// `todayUtc()`, the date part of `now.toISOString()`, and nothing here reads the time zone of the
// browser. The statistics job recomputes today every `stats.land_interval_minutes` minutes and
// fixes a day only after it is over (contract 17.6), so a figure of today is a provisional value.
//
// A figure that is counted on the days after it (the D1 retention of a cohort is counted on the day
// after the cohort day) passes `lagDays`: it is complete only when `day + lagDays` is before today.

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whole days since 1970-01-01 of a real UTC calendar day; null for anything else. */
function dayNumber(day: string): number | null {
  const match = DAY_FORMAT.exec(day);
  if (!match) return null;
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, date);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== date) {
    return null;
  }
  return Math.round(d.getTime() / DAY_MS);
}

/** True when `day` (with `lagDays` more days to be counted) is over: its UTC date is before `today`. */
export function isSettledDay(day: string, today: string, lagDays = 0): boolean {
  const d = dayNumber(day);
  const t = dayNumber(today);
  return d !== null && t !== null && d + lagDays < t;
}

/**
 * True for a day that is still being counted: not complete, and not after today (a day that has
 * not begun has no value at all, so it is not a provisional value either). False for text that is
 * not a day.
 */
export function isProvisionalDay(day: string, today: string, lagDays = 0): boolean {
  const d = dayNumber(day);
  const t = dayNumber(today);
  return d !== null && t !== null && d <= t && !(d + lagDays < t);
}

/**
 * Whether the change between two days may be judged as a rise or a fall: only when both days are
 * complete. With one provisional day the figure may still be shown, but not as good or bad news.
 */
export function changeIsFinal(
  currentDay: string,
  earlierDay: string,
  today: string,
  lagDays = 0,
): boolean {
  return isSettledDay(currentDay, today, lagDays) && isSettledDay(earlierDay, today, lagDays);
}

/** True when any of the days is provisional. */
export function hasProvisionalDay(days: Iterable<string>, today: string, lagDays = 0): boolean {
  for (const day of days) if (isProvisionalDay(day, today, lagDays)) return true;
  return false;
}
