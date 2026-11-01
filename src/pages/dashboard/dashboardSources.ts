import { getModerationStats } from '../../services/moderation';
import { listAlerts } from '../../services/monitor';
import { getDaily, getRetention } from '../../services/stats/reports';
import type { RetentionRow, StatDailyRow } from '../../services/stats/types';
import { lastNDaysUtc, todayUtc } from '../../utils/utcDay';
import { cleanFigure } from './cardChange';

/** The days of the daily report and the retention report that the overview reads (spec 5.1). */
export const LOADED_DAYS = 90;

/**
 * How many days to read: 90, or fewer when the backend allows a shorter range
 * (`stats.max_range_days`, from the shared values), so that the request is not refused.
 */
export function loadedDays(statsMaxRangeDays?: number | null): number {
  return typeof statsMaxRangeDays === 'number' &&
    Number.isFinite(statsMaxRangeDays) &&
    statsMaxRangeDays >= 1
    ? Math.min(LOADED_DAYS, Math.floor(statsMaxRangeDays))
    : LOADED_DAYS;
}

type Window = { from: string; to: string };

export type DailyData = { today: string; window: Window; rows: StatDailyRow[] };
export type RetentionData = { today: string; window: Window; rows: RetentionRow[] };

/** `GET /stats/daily`, platform ALL, the last 90 UTC days (fewer when the backend allows fewer). */
export async function loadDaily(statsMaxRangeDays?: number | null): Promise<DailyData> {
  const window = lastNDaysUtc(loadedDays(statsMaxRangeDays));
  const { items } = await getDaily({ from: window.from, to: window.to, platform: 'ALL' });
  return { today: window.to, window, rows: items };
}

/** `GET /stats/retention`, account retention (ACTIVE), the last 90 UTC cohort days. */
export async function loadRetention(statsMaxRangeDays?: number | null): Promise<RetentionData> {
  const window = lastNDaysUtc(loadedDays(statsMaxRangeDays));
  const { items } = await getRetention({
    from: window.from,
    to: window.to,
    type: 'ACTIVE',
    platform: 'ALL',
  });
  return { today: window.to, window, rows: items };
}

export type PlatformDau = { today: string; dau: number | null };

/** `GET /stats/daily?platform=…`, today only: the DAU of one platform (null when there is no row or number). */
export async function loadPlatformDau(platform: 'ANDROID' | 'IOS'): Promise<PlatformDau> {
  const today = todayUtc();
  const { items } = await getDaily({ from: today, to: today, platform });
  const row = items.find((item) => item.statDate === today);
  return { today, dau: cleanFigure(row?.dau) };
}

/** `GET /moderation/stats`: how long the oldest waiting record has waited, in seconds; null when nothing waits. */
export async function loadOldestPending(): Promise<number | null> {
  const today = todayUtc();
  const stats = await getModerationStats({ from: today, to: today });
  return cleanFigure(stats.oldestPendingSeconds);
}

/** `GET /alerts?status=OPEN&page=1&pageSize=1`: only the total is read. */
export async function loadOpenAlertCount(): Promise<number | null> {
  const answer = await listAlerts({ status: 'OPEN', page: 1, pageSize: 1 });
  return cleanFigure(answer.total);
}
