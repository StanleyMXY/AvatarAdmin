import {
  buildHeaders,
  type RequestParams,
  requestUrl,
  throwIfAborted,
  transportFailure,
  unwrapAndReport,
} from './apiClient';
import { ApiError, abortError } from './errors';
import { startDeadline, TRANSFER_TIMEOUT_MS, timeoutError } from './timeout';

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Characters with no shape of their own that could disguise a name: the C1 controls, the Arabic
// letter mark, the zero width space, the direction marks and embeddings, line and paragraph
// separators, the word joiner and the invisible operators, the isolates and the deprecated format
// characters, the byte order mark and the tag characters. The zero width joiner and non-joiner
// (U+200C, U+200D) stay: Persian, Indic scripts and emoji sequences are spelled with them.
const INVISIBLE_CHARACTERS =
  /[\u0080-\u009F\u061C\u200B\u200E\u200F\u2028-\u202E\u2060-\u206F\uFEFF\u{E0000}-\u{E007F}]/gu;
// biome-ignore lint/suspicious/noControlCharactersInRegex: file names must not carry control characters
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

/** A file name that is safe to hand to the browser: last path segment only, no control or direction characters. */
function cleanFileName(name: string): string | null {
  const lastSegment =
    name.replace(CONTROL_CHARACTERS, '').replace(INVISIBLE_CHARACTERS, '').split(/[/\\]/).pop() ??
    '';
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
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/** An error of the caller's `onProgress`: not a failure of the transfer, and passed on as it is. */
class ProgressCallbackFailure {
  constructor(readonly cause: unknown) {}
}

async function readBody(
  response: Response,
  onProgress?: (bytes: number) => void,
): Promise<{ chunks: Uint8Array[]; bytes: number }> {
  const reader = response.body?.getReader();
  if (!reader) {
    const whole = new Uint8Array(await response.arrayBuffer());
    reportProgress(onProgress, whole.length);
    return { chunks: [whole], bytes: whole.length };
  }
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    bytes += value.length;
    try {
      reportProgress(onProgress, bytes);
    } catch (failure) {
      // Nobody will read the rest: let the connection go.
      await reader.cancel().catch(() => {});
      throw failure;
    }
  }
  return { chunks, bytes };
}

function reportProgress(onProgress: ((bytes: number) => void) | undefined, bytes: number): void {
  try {
    onProgress?.(bytes);
  } catch (cause) {
    throw new ProgressCallbackFailure(cause);
  }
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
  const url = requestUrl(o.url, o.params);
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
      if (cause instanceof ProgressCallbackFailure) throw cause.cause;
      throw transportFailure(cause, deadline);
    }
    // A cancel that came with the last byte still means "no file".
    if (deadline.signal.aborted) throw deadline.timedOut() ? timeoutError() : abortError();
    if (body.bytes === 0) {
      // An xlsx of 0 bytes cannot be opened; do not hand the person a "report" that is nothing.
      throw new ApiError({
        code: 'INVALID_RESPONSE',
        httpStatus: response.status,
        message: 'The file is empty.',
        data: null,
      });
    }
    const filename =
      parseContentDisposition(response.headers.get('content-disposition')) ?? o.fallbackName;
    try {
      saveBlob(new Blob(body.chunks as BlobPart[], { type: XLSX_TYPE }), filename);
    } catch {
      // The browser could not build or hand over the file (memory, blocked downloads). The reason
      // it gives can carry an address, so it is not kept.
      throw new ApiError({
        code: 'UNKNOWN',
        httpStatus: response.status,
        message: 'The file could not be handed to the browser.',
        data: null,
      });
    }
    return { filename, bytes: body.bytes };
  } finally {
    deadline.dispose();
  }
}
