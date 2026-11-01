import { vi } from 'vitest';

type Held = {
  /** How many matching requests have been sent so far (held or not). */
  started: () => number;
  /** Lets the held answer through. */
  release: () => void;
};

/**
 * For page tests: holds the answer to one request (the `nth`, counting from 1, of those that
 * `match`) until `release()` is called, so that a test can click again, or start a newer read,
 * while it is under way. Every other request goes straight to the fetch that was installed before
 * (the fake backend), so call this after the backend was installed.
 */
export function holdRequests(match: (url: string, method: string) => boolean, nth = 1): Held {
  const real = globalThis.fetch;
  let count = 0;
  let open: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (!match(url, method)) return real(input, init);
    count += 1;
    const mine = count;
    // The backend answers at once; it is the answer that is held, so that it is as old as the
    // moment the request was sent when it finally arrives.
    const answer = await real(input, init);
    if (mine === nth) await gate;
    return answer;
  });
  return { started: () => count, release: () => open() };
}
