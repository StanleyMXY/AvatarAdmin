import { useIntl } from '@umijs/max';
import { useCallback, useEffect, useRef, useState } from 'react';
import { describeFailure } from '../session/describe';

/**
 * Reads whenever `fetcher` changes (give it a stable function: `useCallback` over what is asked) and
 * again on `reload`. The answer, or the failure, of a read that was overtaken by a newer one (or by
 * leaving the page) is dropped, so an old answer never replaces a new one. `data` is null while a
 * read is under way and `loading` is true. `failure` is the words of the error code, never the
 * backend's own words.
 */
export function useLatestRead<T>(fetcher: () => Promise<T>) {
  const intl = useIntl();
  const intlRef = useRef(intl);
  intlRef.current = intl;
  const [data, setData] = useState<T | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const counter = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++counter.current;
    setData(null);
    setFailure(null);
    setLoading(true);
    try {
      const result = await fetcher();
      if (mine !== counter.current) return;
      setData(result);
      setLoading(false);
    } catch (caught) {
      if (mine !== counter.current) return;
      setFailure(describeFailure(intlRef.current, caught).text);
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    void reload();
    return () => {
      counter.current += 1;
    };
  }, [reload]);

  return { data, failure, loading, reload: () => void reload() };
}
