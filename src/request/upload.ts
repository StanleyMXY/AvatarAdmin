import { buildHeaders, reportSessionSignals, resolveUrl } from './apiClient';
import { unwrapResponse } from './envelope';
import { abortError, networkError } from './errors';
import { TRANSFER_TIMEOUT_MS, timeoutError } from './timeout';

/**
 * Uploads one file as multipart form data under the field name `file` (the form every admin
 * upload endpoint expects), with progress. XMLHttpRequest is used because `fetch` cannot report
 * upload progress. Resolves with the envelope's `data` (for example `{ uploadId }`). It is given up
 * on after 5 minutes (REQUEST_TIMEOUT).
 */
export function uploadFile<T>(o: {
  url: string;
  file: File;
  fields?: Record<string, string>;
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
  /** Milliseconds for the whole upload; 5 minutes when not given. */
  timeoutMs?: number;
}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (o.signal?.aborted) {
      reject(abortError());
      return;
    }
    const { headers, sentToken } = buildHeaders(false);
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    const finish = () => o.signal?.removeEventListener('abort', onAbort);

    xhr.open('POST', resolveUrl(o.url));
    xhr.timeout = o.timeoutMs ?? TRANSFER_TIMEOUT_MS;
    // No Content-Type: the browser adds multipart/form-data with its boundary.
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) o.onProgress?.(event.loaded, event.total);
    };
    xhr.onload = () => {
      finish();
      try {
        resolve(unwrapResponse<T>(xhr.status, xhr.responseText));
      } catch (error) {
        reportSessionSignals(error, sentToken);
        reject(error);
      }
    };
    xhr.onerror = () => {
      finish();
      reject(networkError());
    };
    xhr.ontimeout = () => {
      finish();
      reject(timeoutError());
    };
    xhr.onabort = () => {
      finish();
      reject(abortError());
    };
    o.signal?.addEventListener('abort', onAbort, { once: true });

    const form = new FormData();
    form.append('file', o.file, o.file.name);
    for (const [name, value] of Object.entries(o.fields ?? {})) form.append(name, value);
    xhr.send(form);
  });
}
