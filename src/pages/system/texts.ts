import { ApiError } from '../../request/errors';
import { describeFailure } from '../../session/describe';
import { formatInstant } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';

/** The part of `useIntl()` this needs (Umi's copy of react-intl and ours have different types). */
export type Translator = {
  locale?: string;
  messages: Record<string, unknown>;
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
};

/** An instant of the backend in the interface language, or a dash when there is none. */
export function instantText(locale: string, value: unknown): string {
  return typeof value === 'string' && value !== '' ? formatInstant(value, locale) : DASH;
}

/** Text the backend sent, or a dash when there is none; whatever its type, it is text. */
export function orDash(value: unknown): string {
  const text = plainText(value);
  return text === '' ? DASH : text;
}

/**
 * The name of an administrator: the user name, or the first eight characters of the id when the
 * name is missing (the account is gone), or a dash. For the audit log the name is the one written
 * with the row, never a current name.
 */
export function adminLabel(name: unknown, id: unknown): string {
  const shown = plainText(name);
  if (shown !== '') return shown;
  const raw = plainText(id);
  return raw === '' ? DASH : raw.slice(0, 8);
}

/** Errors a refused protection can come as: nobody knows which of the two the backend picks. */
const PROTECTION_CODES = ['ADMIN_FORBIDDEN', 'INVALID_STATE'];

/**
 * The words for a failed write of the administrator page: the text of the error code, never the
 * backend's message. A refusal that can be one of the protections of the account (403 or 409) gets
 * the sentence that says which protections there are, since the code alone does not say.
 */
export function protectedFailureText(intl: Translator, error: unknown): string {
  const { error: failure, text } = describeFailure(intl, error);
  return failure instanceof ApiError && PROTECTION_CODES.includes(failure.code)
    ? `${text} ${intl.formatMessage({ id: 'system.admins.refusedHint' })}`
    : text;
}
