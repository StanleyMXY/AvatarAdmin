import { ApiError } from '../../request/errors';
import { describeFailure } from '../../session/describe';
import type { Translator } from '../../utils/displayText';

/**
 * Two sentences one after the other. The text of an error code has no full stop at its end in
 * Chinese, so the language file says what goes between the two sentences.
 */
function afterText(intl: Translator, text: string, sentence: string): string {
  return intl.formatMessage({ id: 'system.sentences' }, { first: text, second: sentence });
}

/** The values of `data.reason` of a 403 `ADMIN_FORBIDDEN` of the administrator and role writes (contract 17.4). */
const FORBIDDEN_REASONS: readonly string[] = [
  'GRANT_NOT_HELD',
  'ROLE_NOT_HELD',
  'OWN_ROLE',
  'ADMIN_NOT_HELD',
  'SUPER_TARGET',
  'SUPER_FLAG',
];

/** `data.reason` of a failure when it is text (the caller checks it against the reasons it knows). */
function reasonOf(error: unknown, code: string): string | null {
  if (!(error instanceof ApiError) || error.code !== code) return null;
  const reason = (error.data as { reason?: unknown } | null)?.reason;
  return typeof reason === 'string' ? reason : null;
}

/**
 * The sentence for a refusal 403 `ADMIN_FORBIDDEN` of a write that hands out or changes roles and
 * administrators, after the text of the code. The backend names the rule that refused in
 * `data.reason` (backend answer 17), so the sentence follows the reason and not the operation the
 * page tried: one operation can be refused by different rules. A 403 without a reason, or with one
 * this page does not know, keeps the text of the code alone. Any other failure keeps its own text.
 */
export function withScopeHint(intl: Translator, error: unknown, text: string): string {
  const reason = reasonOf(error, 'ADMIN_FORBIDDEN');
  return reason !== null && FORBIDDEN_REASONS.includes(reason)
    ? afterText(intl, text, intl.formatMessage({ id: `system.refusal.${reason}` }))
    : text;
}

/** The values of `data.reason` of a 409 `INVALID_STATE` of the administrator writes (contract 17.4). */
const STATE_REASONS: readonly string[] = [
  'SELF_PROTECTED',
  'LAST_SUPER_ADMIN',
  'CONCURRENT_CHANGE',
];

/**
 * The sentence for a refusal 409 `INVALID_STATE` of a write about an administrator, after the text of
 * the code. The backend names the rule in `data.reason` (backend answer 22; `data.status` stays): the
 * protection of the own account, the last enabled super administrator, or another change of a super
 * administrator that is under way (try again). The sentence follows the reason, not the row the page
 * acted on. A 409 without a reason, or with one this page does not know, keeps the text of the code
 * alone. Any other failure keeps its own text.
 */
export function withStateHint(intl: Translator, error: unknown, text: string): string {
  const reason = reasonOf(error, 'INVALID_STATE');
  return reason !== null && STATE_REASONS.includes(reason)
    ? afterText(intl, text, intl.formatMessage({ id: `system.admins.state.${reason}` }))
    : text;
}

/**
 * The words for a failed write of the administrator page: the text of the error code, never the
 * backend's message. A 403 or a 409 gets the sentence of its `data.reason`.
 */
export function protectedFailureText(intl: Translator, error: unknown): string {
  const { error: failure, text } = describeFailure(intl, error);
  return withStateHint(intl, failure, withScopeHint(intl, failure, text));
}
