import { daysBetween } from '../../src/utils/utcDay';
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

/** `from` and `to` of the query (last 7 days when missing); 400 INVALID_REQUEST when they are wrong or span too many days. */
export function rangeOf(
  req: MockReq,
  now: Date = new Date(),
): { from: string; to: string; today: string } {
  const today = todayOf(now);
  const to = text(req.query.to) || today;
  const from = text(req.query.from) || addDays(to, -6);
  for (const [ref, value] of [
    ['from', from],
    ['to', to],
  ] as const) {
    if (!validDay(value))
      throw invalidRequest(`${ref} must be YYYY-MM-DD`, [{ ref, reason: 'OUT_OF_RANGE' }]);
  }
  if (from > to)
    throw invalidRequest('from is after to', [{ ref: 'from', reason: 'OUT_OF_RANGE' }]);
  if (daysIn(from, to).length > META_DEFAULTS.statsMaxRangeDays) {
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
