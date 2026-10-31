import { useEffect, useState } from 'react';

/** How often the list is read again while an avatar is generating. */
export const POLL_INTERVAL_MS = 5000;
/** How long it keeps reading again before it leaves the next check to the person. */
export const POLL_MAX_MS = 5 * 60 * 1000;

/**
 * Calls `reload` every 5 seconds while `generating` is true, for at most 5 minutes; it stops when
 * `generating` turns false (every row has reached an end state) and when the page is left.
 * `restart` changes each time the person asks for a read themselves, which starts the 5 minutes
 * again. Returns whether it gave up after the 5 minutes with a row still generating.
 */
export function useGenerationPolling(
  generating: boolean,
  reload: () => void,
  restart: number,
): { gaveUp: boolean } {
  const [gaveUp, setGaveUp] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `restart` only restarts the timers
  useEffect(() => {
    setGaveUp(false);
    if (!generating) return undefined;
    const tick = setInterval(reload, POLL_INTERVAL_MS);
    const stop = setTimeout(() => {
      clearInterval(tick);
      setGaveUp(true);
    }, POLL_MAX_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(stop);
    };
  }, [generating, reload, restart]);

  return { gaveUp };
}
