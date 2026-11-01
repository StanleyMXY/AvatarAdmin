import { trimSpec } from './trimSpec';

/** Number of Unicode code points in `s` (not UTF-16 units, not graphemes). */
export function countCodePoints(s: string): number {
  let count = 0;
  for (let i = 0; i < s.length; i++) {
    const unit = s.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff && i + 1 < s.length) {
      const next = s.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i++;
    }
    count++;
  }
  return count;
}

/** The text-field length rule: trim with the contract's definition, then count code points. */
export function lengthWithin(s: string, min: number, max: number): boolean {
  const length = countCodePoints(trimSpec(s));
  return length >= min && length <= max;
}

/**
 * `s` cut to at most `max` code points, with an ellipsis after it when something was cut (so a
 * name of any length can stand inside a sentence). A surrogate pair is never cut in the middle.
 */
export function clipCodePoints(s: string, max: number): string {
  const points = [...s];
  return points.length > max ? `${points.slice(0, max).join('')}…` : s;
}
