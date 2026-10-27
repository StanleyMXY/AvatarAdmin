import { useCallback, useRef, useState } from 'react';

/**
 * Runs `task` unless a run is still going: a second click, or Enter pressed again, while the first
 * request is on its way does nothing. `busy` is for disabling the button.
 */
export function useSubmitOnce() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (task: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await task();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, run };
}
