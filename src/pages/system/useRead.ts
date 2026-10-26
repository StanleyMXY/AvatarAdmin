import { useCallback, useEffect, useRef, useState } from 'react';

export type ReadState<T> =
  | { status: 'loading'; data: T | null }
  | { status: 'ok'; data: T }
  | { status: 'failed'; error: unknown; data: null };

/**
 * Reads something once when it appears and again on `reload()`. When two reads overlap the answer of
 * the newest one is the one that counts, and an answer that arrives after the component is gone is
 * dropped. While a new read runs the last good answer stays in `data`, so what depends on it does not
 * flicker.
 */
export function useRead<T>(read: () => Promise<T>) {
  const readRef = useRef(read);
  readRef.current = read;
  const [state, setState] = useState<ReadState<T>>({ status: 'loading', data: null });
  const [tick, setTick] = useState(0);
  const counter = useRef(0);

  // `tick` is what asks for a new read.
  // biome-ignore lint/correctness/useExhaustiveDependencies: tick starts a read
  useEffect(() => {
    const mine = ++counter.current;
    setState((before) => ({ status: 'loading', data: before.data }));
    readRef
      .current()
      .then((data) => {
        if (mine === counter.current) setState({ status: 'ok', data });
      })
      .catch((error: unknown) => {
        if (mine === counter.current) setState({ status: 'failed', error, data: null });
      });
    return () => {
      counter.current += 1;
    };
  }, [tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { state, reload };
}
