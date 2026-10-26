import { DASH } from '../../utils/ratio';

type T = (id: string, values?: Record<string, string | number>) => string;

const formatNumber = (n: number, locale: string): string => new Intl.NumberFormat(locale).format(n);

/**
 * A waiting time as its two largest parts: "3 d 4 h", "5 h 20 min", "12 min", "40 s". Nothing or a
 * value that is not a number gives a dash, never 0 or NaN.
 */
export function formatDuration(seconds: number | null | undefined, t: T, locale: string): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return DASH;
  }
  const whole = Math.floor(seconds);
  const parts: [number, string][] = [
    [Math.floor(whole / 86_400), 'days'],
    [Math.floor((whole % 86_400) / 3_600), 'hours'],
    [Math.floor((whole % 3_600) / 60), 'minutes'],
    [whole % 60, 'seconds'],
  ];
  const first = parts.findIndex(([n]) => n > 0);
  if (first === -1) return t('moderation.duration.seconds', { n: formatNumber(0, locale) });
  const shown = parts.slice(first, first + 2).filter(([n]) => n > 0);
  return shown
    .map(([n, unit]) => t(`moderation.duration.${unit}`, { n: formatNumber(n, locale) }))
    .join(' ');
}

/** Seconds since `iso`, or null when it is not a time. */
export function secondsSince(iso: string, now: number = Date.now()): number | null {
  const at = Date.parse(iso);
  return Number.isNaN(at) ? null : Math.max(0, Math.floor((now - at) / 1000));
}
