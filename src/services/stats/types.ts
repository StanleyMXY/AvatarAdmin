// Row shapes of the report endpoints (contract 17.6). A column that can be missing is `| null`:
// the page shows a dash for it, never a 0.

export type DateRange = { from: string; to: string };
export type PlatformChannel = { platform?: string; channel?: string };

export type StatDailyRow = {
  statDate: string;
  platform?: string;
  channelCode?: string;
  dau: number | null;
  dauDevices: number | null;
  wau: number | null;
  mau: number | null;
  avatarCreatedAccounts: number | null;
  voiceClonedAccounts: number | null;
  sessionStartedAccounts: number | null;
  // only with platform ALL; null for the other platforms
  newAccountsRegistered: number | null;
  guestDevicesNew: number | null;
  guestDevicesConverted: number | null;
  guestSessionsConnected: number | null;
  guestCallSecondsTotal: number | null;
  sessionsConnected: number | null;
  accountsWithCall: number | null;
  callSecondsTotal: number | null;
  messagesUser: number | null;
  messagesAssistant: number | null;
  newSubscriptions: number | null;
  creditPurchases: number | null;
  creditsSpent: number | null;
  /** The day-end snapshot; null for today and for a day without one. */
  activeSubscriptions: number | null;
  activeSubscriptionsBackfilled: boolean | null;
};

export const RETENTION_DAYS = [1, 3, 5, 7, 14, 21, 30, 60, 90] as const;
export type RetentionDay = (typeof RETENTION_DAYS)[number];

type RetentionCells = { [K in `d${RetentionDay}`]: number | null };

/** A cohort row: the cohort size and, per N, how many came back on day N (null before that day). */
export type RetentionRow = RetentionCells & {
  cohortDate: string;
  retentionType?: 'ACTIVE' | 'CALL';
  platform?: string;
  channelCode?: string;
  cohortSize: number;
};

export type ReactivationRow = {
  statDate: string;
  silenceDays: number;
  silentUsers: number;
  reactivated: number;
};

export type GuestDailyRow = {
  statDate: string;
  guestDevicesNew: number;
  guestDevicesConverted: number;
};

export const GUEST_COHORT_DAYS = [0, 1, 2, 3, 5, 7, 14, 30] as const;
export type GuestCohortRow = { [K in `d${(typeof GUEST_COHORT_DAYS)[number]}`]: number | null } & {
  cohortDate: string;
  cohortSize: number;
};

export type GuestQuotaBucketKey = 'ZERO' | 'LE_25' | 'LE_50' | 'LE_75' | 'LT_100' | 'GE_100';
export type GuestQuota = {
  configuredTotalSeconds: number | null;
  devices: number;
  noGrant: number;
  neverCalled: number;
  avgUsedSeconds: number | null;
  exhausted: number;
  buckets: Record<GuestQuotaBucketKey, { devices: number; converted: number }>;
};

export type SessionQualityRow = {
  statDate: string;
  connected: number;
  agentUnavailable: number;
  limitReached: number;
  discardedUserNotJoined: number;
  joinLe2s: number;
  joinLe5s: number;
  joinLe10s: number;
  joinGt10s: number;
  joinMsSum: number;
};

export type PushStatRow = {
  statDate: string;
  triggerReason: string;
  pushesSent: number;
  deliveriesOk: number;
  deliveriesFailed: number;
  pushesOpened: number;
};

export type UsageCostRow = {
  statDate: string;
  resourceType: string;
  provider: string;
  model: string;
  unit: string;
  source: string;
  tier: string;
  currency: string;
  requests: number;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  /**
   * `quantity` and `costAmount` are money and amounts of a unit: the contract does not say whether
   * the backend writes them as decimal text or as a JSON number (see the question file about the
   * cost report), so a reader takes either and treats them as decimal text, never adds them as
   * floats (`pages/cost/costRows.ts` does so with exact decimals).
   */
  quantity: string | number | null;
  costAmount: string | number | null;
  unpricedRequests: number;
};

export type CheckinDailyUsersRow = { statDate: string; userCount: number };
export type StreakBucketRow = { consecutiveDays: number; checkinCount: number };
export type TaskSummaryRow = {
  taskId: string;
  taskName: string;
  totalRecords: number;
  completedCount: number;
  rewardedCount: number;
  creditsIssued: number;
  completionRate: number | null;
};
export type TaskDailyRow = {
  statDate: string;
  totalRecords: number;
  completedCount: number;
  rewardedCount: number;
};

/** The names of `POST /stats/land/{name}` (contract 17.6). */
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
export type LandName = (typeof LAND_NAMES)[number];
