import { daysBetween } from '../../src/utils/utcDay';
import { currentValue } from './configStore';
import { invalidRequest, type MockReq } from './http';
import { META_DEFAULTS } from './meta';
import { addDays, todayOf } from './statData';

export const daysIn = daysBetween;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function validDay(value: string): boolean {
  if (!DAY.test(value) || Number(value.slice(0, 4)) < 1) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

export const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const FIRST_DAY = '0001-01-01';

/**
 * The range of a statistics query, the one rule of contract 17.6 for every statistics endpoint.
 * Neither date given: the last 7 days to today. One given: the other is six days away from it and
 * never later than today (so a `from` after today is "from is after to"). A date that is not a day
 * (or a year below 1) is 400 `<ref> must be YYYY-MM-DD` with reason OUT_OF_RANGE, `from` checked
 * before `to`; then `from` after `to` is 400 on `from`, and a range longer than
 * `stats.max_range_days` is 400 on `to`. An empty value counts as not given.
 */
export function rangeOf(
  req: MockReq,
  now: Date = new Date(),
): { from: string; to: string; today: string } {
  const today = todayOf(now);
  let from = text(req.query.from);
  let to = text(req.query.to);
  for (const [ref, value] of [
    ['from', from],
    ['to', to],
  ] as const) {
    if (value !== '' && !validDay(value))
      throw invalidRequest(`${ref} must be YYYY-MM-DD`, [{ ref, reason: 'OUT_OF_RANGE' }]);
  }
  // The day derived from the other one: inside the calendar, and never later than today.
  const derived = (day: string, days: number): string => {
    const moved = addDays(day, days);
    if (!validDay(moved)) return days < 0 ? FIRST_DAY : today;
    return [moved, today].sort()[0];
  };
  if (from === '' && to === '') to = today;
  if (from === '') from = derived(to, -6);
  else if (to === '') to = derived(from, 6);
  if (from > to)
    throw invalidRequest('from is after to', [{ ref: 'from', reason: 'OUT_OF_RANGE' }]);
  // The limit is the key `stats.max_range_days` as it is saved now (the contract's default until then).
  const limit = currentValue('stats.max_range_days');
  const longest = typeof limit === 'number' ? limit : META_DEFAULTS.statsMaxRangeDays;
  if (daysIn(from, to).length > longest) {
    throw invalidRequest('The range exceeds stats.max_range_days', [
      { ref: 'to', reason: 'OUT_OF_RANGE' },
    ]);
  }
  return { from, to, today };
}

export const oneOf = (
  req: MockReq,
  name: string,
  allowed: readonly string[],
  fallback: string,
): string => {
  const value = text(req.query[name]) || fallback;
  if (!allowed.includes(value)) {
    throw invalidRequest(`${name} is not one of ${allowed.join(', ')}`, [
      { ref: name, reason: 'OUT_OF_RANGE' },
    ]);
  }
  return value;
};

export const PLATFORMS = ['ALL', 'ANDROID', 'IOS', 'unknown'];
const CHANNEL = /^[a-z0-9_-]{2,32}$/;
export const channelOf = (req: MockReq): string => {
  const value = text(req.query.channel) || 'ALL';
  if (value !== 'ALL' && !CHANNEL.test(value)) {
    throw invalidRequest('channel is not a channel code', [
      { ref: 'channel', reason: 'OUT_OF_RANGE' },
    ]);
  }
  return value;
};

// The trigger reasons of the push statistics (contract 18, `triggerReason`).
export const TRIGGERS = ['daily_recall', 'streak_at_risk', 'admin', 'system_event'];

export const LAND_NAMES = [
  'daily-event',
  'daily-business',
  'subscription-snapshot',
  'retention',
  'reactivation',
  'guest-cohort',
  'guest-retention',
  'session-quality',
  'push',
  'usage-cost',
  'ad-daily',
  'attribution-daily',
  'share-funnel',
  'share-channel',
  'checkin-daily',
  'task-daily',
] as const;
