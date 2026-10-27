import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch, textResponse, XLSX_TYPE } from '../../tests/httpStubs';
import { setLocaleProvider } from './apiClient';
import { downloadFile, parseContentDisposition } from './download';
import { ApiError } from './errors';
import { getToken, resetSessionState, setSessionHandlers, setToken } from './session';

let onExpired: Mock<() => void>;
let onForbidden: Mock<() => void>;
let saved: { download: string; href: string }[];
let createObjectURL: ReturnType<typeof vi.fn>;
let blobs: Blob[];

beforeEach(() => {
  resetSessionState();
  onExpired = vi.fn<() => void>();
  onForbidden = vi.fn<() => void>();
  setSessionHandlers({ onExpired, onForbidden });
  setLocaleProvider(() => 'en-US');
  saved = [];
  blobs = [];
  createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return `blob:fake/${blobs.length}`;
  });
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = createObjectURL;
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push({ download: this.download, href: this.href });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const xlsx = (bytes: Uint8Array | number[], disposition?: string, status = 200) =>
  new Response(Uint8Array.from(bytes), {
    status,
    headers: {
      'content-type': XLSX_TYPE,
      ...(disposition ? { 'content-disposition': disposition } : {}),
    },
  });

async function caught(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    return e as ApiError;
  }
  throw new Error('expected the download to fail');
}

describe('downloadFile: success', () => {
  it('saves an xlsx response under the name in Content-Disposition', async () => {
    stubFetch(() =>
      xlsx([1, 2, 3, 4, 5], 'attachment; filename="sms-records-2026-10-01-2026-10-21.xlsx"'),
    );
    const result = await downloadFile({
      url: '/sms/records/export',
      fallbackName: 'fallback.xlsx',
    });
    expect(result).toEqual({ filename: 'sms-records-2026-10-01-2026-10-21.xlsx', bytes: 5 });
    expect(saved).toHaveLength(1);
    expect(saved[0].download).toBe('sms-records-2026-10-01-2026-10-21.xlsx');
    expect(blobs[0].size).toBe(5);
  });

  it("reads a non-ASCII name from filename*=UTF-8''", async () => {
    const name = 'รายงาน-تقرير-报表.xlsx';
    stubFetch(() =>
      xlsx([1], `attachment; filename="report.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`),
    );
    const result = await downloadFile({
      url: '/stats/export/daily',
      fallbackName: 'fallback.xlsx',
    });
    expect(result.filename).toBe(name);
    expect(saved[0].download).toBe(name);
  });

  it('uses fallbackName when there is no usable Content-Disposition', async () => {
    stubFetch(() => xlsx([1]));
    const result = await downloadFile({ url: '/stats/export/daily', fallbackName: 'daily.xlsx' });
    expect(result.filename).toBe('daily.xlsx');
  });

  it('sends the token in the Authorization header and the language, and no token in the url', async () => {
    setToken('tok-secret');
    setLocaleProvider(() => 'zh-CN');
    const calls = stubFetch(() => xlsx([1]));
    await downloadFile({
      url: '/stats/export/daily',
      params: { from: '2026-10-01', to: '2026-10-21', channelCode: undefined },
      fallbackName: 'daily.xlsx',
    });
    expect(calls[0].init.headers.Authorization).toBe('Bearer tok-secret');
    expect(calls[0].init.headers['Accept-Language']).toBe('zh-CN');
    expect(calls[0].init.method).toBe('GET');
    expect(calls[0].url).toBe('/api/admin/stats/export/daily?from=2026-10-01&to=2026-10-21');
    expect(calls[0].url).not.toContain('tok-secret');
  });

  it('does not open a window for the download', async () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    stubFetch(() => xlsx([1]));
    await downloadFile({ url: '/x', fallbackName: 'a.xlsx' });
    expect(open).not.toHaveBeenCalled();
  });

  it('reports the number of bytes received so far', async () => {
    const chunks = [new Uint8Array(3), new Uint8Array(4), new Uint8Array(5)];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(c);
        controller.close();
      },
    });
    stubFetch(() => new Response(stream, { status: 200, headers: { 'content-type': XLSX_TYPE } }));
    const progress: number[] = [];
    const result = await downloadFile({
      url: '/x',
      fallbackName: 'a.xlsx',
      onProgress: (n) => progress.push(n),
    });
    expect(progress).toEqual([3, 7, 12]);
    expect(result.bytes).toBe(12);
    expect(blobs[0].size).toBe(12);
  });

  it('accepts the content type with parameters and in any letter case', async () => {
    stubFetch(
      () =>
        new Response(Uint8Array.from([1]), {
          status: 200,
          headers: { 'content-type': `${XLSX_TYPE.toUpperCase()}; charset=binary` },
        }),
    );
    await downloadFile({ url: '/x', fallbackName: 'a.xlsx' });
    expect(saved).toHaveLength(1);
  });
});

describe('downloadFile: failures are shown, never saved', () => {
  it.each([
    [429, 'RATE_LIMITED', { retryAfterSeconds: 90 }],
    [400, 'INVALID_REQUEST', { details: [{ ref: 'to', reason: 'OUT_OF_RANGE' }] }],
    [403, 'ADMIN_FORBIDDEN', null],
  ])(
    'a %i JSON body becomes an ApiError with the backend code and no file',
    async (status, code, data) => {
      stubFetch(() => jsonResponse(status, envelope(code, data, `backend says ${code}`)));
      const e = await caught(
        downloadFile({ url: '/stats/export/daily', fallbackName: 'daily.xlsx' }),
      );
      expect(e.code).toBe(code);
      expect(e.httpStatus).toBe(status);
      expect(e.message).toBe(`backend says ${code}`);
      expect(e.data).toEqual(data);
      expect(createObjectURL).not.toHaveBeenCalled();
      expect(saved).toEqual([]);
    },
  );

  it('a 200 response whose content type is JSON is an error, not a file', async () => {
    stubFetch(() => jsonResponse(200, envelope('INVALID_REQUEST', null, 'too many rows')));
    const e = await caught(downloadFile({ url: '/x', fallbackName: 'a.xlsx' }));
    expect(e.code).toBe('INVALID_REQUEST');
    expect(saved).toEqual([]);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('a 200 JSON body claiming success is not a file either', async () => {
    stubFetch(() => jsonResponse(200, envelope('200', { rows: 1 })));
    const e = await caught(downloadFile({ url: '/x', fallbackName: 'a.xlsx' }));
    expect(e.code).toBe('INVALID_RESPONSE');
    expect(saved).toEqual([]);
  });

  it('a 200 response with any other content type (a gateway login page) is not saved', async () => {
    stubFetch(() => textResponse(200, '<html>please sign in</html>', 'text/html'));
    const e = await caught(downloadFile({ url: '/x', fallbackName: 'a.xlsx' }));
    expect(e.code).toBe('INVALID_RESPONSE');
    expect(saved).toEqual([]);
  });

  it('an error status with an xlsx content type is not saved', async () => {
    stubFetch(() => xlsx([1, 2], undefined, 500));
    const e = await caught(downloadFile({ url: '/x', fallbackName: 'a.xlsx' }));
    expect(e.code).toBe('INVALID_RESPONSE');
    expect(e.httpStatus).toBe(500);
    expect(saved).toEqual([]);
  });

  it('401 ADMIN_INVALID_TOKEN goes through onExpired', async () => {
    setToken('old');
    stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')));
    const e = await caught(downloadFile({ url: '/x', fallbackName: 'a.xlsx' }));
    expect(e.code).toBe('ADMIN_INVALID_TOKEN');
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(getToken()).toBeNull();
    expect(saved).toEqual([]);
  });

  it('403 ADMIN_FORBIDDEN goes through onForbidden', async () => {
    stubFetch(() => jsonResponse(403, envelope('ADMIN_FORBIDDEN')));
    await caught(downloadFile({ url: '/x', fallbackName: 'a.xlsx' }));
    expect(onForbidden).toHaveBeenCalledTimes(1);
  });

  it('a network failure is NETWORK_ERROR and saves nothing', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    const e = await caught(downloadFile({ url: '/x', fallbackName: 'a.xlsx' }));
    expect(e.code).toBe('NETWORK_ERROR');
    expect(saved).toEqual([]);
  });

  it('a stream that breaks half way saves nothing', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(3));
        controller.error(new TypeError('connection reset'));
      },
    });
    stubFetch(() => new Response(stream, { status: 200, headers: { 'content-type': XLSX_TYPE } }));
    const e = await caught(downloadFile({ url: '/x', fallbackName: 'a.xlsx' }));
    expect(e.code).toBe('NETWORK_ERROR');
    expect(saved).toEqual([]);
  });
});

/** A fetch that answers with an xlsx header and a body that stays open until the signal is aborted. */
function slowBody(firstChunk = new Uint8Array(3)) {
  const signals: AbortSignal[] = [];
  stubFetch(({ init }) => {
    const signal = init.signal as AbortSignal;
    signals.push(signal);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(firstChunk);
        signal.addEventListener('abort', () =>
          controller.error(new DOMException('aborted', 'AbortError')),
        );
      },
    });
    return new Response(stream, { status: 200, headers: { 'content-type': XLSX_TYPE } });
  });
  return signals;
}

describe('downloadFile: gateway page', () => {
  it.each([502, 503, 504])(
    'a %i page is GATEWAY_UNAVAILABLE and nothing is saved',
    async (status) => {
      stubFetch(() => textResponse(status, '<html>Bad Gateway</html>', 'text/html'));
      const e = await caught(downloadFile({ url: '/x', fallbackName: 'a.xlsx' }));
      expect([e.code, e.httpStatus]).toEqual(['GATEWAY_UNAVAILABLE', status]);
      expect(saved).toEqual([]);
    },
  );
});

describe('downloadFile: time limit and cancel', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('gives up after 5 minutes, also in the middle of the body, and saves nothing', async () => {
    vi.useFakeTimers();
    const signals = slowBody();
    const pending = caught(downloadFile({ url: '/x', fallbackName: 'a.xlsx' }));
    await vi.advanceTimersByTimeAsync(299_999);
    expect(signals[0].aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const e = await pending;
    expect([e.code, e.httpStatus]).toEqual(['REQUEST_TIMEOUT', 0]);
    expect(saved).toEqual([]);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('gives up while waiting for the answer as well', async () => {
    vi.useFakeTimers();
    stubFetch(
      ({ init }) =>
        new Promise<Response>((_resolve, reject) => {
          (init.signal as AbortSignal).addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const pending = caught(downloadFile({ url: '/x', fallbackName: 'a.xlsx' }));
    await vi.advanceTimersByTimeAsync(300_000);
    expect((await pending).code).toBe('REQUEST_TIMEOUT');
  });

  it('takes another limit from the caller', async () => {
    vi.useFakeTimers();
    slowBody();
    const pending = caught(downloadFile({ url: '/x', fallbackName: 'a.xlsx', timeoutMs: 2000 }));
    await vi.advanceTimersByTimeAsync(2000);
    expect((await pending).code).toBe('REQUEST_TIMEOUT');
  });

  it('can be cancelled in the middle of the body: an AbortError and no file', async () => {
    const controller = new AbortController();
    slowBody();
    const progress: number[] = [];
    const outcome = downloadFile({
      url: '/x',
      fallbackName: 'a.xlsx',
      signal: controller.signal,
      onProgress: (n) => progress.push(n),
    }).catch((e: unknown) => e);
    await vi.waitFor(() => expect(progress).toEqual([3]));
    controller.abort();
    const e = (await outcome) as { name?: string; code?: string };
    expect(e.name).toBe('AbortError');
    expect(e.code).toBeUndefined();
    expect(saved).toEqual([]);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('can be cancelled while waiting for the answer', async () => {
    const controller = new AbortController();
    stubFetch(
      ({ init }) =>
        new Promise<Response>((_resolve, reject) => {
          (init.signal as AbortSignal).addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const outcome = downloadFile({
      url: '/x',
      fallbackName: 'a.xlsx',
      signal: controller.signal,
    }).catch((e: unknown) => e);
    controller.abort();
    expect(((await outcome) as { name?: string }).name).toBe('AbortError');
  });

  it('a signal that is already aborted sends nothing and saves nothing', async () => {
    const controller = new AbortController();
    controller.abort();
    const calls = stubFetch(() => xlsx([1]));
    const e = (await downloadFile({
      url: '/x',
      fallbackName: 'a.xlsx',
      signal: controller.signal,
    }).catch((err: unknown) => err)) as { name?: string };
    expect(e.name).toBe('AbortError');
    expect(calls).toEqual([]);
    expect(saved).toEqual([]);
  });

  it('a cancel that arrives just as the last byte does saves nothing', async () => {
    const controller = new AbortController();
    stubFetch(() => {
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new Uint8Array(2));
          c.close();
        },
      });
      return new Response(body, { status: 200, headers: { 'content-type': XLSX_TYPE } });
    });
    const outcome = downloadFile({
      url: '/x',
      fallbackName: 'a.xlsx',
      signal: controller.signal,
      onProgress: () => controller.abort(),
    }).catch((e: unknown) => e);
    expect(((await outcome) as { name?: string }).name).toBe('AbortError');
    expect(saved).toEqual([]);
  });

  it('a finished download clears the clock', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    stubFetch(({ init }) => {
      signal = init.signal as AbortSignal;
      return xlsx([1, 2, 3]);
    });
    await downloadFile({ url: '/x', fallbackName: 'a.xlsx' });
    await vi.advanceTimersByTimeAsync(600_000);
    expect(signal?.aborted).toBe(false);
    expect(saved).toHaveLength(1);
  });

  it('carries no token and no address in what it throws', async () => {
    vi.useFakeTimers();
    setToken('tok-secret-xyz');
    slowBody();
    const pending = caught(
      downloadFile({
        url: '/moderation/7/export',
        params: { fileUrl: 'https://files.example.test/a.png?sig=zzz' },
        fallbackName: 'a.xlsx',
      }),
    );
    await vi.advanceTimersByTimeAsync(300_000);
    const e = await pending;
    const text = `${String(e)} ${e.message} ${JSON.stringify(e)}`;
    expect(text).not.toContain('tok-secret-xyz');
    expect(text).not.toContain('files.example.test');
    expect(text).not.toContain('sig=zzz');
  });
});

describe('parseContentDisposition', () => {
  it('reads a quoted and an unquoted filename', () => {
    expect(parseContentDisposition('attachment; filename="a b.xlsx"')).toBe('a b.xlsx');
    expect(parseContentDisposition('attachment; filename=a.xlsx')).toBe('a.xlsx');
  });

  it('prefers filename* over filename', () => {
    expect(
      parseContentDisposition(
        'attachment; filename="fallback.xlsx"; filename*=UTF-8\'\'%E6%8A%A5%E8%A1%A8.xlsx',
      ),
    ).toBe('报表.xlsx');
  });

  it('reads Thai, Arabic and emoji names from filename*', () => {
    for (const name of [
      'รายงาน.xlsx',
      'تقرير.xlsx',
      'laporan-😀.xlsx',
      'informe-año.xlsx',
      'báo-cáo.xlsx',
    ]) {
      expect(
        parseContentDisposition(`attachment; filename*=UTF-8''${encodeURIComponent(name)}`),
      ).toBe(name);
    }
  });

  it('falls back to filename when filename* is broken', () => {
    expect(
      parseContentDisposition('attachment; filename="ok.xlsx"; filename*=UTF-8\'\'%E6%8A'),
    ).toBe('ok.xlsx');
  });

  it('returns null when there is no name or no header', () => {
    expect(parseContentDisposition(null)).toBeNull();
    expect(parseContentDisposition('attachment')).toBeNull();
    expect(parseContentDisposition('attachment; filename=""')).toBeNull();
  });

  it('keeps only the last path segment so a name cannot point outside the downloads folder', () => {
    expect(parseContentDisposition('attachment; filename="../../etc/evil.xlsx"')).toBe('evil.xlsx');
    expect(parseContentDisposition('attachment; filename="..\\\\..\\\\evil.xlsx"')).toBe(
      'evil.xlsx',
    );
    expect(parseContentDisposition("attachment; filename*=UTF-8''..%2F..%2Fevil.xlsx")).toBe(
      'evil.xlsx',
    );
  });

  it('removes direction-control characters that could disguise the extension', () => {
    expect(parseContentDisposition("attachment; filename*=UTF-8''report%E2%80%AEslx.xlsx")).toBe(
      'reportslx.xlsx',
    );
  });

  it('removes control characters and gives null when nothing is left', () => {
    expect(parseContentDisposition("attachment; filename*=UTF-8''a%00b%0Ac.xlsx")).toBe('abc.xlsx');
    expect(parseContentDisposition("attachment; filename*=UTF-8''%00%0A")).toBeNull();
    expect(parseContentDisposition('attachment; filename=".."')).toBeNull();
  });
});
