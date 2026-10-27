/** What an empty value, a ratio without a denominator, or a count that is not known looks like. */
export const DASH = '—';

/** `n / d`, or `null` when either is missing or not a finite number, or `d` is zero. */
export function safeRatio(
  n: number | null | undefined,
  d: number | null | undefined,
): number | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  if (d === null || d === undefined || !Number.isFinite(d) || d === 0) return null;
  return n / d;
}

export function formatPercent(r: number | null, locale: string, digits = 1): string {
  if (r === null || !Number.isFinite(r)) return DASH;
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(r);
}

export function formatCount(n: number | null | undefined, locale: string): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  return new Intl.NumberFormat(locale).format(n);
}
