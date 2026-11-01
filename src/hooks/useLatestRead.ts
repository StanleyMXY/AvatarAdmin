import { useIntl } from '@umijs/max';
import { useCallback, useEffect, useRef, useState } from 'react';
import { describeFailure } from '../session/describe';

/**
 * Reads whenever `fetcher` changes (give it a stable function: `useCallback` over what is asked) and
 * again on `reload`. The answer, or the failure, of a read that was overtaken by a newer one (or by
 * leaving the page) is dropped, so an old answer never replaces a new one. `data` is null while a
 * read is under way and `loading` is true, unless `keepWhileReading` is set: then what was read
 * before stays until the new answer arrives (a table that is read again after a save does not
 * vanish and come back); a failed read clears it either way. `failure` is the words of the error
 * code, never the backend's own words; `error` is the error itself, for a page that must tell
 * "not found" from the rest. A change of `refreshKey` reads again too (for a tab that stays open
 * behind another one, when something it shows was recomputed there).
 */
export function useLatestRead<T>(
  fetcher: () => Promise<T>,
  options: { keepWhileReading?: boolean; refreshKey?: number } = {},
) {
  const keep = options.keepWhileReading === true;
  const intl = useIntl();
  const intlRef = useRef(intl);
  intlRef.current = intl;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const counter = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++counter.current;
    if (!keep) setData(null);
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
  }, [fetcher, keep]);

  // A new `refreshKey` is a reason to read again, although the fetcher is the same.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey only starts a read
  useEffect(() => {
    void reload();
    return () => {
      counter.current += 1;
    };
  }, [reload, options.refreshKey]);

  return { data, error, failure, loading, reload: () => void reload() };
}
