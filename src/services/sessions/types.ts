// Row shapes of the call endpoints (contract 17.4, the 通话 row; the field names are the columns of
// the Session entity, contract 18). A column that can be missing is `| null`: the page shows a dash for it.
export type { Page } from '../../request/errors';

/** One row of `GET /sessions`. A guest session has no `accountId` and carries a `deviceId`. */
export type SessionRow = {
  id: string;
  accountId: string | null;
  deviceId: string | null;
  requestedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  modelTier: string | null;
  language: string | null;
};

/** Why a call ended (contract 15.6). A value a newer backend adds is shown as it comes. */
export const END_REASONS = [
  'DEADLINE',
  'USER_LEFT',
  'ROOM_FINISHED',
  'BANNED',
  'SUPERSEDED',
] as const;
export type EndReason = (typeof END_REASONS)[number];

/** `GET /sessions/{id}`: the columns of the Session entity that are worth showing. */
export type SessionDetail = SessionRow & {
  freeTier: boolean | null;
  roomName: string | null;
  timezone: string | null;
  renderMode: string | null;
  deadlineAt: string | null;
  /**
   * The longest length of the call, in whole minutes (0 or more), as it was when the call was made;
   * a setting changed later does not change it. It explains a deadline that differs from the
   * setting now. Missing from an answer of a backend that does not send it.
   */
  maxDurationMinutes?: number | null;
  endReason: string | null;
  agentJoinedAt: string | null;
  userJoinedAt: string | null;
  userLeftAt: string | null;
};

/**
 * The filters of `GET /sessions`. The contract names `guest` and `endReason=DEADLINE`; the names of
 * the others are in docs/contract-requests/2026-10-26-admin-frontend-sessions.md.
 */
export type SessionQuery = {
  page: number;
  pageSize: number;
  accountId?: string;
  guest?: boolean;
  /** Included. An instant, `requestedAt` is compared with it. */
  from?: string;
  /** Not included. */
  to?: string;
  ongoing?: boolean;
  endReason?: EndReason;
};
