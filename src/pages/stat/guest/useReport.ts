import { useIntl } from '@umijs/max';
import { useCallback, useEffect, useRef, useState } from 'react';
import { describeFailure } from '../../../session/describe';

/**
 * Reads one report whenever `fetcher` changes (give it a stable function: `useCallback` over the
 * applied filter) or `reload` is called. `data` is null while it is being read; `failure` is the
 * words of the error code, never the backend's words. An answer that arrives after a newer read
 * was started is dropped.
 */
export function useReport<T>(fetcher: () => Promise<T>) {
  const intl = useIntl();
  const [data, setData] = useState<T | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const counter = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++counter.current;
    setData(null);
    setFailure(null);
    try {
      const result = await fetcher();
      if (mine === counter.current) setData(result);
    } catch (error) {
      if (mine === counter.current) setFailure(describeFailure(intl, error).text);
    }
  }, [fetcher, intl]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, failure, reload: () => void reload() };
}
