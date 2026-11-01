import { useIntl } from '@umijs/max';
import { useCallback, useEffect, useRef, useState } from 'react';
import { describeFailure } from '../../session/describe';

/**
 * Reads whenever `fetcher` changes (give it a stable function: `useCallback` over what is asked) and
 * again on `reload`. The answer, or the failure, of a read that was overtaken by a newer one (or by
 * leaving the page) is dropped, so an old answer never replaces a new one. `data` is null while a
 * read is under way, unless `keepWhileReading` is set: then what was read before stays until the
 * new answer arrives (a table that is read again after a save does not vanish and come back); a
 * failed read clears it either way. `failure` is the words of the error code, never the backend's
 * own words.
 */
export function useLatestRead<T>(
  fetcher: () => Promise<T>,
  options: { keepWhileReading?: boolean } = {},
) {
  const keep = options.keepWhileReading === true;
  const intl = useIntl();
  const intlRef = useRef(intl);
  intlRef.current = intl;
  const [data, setData] = useState<T | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const counter = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++counter.current;
    if (!keep) setData(null);
    setFailure(null);
    try {
      const result = await fetcher();
      if (mine === counter.current) setData(result);
    } catch (caught) {
      if (mine !== counter.current) return;
      setData(null);
      setFailure(describeFailure(intlRef.current, caught).text);
    }
  }, [fetcher, keep]);

  useEffect(() => {
    void reload();
    return () => {
      counter.current += 1;
    };
  }, [reload]);

  return { data, failure, reload: () => void reload() };
}
