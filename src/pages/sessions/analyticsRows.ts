import type { StatDailyRow } from '../../services/stats/types';
import { safeRatio } from '../../utils/ratio';

/** One day of the call analytics: the five figures of the spec; null is "not known". */
export type CallDay = {
  statDate: string;
  calls: number | null;
  callers: number | null;
  minutes: number | null;
  minutesPerCaller: number | null;
  callsPerCaller: number | null;
};

// A count that is missing, not a number or negative is not a count.
const count = (n: unknown): number | null =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;

/**
 * The figures of one `/stats/daily` row (platform ALL). Minutes are seconds / 60; the two per-caller
 * figures divide by the accounts that called, and are null when nobody called (never 0, never NaN).
 */
export function toCallDay(row: StatDailyRow): CallDay {
  const calls = count(row.sessionsConnected);
  const callers = count(row.accountsWithCall);
  const seconds = count(row.callSecondsTotal);
  const perCallerSeconds = safeRatio(seconds, callers);
  return {
    statDate: row.statDate,
    calls,
    callers,
    minutes: seconds === null ? null : seconds / 60,
    minutesPerCaller: perCallerSeconds === null ? null : perCallerSeconds / 60,
    callsPerCaller: safeRatio(calls, callers),
  };
}

/** A day the backend sent no row for: nothing happened (0), and the per-caller figures are not known. */
export const emptyCallDay = (statDate: string): CallDay => ({
  statDate,
  calls: 0,
  callers: 0,
  minutes: 0,
  minutesPerCaller: null,
  callsPerCaller: null,
});
