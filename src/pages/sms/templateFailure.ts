import { ApiError } from '../../request/errors';
import type { Translator } from '../../utils/displayText';
import { guardedFailureText } from './useLastOtpPrompt';

/** The detail the backend gives when a template write would take away the last enabled OTP template, or the last English one for every country: its `ref` is the entity, not a field of a form. */
const ENTITY = 'SmsTemplate';
const REASON = 'OUT_OF_RANGE';

/**
 * True when the backend refused a template write because it would remove or change the last
 * enabled OTP template, or the last enabled OTP template in English (any case) with no country,
 * while phone sign-in is on or phone-number accounts exist. The two cases have the same `ref` and
 * `reason` (answers 41). The page does not judge this beforehand: the answer is the only source.
 */
export function isLastTemplateRefusal(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.code === 'INVALID_REQUEST' &&
    error.details.some((d) => d.ref === ENTITY && d.reason === REASON)
  );
}

/**
 * The words of a failed template write. The refusal above has one fixed text, which says what has
 * to stay in both of its cases; anything else is the words of the code. The backend's own message
 * is never shown.
 */
export function templateFailureText(intl: Translator, error: unknown): string {
  return isLastTemplateRefusal(error)
    ? intl.formatMessage({ id: 'sms.templates.lastRefused' })
    : guardedFailureText(intl, error);
}
