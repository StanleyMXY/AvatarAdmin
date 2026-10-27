import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import { ApiError } from '../../request/errors';
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
    await act(async () =>
      first.reject(
        new ApiError({ code: 'INTERNAL_ERROR', httpStatus: 500, message: 'raw words', data: null }),
      ),
    );
    expect(result.current.failure).toBeNull();
    expect(result.current.data).toBe('new');
  });

  it('says what failed in the words of the code, not the backend words, and reads again on reload', async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      if (calls === 1)
        throw new ApiError({
          code: 'INTERNAL_ERROR',
          httpStatus: 500,
          message: 'raw backend words',
          data: null,
        });
      return 'ok';
    };
    const { result } = renderHook(() => useLatestRead(fetcher), { wrapper });
    await waitFor(() => expect(result.current.failure).not.toBeNull());
    expect(result.current.failure).not.toContain('raw backend words');
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe('ok'));
    expect(result.current.failure).toBeNull();
  });

  it('does not set state after the page is left', async () => {
    const pending = deferred<string>();
    const { result, unmount } = renderHook(() => useLatestRead(() => pending.promise), { wrapper });
    unmount();
    await act(async () => pending.resolve('late'));
    expect(result.current.data).toBeNull();
  });
});
