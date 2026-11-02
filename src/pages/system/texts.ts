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

/**
 * The sentence for a refusal 409 `INVALID_STATE` of a write about an administrator, after the text of
 * the code. The 409 itself does not say why (backend answer 22): it is the protection of the own
 * account, the last enabled super administrator, or a change of someone else meanwhile. The page
 * knows whether the row is the signed-in person's own, so there are two fixed sentences and the page
 * says the one that fits. Any other failure keeps its own text.
 */
export function withStateHint(
  intl: Translator,
  error: unknown,
  text: string,
  own: boolean,
): string {
  return error instanceof ApiError && error.code === 'INVALID_STATE'
    ? afterText(
        intl,
        text,
        intl.formatMessage({
          id: own ? 'system.admins.refusedOwnHint' : 'system.admins.refusedOtherHint',
        }),
      )
    : text;
}

/**
 * The words for a failed write of the administrator page: the text of the error code, never the
 * backend's message. A 403 gets the sentence that says which rules can refuse it, a 409 the sentence
 * for an own row or for another row (`own`), since the code alone does not say.
 */
export function protectedFailureText(intl: Translator, error: unknown, own: boolean): string {
  const { error: failure, text } = describeFailure(intl, error);
  if (failure instanceof ApiError && failure.code === 'ADMIN_FORBIDDEN')
    return afterText(intl, text, intl.formatMessage({ id: 'system.admins.forbiddenHint' }));
  return withStateHint(intl, failure, text, own);
}
