// Response and request shapes of the activity endpoints (contract 28.1, 28.2; field names as in
// docs/backend-inputs/2026-10-21-avatar-backend-reply-to-avataradmin.md, answer 17). Ids are strings.

export type Page<T> = { items: T[]; total: number };

/** The stored state of a sign-in activity. */
export const ACTIVITY_STATUSES = ['DRAFT', 'ACTIVE', 'DISABLED'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

/** The state shown and filtered by: the stored one, and `ENDED` (worked out when read, never stored). */
export const LIFECYCLE_STATUSES = ['DRAFT', 'ACTIVE', 'ENDED', 'DISABLED'] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export type CheckinActivity = {
  id: string;
  name: string;
  /** A calendar day `YYYY-MM-DD`; null means no limit. */
  startDate: string | null;
  endDate: string | null;
  status: ActivityStatus;
  createdBy: string | null;
  createdByUsername: string | null;
  lifecycleStatus: LifecycleStatus;
  createdAt: string;
  updatedAt: string;
};

export type CheckinReward = { dayNum: number; rewardCredits: number; bonusCredits: number };

export type CheckinActivityDetail = CheckinActivity & { rewards: CheckinReward[] };

/** The body of a new or edited activity; `dayNum` runs from 1 without a gap, in the order of the rows. */
export type ActivityBody = {
  name: string;
  startDate: string | null;
  endDate: string | null;
  rewards: CheckinReward[];
};

export type DisabledActivity = { id: string; name: string };

export type CheckinRecord = {
  id: string;
  accountId: string;
  activityId: string;
  /** The name now; null when the activity is gone (the id stays). */
  activityName: string | null;
  checkinDate: string;
  dayNum: number;
  consecutiveDays: number;
  rewardCredits: number;
  bonusCredits: number;
  createdAt: string;
};

/** The kinds of task the backend declares in code (contract 28.2). */
export const TASK_TYPES = ['daily_login', 'call_seconds', 'text_messages'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_STATUSES = ['ENABLED', 'DISABLED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type TaskConfig = {
  id: string;
  taskName: string;
  taskType: TaskType;
  /** At least 1; seconds for `call_seconds`; exactly 1 for `daily_login`. */
  targetValue: number;
  rewardCredits: number;
  description: string | null;
  /** Seconds to claim after the goal is reached; null means any time on the same local day. */
  claimTimeoutSeconds: number | null;
  sortOrder: number;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
};

export type TaskBody = {
  taskName: string;
  taskType: TaskType;
  targetValue: number;
  rewardCredits: number;
  description: string;
  claimTimeoutSeconds: number | null;
  sortOrder: number;
};

export const RECORD_STATUSES = ['IN_PROGRESS', 'CLAIMABLE', 'REWARDED', 'EXPIRED'] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export type TaskRecord = {
  id: string;
  accountId: string;
  taskId: string;
  /** The name now; null when the configuration is gone (the id stays). */
  taskName: string | null;
  /** The account's local day, not a UTC day. */
  taskDate: string;
  currentProgress: number;
  status: RecordStatus;
  timezone: string;
  windowStartAt: string;
  windowEndAt: string;
  targetValue: number;
  rewardCredits: number | null;
  completedAt: string | null;
  claimDeadlineAt: string | null;
  rewardedAt: string | null;
  creditsGranted: number | null;
  createdAt: string;
};
