import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, useCallback } from 'react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import { ApiError } from '../../request/errors';
import { useRead } from './useRead';

const wrapper = ({ children }: { children: ReactNode }) => (
  <IntlProvider locale="en-US" messages={enUS} onError={() => {}}>
    {children}
  </IntlProvider>
);

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('useRead', () => {
  it('reads once and holds the answer', async () => {
    const fetcher = async () => 'a';
    const { result } = renderHook(() => useRead(fetcher), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe('a'));
    expect(result.current.loading).toBe(false);
    expect(result.current.failure).toBeNull();
  });

  it('drops the answer of an older read that arrives after the newer one (the account changed)', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) =>
        useRead(useCallback(() => (id === 'A' ? first.promise : second.promise), [id])),
      { wrapper, initialProps: { id: 'A' } },
    );
    rerender({ id: 'B' });
    await act(async () => second.resolve('B'));
    await waitFor(() => expect(result.current.data).toBe('B'));
    await act(async () => first.resolve('A, late'));
    expect(result.current.data).toBe('B');
  });

  it('drops an older failure too, and shows the translated words and the error of the newest read', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) =>
        useRead(useCallback(() => (id === 'A' ? first.promise : second.promise), [id])),
      { wrapper, initialProps: { id: 'A' } },
    );
    rerender({ id: 'B' });
    await act(async () => second.resolve('B'));
    await act(async () =>
      first.reject(
        new ApiError({ code: 'ADMIN_FORBIDDEN', httpStatus: 403, message: 'x', data: null }),
      ),
    );
    expect(result.current.failure).toBeNull();
    expect(result.current.data).toBe('B');
  });

  it('keeps the error object so the page can tell "not found" from other failures, with words and no backend message', async () => {
    const fetcher = async (): Promise<string> => {
      throw new ApiError({
        code: 'RESOURCE_NOT_FOUND',
        httpStatus: 404,
        message: 'backend words',
        data: null,
      });
    };
    const { result } = renderHook(() => useRead(fetcher), { wrapper });
    await waitFor(() => expect(result.current.failure).not.toBeNull());
    expect((result.current.error as ApiError).code).toBe('RESOURCE_NOT_FOUND');
    expect(result.current.failure).toBe(enUS['error.RESOURCE_NOT_FOUND']);
    expect(result.current.data).toBeNull();
  });

  it('reads again on reload and, with keep, holds the old rows until the new ones arrive', async () => {
    let n = 0;
    const gate = deferred<number>();
    const fetcher = async () => {
      n += 1;
      return n === 1 ? 1 : gate.promise;
    };
    const { result } = renderHook(() => useRead(fetcher, { keep: true }), { wrapper });
    await waitFor(() => expect(result.current.data).toBe(1));
    act(() => result.current.reload());
    expect(result.current.data).toBe(1);
    await act(async () => gate.resolve(2));
    await waitFor(() => expect(result.current.data).toBe(2));
  });
});
