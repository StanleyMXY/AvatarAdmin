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

/** A size in bytes as B, KB, MB or GB in steps of 1024, which is how the backend's limits are written (2097152 is 2 MB). */
export function formatBytes(n: number, locale: string): string {
  if (!Number.isFinite(n) || n < 0) return DASH;
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)} ${BYTE_UNITS[unit]}`;
}
