import { useIntl } from '@umijs/max';
import { useCallback, useEffect, useRef, useState } from 'react';
import { describeFailure } from '../../session/describe';

/**
 * Reads whenever `fetcher` changes (give it a stable function: `useCallback` over what is asked)
 * and again on `reload`. An answer or a failure that arrives after a newer read has started is
 * dropped, so when the account changes the old account's answer never lands on the new one.
 * `data` is null while a read is under way, or stays as it was with `keep` (a table that changes
 * page keeps its rows until the next ones arrive). `failure` is the words of the error code (never
 * the backend's own words); `error` is the error itself, for a page that must tell "not found" from
 * the rest.
 */
export function useRead<T>(fetcher: () => Promise<T>, options: { keep?: boolean } = {}) {
  const intl = useIntl();
  const intlRef = useRef(intl);
  intlRef.current = intl;
  const keep = useRef(options.keep ?? false);
  keep.current = options.keep ?? false;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const counter = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++counter.current;
    if (!keep.current) setData(null);
    setError(null);
    setFailure(null);
    setLoading(true);
    try {
      const result = await fetcher();
      if (mine !== counter.current) return;
      setData(result);
      setLoading(false);
    } catch (caught) {
      if (mine !== counter.current) return;
      setData(null);
      setError(caught);
      setFailure(describeFailure(intlRef.current, caught).text);
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    void reload();
    return () => {
      // The page went away or asks something else: whatever is still on its way is no longer wanted.
      counter.current += 1;
    };
  }, [reload]);

  return { data, error, failure, loading, reload: () => void reload() };
}
