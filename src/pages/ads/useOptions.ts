import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../request/errors';

export type OptionsStatus = 'loading' | 'ready' | 'forbidden' | 'failed';

/**
 * The rows a picker chooses from (the campaigns, the placements, the units). It tells a refusal for
 * lack of the permission (`forbidden`: the picker is disabled and names the permission it needs)
 * from any other failure (`failed`). An answer that arrives after a newer read was started, or after
 * the page was left, is dropped.
 */
export function useOptions<T>(load: () => Promise<T[]>) {
  const [state, setState] = useState<{ status: OptionsStatus; rows: T[] }>({
    status: 'loading',
    rows: [],
  });
  const counter = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    const mine = ++counter.current;
    setState((before) => ({ status: 'loading', rows: before.rows }));
    try {
      const rows = await loadRef.current();
      if (mine === counter.current) setState({ status: 'ready', rows });
    } catch (error) {
      if (mine !== counter.current) return;
      const refused = error instanceof ApiError && error.httpStatus === 403;
      setState({ status: refused ? 'forbidden' : 'failed', rows: [] });
    }
  }, []);

  useEffect(() => {
    void reload();
    return () => {
      counter.current += 1;
    };
  }, [reload]);

  return { ...state, reload: () => void reload() };
}
