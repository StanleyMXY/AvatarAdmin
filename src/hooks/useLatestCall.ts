import { useCallback, useEffect, useRef } from 'react';

/**
 * Lets a component keep only the answer of the newest read. `begin()` is called when a read starts
 * and gives back a function that says whether that read is still the newest one; a read that was
 * overtaken by a newer one, or by the component going away, is not current any more, so its answer
 * (or failure) must not be shown:
 *
 *     const isCurrent = begin();
 *     const answer = await read(id);
 *     if (isCurrent()) setData(answer);
 */
export function useLatestCall(): () => () => boolean {
  const counter = useRef(0);
  useEffect(
    () => () => {
      counter.current += 1;
    },
    [],
  );
  return useCallback(() => {
    counter.current += 1;
    const mine = counter.current;
    return () => mine === counter.current;
  }, []);
}
