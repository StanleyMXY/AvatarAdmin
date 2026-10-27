/**
 * Text for a field the backend sends as a string but whose type the contract does not fix: a string
 * as it is, a number or boolean written out, an object or list as JSON, nothing as an empty string.
 * Showing such a value as a React child would otherwise throw and blank the whole page.
 */
export function plainText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value) ?? '';
    } catch {
      return '';
    }
  }
  return String(value);
}
