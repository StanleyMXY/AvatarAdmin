import { describe, expect, it } from 'vitest';
import type { PushStatRow } from '../../services/stats';
import { openRate, sumByDay } from './pushStats';

const row = (
  statDate: string,
  triggerReason: string,
  sent: number,
  ok: number,
  failed: number,
  opened: number,
): PushStatRow => ({
  statDate,
  triggerReason,
  pushesSent: sent,
  deliveriesOk: ok,
  deliveriesFailed: failed,
  pushesOpened: opened,
});

describe('openRate', () => {
  it('is opened over sent', () => {
    expect(openRate({ pushesOpened: 25, pushesSent: 100 })).toBe(0.25);
  });

  it('is null when nothing was sent (a dash, never 0 or NaN)', () => {
    expect(openRate({ pushesOpened: 5, pushesSent: 0 })).toBeNull();
    expect(openRate({ pushesOpened: 0, pushesSent: 0 })).toBeNull();
  });

  it('is null for a row whose numbers are not numbers', () => {
    expect(openRate({ pushesOpened: null as unknown as number, pushesSent: 10 })).toBeNull();
    expect(openRate({ pushesOpened: 1, pushesSent: undefined as unknown as number })).toBeNull();
  });

  it('may be above 100 percent: opens are counted on the day of the tap, not of the send', () => {
    expect(openRate({ pushesOpened: 12, pushesSent: 10 })).toBe(1.2);
  });
});

describe('sumByDay: one point for each day, the reasons added up', () => {
  it('adds the four counts of the reasons of a day and keeps the days in order', () => {
    const days = sumByDay([
      row('2026-10-02', 'admin', 10, 9, 1, 2),
      row('2026-10-01', 'daily_recall', 100, 90, 10, 20),
      row('2026-10-01', 'streak_at_risk', 50, 45, 5, 5),
    ]);
    expect(days).toEqual([
      {
        statDate: '2026-10-01',
        pushesSent: 150,
        deliveriesOk: 135,
        deliveriesFailed: 15,
        pushesOpened: 25,
      },
      {
        statDate: '2026-10-02',
        pushesSent: 10,
        deliveriesOk: 9,
        deliveriesFailed: 1,
        pushesOpened: 2,
      },
    ]);
  });

  it('is empty for no rows, and a number that is not one counts as nothing', () => {
    expect(sumByDay([])).toEqual([]);
    const days = sumByDay([
      row('2026-10-01', 'admin', 5, Number.NaN, null as unknown as number, 1),
    ]);
    expect(days[0]).toMatchObject({
      pushesSent: 5,
      deliveriesOk: 0,
      deliveriesFailed: 0,
      pushesOpened: 1,
    });
  });
});
