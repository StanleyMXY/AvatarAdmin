import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { envelope, flush, jsonResponse, stubFetch, textResponse } from '../../tests/httpStubs';
import {
  apiRequest,
  buildQuery,
  defaultLocaleProvider,
  LOCALE_STORAGE_KEY,
  resolveUrl,
  setLocaleProvider,
} from './apiClient';
import { ApiError } from './errors';
import { getToken, resetSessionState, setSessionHandlers, setToken } from './session';

let onExpired: Mock<() => void>;
let onForbidden: Mock<() => void>;

beforeEach(() => {
  resetSessionState();
  onExpired = vi.fn<() => void>();
  onForbidden = vi.fn<() => void>();
  setSessionHandlers({ onExpired, onForbidden });
  setLocaleProvider(() => 'en-US');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function caught(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    return e as ApiError;
  }
  throw new Error('expected the request to fail');
}

describe('apiRequest: success', () => {
  it('returns the data of a success envelope', async () => {
    stubFetch(() => jsonResponse(200, envelope('200', { id: 'a1', name: 'Ploy' })));
    expect(await apiRequest({ method: 'GET', url: '/roles' })).toEqual({ id: 'a1', name: 'Ploy' });
  });

  it('sends Authorization: Bearer <token> and Accept-Language', async () => {
    setToken('tok-123');
    setLocaleProvider(() => 'zh-CN');
    const calls = stubFetch(() => jsonResponse(200, envelope('200', {})));
    await apiRequest({ method: 'GET', url: '/me' });
    expect(calls[0].init.headers.Authorization).toBe('Bearer tok-123');
    expect(calls[0].init.headers['Accept-Language']).toBe('zh-CN');
  });

  it('sends no Authorization header when there is no token', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', {})));
    await apiRequest({ method: 'POST', url: '/auth/login', body: { username: 'a' } });
    expect(Object.keys(calls[0].init.headers).map((k) => k.toLowerCase())).not.toContain(
      'authorization',
    );
  });

  it('leaves the Authorization header out when the request is anonymous, whatever token is held, and does not take a 401 for the end of the session', async () => {
    setToken('tok-123');
    const calls = stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_TOKEN', null, 'void')));
    await expect(
      apiRequest({ method: 'POST', url: '/auth/login', body: {}, anonymous: true }),
    ).rejects.toMatchObject({ code: 'ADMIN_INVALID_TOKEN' });
    expect(Object.keys(calls[0].init.headers).map((k) => k.toLowerCase())).not.toContain(
      'authorization',
    );
    expect(onExpired).not.toHaveBeenCalled();
    expect(getToken()).toBe('tok-123');
  });

  it('does not take a 401 of an anonymous request for the end of a session when no token is held either', async () => {
    stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_TOKEN', null, 'void')));
    await expect(
      apiRequest({ method: 'POST', url: '/auth/totp/enroll', body: {}, anonymous: true }),
    ).rejects.toMatchObject({ code: 'ADMIN_INVALID_TOKEN' });
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('puts relative urls under /api/admin and leaves /api/... urls alone', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', {})));
    await apiRequest({ method: 'GET', url: '/users/42/devices' });
    await apiRequest({ method: 'GET', url: '/api/admin/me' });
    expect(calls[0].url).toBe('/api/admin/users/42/devices');
    expect(calls[1].url).toBe('/api/admin/me');
  });

  it('sends a JSON body with a JSON content type, and nothing for GET', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', {})));
    await apiRequest({ method: 'POST', url: '/roles', body: { name: 'ไทย العربية 😀' } });
    await apiRequest({ method: 'GET', url: '/roles' });
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ name: 'ไทย العربية 😀' });
    expect(calls[1].init.body).toBeUndefined();
  });

  it('sends no content type when there is no body: not on GET, not on a DELETE', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', {})));
    await apiRequest({ method: 'GET', url: '/roles' });
    await apiRequest({ method: 'DELETE', url: '/roles/1' });
    for (const call of calls) {
      expect(Object.keys(call.init.headers).map((k) => k.toLowerCase())).not.toContain(
        'content-type',
      );
    }
  });

  it('uses the method it was given (PUT, DELETE)', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', null)));
    await apiRequest({ method: 'PUT', url: '/config/a.b', body: { value: 1 } });
    await apiRequest({ method: 'DELETE', url: '/config/a.b' });
    expect(calls.map((c) => c.init.method)).toEqual(['PUT', 'DELETE']);
  });

  it('leaves the cache mode of fetch alone, and passes the one a caller asks for', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', null)));
    await apiRequest({ method: 'GET', url: '/a' });
    await apiRequest({ method: 'GET', url: '/b', cache: 'no-store' });
    expect(calls[0].init.cache).toBeUndefined();
    expect(calls[1].init.cache).toBe('no-store');
  });

  it('returns null data as null', async () => {
    stubFetch(() => jsonResponse(200, envelope('200', null)));
    expect(await apiRequest({ method: 'DELETE', url: '/x/1' })).toBeNull();
  });
});

describe('apiRequest: query parameters', () => {
  const query = async (params: Record<string, unknown>) => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', {})));
    await apiRequest({ method: 'GET', url: '/users', params });
    return calls[0].url;
  };

  it('drops undefined, null and empty-string values', async () => {
    expect(await query({ a: undefined, b: null, c: '', d: 'x' })).toBe('/api/admin/users?d=x');
  });

  it('keeps 0, false and whitespace-only strings', async () => {
    const url = await query({ page: 1, zero: 0, flag: false });
    expect(url).toBe('/api/admin/users?page=1&zero=0&flag=false');
  });

  it('sends no question mark when nothing is left', async () => {
    expect(await query({ a: undefined, b: '' })).toBe('/api/admin/users');
  });

  it('encodes values, including non-ASCII text and reserved characters', async () => {
    const url = await query({ q: 'a&b=c d', name: 'สวัสดี مرحبا 😀' });
    const parsed = new URLSearchParams(url.split('?')[1]);
    expect(parsed.get('q')).toBe('a&b=c d');
    expect(parsed.get('name')).toBe('สวัสดี مرحبا 😀');
    expect(url).not.toContain(' ');
  });

  it('turns an array into one comma-separated value (callers decide the format by joining first)', async () => {
    const url = await query({ status: ['A', 'B'] });
    expect(new URLSearchParams(url.split('?')[1]).get('status')).toBe('A,B');
  });

  it('adds the query to an url that has none, and never puts the token in it', async () => {
    setToken('tok-secret');
    const calls = stubFetch(() => jsonResponse(200, envelope('200', {})));
    await apiRequest({ method: 'GET', url: '/users', params: { page: 2 } });
    expect(calls[0].url).not.toContain('tok-secret');
  });

  it('refuses an object value instead of sending [object Object]', async () => {
    stubFetch(() => jsonResponse(200, envelope('200', {})));
    await expect(apiRequest({ method: 'GET', url: '/x', params: { a: { b: 1 } } })).rejects.toThrow(
      TypeError,
    );
  });
});

describe('the address of a request', () => {
  it('refuses an address that is not a path starting with one slash, instead of asking somewhere else', () => {
    for (const bad of [
      'users',
      '',
      'https://evil.example/x',
      '//evil.example/x',
      '/\\evil.example/x',
      ' /users',
    ]) {
      expect(() => resolveUrl(bad), bad).toThrow(TypeError);
    }
  });

  it('refuses a fragment: it is never sent, so the query would land in it', () => {
    expect(() => resolveUrl('/users#frag')).toThrow(TypeError);
  });

  it('keeps accepting the paths services write', () => {
    expect(resolveUrl('/users')).toBe('/api/admin/users');
    expect(resolveUrl('/users/42/devices')).toBe('/api/admin/users/42/devices');
    expect(resolveUrl('/config/app.supported_locales')).toBe(
      '/api/admin/config/app.supported_locales',
    );
    expect(resolveUrl('/api/admin/me')).toBe('/api/admin/me');
    expect(resolveUrl('/users/%E0%B8%AA')).toBe('/api/admin/users/%E0%B8%AA');
  });

  it('joins the parameters to an address that already has a query with &, not a second ?', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', {})));
    await apiRequest({ method: 'GET', url: '/users?status=A', params: { page: 2 } });
    await apiRequest({ method: 'GET', url: '/users?status=A' });
    await apiRequest({ method: 'GET', url: '/users?status=A', params: { page: undefined } });
    expect(calls.map((c) => c.url)).toEqual([
      '/api/admin/users?status=A&page=2',
      '/api/admin/users?status=A',
      '/api/admin/users?status=A',
    ]);
  });

  it('does not send a request to a bad address, and says why', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', {})));
    await expect(apiRequest({ method: 'GET', url: 'users' })).rejects.toThrow(TypeError);
    expect(calls).toEqual([]);
  });
});

describe('query parameters at the edges', () => {
  it('drops an empty array, and the empty elements of an array', () => {
    expect(buildQuery({ a: [] })).toBe('');
    expect(buildQuery({ a: [], b: 1 })).toBe('?b=1');
    expect(buildQuery({ a: [1, undefined, null, ''] })).toBe('?a=1');
    expect(buildQuery({ a: [undefined, null] })).toBe('');
    expect(buildQuery({ a: ['x', 0, false] })).toBe('?a=x%2C0%2Cfalse');
  });

  it('refuses an object inside an array instead of sending [object Object]', () => {
    expect(() => buildQuery({ a: [{ b: 1 }] })).toThrow(TypeError);
    expect(() => buildQuery({ a: [[1, 2]] })).toThrow(TypeError);
  });
});

describe('the language of a request when the shell did not set one', () => {
  const asked = async () => {
    setLocaleProvider(defaultLocaleProvider);
    const calls = stubFetch(() => jsonResponse(200, envelope('200', {})));
    await apiRequest({ method: 'GET', url: '/me' });
    return calls[0].init.headers['Accept-Language'];
  };
  const browserLanguages = (languages: string[]) =>
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);

  it('reads the language the person chose, under the key of the Umi locale plugin', async () => {
    expect(LOCALE_STORAGE_KEY).toBe('umi_locale');
    localStorage.setItem('umi_locale', 'zh-CN');
    browserLanguages(['en-US']);
    expect(await asked()).toBe('zh-CN');
    localStorage.setItem('umi_locale', 'en-US');
    browserLanguages(['zh-CN']);
    expect(await asked()).toBe('en-US');
  });

  it('goes by the browser when nothing was chosen: zh is Chinese, every other language is English', async () => {
    browserLanguages(['zh-TW', 'en-US']);
    expect(await asked()).toBe('zh-CN');
    browserLanguages(['th-TH', 'zh-CN']);
    expect(await asked()).toBe('en-US');
    browserLanguages([]);
    expect(await asked()).toBe('en-US');
  });

  it('ignores a stored value that is not one of the two interface languages', async () => {
    localStorage.setItem('umi_locale', 'th-TH');
    browserLanguages(['zh-CN']);
    expect(await asked()).toBe('zh-CN');
  });

  it('still answers when the browser refuses access to its storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    browserLanguages(['zh-CN']);
    expect(await asked()).toBe('zh-CN');
  });

  it('uses the provider the shell set, whatever is stored', async () => {
    localStorage.setItem('umi_locale', 'zh-CN');
    setLocaleProvider(() => 'en-US');
    const calls = stubFetch(() => jsonResponse(200, envelope('200', {})));
    await apiRequest({ method: 'GET', url: '/me' });
    expect(calls[0].init.headers['Accept-Language']).toBe('en-US');
  });
});

describe('apiRequest: failures that come back in the envelope', () => {
  it('throws ApiError when HTTP is 200 but the code is not "200"', async () => {
    stubFetch(() =>
      jsonResponse(200, envelope('INVALID_STATE', { status: 'ENDED' }, 'already ended')),
    );
    const e = await caught(apiRequest({ method: 'POST', url: '/x/end' }));
    expect(e.code).toBe('INVALID_STATE');
    expect(e.httpStatus).toBe(200);
    expect(e.message).toBe('already ended');
    expect(e.data).toEqual({ status: 'ENDED' });
  });

  it('throws ApiError with the backend code, status, message and data on an error status', async () => {
    stubFetch(() =>
      jsonResponse(
        400,
        envelope('INVALID_REQUEST', { details: [{ ref: 'k', reason: 'NOT_HTTPS' }] }, 'bad k'),
      ),
    );
    const e = await caught(apiRequest({ method: 'PUT', url: '/config/k', body: { value: 'x' } }));
    expect(e.code).toBe('INVALID_REQUEST');
    expect(e.httpStatus).toBe(400);
    expect(e.details).toEqual([{ ref: 'k', reason: 'NOT_HTTPS' }]);
  });

  it('decides by the code, not the status: a 409 with its own code keeps that code', async () => {
    stubFetch(() => jsonResponse(409, envelope('DUPLICATE_RESOURCE', { field: 'code' })));
    const e = await caught(apiRequest({ method: 'POST', url: '/campaigns' }));
    expect(e.code).toBe('DUPLICATE_RESOURCE');
    expect(e.data).toEqual({ field: 'code' });
  });

  it('keeps 429 data such as retryAfterSeconds', async () => {
    stubFetch(() =>
      jsonResponse(429, envelope('RATE_LIMITED', { retryAfterSeconds: 42 }), {
        'retry-after': '42',
      }),
    );
    const e = await caught(apiRequest({ method: 'GET', url: '/stats/export/daily' }));
    expect(e.code).toBe('RATE_LIMITED');
    expect(e.httpStatus).toBe(429);
    expect(e.data).toEqual({ retryAfterSeconds: 42 });
  });

  it('keeps a 429 code that is not RATE_LIMITED', async () => {
    stubFetch(() => jsonResponse(429, envelope('OTP_RESEND_TOO_SOON', { retryAfterSeconds: 30 })));
    const e = await caught(apiRequest({ method: 'POST', url: '/x' }));
    expect(e.code).toBe('OTP_RESEND_TOO_SOON');
  });

  it('gives a 429 without a readable envelope the code RATE_LIMITED', async () => {
    stubFetch(() => textResponse(429, 'Too Many Requests', 'text/plain'));
    const e = await caught(apiRequest({ method: 'GET', url: '/x' }));
    expect(e.code).toBe('RATE_LIMITED');
    expect(e.httpStatus).toBe(429);
  });
});

describe('apiRequest: session signals', () => {
  it('401 ADMIN_INVALID_TOKEN clears the token and calls onExpired', async () => {
    setToken('old');
    stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')));
    const e = await caught(apiRequest({ method: 'GET', url: '/me' }));
    expect(e.code).toBe('ADMIN_INVALID_TOKEN');
    expect(getToken()).toBeNull();
    expect(sessionStorage.getItem('avatar-admin.token')).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('calls onExpired once when several requests fail with ADMIN_INVALID_TOKEN at the same time', async () => {
    setToken('old');
    stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')));
    const results = await Promise.allSettled([
      apiRequest({ method: 'GET', url: '/a' }),
      apiRequest({ method: 'GET', url: '/b' }),
      apiRequest({ method: 'GET', url: '/c' }),
    ]);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it.each(['ADMIN_INVALID_CREDENTIALS', 'ADMIN_TOTP_REQUIRED', 'ADMIN_TOTP_INVALID'])(
    '401 %s only throws: the login page depends on it',
    async (code) => {
      setToken('keep');
      stubFetch(() => jsonResponse(401, envelope(code)));
      const e = await caught(apiRequest({ method: 'POST', url: '/auth/login', body: {} }));
      expect(e.code).toBe(code);
      expect(onExpired).not.toHaveBeenCalled();
      expect(getToken()).toBe('keep');
    },
  );

  it('does not log the user out when a slow answer to an old token arrives after a new login', async () => {
    setToken('old');
    let release: (r: Response) => void = () => {};
    stubFetch(() => new Promise<Response>((resolve) => (release = resolve)));
    const pending = apiRequest({ method: 'GET', url: '/slow' });
    await flush();
    setToken('new');
    release(jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')));
    await caught(pending);
    expect(onExpired).not.toHaveBeenCalled();
    expect(getToken()).toBe('new');
  });

  it('a session handler that throws does not replace the error of the request', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    setSessionHandlers({
      onExpired: () => {
        throw new Error('handler bug');
      },
      onForbidden: () => {
        throw new Error('handler bug');
      },
    });
    setToken('old');
    stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')));
    expect((await caught(apiRequest({ method: 'GET', url: '/me' }))).code).toBe(
      'ADMIN_INVALID_TOKEN',
    );
    stubFetch(() => jsonResponse(403, envelope('ADMIN_FORBIDDEN')));
    expect((await caught(apiRequest({ method: 'GET', url: '/x' }))).code).toBe('ADMIN_FORBIDDEN');
    expect(log).toHaveBeenCalledTimes(2);
  });

  it('403 ADMIN_FORBIDDEN calls onForbidden, throws, and keeps the token', async () => {
    setToken('keep');
    stubFetch(() => jsonResponse(403, envelope('ADMIN_FORBIDDEN')));
    const e = await caught(apiRequest({ method: 'POST', url: '/users/1/ban' }));
    expect(e.code).toBe('ADMIN_FORBIDDEN');
    expect(onForbidden).toHaveBeenCalledTimes(1);
    expect(onExpired).not.toHaveBeenCalled();
    expect(getToken()).toBe('keep');
  });

  it('reportForbidden: false keeps a 403 ADMIN_FORBIDDEN from calling onForbidden, but the request still throws it and a lost token is still reported', async () => {
    setToken('keep');
    stubFetch(() => jsonResponse(403, envelope('ADMIN_FORBIDDEN')));
    const e = await caught(apiRequest({ method: 'GET', url: '/me', reportForbidden: false }));
    expect(e.code).toBe('ADMIN_FORBIDDEN');
    expect(onForbidden).not.toHaveBeenCalled();
    stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')));
    await caught(apiRequest({ method: 'GET', url: '/me', reportForbidden: false }));
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('other 403 codes do not call onForbidden', async () => {
    stubFetch(() => jsonResponse(403, envelope('SELF_REVIEW_FORBIDDEN')));
    await caught(apiRequest({ method: 'POST', url: '/credits/adjustments/1/approve' }));
    expect(onForbidden).not.toHaveBeenCalled();
  });

  it('429 triggers neither handler', async () => {
    stubFetch(() => jsonResponse(429, envelope('RATE_LIMITED')));
    await caught(apiRequest({ method: 'GET', url: '/x' }));
    expect(onExpired).not.toHaveBeenCalled();
    expect(onForbidden).not.toHaveBeenCalled();
  });
});

describe('apiRequest: failures without a usable envelope', () => {
  it('maps a fetch rejection to NETWORK_ERROR', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    const e = await caught(apiRequest({ method: 'GET', url: '/x' }));
    expect(e.code).toBe('NETWORK_ERROR');
    expect(e.httpStatus).toBe(0);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('lets an abort through as an AbortError instead of calling it a network error', async () => {
    const controller = new AbortController();
    stubFetch(
      ({ init }) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const pending = apiRequest({ method: 'GET', url: '/x', signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('an abort with a reason of its own (a string, a plain Error) is still an abort, not a network error', async () => {
    for (const reason of ['page closed', new Error('unmounted')]) {
      const controller = new AbortController();
      stubFetch(
        ({ init }) =>
          new Promise<Response>((_resolve, rejectFetch) => {
            // Some browsers and polyfills reject with whatever the abort carried.
            init.signal?.addEventListener('abort', () => rejectFetch(reason));
          }),
      );
      const pending = apiRequest({ method: 'GET', url: '/x', signal: controller.signal });
      controller.abort(reason);
      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    }
  });

  it('maps a body that is not JSON to INVALID_RESPONSE and keeps the status', async () => {
    stubFetch(() => textResponse(200, '<html>login</html>'));
    const e = await caught(apiRequest({ method: 'GET', url: '/x' }));
    expect(e.code).toBe('INVALID_RESPONSE');
    expect(e.httpStatus).toBe(200);
  });

  it.each([502, 503, 504])(
    'maps a %i gateway error page to GATEWAY_UNAVAILABLE',
    async (status) => {
      stubFetch(() => textResponse(status, '<html>Bad Gateway</html>'));
      const e = await caught(apiRequest({ method: 'GET', url: '/x' }));
      expect(e.code).toBe('GATEWAY_UNAVAILABLE');
      expect(e.httpStatus).toBe(status);
    },
  );

  it('keeps INVALID_RESPONSE for an HTML page with another error status', async () => {
    stubFetch(() => textResponse(500, '<html>Server Error</html>'));
    expect((await caught(apiRequest({ method: 'GET', url: '/x' }))).code).toBe('INVALID_RESPONSE');
  });

  it('maps JSON that is not an envelope to INVALID_RESPONSE', async () => {
    for (const body of [{ foo: 1 }, [], 'text', 7, null, { code: 200, message: 'x', data: 1 }]) {
      stubFetch(() => jsonResponse(200, body));
      const e = await caught(apiRequest({ method: 'GET', url: '/x' }));
      expect(e.code).toBe('INVALID_RESPONSE');
    }
  });

  it('maps an empty body to INVALID_RESPONSE', async () => {
    stubFetch(() => new Response('', { status: 200 }));
    expect((await caught(apiRequest({ method: 'GET', url: '/x' }))).code).toBe('INVALID_RESPONSE');
  });

  it('does not take an error status carrying the success code for a success', async () => {
    stubFetch(() => jsonResponse(500, envelope('200', { ok: true })));
    expect((await caught(apiRequest({ method: 'GET', url: '/x' }))).code).toBe('INVALID_RESPONSE');
  });

  it('keeps INTERNAL_ERROR as it is', async () => {
    stubFetch(() => jsonResponse(500, envelope('INTERNAL_ERROR')));
    expect((await caught(apiRequest({ method: 'GET', url: '/x' }))).code).toBe('INTERNAL_ERROR');
  });

  it('a gateway 401 without an envelope does not log the user out', async () => {
    setToken('keep');
    stubFetch(() => textResponse(401, 'Unauthorized', 'text/plain'));
    const e = await caught(apiRequest({ method: 'GET', url: '/x' }));
    expect(e.code).toBe('INVALID_RESPONSE');
    expect(onExpired).not.toHaveBeenCalled();
  });
});

describe('apiRequest: nothing leaks', () => {
  it('writes nothing to the console, also on failure', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m),
    );
    setToken('tok-secret');
    stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')));
    await caught(apiRequest({ method: 'GET', url: '/me' }));
    stubFetch(() => Promise.reject(new TypeError('x')));
    await caught(apiRequest({ method: 'GET', url: '/me' }));
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it('does not send credentials by cookie or a fixed token', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', {})));
    await apiRequest({ method: 'GET', url: '/me' });
    expect(
      calls[0].init.credentials === undefined || calls[0].init.credentials === 'same-origin',
    ).toBe(true);
    expect(JSON.stringify(calls[0].init.headers)).not.toMatch(/token=|x-api-key|x-token/i);
  });
});

/** A fetch that never answers by itself and rejects like the browser when its signal is aborted. */
function hangingFetch() {
  const signals: AbortSignal[] = [];
  const calls = stubFetch(
    ({ init }) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init.signal as AbortSignal;
        signals.push(signal);
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
  );
  return { calls, signals };
}

describe('apiRequest: time limit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('gives up after 30 seconds with REQUEST_TIMEOUT, not before', async () => {
    const { signals } = hangingFetch();
    const pending = caught(apiRequest({ method: 'GET', url: '/slow' }));
    await vi.advanceTimersByTimeAsync(29_999);
    expect(signals[0].aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const e = await pending;
    expect([e.code, e.httpStatus]).toEqual(['REQUEST_TIMEOUT', 0]);
  });

  it('also limits a write', async () => {
    hangingFetch();
    const pending = caught(apiRequest({ method: 'POST', url: '/slow', body: { a: 1 } }));
    await vi.advanceTimersByTimeAsync(30_000);
    expect((await pending).code).toBe('REQUEST_TIMEOUT');
  });

  it('counts the reading of the body too', async () => {
    let signal: AbortSignal | undefined;
    stubFetch(({ init }) => {
      signal = init.signal as AbortSignal;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          signal?.addEventListener('abort', () =>
            controller.error(new DOMException('aborted', 'AbortError')),
          );
        },
      });
      return Promise.resolve(new Response(stream, { status: 200 }));
    });
    const pending = caught(apiRequest({ method: 'GET', url: '/slow-body' }));
    await vi.advanceTimersByTimeAsync(30_000);
    expect((await pending).code).toBe('REQUEST_TIMEOUT');
  });

  it('takes a limit from the caller', async () => {
    hangingFetch();
    const pending = caught(apiRequest({ method: 'GET', url: '/slow', timeoutMs: 5000 }));
    await vi.advanceTimersByTimeAsync(5000);
    expect((await pending).code).toBe('REQUEST_TIMEOUT');
  });

  it('a caller abort stays an AbortError, also when the time would have run out later', async () => {
    const controller = new AbortController();
    hangingFetch();
    const pending = apiRequest({ method: 'GET', url: '/slow', signal: controller.signal });
    const outcome = pending.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1000);
    controller.abort();
    const e = (await outcome) as { name?: string; code?: string };
    expect(e.name).toBe('AbortError');
    expect(e.code).toBeUndefined();
  });

  it('a signal that is already aborted sends nothing', async () => {
    const controller = new AbortController();
    controller.abort();
    const calls = stubFetch(() => jsonResponse(200, envelope('200', {})));
    await expect(
      apiRequest({ method: 'GET', url: '/x', signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls).toEqual([]);
  });

  it('an answer in time clears the clock, so nothing is aborted afterwards', async () => {
    const seen: AbortSignal[] = [];
    stubFetch(({ init }) => {
      seen.push(init.signal as AbortSignal);
      return jsonResponse(200, envelope('200', { ok: true }));
    });
    await apiRequest({ method: 'GET', url: '/fast' });
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(seen[0].aborted).toBe(false);
  });

  it('a failed request clears the clock as well', async () => {
    stubFetch(() => Promise.reject(new TypeError('offline')));
    await caught(apiRequest({ method: 'GET', url: '/x' }));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a timed-out request does not tell the session layer anything', async () => {
    setToken('keep');
    hangingFetch();
    const pending = caught(apiRequest({ method: 'GET', url: '/slow' }));
    await vi.advanceTimersByTimeAsync(30_000);
    await pending;
    expect(onExpired).not.toHaveBeenCalled();
    expect(getToken()).toBe('keep');
  });
});

describe('apiRequest: failures carry no token and no address', () => {
  const TOKEN = 'tok-very-secret-123';
  const FILE_URL = 'https://files.example.test/moderation/ภาพ-صورة.png?X-Signature=abc123';

  afterEach(() => {
    vi.useRealTimers();
  });

  const everything = (e: unknown) =>
    [String(e), (e as Error).message, JSON.stringify(e), JSON.stringify((e as ApiError).data)].join(
      '\n',
    );

  it('does not put them in the error or the console, whichever way the request fails', async () => {
    vi.useFakeTimers();
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m),
    );
    setToken(TOKEN);
    const params = { fileUrl: FILE_URL };
    const failures: ApiError[] = [];

    stubFetch(() => textResponse(502, `<html>upstream ${FILE_URL}</html>`));
    failures.push(await caught(apiRequest({ method: 'GET', url: '/moderation/7', params })));

    stubFetch(() => textResponse(200, `<html>${FILE_URL}</html>`));
    failures.push(await caught(apiRequest({ method: 'GET', url: '/moderation/7', params })));

    stubFetch(() => Promise.reject(new TypeError(`Failed to fetch ${FILE_URL} ${TOKEN}`)));
    failures.push(await caught(apiRequest({ method: 'GET', url: '/moderation/7', params })));

    hangingFetch();
    const timedOut = caught(apiRequest({ method: 'GET', url: '/moderation/7', params }));
    await vi.advanceTimersByTimeAsync(30_000);
    failures.push(await timedOut);

    expect(failures.map((f) => f.code)).toEqual([
      'GATEWAY_UNAVAILABLE',
      'INVALID_RESPONSE',
      'NETWORK_ERROR',
      'REQUEST_TIMEOUT',
    ]);
    for (const failure of failures) {
      const text = everything(failure);
      expect(text).not.toContain(TOKEN);
      expect(text).not.toContain('X-Signature');
      expect(text).not.toContain('files.example.test');
    }
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
