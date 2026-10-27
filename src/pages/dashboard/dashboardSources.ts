import { getModerationStats } from '../../services/moderation';
import { listAlerts } from '../../services/monitor';
import { getDaily, getRetention } from '../../services/stats/reports';
import type { RetentionRow, StatDailyRow } from '../../services/stats/types';
import { lastNDaysUtc, todayUtc } from '../../utils/utcDay';
import { cleanFigure } from './cardChange';

/** The days of the daily report and the retention report that the overview reads (spec 5.1). */
export const LOADED_DAYS = 90;

type Window = { from: string; to: string };

export type DailyData = { today: string; window: Window; rows: StatDailyRow[] };
export type RetentionData = { today: string; window: Window; rows: RetentionRow[] };

/** `GET /stats/daily`, platform ALL, the last 90 UTC days. */
export async function loadDaily(): Promise<DailyData> {
  const window = lastNDaysUtc(LOADED_DAYS);
  const { items } = await getDaily({ from: window.from, to: window.to, platform: 'ALL' });
  return { today: window.to, window, rows: items };
}

/** `GET /stats/retention`, account retention (ACTIVE), the last 90 UTC cohort days. */
export async function loadRetention(): Promise<RetentionData> {
  const window = lastNDaysUtc(LOADED_DAYS);
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
