import {
  buildHeaders,
  buildQuery,
  type RequestParams,
  resolveUrl,
  throwIfAborted,
  transportFailure,
  unwrapAndReport,
} from './apiClient';
import { ApiError, abortError } from './errors';
import { startDeadline, TRANSFER_TIMEOUT_MS, timeoutError } from './timeout';

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const BIDI_CONTROLS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
// biome-ignore lint/suspicious/noControlCharactersInRegex: file names must not carry control characters
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

/** A file name that is safe to hand to the browser: last path segment only, no control or direction characters. */
function cleanFileName(name: string): string | null {
  const lastSegment =
    name.replace(CONTROL_CHARACTERS, '').replace(BIDI_CONTROLS, '').split(/[/\\]/).pop() ?? '';
  const cleaned = lastSegment.trim();
  return cleaned === '' || cleaned === '.' || cleaned === '..' ? null : cleaned;
}

/** The file name in a Content-Disposition header: `filename*` (UTF-8) first, then `filename`. */
export function parseContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const extended = /(?:^|;)\s*filename\*\s*=\s*([^';]*)'[^';]*'([^;]+)/i.exec(header);
  if (extended && /^utf-?8$/i.test(extended[1].trim())) {
    try {
      const name = cleanFileName(decodeURIComponent(extended[2].trim()));
      if (name) return name;
    } catch {
      // broken percent-encoding: use the plain filename below
    }
  }
  const plain = /(?:^|;)\s*filename\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;]+))/i.exec(header);
  if (plain) {
    const raw = plain[1] !== undefined ? plain[1].replace(/\\(.)/g, '$1') : plain[2].trim();
    return cleanFileName(raw);
  }
  return null;
}

/** Hands a blob to the browser as a download. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function readBody(
  response: Response,
  onProgress?: (bytes: number) => void,
): Promise<{ chunks: Uint8Array[]; bytes: number }> {
  const reader = response.body?.getReader();
  if (!reader) {
    const whole = new Uint8Array(await response.arrayBuffer());
    onProgress?.(whole.length);
    return { chunks: [whole], bytes: whole.length };
  }
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    bytes += value.length;
    onProgress?.(bytes);
  }
  return { chunks, bytes };
}

/**
 * Downloads an xlsx export with the admin token in the Authorization header. The status and the
 * content type are checked before anything is saved: only a 2xx answer typed as xlsx becomes a
 * file; a JSON error from the backend (rate limit, too many rows, no permission, expired token)
 * is thrown as an ApiError and nothing is saved. The whole download, body included, has 5 minutes
 * (REQUEST_TIMEOUT); `signal` cancels it (an AbortError) and nothing is saved either.
 */
export async function downloadFile(o: {
  url: string;
  params?: RequestParams;
  fallbackName: string;
  onProgress?: (bytes: number) => void;
  signal?: AbortSignal;
  /** Milliseconds for the whole download; 5 minutes when not given. */
  timeoutMs?: number;
}): Promise<{ filename: string; bytes: number }> {
  const url = `${resolveUrl(o.url)}${buildQuery(o.params)}`;
  const { headers, sentToken } = buildHeaders(false);
  headers.Accept = `${XLSX_TYPE}, application/json;q=0.9`;

  const deadline = startDeadline(o.timeoutMs ?? TRANSFER_TIMEOUT_MS, o.signal);
  try {
    let response: Response;
    try {
      throwIfAborted(deadline);
      response = await fetch(url, { method: 'GET', headers, signal: deadline.signal });
    } catch (cause) {
      throw transportFailure(cause, deadline);
    }

    const contentType = (response.headers.get('content-type') ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (!(response.ok && contentType === XLSX_TYPE)) {
      let text: string;
      try {
        text = await response.text();
      } catch (cause) {
        throw transportFailure(cause, deadline);
      }
      unwrapAndReport(response.status, text, sentToken);
      // The backend answered with a success envelope where a file was expected.
      throw new ApiError({
        code: 'INVALID_RESPONSE',
        httpStatus: response.status,
        message: 'A file was expected but the answer is not a file.',
        data: null,
      });
    }

    let body: { chunks: Uint8Array[]; bytes: number };
    try {
      body = await readBody(response, o.onProgress);
    } catch (cause) {
      throw transportFailure(cause, deadline);
    }
    // A cancel that came with the last byte still means "no file".
    if (deadline.signal.aborted) throw deadline.timedOut() ? timeoutError() : abortError();
    const filename =
      parseContentDisposition(response.headers.get('content-disposition')) ?? o.fallbackName;
    saveBlob(new Blob(body.chunks as BlobPart[], { type: XLSX_TYPE }), filename);
    return { filename, bytes: body.bytes };
  } finally {
    deadline.dispose();
  }
}
