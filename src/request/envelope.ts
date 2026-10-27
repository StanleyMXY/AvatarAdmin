import { ApiError } from './errors';

export const SUCCESS_CODE = '200';

export type Envelope<T = unknown> = { code: string; message: string; data: T };

/** The backend's `{code, message, data}` envelope, or `null` when the text is not one. */
export function parseEnvelope(text: string): Envelope | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { code, message, data } = value as { code?: unknown; message?: unknown; data?: unknown };
  if (typeof code !== 'string') return null;
  return { code, message: typeof message === 'string' ? message : '', data: data ?? null };
}

/** The statuses with which a gateway or proxy in front of the backend says it cannot reach it. */
const GATEWAY_STATUSES: readonly number[] = [502, 503, 504];

const gatewayUnavailable = (httpStatus: number) =>
  new ApiError({
    code: 'GATEWAY_UNAVAILABLE',
    httpStatus,
    message: `The service is temporarily unavailable (HTTP ${httpStatus}).`,
    data: null,
  });

const invalidResponse = (httpStatus: number) =>
  new ApiError({
    code: 'INVALID_RESPONSE',
    httpStatus,
    message: `The answer (HTTP ${httpStatus}) is not a valid response envelope.`,
    data: null,
  });

/**
 * Turns an HTTP answer into the envelope's `data` or throws. Success needs an HTTP 2xx status
 * and code "200"; any other code is the backend's error and is thrown as it is, whatever the
 * status. An answer without an envelope is INVALID_RESPONSE, except a bare 429 (a limiter in
 * front of the backend), which is RATE_LIMITED, and a 502, 503 or 504 (the gateway's own page, the
 * body is never shown), which is GATEWAY_UNAVAILABLE.
 */
export function unwrapResponse<T = unknown>(httpStatus: number, text: string): T {
  const envelope = parseEnvelope(text);
  if (envelope === null) {
    if (httpStatus === 429) {
      return fail(new ApiError({ code: 'RATE_LIMITED', httpStatus, message: '', data: null }));
    }
    if (GATEWAY_STATUSES.includes(httpStatus)) return fail(gatewayUnavailable(httpStatus));
    return fail(invalidResponse(httpStatus));
  }
  if (envelope.code === SUCCESS_CODE) {
    if (httpStatus >= 200 && httpStatus < 300) return envelope.data as T;
    return fail(invalidResponse(httpStatus));
  }
  return fail(
    new ApiError({
      code: envelope.code,
      httpStatus,
      message: envelope.message,
      data: envelope.data,
    }),
  );
}

function fail(error: ApiError): never {
  throw error;
}
