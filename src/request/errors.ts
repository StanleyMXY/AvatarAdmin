export type ErrorDetail = { ref: string; reason: string };

export type Page<T> = { items: T[]; total: number };

export type ApiErrorInit = {
  code: string;
  httpStatus: number;
  message: string;
  data: unknown;
};

function readDetails(data: unknown): ErrorDetail[] {
  if (typeof data !== 'object' || data === null) return [];
  const raw = (data as { details?: unknown }).details;
  if (!Array.isArray(raw)) return [];
  const details: ErrorDetail[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { ref, reason } = entry as { ref?: unknown; reason?: unknown };
    if (typeof ref === 'string' && typeof reason === 'string') details.push({ ref, reason });
  }
  return details;
}

/**
 * A failed request. `code` is the backend's error code, or `NETWORK_ERROR` (no answer),
 * `REQUEST_TIMEOUT` (no answer in time), `GATEWAY_UNAVAILABLE` (the gateway's own 502, 503 or 504
 * page), `INVALID_RESPONSE` (any other answer that is not the JSON envelope), or `UNKNOWN` (made by
 * `unknownError`, not by a request). `httpStatus` is 0 when there was no answer. `details` comes from `data.details` of an INVALID_REQUEST answer.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly data: unknown;
  readonly details: ErrorDetail[];

  constructor({ code, httpStatus, message, data }: ApiErrorInit) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.data = data;
    this.details = readDetails(data);
  }
}

export function networkError(): ApiError {
  return new ApiError({
    code: 'NETWORK_ERROR',
    httpStatus: 0,
    message: 'The request could not be sent or the answer did not arrive.',
    data: null,
  });
}

/**
 * What a page holds when a request failed with something that is not an `ApiError` (a mistake in
 * the page's own code, a value that is not an error at all). The code is `UNKNOWN`, the one
 * `describeError` gives such a value, and the message is fixed: a foreign error's own words can
 * carry an address or a token. `httpStatus` 0 keeps `isOutcomeUnknown` true, so a write is not
 * called "not done" on the strength of an error nobody understands.
 */
export function unknownError(): ApiError {
  return new ApiError({
    code: 'UNKNOWN',
    httpStatus: 0,
    message: 'The request failed in a way that is not known.',
    data: null,
  });
}

/** No answer within the time limit (30 seconds for a request, 5 minutes for a file transfer). */
export function timeoutError(): ApiError {
  return new ApiError({
    code: 'REQUEST_TIMEOUT',
    httpStatus: 0,
    message: 'The request took too long.',
    data: null,
  });
}

/**
 * True when a failed write may nevertheless have been carried out: no answer came back (network,
 * time limit), or the answer was the gateway's own page or something that is not the envelope. Only
 * an answer of the backend itself says what happened to the request. Anyone who shows "not done,
 * try again" for such a failure invites a repeat of something that may have been done.
 */
export function isOutcomeUnknown(error: ApiError): boolean {
  // `httpStatus` is 0 when there was no answer: the network failed or the time limit ran out.
  return (
    error.httpStatus === 0 ||
    error.code === 'GATEWAY_UNAVAILABLE' ||
    error.code === 'INVALID_RESPONSE'
  );
}

export function abortError(): DOMException {
  return new DOMException('The request was aborted.', 'AbortError');
}

export const isAbortError = (e: unknown): boolean =>
  typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'AbortError';

/** What `t` returns when a key has no text: nothing, or (as react-intl does) the key itself. */
const hasText = (value: string, key: string) => value !== '' && value !== key;

/**
 * The texts to show for an error: `text` from `error.<code>`, and one text per detail from
 * `reason.<reason>`. A missing `error.<code>` becomes `error.UNKNOWN` plus the backend message. A
 * missing reason falls back to the backend message (English) when it is the only detail, so the
 * sentence is not repeated on every row; with several details it falls back to the reason code.
 * Anything that is not an `ApiError` (a TypeError from a page, an abort) is `error.UNKNOWN` alone:
 * the message of a foreign error may carry an address.
 */
export function describeError(
  e: unknown,
  t: (key: string) => string,
): { text: string; fields: { ref: string; text: string }[] } {
  if (!(e instanceof ApiError)) return { text: t('error.UNKNOWN'), fields: [] };
  const known = t(`error.${e.code}`);
  let text: string;
  if (hasText(known, `error.${e.code}`)) {
    text = known;
  } else {
    const unknown = t('error.UNKNOWN');
    text = e.message ? `${unknown} (${e.message})` : unknown;
  }
  const fields = e.details.map((detail) => {
    const reason = t(`reason.${detail.reason}`);
    const untranslated = e.details.length === 1 ? e.message || detail.reason : detail.reason;
    return {
      ref: detail.ref,
      text: hasText(reason, `reason.${detail.reason}`) ? reason : untranslated,
    };
  });
  return { text, fields };
}
