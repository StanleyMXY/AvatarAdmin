import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { envelope, type FakeXHR, stubXhr } from '../../tests/httpStubs';
import { setLocaleProvider } from './apiClient';
import { ApiError } from './errors';
import { getToken, resetSessionState, setSessionHandlers, setToken } from './session';
import { uploadFile } from './upload';

let xhrs: FakeXHR[];
let onExpired: Mock<() => void>;
let onForbidden: Mock<() => void>;

beforeEach(() => {
  resetSessionState();
  onExpired = vi.fn<() => void>();
  onForbidden = vi.fn<() => void>();
  setSessionHandlers({ onExpired, onForbidden });
  setLocaleProvider(() => 'en-US');
  xhrs = stubXhr();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const file = () => new File([Uint8Array.from([1, 2, 3])], 'ภาพ-صورة.png', { type: 'image/png' });

async function caught(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    return e as ApiError;
  }
  throw new Error('expected the upload to fail');
}

describe('uploadFile', () => {
  it('posts multipart form data with the file under the field name "file"', async () => {
    const pending = uploadFile<{ uploadId: string }>({ url: '/uploads/image', file: file() });
    const xhr = xhrs[0];
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('/api/admin/uploads/image');
    expect(xhr.body).toBeInstanceOf(FormData);
    const form = xhr.body as FormData;
    expect((form.get('file') as File).name).toBe('ภาพ-صورة.png');
    xhr.respond(200, JSON.stringify(envelope('200', { uploadId: 'u-1' })));
    expect(await pending).toEqual({ uploadId: 'u-1' });
  });

  it('adds extra fields as strings', async () => {
    const pending = uploadFile({
      url: '/ads/media',
      file: file(),
      fields: { kind: 'IMAGE', note: 'ñandú' },
    });
    const form = xhrs[0].body as FormData;
    expect(form.get('kind')).toBe('IMAGE');
    expect(form.get('note')).toBe('ñandú');
    xhrs[0].respond(200, JSON.stringify(envelope('200', {})));
    await pending;
  });

  it('sends Authorization and Accept-Language, and leaves Content-Type to the browser', async () => {
    setToken('tok-secret');
    setLocaleProvider(() => 'zh-CN');
    const pending = uploadFile({ url: '/uploads/image', file: file() });
    const xhr = xhrs[0];
    expect(xhr.headers.Authorization).toBe('Bearer tok-secret');
    expect(xhr.headers['Accept-Language']).toBe('zh-CN');
    expect(Object.keys(xhr.headers).map((h) => h.toLowerCase())).not.toContain('content-type');
    expect(xhr.url).not.toContain('tok-secret');
    xhr.respond(200, JSON.stringify(envelope('200', {})));
    await pending;
  });

  it('reports progress as loaded and total', async () => {
    const progress: [number, number][] = [];
    const pending = uploadFile({
      url: '/uploads/apk',
      file: file(),
      onProgress: (loaded, total) => progress.push([loaded, total]),
    });
    xhrs[0].progress(10, 100);
    xhrs[0].progress(100, 100);
    xhrs[0].progress(5, 0, false);
    xhrs[0].respond(200, JSON.stringify(envelope('200', {})));
    await pending;
    expect(progress).toEqual([
      [10, 100],
      [100, 100],
    ]);
  });

  it('reads errors from the envelope the same way as apiRequest', async () => {
    const pending = uploadFile({ url: '/uploads/image', file: file() });
    xhrs[0].respond(400, JSON.stringify(envelope('INVALID_FILE', null, 'file too big')));
    const e = await caught(pending);
    expect(e.code).toBe('INVALID_FILE');
    expect(e.httpStatus).toBe(400);
    expect(e.message).toBe('file too big');
  });

  it('turns a 200 with a failure code into an ApiError', async () => {
    const pending = uploadFile({ url: '/uploads/image', file: file() });
    xhrs[0].respond(
      200,
      JSON.stringify(envelope('DEPENDENCY_UNAVAILABLE', null, 'upload.public_base_url is not set')),
    );
    expect((await caught(pending)).code).toBe('DEPENDENCY_UNAVAILABLE');
  });

  it('maps a body that is not JSON to INVALID_RESPONSE', async () => {
    const pending = uploadFile({ url: '/uploads/image', file: file() });
    xhrs[0].respond(413, '<html>Request Entity Too Large</html>');
    const e = await caught(pending);
    expect(e.code).toBe('INVALID_RESPONSE');
    expect(e.httpStatus).toBe(413);
  });

  it('maps 429 without an envelope to RATE_LIMITED', async () => {
    const pending = uploadFile({ url: '/uploads/image', file: file() });
    xhrs[0].respond(429, '');
    expect((await caught(pending)).code).toBe('RATE_LIMITED');
  });

  it('401 ADMIN_INVALID_TOKEN goes through onExpired and clears the token', async () => {
    setToken('old');
    const pending = uploadFile({ url: '/uploads/image', file: file() });
    xhrs[0].respond(401, JSON.stringify(envelope('ADMIN_INVALID_TOKEN')));
    await caught(pending);
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(getToken()).toBeNull();
  });

  it('403 ADMIN_FORBIDDEN goes through onForbidden', async () => {
    const pending = uploadFile({ url: '/uploads/image', file: file() });
    xhrs[0].respond(403, JSON.stringify(envelope('ADMIN_FORBIDDEN')));
    await caught(pending);
    expect(onForbidden).toHaveBeenCalledTimes(1);
  });

  it('a network failure is NETWORK_ERROR', async () => {
    const pending = uploadFile({ url: '/uploads/image', file: file() });
    xhrs[0].failNetwork();
    const e = await caught(pending);
    expect(e.code).toBe('NETWORK_ERROR');
    expect(e.httpStatus).toBe(0);
  });

  it('abort cancels the request and rejects with an AbortError', async () => {
    const controller = new AbortController();
    const pending = uploadFile({ url: '/uploads/apk', file: file(), signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(xhrs[0].aborted).toBe(true);
  });

  it('a signal that is already aborted sends nothing', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      uploadFile({ url: '/uploads/apk', file: file(), signal: controller.signal }),
    ).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(xhrs.every((x) => !x.sent)).toBe(true);
  });

  it('an abort after the answer arrived changes nothing', async () => {
    const controller = new AbortController();
    const pending = uploadFile({ url: '/uploads/apk', file: file(), signal: controller.signal });
    xhrs[0].respond(200, JSON.stringify(envelope('200', { uploadId: 'u' })));
    expect(await pending).toEqual({ uploadId: 'u' });
    controller.abort();
    expect(xhrs[0].aborted).toBe(false);
  });
});
