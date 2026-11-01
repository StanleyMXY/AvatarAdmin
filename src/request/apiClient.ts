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

/** The language of the saved choice, else of the browser; what a request sends until the shell says otherwise. */
export const defaultLocaleProvider = (): string =>
  resolveInitialLocale(
    storedLocale(),
    typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]),
  );

let localeProvider: () => string = defaultLocaleProvider;

/** The shell tells the client which language is current; the default reads the saved choice. */
export function setLocaleProvider(provider: () => string): void {
  localeProvider = provider;
}

/**
 * `/users` becomes `/api/admin/users`; a path that already starts with `/api/` is left alone. Only
 * a path that starts with one slash is accepted: `users` would become `/api/adminusers`, and
 * `//host/x` or a full address would ask somewhere else. A `#` is refused because a fragment is
 * never sent, so a query added after it would be lost.
 */
export function resolveUrl(url: string): string {
  if (!url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\') || url.includes('#')) {
    throw new TypeError('a request address must be a path that starts with one slash, without #');
  }
  return url.startsWith('/api/') ? url : `${ADMIN_API_BASE}${url}`;
}

const isEmptyValue = (value: unknown) => value === undefined || value === null || value === '';

function queryValue(key: string, value: unknown): string | null {
  if (isEmptyValue(value)) return null;
  if (Array.isArray(value)) {
    const kept = value.filter((item) => !isEmptyValue(item));
    if (kept.some((item) => typeof item === 'object')) {
      throw new TypeError(
        `query parameter "${key}" must be a list of strings, numbers or booleans`,
      );
    }
    return kept.length === 0 ? null : kept.map(String).join(',');
  }
  if (typeof value === 'object') {
    throw new TypeError(`query parameter "${key}" must be a string, number, boolean or array`);
  }
  return String(value);
}

/**
 * `?a=1&b=2` for the parameters that have a value, or an empty string. `undefined`, `null` and
 * `''` are dropped, also inside an array; an array is written as one comma-joined value (callers
 * that need another format join first) and an empty one is dropped; objects are refused.
 */
export function buildQuery(params?: RequestParams): string {
  if (!params) return '';
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const text = queryValue(key, value);
    if (text !== null) query.append(key, text);
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

/** The address to ask for: the resolved path, and the parameters after the query it may already have. */
export function requestUrl(url: string, params?: RequestParams): string {
  const path = resolveUrl(url);
  const query = buildQuery(params);
  return path.includes('?') && query !== '' ? `${path}&${query.slice(1)}` : `${path}${query}`;
}

/**
 * The request body as JSON text. A body that cannot be written (it contains itself, holds a BigInt,
 * a `toJSON` that throws, or is a function or symbol, which write to nothing) is a mistake in the
 * caller, found before anything is sent: a `TypeError`, like a bad address, and not a network
 * failure, which would tell a page that a write may have been carried out. The message is fixed:
 * the body can hold a password, so neither it nor the reason `JSON.stringify` gave is repeated.
 */
export function serializeBody(body: unknown): string {
  let text: string | undefined;
  try {
    text = JSON.stringify(body);
  } catch {
    text = undefined;
  }
  if (typeof text !== 'string') {
    throw new TypeError('the request body cannot be written as JSON');
  }
  return text;
}

/** The headers every request carries, and the token they were built with. */
export function buildHeaders(
  json: boolean,
  anonymous = false,
): {
  headers: Record<string, string>;
  sentToken: string | null;
} {
  const sentToken = anonymous ? null : getToken();
  const headers: Record<string, string> = { 'Accept-Language': localeProvider() };
  if (sentToken !== null) headers.Authorization = `Bearer ${sentToken}`;
  if (json) headers['Content-Type'] = 'application/json';
  return { headers, sentToken };
}

/** Tells the session layer about the answers that matter to it; the error is thrown by the caller. */
export function reportSessionSignals(
  error: unknown,
  sentToken: string | null,
  reportForbidden = true,
): void {
  if (!(error instanceof ApiError)) return;
  if (error.code === 'ADMIN_INVALID_TOKEN') handleTokenExpired(sentToken);
  else if (error.code === 'ADMIN_FORBIDDEN' && reportForbidden) handleForbidden();
}

/**
 * A failure of the transport. Running out of time is REQUEST_TIMEOUT; an abort by the caller stays
 * an abort; anything else is NETWORK_ERROR. The cause is never kept: the browser's own message can
 * carry the address that was asked for.
 */
export function transportFailure(cause: unknown, deadline?: Deadline): unknown {
  if (deadline?.timedOut()) return timeoutError();
  // A cancel by the caller is a cancel whatever the browser rejected with (an abort given a reason
  // of its own rejects with that reason).
  if (deadline?.signal.aborted) return isAbortError(cause) ? cause : abortError();
  return isAbortError(cause) ? cause : networkError();
}

/** Throws the abort when the caller's signal is already aborted, before anything is sent. */
export function throwIfAborted(deadline: Deadline): void {
  if (deadline.signal.aborted && !deadline.timedOut()) throw abortError();
}

/** Unwraps an answer and reports its session signals (`reportSession` is false for an anonymous request). */
export function unwrapAndReport<T>(
  httpStatus: number,
  text: string,
  sentToken: string | null,
  reportSession = true,
  reportForbidden = true,
): T {
  try {
    return unwrapResponse<T>(httpStatus, text);
  } catch (error) {
    if (reportSession) reportSessionSignals(error, sentToken, reportForbidden);
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
  /** The cache mode of `fetch`; left out, the browser's default. `no-store` for an answer that must be asked for again every time. */
  cache?: RequestCache;
  /**
   * False for the read of the account itself (`GET /me`): a 403 there cannot be answered by reading
   * the permissions again, which is what the session layer would do. A lost token is still reported.
   */
  reportForbidden?: boolean;
  /**
   * True for a request made before there is a session (sign-in, authenticator setup): the token
   * held from an earlier session is not sent with it, and its answers say nothing about that
   * session (a 401 ADMIN_INVALID_TOKEN there is about the setup token, not the session token), so
   * the session layer is not told. This is the only way to keep an answer from the session layer.
   */
  anonymous?: boolean;
}): Promise<T> {
  const url = requestUrl(o.url, o.params);
  const hasBody = o.body !== undefined;
  // Before the token is read and the time limit starts: a body that cannot be written costs nothing.
  const bodyText = hasBody ? serializeBody(o.body) : undefined;
  const { headers, sentToken } = buildHeaders(hasBody, o.anonymous);

  const deadline = startDeadline(o.timeoutMs ?? DEFAULT_TIMEOUT_MS, o.signal);
  let status: number;
  let text: string;
  try {
    throwIfAborted(deadline);
    const response = await fetch(url, {
      method: o.method,
      headers,
      body: bodyText,
      signal: deadline.signal,
      ...(o.cache ? { cache: o.cache } : {}),
    });
    status = response.status;
    text = await response.text();
  } catch (cause) {
    throw transportFailure(cause, deadline);
  } finally {
    deadline.dispose();
  }
  try {
    const data = unwrapAndReport<T>(status, text, sentToken, !o.anonymous, o.reportForbidden);
    markServiceReachable(readKey(o.method, url));
    return data;
  } catch (error) {
    noteServiceStatus(o.method, readKey(o.method, url), error);
    throw error;
  }
}

/** Answers that say nothing about whether the backend can be reached. */
const NO_BACKEND_ANSWER = ['NETWORK_ERROR', 'REQUEST_TIMEOUT', 'INVALID_RESPONSE'];

/**
 * A read that met the gateway's own "unavailable" page raises the shell's notice (with a retry
 * button, which is only safe for a read); any answer of the backend itself takes it down again.
 */
function noteServiceStatus(method: Method, key: string, error: unknown): void {
  if (!(error instanceof ApiError)) return;
  if (error.code === 'GATEWAY_UNAVAILABLE') {
    if (method === 'GET') markServiceUnavailable(key);
  } else if (!NO_BACKEND_ANSWER.includes(error.code)) {
    markServiceReachable(key);
  }
}

/** What the notice remembers a read by: the method and the path, not the query (page 2 of a list is the same read). */
const readKey = (method: Method, url: string): string => `${method} ${url.split('?')[0]}`;
