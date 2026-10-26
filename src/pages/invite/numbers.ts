// Counts from the backend are shown as they are only when they can be counts: a number that is
// finite and not negative. Anything else (missing, text, negative, NaN) is "not known" and is shown
// as a dash, and a sum or a ratio is never made out of it.

/** The value when it is a finite number that is not negative, else null. */
export const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

/** The sum of the valid counts; null when none of the values is valid (nothing is known). */
export function sumCounts(values: readonly unknown[]): number | null {
  let sum: number | null = null;
  for (const value of values) {
    const one = count(value);
    if (one !== null) sum = (sum ?? 0) + one;
  }
  return sum;
}

/** `n / d` for valid counts when `d` is above 0, else null. */
export function rateOf(n: unknown, d: unknown): number | null {
  const top = count(n);
  const bottom = count(d);
  if (top === null || bottom === null || bottom === 0) return null;
  return top / bottom;
}
