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

/**
 * The sentence for a refusal 403 `ADMIN_FORBIDDEN` of a write that hands out or changes roles and
 * administrators, after the text of the code. The backend sends four different messages for four
 * different rules and no structured reason, and what it says is never shown, so one sentence names all
 * four rules (docs/contract-requests/2026-10-31-admin-frontend-admin-forbidden-reason.md asks for a
 * reason code that would let the page say which one). Any other failure keeps its own text.
 */
export function withScopeHint(intl: Translator, error: unknown, text: string): string {
  return error instanceof ApiError && error.code === 'ADMIN_FORBIDDEN'
    ? afterText(intl, text, intl.formatMessage({ id: 'system.scopeHint' }))
    : text;
}

/** The refusal of the last enabled super administrator comes as 409 (403 has its own sentences). */
const PROTECTION_CODES = ['INVALID_STATE'];

/**
 * The words for a failed write of the administrator page: the text of the error code, never the
 * backend's message. A refusal that can be one of the protections of the account (403 or 409) gets
 * the sentence that says which protections there are, since the code alone does not say.
 */
export function protectedFailureText(intl: Translator, error: unknown): string {
  const { error: failure, text } = describeFailure(intl, error);
  if (failure instanceof ApiError && failure.code === 'ADMIN_FORBIDDEN')
    return afterText(intl, text, intl.formatMessage({ id: 'system.admins.forbiddenHint' }));
  return failure instanceof ApiError && PROTECTION_CODES.includes(failure.code)
    ? afterText(intl, text, intl.formatMessage({ id: 'system.admins.refusedHint' }))
    : text;
}
