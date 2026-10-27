import { useCallback, useRef, useState } from 'react';

/**
 * Wraps an async action so that a call made while the previous one is still running is ignored
 * (it resolves to `undefined` without calling `fn`). `pending` is for disabling the control.
 * The guard is a ref, so two clicks in the same tick are caught too.
 */
export function useSingleFlight<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const running = useRef(false);
  const latest = useRef(fn);
  latest.current = fn;
  const [pending, setPending] = useState(false);

  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    if (running.current) return undefined;
    running.current = true;
    setPending(true);
    try {
      return await latest.current(...args);
    } finally {
      running.current = false;
      setPending(false);
    }
  }, []);

  return { run, pending };
}
