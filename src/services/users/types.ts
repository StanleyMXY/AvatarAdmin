import type { Page } from '../../request/errors';

export type { Page };

/** `User.status` (contract 2.8). A status the page does not know is shown as it came. */
export const USER_STATUSES = ['ACTIVE', 'BANNED', 'PENDING_DELETION', 'DELETING'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const TRAFFIC_TYPES = ['PAID', 'ORGANIC'] as const;
export type TrafficType = (typeof TRAFFIC_TYPES)[number];

export const LOGIN_METHODS = ['EMAIL', 'PHONE', 'GOOGLE', 'APPLE'] as const;
export type LoginMethod = (typeof LOGIN_METHODS)[number];

/** `AccountDeletion.status` (contract 13.1). */
export const DELETION_STATUSES = [
  'SCHEDULED',
  'CANCELED',
  'PENDING',
  'RUNNING',
  'FAILED',
  'COMPLETED',
] as const;
export type DeletionStatus = (typeof DELETION_STATUSES)[number];

/** `AccountDeletion.reason`: what the user chose when asking for the deletion (contract 13.1). */
export const DELETION_REASONS = [
  'NOT_USEFUL',
  'TOO_EXPENSIVE',
  'PRIVACY_CONCERN',
  'TECHNICAL_PROBLEMS',
  'FOUND_ALTERNATIVE',
  'OTHER',
] as const;
export type DeletionReason = (typeof DELETION_REASONS)[number];

/** One row of `GET /users`; the e-mail and phone number are masked unless the administrator may see them. */
export type UserRow = {
  id: string;
  email: string | null;
  phone: string | null;
  status: string;
  channelCode: string | null;
  trafficType: string;
  createdAt: string;
  timezone: string | null;
  conversationLanguage: string | null;
};

export type UserQuery = {
  page: number;
  pageSize: number;
  accountId?: string;
  email?: string;
  phone?: string;
  status?: string;
  channelCode?: string;
  trafficType?: string;
  mediaSource?: string;
};

export type Companionship = {
  interactionCount: number;
  currentStreak: number;
  lastInteractionDate: string | null;
  lastInteractionAt: string | null;
};

export type AssetCounts = { avatars: number; voices: number; looks: number; cosmetics: number };

export type Attribution = {
  source: string | null;
  matchType: string | null;
  mediaSource: string | null;
  campaign: string | null;
  installTime: string | null;
  registeredAt: string | null;
};

/**
 * `GET /users/{id}` (backend reply, item 6): the columns of `User` and five derived fields. The
 * backend never returns the persona, a password hash or a third-party login identifier.
 */
export type UserDetail = {
  id: string;
  email: string | null;
  emailVerifiedAt: string | null;
  phone: string | null;
  phoneVerifiedAt: string | null;
  status: string;
  banReason: string | null;
  bannedAt: string | null;
  currentAvatarAssetId: string | null;
  currentVoiceAssetId: string | null;
  personaModerationStatus: string | null;
  companionName: string | null;
  timezone: string | null;
  conversationLanguage: string | null;
  lifetimeGrantSeconds: number | null;
  lifetimeUsedSeconds: number | null;
  channelCode: string | null;
  registerPlatform: string | null;
  priorInviteeRewarded: boolean | null;
  inviteRewardedCount: number | null;
  createdAt: string;
  loginMethods: string[];
  trafficType: string;
  companionship: Companionship;
  counts: AssetCounts;
  /** `null` when the account has no attribution record. */
  attribution: Attribution | null;
};

/** One session of the account (`GET /users/{id}/sessions`); the fields are the columns of `Session` (see the contract request). */
export type UserSession = {
  id: string;
  requestedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  modelTier: string | null;
  language: string | null;
  endReason: string | null;
};

/** One push registration of the account; `tokenSuffix` is the last six characters, never the token. */
export type UserDevice = {
  id: string;
  platform: string | null;
  appVersion: string | null;
  locale: string | null;
  lastSeenAt: string | null;
  tokenSuffix: string | null;
};

/** One row of the authentication log; the hashes are cut to eight characters by the backend. */
export type AuthEvent = {
  type: string;
  reason: string | null;
  deviceIdHashPrefix: string | null;
  ipHashPrefix: string | null;
  at: string;
};

/** One row of `GET /account-deletions`: the columns of `AccountDeletion` and the name of the administrator who asked. */
export type AccountDeletionRow = {
  id: string;
  accountId: string;
  requestedBy: string | null;
  requestedByUsername: string | null;
  reason: string | null;
  status: string;
  executeAfter: string | null;
  statusBefore: string | null;
  canceledAt: string | null;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type AbuseBy = 'DEVICE' | 'IP';

export type AbuseCluster = {
  /** The whole opaque key (an HMAC): it is given back to `GET /abuse/clusters/accounts` as it is, and only its first eight characters are shown. */
  key: string;
  accounts: number;
  freeAccounts: number;
  paidAccounts: number;
  firstCreatedAt: string;
  lastCreatedAt: string;
};

export type AbuseQuery = {
  by: AbuseBy;
  from: string;
  to: string;
  /** Left out when empty: the server's default (`abuse.cluster_min_free_accounts`) applies. */
  minFreeAccounts?: number;
  page: number;
  pageSize: number;
};

export type ClusterAccount = {
  accountId: string;
  createdAt: string;
  status: string;
  paid: boolean;
  registerMethod: string;
};
