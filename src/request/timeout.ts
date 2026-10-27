import { timeoutError } from './errors';

export { timeoutError };

/** An ordinary request is given up on after 30 seconds. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** A file upload or an export download is given up on after 5 minutes. */
export const TRANSFER_TIMEOUT_MS = 300_000;

export type Deadline = {
  /** Aborted when the time is up or when the caller's signal is aborted. Give it to `fetch`. */
  signal: AbortSignal;
  /** True only when the abort came from the clock, not from the caller. */
  timedOut: () => boolean;
  /** Stops the clock and lets go of the caller's signal. Call it when the work is over. */
  dispose: () => void;
};

/**
 * A signal that is aborted after `ms`, or earlier when `outer` is aborted. `timedOut()` tells the
 * two apart, so a caller's cancel stays a cancel and only a slow answer becomes REQUEST_TIMEOUT.
 */
export function startDeadline(ms: number, outer?: AbortSignal): Deadline {
  const controller = new AbortController();
  let late = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onOuterAbort = () => {
    if (timer !== undefined) clearTimeout(timer);
    controller.abort();
  };
  if (outer?.aborted) {
    controller.abort();
  } else {
    outer?.addEventListener('abort', onOuterAbort, { once: true });
    timer = setTimeout(() => {
      late = true;
      controller.abort();
    }, ms);
  }
  return {
    signal: controller.signal,
    timedOut: () => late,
    dispose: () => {
      if (timer !== undefined) clearTimeout(timer);
      outer?.removeEventListener('abort', onOuterAbort);
    },
  };
}
