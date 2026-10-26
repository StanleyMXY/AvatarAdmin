import { resolveInitialLocale } from '../utils/resolveLocale';
import { unwrapResponse } from './envelope';
import { ApiError, isAbortError, networkError } from './errors';
import { getToken, handleForbidden, handleTokenExpired } from './session';

/** Every admin endpoint is under this prefix; service functions give the path after it. */
export const ADMIN_API_BASE = '/api/admin';

export const LOCALE_STORAGE_KEY = 'avatar-admin.locale';

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

/** A failure of the transport: an abort stays an abort, anything else is NETWORK_ERROR. */
export function transportFailure(cause: unknown): unknown {
  return isAbortError(cause) ? cause : networkError();
}

/** Unwraps an answer and reports its session signals. */
export function unwrapAndReport<T>(httpStatus: number, text: string, sentToken: string | null): T {
  try {
    return unwrapResponse<T>(httpStatus, text);
  } catch (error) {
    reportSessionSignals(error, sentToken);
    throw error;
  }
}

export async function apiRequest<T>(o: {
  method: Method;
  url: string;
  params?: RequestParams;
  body?: unknown;
  signal?: AbortSignal;
}): Promise<T> {
  const url = `${resolveUrl(o.url)}${buildQuery(o.params)}`;
  const hasBody = o.body !== undefined;
  const { headers, sentToken } = buildHeaders(hasBody);

  let status: number;
  let text: string;
  try {
    const response = await fetch(url, {
      method: o.method,
      headers,
      body: hasBody ? JSON.stringify(o.body) : undefined,
      signal: o.signal,
    });
    status = response.status;
    text = await response.text();
  } catch (cause) {
    throw transportFailure(cause);
  }
  return unwrapAndReport<T>(status, text, sentToken);
}
