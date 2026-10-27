import type { Dayjs } from 'dayjs';

// Statistics days are UTC calendar days written `YYYY-MM-DD`. Nothing here depends on the time
// zone of the browser: a picked day is sent as picked, and "today" is the UTC date.

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number, width: number) => String(n).padStart(width, '0');

/** Milliseconds at 00:00:00 UTC of `day`; throws RangeError unless it is a real calendar day. */
function parseDay(day: string): number {
  const match = DAY_FORMAT.exec(day);
  if (!match) throw new RangeError(`not a YYYY-MM-DD day: ${day}`);
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, date);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== date) {
    throw new RangeError(`not a calendar day: ${day}`);
  }
  return d.getTime();
}

const formatDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function yesterdayUtc(now: Date = new Date()): string {
  return formatDay(parseDay(todayUtc(now)) - DAY_MS);
}

/** The last `n` UTC days including today. */
export function lastNDaysUtc(n: number, now: Date = new Date()): { from: string; to: string } {
  const to = todayUtc(now);
  return { from: formatDay(parseDay(to) - (n - 1) * DAY_MS), to };
}

/** The calendar day a date picker shows, as it was picked: no time zone conversion. */
export function pickedDay(d: Dayjs): string {
  return `${pad(d.year(), 4)}-${pad(d.month() + 1, 2)}-${pad(d.date(), 2)}`;
}

/** Every day from `from` to `to`, both included; empty when `from` is after `to`. */
export function daysBetween(from: string, to: string): string[] {
  const last = parseDay(to);
  const days: string[] = [];
  for (let ms = parseDay(from); ms <= last; ms += DAY_MS) days.push(formatDay(ms));
  return days;
}

/**
 * Turns the statistics day range `[from, to]` into the instants `[from 00:00:00Z, day after to
 * 00:00:00Z)` for endpoints that filter by event time. The end is not included.
 */
export function utcDayRangeToInstants(from: string, to: string): { from: string; to: string } {
  const start = parseDay(from);
  const end = parseDay(to) + DAY_MS;
  return { from: `${formatDay(start)}T00:00:00Z`, to: `${formatDay(end)}T00:00:00Z` };
}
