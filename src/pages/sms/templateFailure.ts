import { ApiError } from '../../request/errors';
import type { Translator } from '../../utils/displayText';
import { guardedFailureText } from './useLastOtpPrompt';

/** The detail the backend gives when the last enabled English OTP template for every country would go: its `ref` is the entity, not a field of a form. */
const ENTITY = 'SmsTemplate';
const REASON = 'OUT_OF_RANGE';

/**
 * True when the backend refused a template write because it would remove or change the last
 * enabled OTP template in English (any case) with no country, while phone sign-in is on or
 * phone-number accounts exist. The page does not judge this beforehand: the answer is the only source.
 */
export function isEnglishFallbackRefusal(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.code === 'INVALID_REQUEST' &&
    error.details.some((d) => d.ref === ENTITY && d.reason === REASON)
  );
}

/**
 * The words of a failed template write. The refusal above has words of its own, which say what has
 * to stay; anything else is the words of the code (with the line about the last OTP template when
 * the write was one that the question was asked for). The backend's own message is never shown.
 */
export function templateFailureText(intl: Translator, error: unknown, guarded: boolean): string {
  return isEnglishFallbackRefusal(error)
    ? intl.formatMessage({ id: 'sms.templates.englishRefused' })
    : guardedFailureText(intl, error, guarded);
}
