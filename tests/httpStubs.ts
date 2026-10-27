import { vi } from 'vitest';

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** The backend's response envelope, as an object. */
export const envelope = (code: string, data: unknown = null, message = '') => ({
  code,
  message: message || (code === '200' ? 'success' : `message for ${code}`),
  data,
});

export const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

export const textResponse = (status: number, text: string, contentType = 'text/html') =>
  new Response(text, { status, headers: { 'content-type': contentType } });

export type FetchCall = { url: string; init: RequestInit & { headers: Record<string, string> } };

/** Replaces `fetch`; `handler` answers each call. Returns the list of calls made. */
export function stubFetch(handler: (call: FetchCall) => Response | Promise<Response>): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      const call: FetchCall = {
        url: String(input),
        init: { ...init, headers: { ...(init.headers as Record<string, string> | undefined) } },
      };
      calls.push(call);
      return handler(call);
    }),
  );
  return calls;
}

/** A stand-in for XMLHttpRequest that the test drives by hand. */
export class FakeXHR {
  static instances: FakeXHR[] = [];

  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: unknown = undefined;
  sent = false;
  aborted = false;
  status = 0;
  timeout = 0;
  responseText = '';
  upload: { onprogress: ((e: unknown) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  ontimeout: (() => void) | null = null;

  constructor() {
    FakeXHR.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: unknown) {
    this.body = body;
    this.sent = true;
  }

  abort() {
    this.aborted = true;
    this.onabort?.();
  }

  getResponseHeader(): string | null {
    return null;
  }

  // Test controls
  progress(loaded: number, total: number, lengthComputable = true) {
    this.upload.onprogress?.({ loaded, total, lengthComputable });
  }

  respond(status: number, text: string) {
    this.status = status;
    this.responseText = text;
    this.onload?.();
  }

  failNetwork() {
    this.onerror?.();
  }
}

export function stubXhr(): FakeXHR[] {
  FakeXHR.instances = [];
  vi.stubGlobal('XMLHttpRequest', FakeXHR);
  return FakeXHR.instances;
}

export const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
