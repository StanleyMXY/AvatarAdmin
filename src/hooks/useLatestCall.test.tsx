import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useLatestCall } from './useLatestCall';

describe('useLatestCall', () => {
  it('says that the newest read is current and an older one is not', () => {
    const { result } = renderHook(() => useLatestCall());
    const first = result.current();
    expect(first()).toBe(true);
    const second = result.current();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  it('keeps the same function between renders, so that it can be a dependency of an effect', () => {
    const { result, rerender } = renderHook(() => useLatestCall());
    const before = result.current;
    rerender();
    expect(result.current).toBe(before);
  });

  it('makes a read that is still running not current when the component goes away', () => {
    const { result, unmount } = renderHook(() => useLatestCall());
    const running = result.current();
    expect(running()).toBe(true);
    unmount();
    expect(running()).toBe(false);
  });
});
