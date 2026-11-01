import { useIntl } from '@umijs/max';
import { useCallback, useEffect, useRef, useState } from 'react';
import { describeFailure } from '../../session/describe';

/**
 * Reads once whenever `fetcher` changes (give it a stable function: `useCallback` over what is
 * asked) and again when `reload` is called. `data` is null until the first answer; a later read
 * keeps what was shown until its answer arrives (so a table does not vanish and come back after
 * every save), and a failed read clears it. `failure` is the words of the error code, never the
 * backend's own words. An answer that arrives after a newer read was started is dropped.
 */
export function useRead<T>(fetcher: () => Promise<T>) {
  const intl = useIntl();
  const intlRef = useRef(intl);
  intlRef.current = intl;
  const [data, setData] = useState<T | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const counter = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++counter.current;
    setFailure(null);
    setLoading(true);
    try {
      const result = await fetcher();
      if (mine !== counter.current) return;
      setData(result);
      setLoading(false);
    } catch (error) {
      if (mine !== counter.current) return;
      setData(null);
      setFailure(describeFailure(intlRef.current, error).text);
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, failure, loading, reload: () => void reload() };
}
