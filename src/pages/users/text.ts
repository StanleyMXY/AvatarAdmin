import { ApiError } from '../../request/errors';
import { describeFailure } from '../../session/describe';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';

/** The part of `useIntl()` these helpers need (Umi's copy of react-intl and ours have different types). */
export type Translator = {
  messages: Record<string, unknown>;
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
};

/**
 * The text of a code the backend sends (a state, a method, a reason): its translation under
 * `<prefix>.<code>`, or the code itself when there is no translation (a value a newer backend adds
 * is shown, not hidden), or a dash for nothing. Any type is safe: the code is turned into text first.
 */
export function labelOf(intl: Translator, prefix: string, code: unknown): string {
  const text = plainText(code);
  if (text === '') return DASH;
  const key = `${prefix}.${text}`;
  return Object.hasOwn(intl.messages, key) ? intl.formatMessage({ id: key }) : text;
}

/** A state of an account or of a deletion task, in words. */
export function stateWords(intl: Translator, status: unknown): string {
  const text = plainText(status);
  if (Object.hasOwn(intl.messages, `users.status.${text}`))
    return labelOf(intl, 'users.status', text);
  return labelOf(intl, 'users.deletionStatus', text);
}

/**
 * What to say when a write failed. A known error code shows its translated text only (never the
 * backend message). A 409 INVALID_STATE adds the state the object (the account, or the deletion
 * task) is in now, in words, so the administrator can see why the button no longer applies.
 */
export function actionFailure(
  intl: Translator,
  failure: unknown,
  about: 'account' | 'task' = 'account',
): string {
  const { error, text } = describeFailure(intl, failure);
  if (!(failure instanceof ApiError) || error.code !== 'INVALID_STATE') return text;
  const status = (error.data as { status?: unknown } | null)?.status;
  if (typeof status !== 'string' || status === '') return text;
  const id = about === 'task' ? 'users.state.currentTask' : 'users.state.current';
  return `${text} ${intl.formatMessage({ id }, { state: stateWords(intl, status) })}`;
}

/** A duration in seconds as hours and minutes, minutes and seconds, or seconds; a dash when it is not a duration. */
export function formatSeconds(
  seconds: number | null | undefined,
  t: (id: string, values?: Record<string, string | number>) => string,
): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return DASH;
  const whole = Math.floor(seconds);
  if (whole >= 3600) {
    return t('users.duration.hours', {
      h: Math.floor(whole / 3600),
      m: Math.floor((whole % 3600) / 60),
    });
  }
  if (whole >= 60) return t('users.duration.minutes', { m: Math.floor(whole / 60), s: whole % 60 });
  return t('users.duration.seconds', { s: whole });
}

/** A count: 0 is shown as 0; nothing, a negative number (a count cannot be one) or anything that is not a number is a dash. */
export function countText(value: unknown, locale: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return DASH;
  return new Intl.NumberFormat(locale).format(value);
}
