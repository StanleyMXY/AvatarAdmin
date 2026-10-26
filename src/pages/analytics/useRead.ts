import { useIntl } from '@umijs/max';
import { useCallback, useEffect, useRef, useState } from 'react';
import { describeFailure } from '../../session/describe';

/**
 * Reads once whenever `fetcher` changes (give it a stable function: `useCallback` over what is
 * asked) and again when `reload` is called. `data` is null while it is being read, or stays as it
 * was with `keep` (a table that changes page keeps its rows until the next ones arrive); `failure`
 * is the words of the error code, never the backend's own words. An answer that arrives after a
 * newer read was started is dropped.
 */
export function useRead<T>(fetcher: () => Promise<T>, options: { keep?: boolean } = {}) {
  const intl = useIntl();
  const intlRef = useRef(intl);
  intlRef.current = intl;
  const keep = useRef(options.keep ?? false);
  keep.current = options.keep ?? false;
  const [data, setData] = useState<T | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const counter = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++counter.current;
    if (!keep.current) setData(null);
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
