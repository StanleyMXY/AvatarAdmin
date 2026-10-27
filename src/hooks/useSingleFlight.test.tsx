import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSingleFlight } from './useSingleFlight';

describe('useSingleFlight', () => {
  it('runs the action and gives its result', async () => {
    const { result } = renderHook(() => useSingleFlight(async (n: number) => n * 2));
    let value: number | undefined;
    await act(async () => {
      value = await result.current.run(21);
    });
    expect(value).toBe(42);
    expect(result.current.pending).toBe(false);
  });

  it('ignores a second call while the first is running, even in the same tick', async () => {
    let release: () => void = () => {};
    const fn = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = () => resolve('done');
        }),
    );
    const { result } = renderHook(() => useSingleFlight(fn));
    let first: Promise<string | undefined> = Promise.resolve(undefined);
    let second: Promise<string | undefined> = Promise.resolve(undefined);
    act(() => {
      first = result.current.run();
      second = result.current.run();
    });
    expect(result.current.pending).toBe(true);
    await act(async () => {
      release();
      await first;
    });
    expect(await second).toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(false);
  });

  it('can run again after the action finished or failed', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok');
    const { result } = renderHook(() => useSingleFlight(fn));
    await act(async () => {
      await result.current.run().catch(() => {});
    });
    expect(result.current.pending).toBe(false);
    let value: string | undefined;
    await act(async () => {
      value = await result.current.run();
    });
    expect(value).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('uses the newest function of the last render', async () => {
    const { result, rerender } = renderHook(({ n }) => useSingleFlight(async () => n), {
      initialProps: { n: 1 },
    });
    rerender({ n: 2 });
    let value: number | undefined;
    await act(async () => {
      value = await result.current.run();
    });
    expect(value).toBe(2);
  });
});
