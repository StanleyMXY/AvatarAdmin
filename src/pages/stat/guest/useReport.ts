import { useIntl } from '@umijs/max';
import { useCallback, useEffect, useRef, useState } from 'react';
import { describeFailure } from '../../../session/describe';

/**
 * Reads one report whenever `fetcher` changes (give it a stable function: `useCallback` over the
 * applied filter) or `reload` is called. `data` is null while it is being read; `failure` is the
 * words of the error code, never the backend's words. An answer that arrives after a newer read
 * was started is dropped. A change of `refreshKey` reads it again too (for a tab that stays open
 * behind another one, when something it shows was recomputed there).
 */
export function useReport<T>(fetcher: () => Promise<T>, refreshKey = 0) {
  const intl = useIntl();
  const [data, setData] = useState<T | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const counter = useRef(0);
  // The words of a failure follow the language; a switch of language is not a reason to read again.
  const intlRef = useRef(intl);
  intlRef.current = intl;

  const reload = useCallback(async () => {
    const mine = ++counter.current;
    setData(null);
    setFailure(null);
    try {
      const result = await fetcher();
      if (mine === counter.current) setData(result);
    } catch (error) {
      if (mine === counter.current) setFailure(describeFailure(intlRef.current, error).text);
    }
  }, [fetcher]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new refreshKey is the reason to read again
  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  return { data, failure, reload: () => void reload() };
}
