import { describe, expect, it } from 'vitest';
import type { SessionQualityRow } from '../../services/stats/types';
import {
  averageJoinSeconds,
  bucketShare,
  JOIN_BUCKETS,
  qualityFlags,
  successRate,
  sumRows,
} from './qualityMetrics';

const row = (over: Partial<SessionQualityRow> = {}): SessionQualityRow => ({
  statDate: '2026-10-20',
  connected: 100,
  agentUnavailable: 0,
  limitReached: 0,
  discardedUserNotJoined: 0,
  joinLe2s: 50,
  joinLe5s: 30,
  joinLe10s: 15,
  joinGt10s: 5,
  joinMsSum: 300000,
  ...over,
});

describe('the connect success rate', () => {
  it('is connected / (connected + agentUnavailable)', () => {
    expect(successRate({ connected: 95, agentUnavailable: 5 })).toBe(0.95);
    expect(successRate({ connected: 90, agentUnavailable: 10 })).toBe(0.9);
    // the limit and the never-joined counts are not failures of the service: they are not in it
    expect(successRate({ connected: 3, agentUnavailable: 1 })).toBe(0.75);
  });

  it('is 0, not a dash, when there were attempts and none connected', () => {
    expect(successRate({ connected: 0, agentUnavailable: 4 })).toBe(0);
  });

  it('is null when the denominator is 0 or a number is missing or negative', () => {
    expect(successRate({ connected: 0, agentUnavailable: 0 })).toBeNull();
    expect(successRate({ connected: Number.NaN, agentUnavailable: 1 })).toBeNull();
    expect(successRate({ connected: 5, agentUnavailable: undefined as never })).toBeNull();
    expect(successRate({ connected: -5, agentUnavailable: 1 })).toBeNull();
    expect(successRate({ connected: 5, agentUnavailable: -1 })).toBeNull();
  });
});

describe('the average connect time', () => {
  it('is joinMsSum / connected, in seconds', () => {
    expect(averageJoinSeconds({ joinMsSum: 5000, connected: 2 })).toBe(2.5);
    expect(averageJoinSeconds({ joinMsSum: 0, connected: 4 })).toBe(0);
  });

  it('is null without connected calls, and never negative', () => {
    expect(averageJoinSeconds({ joinMsSum: 5000, connected: 0 })).toBeNull();
    expect(averageJoinSeconds({ joinMsSum: -5000, connected: 2 })).toBeNull();
    expect(averageJoinSeconds({ joinMsSum: Number.NaN, connected: 2 })).toBeNull();
  });
});

describe('the four connect-time buckets', () => {
  it('are in the order of the contract and each is a share of connected', () => {
    expect(JOIN_BUCKETS).toEqual(['joinLe2s', 'joinLe5s', 'joinLe10s', 'joinGt10s']);
    const r = row();
    const shares = JOIN_BUCKETS.map((b) => bucketShare(r, b));
    expect(shares).toEqual([0.5, 0.3, 0.15, 0.05]);
    // mutually exclusive: together they are all of the connected calls
    expect(shares.reduce((a, b) => (a ?? 0) + (b ?? 0), 0)).toBeCloseTo(1, 10);
  });

  it('are null with no connected calls', () => {
    expect(bucketShare(row({ connected: 0, joinLe2s: 0, joinGt10s: 0 }), 'joinGt10s')).toBeNull();
  });

  it('keep 0 as 0', () => {
    expect(bucketShare(row({ joinGt10s: 0 }), 'joinGt10s')).toBe(0);
  });
});

describe('the totals of a range', () => {
  it('add the counts of the days; a ratio of the totals is not an average of daily ratios', () => {
    const totals = sumRows([
      row({
        connected: 10,
        agentUnavailable: 0,
        joinGt10s: 0,
        joinLe2s: 10,
        joinLe5s: 0,
        joinLe10s: 0,
      }),
      row({
        connected: 90,
        agentUnavailable: 10,
        joinGt10s: 9,
        joinLe2s: 81,
        joinLe5s: 0,
        joinLe10s: 0,
      }),
    ]);
    expect(totals).not.toBeNull();
    expect(totals?.connected).toBe(100);
    expect(totals?.agentUnavailable).toBe(10);
    // 100 / 110, not the mean of 100% and 90%
    expect(successRate(totals as never)).toBeCloseTo(100 / 110, 10);
    expect(bucketShare(totals as never, 'joinGt10s')).toBe(0.09);
  });

  it('are null for no days at all (nothing is known, which is not 0)', () => {
    expect(sumRows([])).toBeNull();
  });

  it('skip a number that is missing or negative instead of adding it', () => {
    const totals = sumRows([
      row({ limitReached: Number.NaN }),
      row({ limitReached: -3 }),
      row({ limitReached: 4 }),
    ]);
    expect(totals?.limitReached).toBe(4);
  });
});

describe('the red frame', () => {
  const limits = { minSuccessRate: 0.95, maxSlowShare: 0.05 };
  const flags = (success: number | null, slow: number | null, l = limits) =>
    qualityFlags({ successRate: success, slowShare: slow }, l);

  it('is drawn below the success-rate limit, not at it', () => {
    expect(flags(0.949, 0).lowSuccessRate).toBe(true);
    expect(flags(0.95, 0).lowSuccessRate).toBe(false);
    expect(flags(1, 0).lowSuccessRate).toBe(false);
    expect(flags(0, 0).lowSuccessRate).toBe(true);
  });

  it('is drawn above the slow-share limit, not at it', () => {
    expect(flags(1, 0.051).highSlowShare).toBe(true);
    expect(flags(1, 0.05).highSlowShare).toBe(false);
    expect(flags(1, 0).highSlowShare).toBe(false);
  });

  it('is not drawn for a value that is not known', () => {
    expect(flags(null, null)).toEqual({ lowSuccessRate: false, highSlowShare: false });
  });

  it('follows the limits it is given', () => {
    expect(flags(0.9, 0.08, { minSuccessRate: 0.85, maxSlowShare: 0.1 })).toEqual({
      lowSuccessRate: false,
      highSlowShare: false,
    });
    expect(flags(0.9, 0.08, { minSuccessRate: 0.95, maxSlowShare: 0.05 })).toEqual({
      lowSuccessRate: true,
      highSlowShare: true,
    });
    expect(flags(0.9, 0.08, { minSuccessRate: 0.99, maxSlowShare: 0.07 })).toEqual({
      lowSuccessRate: true,
      highSlowShare: true,
    });
    expect(flags(0.9, 0.08, { minSuccessRate: 0.9, maxSlowShare: 0.08 })).toEqual({
      lowSuccessRate: false,
      highSlowShare: false,
    });
  });
});
