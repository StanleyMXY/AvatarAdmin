import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it } from 'vitest';
import enUS from '../locales/en-US';
import zhCN from '../locales/zh-CN';
import { ApiError, type Page } from '../request/errors';
import { useServerPage } from './useServerPage';

const wrapper = ({ children }: { children: ReactNode }) => (
  <IntlProvider locale="en-US" messages={enUS} onError={() => {}}>
    {children}
  </IntlProvider>
);

/** The language of `switchable` can be changed between two renders. */
const language = { current: 'en-US' as 'en-US' | 'zh-CN' };
const switchable = ({ children }: { children: ReactNode }) => (
  <IntlProvider
    locale={language.current}
    messages={language.current === 'en-US' ? enUS : zhCN}
    onError={() => {}}
  >
    {children}
  </IntlProvider>
);

const deferred = <T,>() => {
  let resolve: (v: T) => void = () => {};
  let reject: (e: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

type Query = { page: number; pageSize: number };
type FilterQuery = Query & { q: string };
const pageOf = (items: string[], total = items.length): Page<string> => ({
  items,
  total,
});

/** A list of 45 rows named by their number, served by page. */
const serve = (calls: FilterQuery[]) => async (query: FilterQuery) => {
  calls.push(query);
  const start = (query.page - 1) * query.pageSize;
  const names = Array.from({ length: 45 }, (_, i) => `row ${i + 1}`);
  return pageOf(names.slice(start, start + query.pageSize), 45);
};

describe('useServerPage', () => {
  it('reads the first page with the default size and holds the rows and the total', async () => {
    const calls: FilterQuery[] = [];
    const { result } = renderHook(() => useServerPage(serve(calls), { q: 'ก' }), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(calls).toEqual([{ q: 'ก', page: 1, pageSize: result.current.pageSize }]);
    expect(result.current.rows).toHaveLength(result.current.pageSize);
    expect(result.current.total).toBe(45);
    expect(result.current.failure).toBeNull();
  });

  it('reads the page that is asked for, and goes back to page 1 when the size changes', async () => {
    const calls: FilterQuery[] = [];
    const { result } = renderHook(() => useServerPage(serve(calls), { q: '' }), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const size = result.current.pageSize;
    act(() => result.current.setPaging(2, size));
    await waitFor(() => expect(result.current.rows[0]).toBe(`row ${size + 1}`));
    expect(result.current.page).toBe(2);
    act(() => result.current.setPaging(2, 50));
    await waitFor(() => expect(result.current.pageSize).toBe(50));
    expect(result.current.page).toBe(1);
    await waitFor(() => expect(result.current.rows).toHaveLength(45));
  });

  it('starts again from page 1 when the filters change', async () => {
    const calls: FilterQuery[] = [];
    const { result, rerender } = renderHook(({ q }) => useServerPage(serve(calls), { q }), {
      wrapper,
      initialProps: { q: 'a' },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setPaging(2, result.current.pageSize));
    await waitFor(() => expect(result.current.page).toBe(2));
    rerender({ q: 'b' });
    expect(result.current.page).toBe(1);
    await waitFor(() => expect(calls[calls.length - 1]).toMatchObject({ q: 'b', page: 1 }));
  });

  it('reads again on reload and on search, and search goes to page 1', async () => {
    const calls: FilterQuery[] = [];
    const { result } = renderHook(() => useServerPage(serve(calls), { q: '' }), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setPaging(2, result.current.pageSize));
    await waitFor(() => expect(result.current.page).toBe(2));
    const before = calls.length;
    act(() => result.current.reload());
    await waitFor(() => expect(calls.length).toBe(before + 1));
    expect(result.current.page).toBe(2);
    act(() => result.current.search());
    await waitFor(() => expect(result.current.page).toBe(1));
    await waitFor(() => expect(calls[calls.length - 1].page).toBe(1));
  });

  it('shows the answer of the newest read when an older one arrives last', async () => {
    const first = deferred<Page<string>>();
    const second = deferred<Page<string>>();
    const answers = [first, second];
    let n = 0;
    const { result } = renderHook(() => useServerPage(() => answers[n++].promise, {}), { wrapper });
    act(() => result.current.reload());
    await act(async () => second.resolve(pageOf(['new'])));
    await act(async () => first.resolve(pageOf(['old'])));
    expect(result.current.rows).toEqual(['new']);
    expect(result.current.loading).toBe(false);
  });

  it('takes the failure away when a read after it succeeds', async () => {
    let n = 0;
    const { result } = renderHook(
      () =>
        useServerPage(
          () =>
            n++ === 0
              ? Promise.reject(
                  new ApiError({
                    code: 'INTERNAL_ERROR',
                    httpStatus: 500,
                    message: 'x',
                    data: null,
                  }),
                )
              : Promise.resolve(pageOf(['back'])),
          {},
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.failure).toBe(enUS['error.INTERNAL_ERROR']));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.rows).toEqual(['back']));
    expect(result.current.failure).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('drops the failure of an older read too', async () => {
    const first = deferred<Page<string>>();
    const second = deferred<Page<string>>();
    const answers = [first, second];
    let n = 0;
    const { result } = renderHook(() => useServerPage(() => answers[n++].promise, {}), { wrapper });
    act(() => result.current.reload());
    await act(async () => second.resolve(pageOf(['new'])));
    await act(async () =>
      first.reject(
        new ApiError({ code: 'INTERNAL_ERROR', httpStatus: 500, message: 'x', data: null }),
      ),
    );
    expect(result.current.failure).toBeNull();
    expect(result.current.rows).toEqual(['new']);
  });

  it('keeps the rows while the next page is read, and on a failure takes them away and says why in the words of the code', async () => {
    const second = deferred<Page<string>>();
    let n = 0;
    const { result } = renderHook(
      () =>
        useServerPage(
          () => (n++ === 0 ? Promise.resolve(pageOf(['kept'], 30)) : second.promise),
          {},
        ),
      { wrapper },
    );
    await waitFor(() => expect(result.current.rows).toEqual(['kept']));
    act(() => result.current.reload());
    expect(result.current.rows).toEqual(['kept']);
    expect(result.current.loading).toBe(true);
    await act(async () =>
      second.reject(
        new ApiError({ code: 'INTERNAL_ERROR', httpStatus: 500, message: 'raw words', data: null }),
      ),
    );
    expect(result.current.rows).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.failure).toBe(enUS['error.INTERNAL_ERROR']);
    expect(result.current.loading).toBe(false);
  });

  it('says the failure in the language that is current when it is drawn, not the one it happened in', async () => {
    language.current = 'en-US';
    const { result, rerender } = renderHook(
      () =>
        useServerPage(
          () =>
            Promise.reject(
              new ApiError({ code: 'ADMIN_FORBIDDEN', httpStatus: 403, message: 'x', data: null }),
            ),
          {},
        ),
      { wrapper: switchable },
    );
    await waitFor(() => expect(result.current.failure).toBe(enUS['error.ADMIN_FORBIDDEN']));
    language.current = 'zh-CN';
    rerender();
    expect(result.current.failure).toBe(zhCN['error.ADMIN_FORBIDDEN']);
    language.current = 'en-US';
    rerender();
    expect(result.current.failure).toBe(enUS['error.ADMIN_FORBIDDEN']);
  });

  it('does not set state after the page is left', async () => {
    const pending = deferred<Page<string>>();
    const { result, unmount } = renderHook(() => useServerPage(() => pending.promise, {}), {
      wrapper,
    });
    unmount();
    await act(async () => pending.resolve(pageOf(['late'])));
    expect(result.current.rows).toEqual([]);
    expect(result.current.loading).toBe(true);
  });
});

describe('useServerPage: backToLastPage', () => {
  /** Three pages of 10; the third has 5 rows, and then those are deleted. */
  const shrinking = (total: { value: number }, calls: Query[]) => async (query: Query) => {
    calls.push(query);
    const start = (query.page - 1) * query.pageSize;
    const count = Math.max(0, Math.min(query.pageSize, total.value - start));
    return pageOf(
      Array.from({ length: count }, (_, i) => `row ${start + i + 1}`),
      total.value,
    );
  };

  it('goes to the last page that has rows when the page it is on comes back empty', async () => {
    const total = { value: 25 };
    const calls: Query[] = [];
    const { result } = renderHook(
      () => useServerPage(shrinking(total, calls), {}, { backToLastPage: true }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setPaging(1, 10));
    await waitFor(() => expect(result.current.pageSize).toBe(10));
    act(() => result.current.setPaging(3, 10));
    await waitFor(() => expect(result.current.rows).toHaveLength(5));
    total.value = 20;
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.page).toBe(2));
    await waitFor(() => expect(result.current.rows).toHaveLength(10));
    expect(result.current.loading).toBe(false);
    expect(calls.map((c) => c.page)).toEqual([1, 1, 3, 3, 2]);
  });

  it('does not go back without the option, and shows the empty page', async () => {
    const total = { value: 25 };
    const calls: Query[] = [];
    const { result } = renderHook(() => useServerPage(shrinking(total, calls), {}), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setPaging(1, 10));
    await waitFor(() => expect(result.current.pageSize).toBe(10));
    act(() => result.current.setPaging(3, 10));
    await waitFor(() => expect(result.current.rows).toHaveLength(5));
    total.value = 20;
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.rows).toHaveLength(0));
    expect(result.current.page).toBe(3);
    expect(result.current.loading).toBe(false);
    expect(calls.map((c) => c.page)).toEqual([1, 1, 3, 3]);
  });

  it('is still loading, with no rows, while the last page is read', async () => {
    const calls: Query[] = [];
    const total = { value: 25 };
    const gate = deferred<void>();
    const serveRows = shrinking(total, calls);
    const seen: { page: number; loading: boolean }[] = [];
    const { result } = renderHook(
      () => {
        const state = useServerPage(
          async (query: Query) => {
            if (query.page === 2 && total.value === 20) await gate.promise;
            return serveRows(query);
          },
          {},
          { backToLastPage: true },
        );
        seen.push({ page: state.page, loading: state.loading });
        return state;
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setPaging(1, 10));
    await waitFor(() => expect(result.current.pageSize).toBe(10));
    act(() => result.current.setPaging(3, 10));
    await waitFor(() => expect(result.current.rows).toHaveLength(5));
    total.value = 20;
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.page).toBe(2));
    expect(result.current.loading).toBe(true);
    expect(result.current.rows).toEqual([]);
    // There was no moment of page 2 that was not loading.
    expect(seen.filter((s) => s.page === 2 && !s.loading)).toEqual([]);
    await act(async () => gate.resolve());
    await waitFor(() => expect(result.current.rows).toHaveLength(10));
    expect(result.current.loading).toBe(false);
  });

  it('goes to the last page when the total is not a whole number of pages: 19 rows of 10 are two pages', async () => {
    const total = { value: 25 };
    const calls: Query[] = [];
    const serveRows = async (query: Query) => {
      calls.push(query);
      const start = (query.page - 1) * query.pageSize;
      const count = Math.max(0, Math.min(query.pageSize, total.value - start));
      return pageOf(
        Array.from({ length: count }, (_, i) => `row ${start + i + 1}`),
        total.value,
      );
    };
    const { result } = renderHook(() => useServerPage(serveRows, {}, { backToLastPage: true }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setPaging(1, 10));
    await waitFor(() => expect(result.current.pageSize).toBe(10));
    act(() => result.current.setPaging(3, 10));
    await waitFor(() => expect(result.current.rows).toHaveLength(5));
    total.value = 19;
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.page).toBe(2));
    await waitFor(() => expect(result.current.rows).toHaveLength(9));
    expect(result.current.loading).toBe(false);
    expect(calls.map((c) => c.page)).toEqual([1, 1, 3, 3, 2]);
  });

  it('does not move when the page has rows, or when the page is inside the pages the total counts', async () => {
    const calls: Query[] = [];
    // Page 2 of size 10 says it has rows although the total counts only one page.
    const odd = async (query: Query) => {
      calls.push(query);
      return pageOf(['stray'], 5);
    };
    const first = renderHook(() => useServerPage(odd, {}, { backToLastPage: true }), { wrapper });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    act(() => first.result.current.setPaging(1, 10));
    await waitFor(() => expect(first.result.current.pageSize).toBe(10));
    act(() => first.result.current.setPaging(2, 10));
    await waitFor(() => expect(calls[calls.length - 1].page).toBe(2));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.page).toBe(2);
    expect(first.result.current.rows).toEqual(['stray']);
    // Page 2 is empty although the total counts three pages: it is a page of the list, so it stays.
    const hole = async (query: Query) => {
      calls.push(query);
      return pageOf([], 25);
    };
    const second = renderHook(() => useServerPage(hole, {}, { backToLastPage: true }), { wrapper });
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    act(() => second.result.current.setPaging(1, 10));
    await waitFor(() => expect(second.result.current.pageSize).toBe(10));
    const before = calls.length;
    act(() => second.result.current.setPaging(2, 10));
    await waitFor(() => expect(calls.length).toBe(before + 1));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.page).toBe(2);
    expect(calls).toHaveLength(before + 1);
  });

  it('stays on page 1 when the whole list is empty, and when a page past the end has no total to go by', async () => {
    const calls: Query[] = [];
    const empty = async (query: Query) => {
      calls.push(query);
      return pageOf([], 0);
    };
    const { result } = renderHook(() => useServerPage(empty, {}, { backToLastPage: true }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setPaging(1, 10));
    await waitFor(() => expect(result.current.pageSize).toBe(10));
    act(() => result.current.setPaging(2, 10));
    await waitFor(() => expect(calls).toHaveLength(3));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.page).toBe(2);
    expect(calls).toHaveLength(3);
    const noTotal = async (query: Query) => {
      calls.push(query);
      return pageOf([], Number.NaN);
    };
    const second = renderHook(() => useServerPage(noTotal, {}, { backToLastPage: true }), {
      wrapper,
    });
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    act(() => second.result.current.setPaging(1, 10));
    await waitFor(() => expect(second.result.current.pageSize).toBe(10));
    act(() => second.result.current.setPaging(2, 10));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    await waitFor(() => expect(calls[calls.length - 1].page).toBe(2));
    expect(second.result.current.page).toBe(2);
  });
});
