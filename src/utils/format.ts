import { DASH } from './ratio';

// Instants from the backend are ISO-8601 with an explicit UTC `Z` or an offset.
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

/** An instant in the browser's time zone and the given locale; text that is not an instant comes back unchanged. */
export function formatInstant(iso: string, locale: string): string {
  if (!ISO_INSTANT.test(iso)) return iso;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;

const roundedToTwo = (value: number) => Math.round(value * 100) / 100;

/**
 * A size in bytes as B, KB, MB or GB in steps of 1024, which is how the backend's limits are written
 * (2097152 is 2 MB). A value that rounds up to 1024 of a unit is written in the next unit.
 */
export function formatBytes(n: number, locale: string): string {
  if (!Number.isFinite(n) || n < 0) return DASH;
  let value = n;
  let unit = 0;
  while (roundedToTwo(value) >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)} ${BYTE_UNITS[unit]}`;
}

/**
 * Two sizes that are shown side by side, such as a file and the limit it breaks. Rounding can make
 * different sizes read the same ("1 MB over a limit of 1 MB"); then both are written as exact byte
 * counts. A size that is not a number is a dash and does not change the other.
 */
export function formatBytesPair(a: number, b: number, locale: string): [string, string] {
  const shown: [string, string] = [formatBytes(a, locale), formatBytes(b, locale)];
  const bothNumbers = Number.isFinite(a) && a >= 0 && Number.isFinite(b) && b >= 0;
  if (!bothNumbers || a === b || shown[0] !== shown[1]) return shown;
  const exact = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return [`${exact.format(a)} B`, `${exact.format(b)} B`];
}
