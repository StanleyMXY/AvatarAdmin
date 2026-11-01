import { useCallback, useEffect, useRef, useState } from 'react';
import { useLatestCall } from '../../hooks/useLatestCall';

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
  const begin = useLatestCall();
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(() => {
    const isCurrent = begin();
    setState({ status: 'loading', data: null, error: null });
    loadRef.current().then(
      (data) => {
        if (isCurrent()) setState({ status: 'ready', data, error: null });
      },
      (error: unknown) => {
        if (isCurrent()) setState({ status: 'failed', data: null, error });
      },
    );
  }, [begin]);

  useEffect(() => {
    if (!enabled) {
      begin();
      setState((previous) =>
        previous.status === 'idle' ? previous : { status: 'idle', data: null, error: null },
      );
      return undefined;
    }
    run();
    return () => {
      begin();
    };
  }, [enabled, run, begin]);

  return { ...state, reload: run };
}
