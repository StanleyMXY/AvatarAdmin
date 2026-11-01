import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type Kept, useKeptState } from './useKeptState';

const box = (): Kept => ({ current: {} });

describe('useKeptState', () => {
  it('starts from the initial value and works like useState', () => {
    const kept = box();
    const { result } = renderHook(() => useKeptState(kept, 'a', 1));
    expect(result.current[0]).toBe(1);
    act(() => result.current[1](2));
    expect(result.current[0]).toBe(2);
    act(() => result.current[1]((n) => n + 5));
    expect(result.current[0]).toBe(7);
  });

  it('gives back the last value to a component that is drawn again', () => {
    const kept = box();
    const first = renderHook(() => useKeptState(kept, 'filter', 'all'));
    act(() => first.result.current[1]('open'));
    first.unmount();
    const second = renderHook(() => useKeptState(kept, 'filter', 'all'));
    expect(second.result.current[0]).toBe('open');
  });

  it('keeps a value of undefined and falsy values too', () => {
    const kept = box();
    const first = renderHook(() => useKeptState<number | undefined>(kept, 'n', 3));
    act(() => first.result.current[1](undefined));
    first.unmount();
    const second = renderHook(() => useKeptState<number | undefined>(kept, 'n', 3));
    expect(second.result.current[0]).toBeUndefined();
  });

  it('keeps each key apart, and a box apart from another box', () => {
    const one = box();
    const other = box();
    const a = renderHook(() => useKeptState(one, 'a', 'x'));
    const b = renderHook(() => useKeptState(one, 'b', 'y'));
    const c = renderHook(() => useKeptState(other, 'a', 'z'));
    act(() => a.result.current[1]('changed'));
    expect(b.result.current[0]).toBe('y');
    expect(c.result.current[0]).toBe('z');
    expect(one.current).toEqual({ a: 'changed' });
  });

  it('works out a lazy initial value only when nothing was kept', () => {
    const kept = box();
    let calls = 0;
    const lazy = () => {
      calls += 1;
      return 'made';
    };
    const first = renderHook(() => useKeptState(kept, 'k', lazy));
    expect(first.result.current[0]).toBe('made');
    act(() => first.result.current[1]('kept'));
    first.unmount();
    calls = 0;
    const second = renderHook(() => useKeptState(kept, 'k', lazy));
    expect(second.result.current[0]).toBe('kept');
    expect(calls).toBe(0);
  });
});
