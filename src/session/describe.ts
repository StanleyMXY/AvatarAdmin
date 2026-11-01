import { ApiError, describeError, unknownError } from '../request/errors';

/** The part of `useIntl()` this needs (Umi's copy of react-intl and ours have different types). */
type Translator = {
  messages: Record<string, unknown>;
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
};

/**
 * The texts for a failed request, in the current language: the text of the error and one per
 * field detail. Anything that is not an `ApiError` (a mistake in the page's own code, an abort) is
 * the unknown error, as `describeError` says it: only the request layer knows that the network
 * failed, and it says so with an `ApiError`.
 */
export function describeFailure(intl: Translator, failure: unknown) {
  const error = failure instanceof ApiError ? failure : unknownError();
  const described = describeError(error, (key) =>
    intl.messages[key] ? intl.formatMessage({ id: key }) : key,
  );
  return { error, ...described };
}

/**
 * What a page shows in a message bar. It keeps the language-file key (or the failure itself), not
 * the translated text, so the bar changes language when the language is switched.
 */
export type Notice = {
  type: 'error' | 'info';
  content: { id: string; values?: Record<string, string | number> } | { failure: unknown };
};

export function noticeText(intl: Translator, notice: Notice): string {
  return 'failure' in notice.content
    ? describeFailure(intl, notice.content.failure).text
    : intl.formatMessage({ id: notice.content.id }, notice.content.values);
}

/** Whole minutes to wait, when the answer of a lock says how many seconds; otherwise undefined. */
export function retryMinutes(error: ApiError): number | undefined {
  const seconds = (error.data as { retryAfterSeconds?: unknown } | null)?.retryAfterSeconds;
  return typeof seconds === 'number' && seconds > 0 ? Math.ceil(seconds / 60) : undefined;
}

/** The notice for a failed sign-in or authenticator step: a lock with its waiting time, or the failure. */
export function failureNotice(failure: unknown): Notice {
  const error = failure instanceof ApiError ? failure : undefined;
  const minutes = error?.code === 'RATE_LIMITED' ? retryMinutes(error) : undefined;
  return minutes === undefined
    ? { type: 'error', content: { failure } }
    : { type: 'error', content: { id: 'auth.login.locked', values: { minutes } } };
}
