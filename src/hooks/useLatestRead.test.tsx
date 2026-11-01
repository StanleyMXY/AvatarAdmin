import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it } from 'vitest';
import enUS from '../locales/en-US';
import { ApiError } from '../request/errors';
import { useLatestRead } from './useLatestRead';

const wrapper = ({ children }: { children: ReactNode }) => (
  <IntlProvider locale="en-US" messages={enUS} onError={() => {}}>
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

const failureOf = (message: string) =>
  new ApiError({ code: 'INTERNAL_ERROR', httpStatus: 500, message, data: null });

describe('useLatestRead: an old answer never replaces a new one', () => {
  it('shows the answer of the newest read when the older one arrives last', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const fetchers = [() => first.promise, () => second.promise];
    const { result, rerender } = renderHook(({ n }) => useLatestRead(fetchers[n]), {
      wrapper,
      initialProps: { n: 0 },
    });
    rerender({ n: 1 });
    await act(async () => second.resolve('new'));
    await waitFor(() => expect(result.current.data).toBe('new'));
    await act(async () => first.resolve('old'));
    expect(result.current.data).toBe('new');
    expect(result.current.loading).toBe(false);
  });

  it('drops the failure of an older read too', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const fetchers = [() => first.promise, () => second.promise];
    const { result, rerender } = renderHook(({ n }) => useLatestRead(fetchers[n]), {
      wrapper,
      initialProps: { n: 0 },
    });
    rerender({ n: 1 });
    await act(async () => second.resolve('new'));
    await act(async () => first.reject(failureOf('raw words')));
    expect(result.current.failure).toBeNull();
    expect(result.current.data).toBe('new');
  });

  it('is loading until the answer or the failure comes, and not after', async () => {
    const answer = deferred<string>();
    const fetcher = () => answer.promise;
    const { result } = renderHook(() => useLatestRead(fetcher), { wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    await act(async () => answer.reject(failureOf('x')));
    expect(result.current.loading).toBe(false);
    expect(result.current.failure).not.toBeNull();
  });

  it('says what failed in the words of the code, not the backend words, and reads again on reload', async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      if (calls === 1) throw failureOf('raw backend words');
      return 'ok';
    };
    const { result } = renderHook(() => useLatestRead(fetcher), { wrapper });
    await waitFor(() => expect(result.current.failure).not.toBeNull());
    expect(result.current.failure).not.toContain('raw backend words');
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe('ok'));
    expect(result.current.failure).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('does not set state after the page is left', async () => {
    const pending = deferred<string>();
    const fetcher = () => pending.promise;
    const { result, unmount } = renderHook(() => useLatestRead(fetcher), { wrapper });
    unmount();
    await act(async () => pending.resolve('late'));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
  });
});

describe('useLatestRead: keepWhileReading', () => {
  /** A read whose answers are given one by one, in the order the reads are made. */
  const readsOf = () => {
    const answers = [deferred<string>(), deferred<string>()];
    let n = 0;
    return { answers, fetcher: () => answers[n++ % answers.length].promise };
  };

  it('keeps the last answer while a new read is under way', async () => {
    const { answers, fetcher } = readsOf();
    const { result } = renderHook(() => useLatestRead(fetcher, { keepWhileReading: true }), {
      wrapper,
    });
    await act(async () => answers[0].resolve('first'));
    await waitFor(() => expect(result.current.data).toBe('first'));
    act(() => result.current.reload());
    expect(result.current.data).toBe('first');
    expect(result.current.loading).toBe(true);
    await act(async () => answers[1].resolve('second'));
    await waitFor(() => expect(result.current.data).toBe('second'));
  });

  it('clears the last answer when a new read starts, without the option', async () => {
    const { answers, fetcher } = readsOf();
    const { result } = renderHook(() => useLatestRead(fetcher), { wrapper });
    await act(async () => answers[0].resolve('first'));
    await waitFor(() => expect(result.current.data).toBe('first'));
    act(() => result.current.reload());
    expect(result.current.data).toBeNull();
  });

  it('clears the kept answer when the new read fails', async () => {
    const { answers, fetcher } = readsOf();
    const { result } = renderHook(() => useLatestRead(fetcher, { keepWhileReading: true }), {
      wrapper,
    });
    await act(async () => answers[0].resolve('first'));
    await waitFor(() => expect(result.current.data).toBe('first'));
    act(() => result.current.reload());
    await act(async () => answers[1].reject(failureOf('raw words')));
    await waitFor(() => expect(result.current.failure).not.toBeNull());
    expect(result.current.data).toBeNull();
  });
});
