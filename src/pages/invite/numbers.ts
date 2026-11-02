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

/**
 * `field` over `previous` summed only over the rows that have a valid count for both, then
 * divided; null when no row has both or the earlier sum is 0. A day whose earlier step is not known
 * (null: its events expired) is left out of both sums, so it does not raise the ratio by adding a
 * numerator to a denominator that has no such day.
 */
export function pairedRate<T extends Record<string, unknown>>(
  rows: readonly T[],
  field: keyof T,
  previous: keyof T,
): number | null {
  const both = rows.filter((row) => count(row[field]) !== null && count(row[previous]) !== null);
  return rateOf(
    sumCounts(both.map((row) => row[field])),
    sumCounts(both.map((row) => row[previous])),
  );
}
