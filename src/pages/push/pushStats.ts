import type { PushStatRow } from '../../services/stats';
import { safeRatio } from '../../utils/ratio';

/** Opened over sent (contract 17.6); `null` when nothing was sent, so the page shows a dash. */
export function openRate(row: Pick<PushStatRow, 'pushesOpened' | 'pushesSent'>): number | null {
  return safeRatio(row.pushesOpened, row.pushesSent);
}

export type PushDay = {
  statDate: string;
  pushesSent: number;
  deliveriesOk: number;
  deliveriesFailed: number;
  pushesOpened: number;
};

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/**
 * One point for each day for the chart: the counts of the reasons of a day added up (every count
 * belongs to one reason, so the sum is the day's number). A count that is not a number is nothing.
 */
export function sumByDay(rows: readonly PushStatRow[]): PushDay[] {
  const days = new Map<string, PushDay>();
  for (const row of rows) {
    const day = days.get(row.statDate) ?? {
      statDate: row.statDate,
      pushesSent: 0,
      deliveriesOk: 0,
      deliveriesFailed: 0,
      pushesOpened: 0,
    };
    day.pushesSent += count(row.pushesSent);
    day.deliveriesOk += count(row.deliveriesOk);
    day.deliveriesFailed += count(row.deliveriesFailed);
    day.pushesOpened += count(row.pushesOpened);
    days.set(row.statDate, day);
  }
  return [...days.values()].sort((a, b) => a.statDate.localeCompare(b.statDate));
}
