import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRead } from './useRead';

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
  it('reads once when it appears and keeps the answer', async () => {
    let reads = 0;
    const { result } = renderHook(() =>
      useRead(async () => {
        reads += 1;
        return ['a'];
      }),
    );
    expect(result.current.state.status).toBe('loading');
    await waitFor(() => expect(result.current.state.status).toBe('ok'));
    expect(result.current.state.data).toEqual(['a']);
    expect(reads).toBe(1);
  });

  it('shows the answer of the newest read when an older one arrives later', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const pending = [first, second];
    let n = 0;
    const { result } = renderHook(() => useRead(() => pending[n++].promise));
    act(() => result.current.reload());
    second.resolve('new');
    await waitFor(() => expect(result.current.state.data).toBe('new'));
    first.resolve('old');
    await act(async () => {
      await first.promise;
    });
    expect(result.current.state.data).toBe('new');
  });

  it('keeps the last good answer while the next read runs, and drops it when that read fails', async () => {
    const second = deferred<string[]>();
    let n = 0;
    const { result } = renderHook(() =>
      useRead(() => (n++ === 0 ? Promise.resolve(['kept']) : second.promise)),
    );
    await waitFor(() => expect(result.current.state.status).toBe('ok'));
    act(() => result.current.reload());
    expect(result.current.state).toEqual({ status: 'loading', data: ['kept'] });
    second.reject(new Error('boom'));
    await waitFor(() => expect(result.current.state.status).toBe('failed'));
    expect(result.current.state.data).toBeNull();
  });

  it('drops an answer that arrives after the component is gone', async () => {
    const late = deferred<string>();
    const { result, unmount } = renderHook(() => useRead(() => late.promise));
    unmount();
    late.resolve('late');
    await late.promise;
    expect(result.current.state.status).toBe('loading');
  });
});
