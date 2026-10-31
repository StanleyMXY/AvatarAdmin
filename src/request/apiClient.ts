import { resolveInitialLocale } from '../utils/resolveLocale';
import { unwrapResponse } from './envelope';
import { ApiError, abortError, isAbortError, networkError } from './errors';
import { markServiceReachable, markServiceUnavailable } from './serviceStatus';
import { getToken, handleForbidden, handleTokenExpired } from './session';
import { DEFAULT_TIMEOUT_MS, type Deadline, startDeadline, timeoutError } from './timeout';

/** Every admin endpoint is under this prefix; service functions give the path after it. */
export const ADMIN_API_BASE = '/api/admin';

/** Where Umi's locale plugin keeps the language the user chose. */
export const LOCALE_STORAGE_KEY = 'umi_locale';

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type RequestParams = Record<string, unknown>;

function storedLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

const defaultLocaleProvider = (): string =>
  resolveInitialLocale(
    storedLocale(),
    typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]),
  );

let localeProvider: () => string = defaultLocaleProvider;

/** The shell tells the client which language is current; the default reads the saved choice. */
export function setLocaleProvider(provider: () => string): void {
  localeProvider = provider;
}

/** `/users` becomes `/api/admin/users`; a path that already starts with `/api/` is left alone. */
export function resolveUrl(url: string): string {
  return url.startsWith('/api/') ? url : `${ADMIN_API_BASE}${url}`;
}

/**
 * `?a=1&b=2` for the parameters that have a value, or an empty string. `undefined`, `null` and
 * `''` are dropped; arrays are written as one comma-joined value (callers that need another
 * format join first); objects are refused.
 */
export function buildQuery(params?: RequestParams): string {
  if (!params) return '';
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      throw new TypeError(`query parameter "${key}" must be a string, number, boolean or array`);
    }
    query.append(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

/** The headers every request carries, and the token they were built with. */
export function buildHeaders(json: boolean): {
  headers: Record<string, string>;
  sentToken: string | null;
} {
  const sentToken = getToken();
  const headers: Record<string, string> = { 'Accept-Language': localeProvider() };
  if (sentToken !== null) headers.Authorization = `Bearer ${sentToken}`;
  if (json) headers['Content-Type'] = 'application/json';
  return { headers, sentToken };
}

/** Tells the session layer about the answers that matter to it; the error is thrown by the caller. */
export function reportSessionSignals(error: unknown, sentToken: string | null): void {
  if (!(error instanceof ApiError)) return;
  if (error.code === 'ADMIN_INVALID_TOKEN') handleTokenExpired(sentToken);
  else if (error.code === 'ADMIN_FORBIDDEN') handleForbidden();
}

/**
 * A failure of the transport. Running out of time is REQUEST_TIMEOUT; an abort by the caller stays
 * an abort; anything else is NETWORK_ERROR. The cause is never kept: the browser's own message can
 * carry the address that was asked for.
 */
export function transportFailure(cause: unknown, deadline?: Deadline): unknown {
  if (deadline?.timedOut()) return timeoutError();
  return isAbortError(cause) ? cause : networkError();
}

/** Throws the abort when the caller's signal is already aborted, before anything is sent. */
export function throwIfAborted(deadline: Deadline): void {
  if (deadline.signal.aborted && !deadline.timedOut()) throw abortError();
}

/** Unwraps an answer and reports its session signals. */
export function unwrapAndReport<T>(
  httpStatus: number,
  text: string,
  sentToken: string | null,
  reportSession = true,
): T {
  try {
    return unwrapResponse<T>(httpStatus, text);
  } catch (error) {
    if (reportSession) reportSessionSignals(error, sentToken);
    throw error;
  }
}

export async function apiRequest<T>(o: {
  method: Method;
  url: string;
  params?: RequestParams;
  body?: unknown;
  signal?: AbortSignal;
  /** Milliseconds to wait for the whole answer; 30 seconds when not given. */
  timeoutMs?: number;
  /**
   * False for a request whose 401 ADMIN_INVALID_TOKEN is about something other than the session
   * token (the enrollment token of the authenticator setup): the session layer is not told.
   */
  reportSession?: boolean;
}): Promise<T> {
  const url = `${resolveUrl(o.url)}${buildQuery(o.params)}`;
  const hasBody = o.body !== undefined;
  const { headers, sentToken } = buildHeaders(hasBody);

  const deadline = startDeadline(o.timeoutMs ?? DEFAULT_TIMEOUT_MS, o.signal);
  let status: number;
  let text: string;
  try {
    throwIfAborted(deadline);
    const response = await fetch(url, {
      method: o.method,
      headers,
      body: hasBody ? JSON.stringify(o.body) : undefined,
      signal: deadline.signal,
    });
    status = response.status;
    text = await response.text();
  } catch (cause) {
    throw transportFailure(cause, deadline);
  } finally {
    deadline.dispose();
  }
  try {
    const data = unwrapAndReport<T>(status, text, sentToken, o.reportSession);
    markServiceReachable();
    return data;
  } catch (error) {
    noteServiceStatus(o.method, error);
    throw error;
  }
}

/** Answers that say nothing about whether the backend can be reached. */
const NO_BACKEND_ANSWER = ['NETWORK_ERROR', 'REQUEST_TIMEOUT', 'INVALID_RESPONSE'];

/**
 * A read that met the gateway's own "unavailable" page raises the shell's notice (with a retry
 * button, which is only safe for a read); any answer of the backend itself takes it down again.
 */
function noteServiceStatus(method: Method, error: unknown): void {
  if (!(error instanceof ApiError)) return;
  if (error.code === 'GATEWAY_UNAVAILABLE') {
    if (method === 'GET') markServiceUnavailable();
  } else if (!NO_BACKEND_ANSWER.includes(error.code)) {
    markServiceReachable();
  }
}
