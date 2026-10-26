import { useCallback, useEffect, useRef, useState } from 'react';

export type SourceState<T> =
  | { status: 'idle'; data: null; error: null }
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: T; error: null }
  | { status: 'failed'; data: null; error: unknown };

export type Source<T> = SourceState<T> & { reload: () => void };

/**
 * One request of the overview with its own state. It starts when `enabled` is true (the permission
 * for it is held) and not before; `reload` asks again. An answer is used only if it belongs to the
 * newest request: an older one that comes late, or one that comes after the page is gone, is dropped.
 */
export function useSource<T>(load: () => Promise<T>, enabled: boolean): Source<T> {
  const [state, setState] = useState<SourceState<T>>({
    status: enabled ? 'loading' : 'idle',
    data: null,
    error: null,
  });
  const newest = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(() => {
    const mine = ++newest.current;
    setState({ status: 'loading', data: null, error: null });
    loadRef.current().then(
      (data) => {
        if (mine === newest.current) setState({ status: 'ready', data, error: null });
      },
      (error: unknown) => {
        if (mine === newest.current) setState({ status: 'failed', data: null, error });
      },
    );
  }, []);

  useEffect(() => {
    if (!enabled) {
      newest.current++;
      setState((previous) =>
        previous.status === 'idle' ? previous : { status: 'idle', data: null, error: null },
      );
      return undefined;
    }
    run();
    return () => {
      newest.current++;
    };
  }, [enabled, run]);

  return { ...state, reload: run };
}
