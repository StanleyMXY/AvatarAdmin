import { ApiError } from '../../request/errors';
import type { Translator } from '../../utils/displayText';
import { guardedFailureText } from './useLastOtpPrompt';

/** The detail the backend gives when a template write would take away the last enabled OTP template, or the last English one for every country: its `ref` is the entity, not a field of a form. */
const ENTITY = 'SmsTemplate';
const REASONS = ['LAST_OTP_TEMPLATE', 'LAST_ENGLISH_FALLBACK_TEMPLATE'] as const;

/**
 * The reason of the refusal of a template write that would remove or change the last enabled OTP
 * template (`LAST_OTP_TEMPLATE`), or the last enabled OTP template in English (any case) with no
 * country (`LAST_ENGLISH_FALLBACK_TEMPLATE`), while phone sign-in is on or phone-number accounts
 * exist; undefined for any other failure. The first is judged first by the backend.
 */
export function lastTemplateReason(error: unknown): (typeof REASONS)[number] | undefined {
  if (!(error instanceof ApiError) || error.code !== 'INVALID_REQUEST') return undefined;
  return REASONS.find((reason) =>
    error.details.some((d) => d.ref === ENTITY && d.reason === reason),
  );
}

export const isLastTemplateRefusal = (error: unknown): boolean =>
  lastTemplateReason(error) !== undefined;

/**
 * The words of a failed template write. Each of the two refusals above has its own fixed text (the
 * text of its reason); anything else is the words of the code. The backend's own message is never shown.
 */
export function templateFailureText(intl: Translator, error: unknown): string {
  const reason = lastTemplateReason(error);
  return reason === undefined
    ? guardedFailureText(intl, error)
    : intl.formatMessage({ id: `reason.${reason}` });
}
