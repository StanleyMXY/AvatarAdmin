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
 * page), `INVALID_RESPONSE` (any other answer that is not the JSON envelope). `httpStatus` is 0 when there was
 * no answer. `details` comes from `data.details` of an INVALID_REQUEST answer.
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

/** No answer within the time limit (30 seconds for a request, 5 minutes for a file transfer). */
export function timeoutError(): ApiError {
  return new ApiError({
    code: 'REQUEST_TIMEOUT',
    httpStatus: 0,
    message: 'The request took too long.',
    data: null,
  });
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
 * `reason.<reason>`. A missing `error.<code>` becomes `error.UNKNOWN` plus the backend message; a
 * missing reason falls back to the backend message (English), then to the reason code.
 */
export function describeError(
  e: ApiError,
  t: (key: string) => string,
): { text: string; fields: { ref: string; text: string }[] } {
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
    return {
      ref: detail.ref,
      text: hasText(reason, `reason.${detail.reason}`) ? reason : e.message || detail.reason,
    };
  });
  return { text, fields };
}
