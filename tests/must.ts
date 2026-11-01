/**
 * Returns `value` when the test found it, and fails with a clear message when it did not. A test
 * uses this where it looks a row, a record or an element up and the lookup must succeed: the
 * failure then names what was missing instead of ending in "cannot read properties of undefined".
 */
export function must<T>(value: T | null | undefined, what = 'value'): T {
  if (value === null || value === undefined) {
    throw new Error(`[avatar-admin] the test expected ${what} to exist, but it was not found`);
  }
  return value;
}
