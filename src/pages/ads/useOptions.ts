import { useCallback, useEffect, useRef, useState } from 'react';
import { useLatestCall } from '../../hooks/useLatestCall';
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
  const begin = useLatestCall();
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    const isCurrent = begin();
    setState((before) => ({ status: 'loading', rows: before.rows }));
    try {
      const rows = await loadRef.current();
      if (isCurrent()) setState({ status: 'ready', rows });
    } catch (error) {
      if (!isCurrent()) return;
      const refused = error instanceof ApiError && error.httpStatus === 403;
      setState({ status: refused ? 'forbidden' : 'failed', rows: [] });
    }
  }, [begin]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload: () => void reload() };
}
