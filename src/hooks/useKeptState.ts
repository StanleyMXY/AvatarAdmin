import { type Dispatch, type SetStateAction, useCallback, useState } from 'react';

/**
 * A box that a page owns (`useRef<Record<string, unknown>>({})`) and hands to the tabs whose content
 * is drawn again when the tab is opened. What a tab keeps in it is still there when the tab is
 * opened again.
 */
export type Kept = { current: Record<string, unknown> };

/**
 * `useState` whose value is also written into `kept` under `key`, and read from there when the
 * component is drawn again. A tab that is destroyed when it is hidden (so that it reads fresh data
 * each time it is opened) can keep its filters and a half-filled form this way.
 */
export function useKeptState<T>(
  kept: Kept,
  key: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (Object.hasOwn(kept.current, key)) return kept.current[key] as T;
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });
  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (next) => {
      setValue((before) => {
        const after = typeof next === 'function' ? (next as (value: T) => T)(before) : next;
        kept.current[key] = after;
        return after;
      });
    },
    [kept, key],
  );
  return [value, set];
}
