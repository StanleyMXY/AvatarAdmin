import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch, stubXhr, textResponse } from '../../tests/httpStubs';
import { apiRequest } from './apiClient';
import { downloadFile } from './download';
import {
  isServiceUnavailable,
  markServiceReachable,
  markServiceUnavailable,
  resetServiceStatus,
  subscribeServiceStatus,
} from './serviceStatus';
import { resetSessionState } from './session';
import { uploadFile } from './upload';

beforeEach(() => {
  resetSessionState();
  resetServiceStatus();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const attempt = (promise: Promise<unknown>) => promise.catch(() => undefined);

describe('the service status', () => {
  it('starts as reachable, and tells the listeners only when it changes', () => {
    const listener = vi.fn();
    const stop = subscribeServiceStatus(listener);
    expect(isServiceUnavailable()).toBe(false);
    markServiceReachable();
    expect(listener).not.toHaveBeenCalled();
    markServiceUnavailable();
    markServiceUnavailable();
    expect(isServiceUnavailable()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    markServiceReachable();
    expect(isServiceUnavailable()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    markServiceUnavailable();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('what a request does to the service status', () => {
  it.each([502, 503, 504])(
    'a read that gets a %i page marks the service unavailable',
    async (status) => {
      stubFetch(() => textResponse(status, '<html>Bad Gateway</html>'));
      await attempt(apiRequest({ method: 'GET', url: '/users' }));
      expect(isServiceUnavailable()).toBe(true);
    },
  );

  it.each(['POST', 'PUT', 'DELETE'] as const)(
    'a %s that gets a 502 page does not (nothing is offered to repeat a write)',
    async (method) => {
      stubFetch(() => textResponse(502, '<html>Bad Gateway</html>'));
      await attempt(apiRequest({ method, url: '/users', body: {} }));
      expect(isServiceUnavailable()).toBe(false);
    },
  );

  it('a read that gets a 500 page, a timeout or no network does not', async () => {
    stubFetch(() => textResponse(500, '<html>x</html>'));
    await attempt(apiRequest({ method: 'GET', url: '/users' }));
    stubFetch(() => Promise.reject(new TypeError('offline')));
    await attempt(apiRequest({ method: 'GET', url: '/users' }));
    vi.useFakeTimers();
    stubFetch(
      ({ init }) =>
        new Promise<Response>((_r, reject) => {
          (init.signal as AbortSignal).addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const slow = attempt(apiRequest({ method: 'GET', url: '/users' }));
    await vi.advanceTimersByTimeAsync(30_000);
    await slow;
    vi.useRealTimers();
    expect(isServiceUnavailable()).toBe(false);
  });

  it('a success of the same read clears it, and so does an answer from the backend that is an error', async () => {
    stubFetch(() => textResponse(504, '<html>Gateway Time-out</html>'));
    await attempt(apiRequest({ method: 'GET', url: '/users' }));
    expect(isServiceUnavailable()).toBe(true);
    stubFetch(() => jsonResponse(200, envelope('200', {})));
    await apiRequest({ method: 'GET', url: '/users', params: { page: 2 } });
    expect(isServiceUnavailable()).toBe(false);

    stubFetch(() => textResponse(502, '<html>Bad Gateway</html>'));
    await attempt(apiRequest({ method: 'GET', url: '/users/9' }));
    expect(isServiceUnavailable()).toBe(true);
    stubFetch(() => jsonResponse(404, envelope('RESOURCE_NOT_FOUND')));
    await attempt(apiRequest({ method: 'GET', url: '/users/9' }));
    expect(isServiceUnavailable()).toBe(false);
  });

  it('a success of another read does not clear it: the read that met the gateway page has not worked yet', async () => {
    stubFetch(() => textResponse(504, '<html>Gateway Time-out</html>'));
    await attempt(apiRequest({ method: 'GET', url: '/stats/daily' }));
    stubFetch(() => jsonResponse(200, envelope('200', {})));
    await apiRequest({ method: 'GET', url: '/stats/retention' });
    await attempt(apiRequest({ method: 'POST', url: '/users/1/ban', body: {} }));
    stubFetch(() => jsonResponse(404, envelope('RESOURCE_NOT_FOUND')));
    await attempt(apiRequest({ method: 'GET', url: '/users/404' }));
    stubFetch(() => jsonResponse(200, envelope('200', {})));
    expect(isServiceUnavailable()).toBe(true);
    // two reads failed: it goes when both have worked (or the page is left, or the person retries)
    stubFetch(() => textResponse(503, '<html>x</html>'));
    await attempt(apiRequest({ method: 'GET', url: '/stats/guest/daily' }));
    stubFetch(() => jsonResponse(200, envelope('200', {})));
    await apiRequest({ method: 'GET', url: '/stats/daily' });
    expect(isServiceUnavailable()).toBe(true);
    await apiRequest({ method: 'GET', url: '/stats/guest/daily' });
    expect(isServiceUnavailable()).toBe(false);
  });

  it('leaving the page or pressing retry (a clear without a read) clears every read that failed', async () => {
    stubFetch(() => textResponse(504, '<html>x</html>'));
    await attempt(apiRequest({ method: 'GET', url: '/stats/daily' }));
    await attempt(apiRequest({ method: 'GET', url: '/stats/retention' }));
    markServiceReachable();
    expect(isServiceUnavailable()).toBe(false);
  });

  it('a timeout, no network or a page that is not an envelope leave it as it was', async () => {
    markServiceUnavailable('GET /users');
    stubFetch(() => Promise.reject(new TypeError('offline')));
    await attempt(apiRequest({ method: 'GET', url: '/users' }));
    stubFetch(() => textResponse(200, '<html>x</html>'));
    await attempt(apiRequest({ method: 'GET', url: '/users' }));
    expect(isServiceUnavailable()).toBe(true);
  });

  it('an upload or a download that gets a gateway page does not mark it (only reads of data do)', async () => {
    stubFetch(() => textResponse(502, '<html>x</html>', 'text/html'));
    await attempt(downloadFile({ url: '/x', fallbackName: 'a.xlsx' }));
    const xhrs = stubXhr();
    const upload = attempt(
      uploadFile({ url: '/uploads/apk', file: new File([new Uint8Array(1)], 'a') }),
    );
    xhrs[0].respond(502, '<html>x</html>');
    await upload;
    expect(isServiceUnavailable()).toBe(false);
  });
});
