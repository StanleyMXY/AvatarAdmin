import { useIntl } from '@umijs/max';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { describeFailure } from '../session/describe';
import { useLatestCall } from './useLatestCall';

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
  const [data, setData] = useState<T | null>(null);
  // The failed read itself (boxed: a thrown value can be anything); its words are made when the
  // page is drawn, so they follow the language.
  const [failed, setFailed] = useState<{ error: unknown } | null>(null);
  const error = failed === null ? null : failed.error;
  const failure = useMemo(
    () => (failed === null ? null : describeFailure(intl, failed.error).text),
    [intl, failed],
  );
  const [loading, setLoading] = useState(true);
  const begin = useLatestCall();

  const reload = useCallback(async () => {
    const isCurrent = begin();
    if (!keep) setData(null);
    setFailed(null);
    setLoading(true);
    try {
      const result = await fetcher();
      if (!isCurrent()) return;
      setData(result);
      setLoading(false);
    } catch (caught) {
      if (!isCurrent()) return;
      setData(null);
      setFailed({ error: caught });
      setLoading(false);
    }
  }, [fetcher, keep, begin]);

  // A new `refreshKey` is a reason to read again, although the fetcher is the same.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey only starts a read
  useEffect(() => {
    void reload();
  }, [reload, options.refreshKey]);

  return { data, error, failure, loading, reload: () => void reload() };
}
