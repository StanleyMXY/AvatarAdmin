import { daysBetween } from '../../utils/utcDay';

/**
 * Makes a daily series complete: every day from `from` to `to` (UTC calendar days, ascending, each
 * once) has a row; a day the backend sent nothing for gets `zero(statDate)`. Rows outside the range
 * are dropped; if a day appears twice the first row wins. `from` after `to` gives an empty list.
 */
export function fillMissingDays<T extends { statDate: string }>(
  rows: T[],
  from: string,
  to: string,
  zero: (statDate: string) => T,
): T[] {
  const byDay = new Map<string, T>();
  for (const row of rows) if (!byDay.has(row.statDate)) byDay.set(row.statDate, row);
  return daysBetween(from, to).map((day) => byDay.get(day) ?? zero(day));
}
