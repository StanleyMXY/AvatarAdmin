import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';
import enUS from '../../locales/en-US';
import { useStatRead } from './useStatRead';

const wrapper = ({ children }: { children: ReactNode }) => (
  <IntlProvider locale="en-US" messages={enUS} onError={() => {}}>
    {children}
  </IntlProvider>
);

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };
const deferred = <T,>(): Deferred<T> => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('useStatRead', () => {
  it('reads once, and holds the data', async () => {
    const fetcher = vi.fn(async () => 'a');
    const { result } = renderHook(() => useStatRead(fetcher), { wrapper });
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.data).toBe('a'));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('never lets an answer that comes late replace the answer of the newer read', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const fetcher = vi
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useStatRead(fetcher), { wrapper });
    act(() => result.current.reload());
    await act(async () => {
      second.resolve('new');
    });
    await waitFor(() => expect(result.current.data).toBe('new'));
    await act(async () => {
      first.resolve('old');
    });
    expect(result.current.data).toBe('new');
  });

  it('does not let the failure of a read that was overtaken show over the newer data', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const fetcher = vi
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useStatRead(fetcher), { wrapper });
    act(() => result.current.reload());
    await act(async () => {
      second.resolve('new');
    });
    await waitFor(() => expect(result.current.data).toBe('new'));
    await act(async () => {
      first.reject(new Error('late'));
    });
    expect(result.current.failure).toBeNull();
    expect(result.current.data).toBe('new');
  });

  it('drops the answer of a read when the page is left', async () => {
    const pending = deferred<string>();
    const fetcher = vi.fn(() => pending.promise);
    const { result, unmount } = renderHook(() => useStatRead(fetcher), { wrapper });
    unmount();
    await act(async () => {
      pending.resolve('late');
    });
    expect(result.current.data).toBeNull();
  });

  it('shows the failure in the words of its code, never the words of the backend', async () => {
    const fetcher = vi.fn(async () => {
      throw Object.assign(new Error('raw backend words'), {});
    });
    const { result } = renderHook(() => useStatRead(fetcher), { wrapper });
    await waitFor(() => expect(result.current.failure).not.toBeNull());
    expect(result.current.failure).not.toContain('raw backend words');
  });
});
