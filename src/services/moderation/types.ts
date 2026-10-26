export type { Page } from '../../request/errors';

// Contract 17.4 (content moderation row), 11.2 to 11.4 and 18 (`ModerationRecord`); field names as in
// docs/backend-inputs. The values below are the ones the contract lists.

export const MODERATION_CONTENT_TYPES = [
  'AVATAR',
  'VOICE',
  'MESSAGE',
  'PERSONA',
  'COMPANION_NAME',
  'AVATAR_IMAGE',
  'ACTION_CLIP',
] as const;
export type ModerationContentType = (typeof MODERATION_CONTENT_TYPES)[number];

export const MODERATION_SOURCES = ['AUTO', 'REPORT', 'COMPLAINT'] as const;
export type ModerationSource = (typeof MODERATION_SOURCES)[number];

export const MODERATION_STATUSES = ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'BLOCKED'] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const AUTO_LEVELS = ['PASS', 'REVIEW', 'BLOCK'] as const;
export type AutoLevel = (typeof AUTO_LEVELS)[number];

/** One row of the review queue and the record of the detail page. The original content is never in it. */
export type ModerationRecord = {
  id: string;
  /** Null after the account was deleted. */
  accountId: string | null;
  contentType: ModerationContentType;
  contentRef: string;
  source: ModerationSource;
  autoLevel: AutoLevel | null;
  /** The ids of the rules that matched (`RULE:<id>`) and the service's categories; never the matched text. */
  categories: string[] | null;
  score: number | null;
  providerRef: string | null;
  status: ModerationStatus;
  /** `SEXUAL`, `HARASSMENT`, `VIOLENCE`, `SELF_HARM` or `OTHER`; only on records from a report. */
  reporterReason: string | null;
  reporterDetail: string | null;
  reviewedBy: string | null;
  /** Null when the administrator no longer exists (the id stays). */
  reviewedByUsername: string | null;
  reviewedAt: string | null;
  note: string | null;
  createdAt: string;
};

export type ModerationQuery = {
  page: number;
  pageSize: number;
  status?: ModerationStatus;
  source?: ModerationSource;
  /** Not in the contract's query list; see docs/contract-requests/2026-10-26-admin-frontend-moderation.md. */
  contentType?: ModerationContentType;
};

/**
 * What `GET /moderation/records/{id}/content` answers. `FILE` has `text` only when there is a text
 * that belongs to the file (today the transcript of a voice sample).
 */
export type ModerationContent =
  | { kind: 'TEXT'; text: string }
  | { kind: 'FILE'; mediaType: string; url: string; text?: string };

export type ModerationDecision = 'APPROVE' | 'REJECT';

export type ModerationDecisionBody = { decision: ModerationDecision; note?: string };

export type ModerationStatRow = {
  /** UTC calendar day `YYYY-MM-DD`. */
  statDate: string;
  contentType: ModerationContentType;
  source: ModerationSource;
  created: number;
  approved: number;
  rejected: number;
  blocked: number;
};

export type ModerationStats = {
  items: ModerationStatRow[];
  /** Null when no record was handled. */
  avgHandleSeconds: number | null;
  /** Null when nothing is waiting. */
  oldestPendingSeconds: number | null;
};

export const TEXT_RULE_MATCH_MODES = ['SUBSTRING', 'WORD', 'REGEX'] as const;
export type TextRuleMatchMode = (typeof TEXT_RULE_MATCH_MODES)[number];

export const TEXT_RULE_LEVELS = ['REVIEW', 'BLOCK'] as const;
export type TextRuleLevel = (typeof TEXT_RULE_LEVELS)[number];

export type TextRule = {
  id: string;
  pattern: string;
  matchMode: TextRuleMatchMode;
  level: TextRuleLevel;
  note: string | null;
};

/** An element of the list sent by `PUT /moderation/text-rules`; no `id` means a new rule. */
export type TextRuleInput = {
  id?: string;
  pattern: string;
  matchMode: TextRuleMatchMode;
  level: TextRuleLevel;
  note: string;
};

export const TEXT_RULE_PATTERN_MAX = 200;
export const TEXT_RULE_NOTE_MAX = 200;
