import { apiRequest } from '../../request/apiClient';
import type {
  CheckinDailyUsersRow,
  DateRange,
  GuestCohortRow,
  GuestDailyRow,
  GuestQuota,
  PlatformChannel,
  PushStatRow,
  ReactivationRow,
  RetentionRow,
  SessionQualityRow,
  StatDailyRow,
  StreakBucketRow,
  TaskDailyRow,
  TaskSummaryRow,
  UsageCostRow,
} from './types';

const items = async <T>(url: string, params: Record<string, unknown>): Promise<{ items: T[] }> =>
  apiRequest<{ items: T[] }>({ method: 'GET', url, params });

/** `GET /stats/daily`: one row per day (platform ALL also carries the business columns). */
export const getDaily = (p: DateRange & PlatformChannel) => items<StatDailyRow>('/stats/daily', p);

/** `GET /stats/retention`: one row per cohort day. */
export const getRetention = (p: DateRange & PlatformChannel & { type?: 'ACTIVE' | 'CALL' }) =>
  items<RetentionRow>('/stats/retention', p);

export const getReactivation = (p: DateRange & { silenceDays?: 7 | 14 | 30 }) =>
  items<ReactivationRow>('/stats/reactivation', p);

export const getGuestDaily = (p: DateRange) => items<GuestDailyRow>('/stats/guest/daily', p);

export const getGuestCohort = (p: DateRange) => items<GuestCohortRow>('/stats/guest/cohort', p);

export const getGuestRetention = (p: DateRange & PlatformChannel) =>
  items<RetentionRow>('/stats/guest/retention', p);

/** `GET /stats/guest/quota`: the one report whose answer is a single object, not `items`. */
export const getGuestQuota = (p: DateRange): Promise<GuestQuota> =>
  apiRequest<GuestQuota>({ method: 'GET', url: '/stats/guest/quota', params: p });

export const getSessionQuality = (p: DateRange) =>
  items<SessionQualityRow>('/stats/session-quality', p);

export const getPushStats = (p: DateRange & { triggerReason?: string }) =>
  items<PushStatRow>('/stats/push', p);

/** `GET /stats/usage-cost` needs `COST:VIEW`, not `STATS:VIEW`. */
export const getUsageCost = (
  p: DateRange & {
    resourceType?: string;
    provider?: string;
    model?: string;
    source?: string;
    tier?: string;
    currency?: string;
  },
) => items<UsageCostRow>('/stats/usage-cost', p);

export const getCheckinDailyUsers = (p: DateRange) =>
  items<CheckinDailyUsersRow>('/stats/checkin/daily-users', p);

export const getCheckinStreakBuckets = (p: DateRange) =>
  items<StreakBucketRow>('/stats/checkin/streak-buckets', p);

export const getTasksSummary = (p: DateRange) => items<TaskSummaryRow>('/stats/tasks/summary', p);

export const getTasksDaily = (p: DateRange) => items<TaskDailyRow>('/stats/tasks/daily', p);
