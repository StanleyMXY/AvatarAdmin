import type { SessionQualityRow } from '../../services/stats/types';
import { safeRatio } from '../../utils/ratio';

/** The four connect-time buckets, in the order of the contract (17.6): each call is in exactly one. */
export const JOIN_BUCKETS = ['joinLe2s', 'joinLe5s', 'joinLe10s', 'joinGt10s'] as const;
export type JoinBucket = (typeof JOIN_BUCKETS)[number];

export type QualityCounts = Omit<SessionQualityRow, 'statDate'>;

// A count that is missing, not a number or negative is not a count: it is left out, never used.
const valid = (n: unknown): number | null =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;

/** Connect success rate: `connected / (connected + agentUnavailable)`; null when that has no denominator or a part is missing. */
export function successRate(
  r: Pick<QualityCounts, 'connected' | 'agentUnavailable'>,
): number | null {
  const connected = valid(r.connected);
  const failed = valid(r.agentUnavailable);
  if (connected === null || failed === null) return null;
  return safeRatio(connected, connected + failed);
}

/** Average connect time in seconds: `joinMsSum / connected / 1000`; null without connected calls. */
export function averageJoinSeconds(
  r: Pick<QualityCounts, 'joinMsSum' | 'connected'>,
): number | null {
  const sum = valid(r.joinMsSum);
  const connected = valid(r.connected);
  if (sum === null || connected === null) return null;
  const ms = safeRatio(sum, connected);
  return ms === null ? null : ms / 1000;
}

/** The share of the connected calls that are in one bucket; null without connected calls. */
export function bucketShare(
  r: Pick<QualityCounts, 'connected'> & Partial<Record<JoinBucket, number>>,
  bucket: JoinBucket,
): number | null {
  const count = valid(r[bucket]);
  const connected = valid(r.connected);
  if (count === null || connected === null) return null;
  return safeRatio(count, connected);
}

const FIELDS: (keyof QualityCounts)[] = [
  'connected',
  'agentUnavailable',
  'limitReached',
  'discardedUserNotJoined',
  'joinLe2s',
  'joinLe5s',
  'joinLe10s',
  'joinGt10s',
  'joinMsSum',
];

/**
 * The counts of a range added up. Ratios are taken from these totals, not averaged over the days: a
 * day with few calls must not weigh as much as a day with many. No days at all is null: nothing is
 * known, which is not the same as 0.
 */
export function sumRows(rows: readonly SessionQualityRow[]): QualityCounts | null {
  if (rows.length === 0) return null;
  const totals = Object.fromEntries(FIELDS.map((f) => [f, 0])) as QualityCounts;
  for (const row of rows) {
    for (const field of FIELDS) totals[field] += valid(row[field]) ?? 0;
  }
  return totals;
}

export type QualityLimits = { minSuccessRate: number; maxSlowShare: number };

/**
 * Which cards get the red frame. The success rate is framed below its limit, the share of connects
 * slower than 10 seconds above its limit; a value that is not known is not framed.
 */
export function qualityFlags(
  value: { successRate: number | null; slowShare: number | null },
  limits: QualityLimits,
): { lowSuccessRate: boolean; highSlowShare: boolean } {
  return {
    lowSuccessRate: value.successRate !== null && value.successRate < limits.minSuccessRate,
    highSlowShare: value.slowShare !== null && value.slowShare > limits.maxSlowShare,
  };
}
