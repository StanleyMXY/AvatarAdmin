import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSource } from './useSource';

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

describe('useSource', () => {
  it('is idle and asks for nothing while it is not enabled', () => {
    const load = vi.fn(async () => 1);
    const { result } = renderHook(() => useSource(load, false));
    expect(result.current.status).toBe('idle');
    expect(load).not.toHaveBeenCalled();
  });

  it('loads once when enabled and then holds the data', async () => {
    const load = vi.fn(async () => 42);
    const { result } = renderHook(() => useSource(load, true));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data).toBe(42);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps the error of a failed load and loads again on reload', async () => {
    const load = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error('no'))
      .mockResolvedValueOnce(7);
    const { result } = renderHook(() => useSource(load, true));
    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeNull();
    act(() => result.current.reload());
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data).toBe(7);
    expect(result.current.error).toBeNull();
  });

  it('never lets an answer that comes late overwrite a newer one', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const load = vi
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useSource(load, true));
    act(() => result.current.reload());
    await act(async () => {
      second.resolve('new');
    });
    await waitFor(() => expect(result.current.data).toBe('new'));
    await act(async () => {
      first.resolve('old');
    });
    expect(result.current.data).toBe('new');
    expect(result.current.status).toBe('ready');
  });

  it('does not let a late failure replace newer data either', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const load = vi
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useSource(load, true));
    act(() => result.current.reload());
    await act(async () => {
      second.resolve('new');
    });
    await act(async () => {
      first.reject(new Error('late'));
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.data).toBe('new');
  });

  it('drops the answer when the page is gone', async () => {
    const pending = deferred<number>();
    const { unmount } = renderHook(() => useSource(() => pending.promise, true));
    unmount();
    await act(async () => {
      pending.resolve(1);
    });
  });

  it('starts when it becomes enabled later, and not again for the same permission', async () => {
    const load = vi.fn(async () => 5);
    const { result, rerender } = renderHook(({ on }) => useSource(load, on), {
      initialProps: { on: false },
    });
    expect(load).not.toHaveBeenCalled();
    rerender({ on: true });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ on: true });
    expect(load).toHaveBeenCalledTimes(1);
  });
});
