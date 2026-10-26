import { useIntl } from '@umijs/max';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_PAGE_SIZE } from '../../components/PagedListTable';
import type { Page } from '../../request/errors';
import { describeFailure } from '../../session/describe';

export type ServerPage<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  /** The words of the error code of the last read, or null. */
  failure: string | null;
  setPaging: (page: number, pageSize: number) => void;
  /** Reads again from page 1, also when the filters are the same as before (the Search button). */
  search: () => void;
  reload: () => void;
};

/**
 * A list that the backend pages: reads the page for `filters` (the ones asked for with Search, a
 * plain object) and starts again from page 1 when they change. When two reads overlap, the answer
 * of the newest read is the one that is shown, whichever arrives first.
 */
export function useServerPage<T, F extends Record<string, unknown>>(
  fetcher: (query: F & { page: number; pageSize: number }) => Promise<Page<T>>,
  filters: F,
): ServerPage<T> {
  const intl = useIntl();
  const intlRef = useRef(intl);
  intlRef.current = intl;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const key = JSON.stringify(filters);

  const [paging, setPagingState] = useState({ key, page: 1, pageSize: DEFAULT_PAGE_SIZE });
  const page = paging.key === key ? paging.page : 1;
  const { pageSize } = paging;
  const [tick, setTick] = useState(0);
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const counter = useRef(0);

  // `key` stands for the filters: the effect runs when they change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: key, page, pageSize and tick are what a new read depends on
  useEffect(() => {
    const mine = ++counter.current;
    setLoading(true);
    fetcherRef
      .current({ ...filtersRef.current, page, pageSize })
      .then((answer) => {
        if (mine !== counter.current) return;
        setRows(answer.items);
        setTotal(answer.total);
        setFailure(null);
        setLoading(false);
      })
      .catch((error) => {
        if (mine !== counter.current) return;
        setRows([]);
        setTotal(0);
        setFailure(describeFailure(intlRef.current, error).text);
        setLoading(false);
      });
  }, [key, page, pageSize, tick]);

  const setPaging = useCallback(
    (nextPage: number, nextSize: number) =>
      setPagingState({ key, page: nextSize === pageSize ? nextPage : 1, pageSize: nextSize }),
    [key, pageSize],
  );
  const reload = useCallback(() => setTick((n) => n + 1), []);
  // Two updates in one event: the filters (when they changed) and this one make a single read.
  const search = useCallback(() => {
    setPagingState((before) => ({ ...before, page: 1 }));
    setTick((n) => n + 1);
  }, []);

  return { rows, total, page, pageSize, loading, failure, setPaging, search, reload };
}
