// Response and request shapes of the push endpoints (contract 8.3 to 8.5, 17.4 "推送管理" row; field
// names are the columns of the entities in contract chapter 18). What the contract leaves open is in
// docs/contract-requests/2026-10-26-admin-frontend-push.md.

import type { Page } from '../../request/errors';

export type { Page };

/** What a push opens when it is tapped (contract 8.3). */
export type LinkType = 'NONE' | 'SCREEN' | 'URL';

/** Only the recall reasons have templates; `admin` and `system_event` take their words from the task or the notification. */
export const RECALL_REASONS = ['daily_recall', 'streak_at_risk'] as const;
export type RecallReason = (typeof RECALL_REASONS)[number];

/** The `triggerReason` of a `PushRecord` (contract 8.3). */
export const TRIGGER_REASONS = ['daily_recall', 'streak_at_risk', 'admin', 'system_event'] as const;
export type TriggerReason = (typeof TRIGGER_REASONS)[number];

export const AUDIENCES = ['ALL', 'ACCOUNTS', 'GUESTS', 'ACCOUNT_IDS'] as const;
export type Audience = (typeof AUDIENCES)[number];

export const PLATFORMS = ['ANDROID', 'IOS'] as const;
export type PushPlatform = (typeof PLATFORMS)[number];

export const TASK_STATUSES = ['PENDING', 'RUNNING', 'DONE', 'CANCELLED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const REPEATS = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type Repeat = (typeof REPEATS)[number];

export const DELIVERY_RESULTS = ['ACCEPTED', 'INVALID_TOKEN', 'FAILED'] as const;

// ---- templates (PUSH:TEMPLATE) ----

export type PushTemplate = {
  id: string;
  triggerReason: string;
  locale: string;
  title: string;
  body: string;
  linkType: LinkType;
  linkTarget: string | null;
  imageUrl: string | null;
  enabled: boolean;
};

/** The supported languages without an enabled template, for each recall reason (they fall back to the default language). */
export type MissingLocales = Record<string, string[]>;

/** The answer of `GET /push/templates`; `missingLocales` is read with `readMissingLocales`, not trusted. */
export type TemplatePage = Page<PushTemplate> & { missingLocales?: unknown };

export type TemplateOverview = { items: PushTemplate[]; missingLocales: MissingLocales | null };

/** What a template can change after it exists (the reason and the language are its key). */
export type TemplateFields = {
  title: string;
  body: string;
  linkType: LinkType;
  linkTarget: string;
  enabled: boolean;
  /** The id of the picture uploaded first. Leave out to keep the picture; an address is never sent. */
  imageUploadId?: string;
};

export type TemplateCreate = TemplateFields & { triggerReason: string; locale: string };

// ---- what a task and a schedule share ----

export type AudienceFields = {
  audience: Audience;
  /** Only for `ACCOUNT_IDS`. */
  accountIds?: string[];
  /** Not for `ACCOUNT_IDS`: the backend refuses them there. Empty or left out means no limit. */
  platforms?: PushPlatform[];
  locales?: string[];
};

export type ContentFields = {
  title: string;
  body: string;
  linkType: LinkType;
  linkTarget: string;
  imageUploadId?: string;
};

// ---- manual tasks (PUSH:SEND) ----

export type PushTask = {
  id: string;
  createdBy: string | null;
  createdByUsername: string | null;
  audience: Audience;
  accountIds: string[] | null;
  platforms: string[] | null;
  locales: string[] | null;
  title: string;
  body: string;
  linkType: LinkType;
  linkTarget: string | null;
  imageUrl: string | null;
  scheduledAt: string;
  scheduleId: string | null;
  status: TaskStatus;
  note: string | null;
  sentCount: number;
  failedCount: number;
};

/** `scheduledAt` (a UTC instant) is left out for a task that goes out at once. */
export type TaskCreate = AudienceFields & ContentFields & { scheduledAt?: string };

// ---- periodic pushes (PUSH:SEND) ----

export type PushSchedule = {
  id: string;
  createdBy: string | null;
  createdByUsername: string | null;
  repeat: Repeat;
  daysOfWeek: number[] | null;
  dayOfMonth: number | null;
  timeOfDay: string;
  timezone: string;
  startDate: string;
  endDate: string | null;
  enabled: boolean;
  nextRunAt: string | null;
  audience: Audience;
  accountIds: string[] | null;
  platforms: string[] | null;
  locales: string[] | null;
  title: string;
  body: string;
  linkType: LinkType;
  linkTarget: string | null;
  imageUrl: string | null;
};

export type ScheduleFields = AudienceFields &
  ContentFields & {
    repeat: Repeat;
    /** 1 (Monday) to 7, for `WEEKLY`. */
    daysOfWeek?: number[];
    /** 1 to 31, for `MONTHLY`; a month without that day uses its last day. */
    dayOfMonth?: number;
    timeOfDay: string;
    timezone: string;
    startDate: string;
    endDate: string | null;
    enabled: boolean;
  };

// ---- records (PUSH:VIEW) ----

export type PushRecord = {
  id: string;
  accountId: string;
  pushType: string;
  triggerReason: string;
  localDate: string;
  createdAt: string;
};

export type PushDelivery = {
  id: string;
  pushId: string;
  pushTokenId: string;
  result: string;
  sentAt: string;
};

export type PushRecordDetail = PushRecord & { deliveries: PushDelivery[] };
