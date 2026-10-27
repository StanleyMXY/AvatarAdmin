import { formatInstant } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';

export type Translate = (id: string, values?: Record<string, string | number>) => string;

/** The number of characters of the device that are shown: the rest of the hash stays out of the page. */
export const DEVICE_SHOWN = 8;

/** A guest session has no account. */
export const isGuest = (accountId: unknown): boolean => plainText(accountId) === '';

/** The first 8 characters of a device (by characters, not code units: an emoji is not cut in half). */
export function devicePrefix(deviceId: unknown): string {
  return Array.from(plainText(deviceId)).slice(0, DEVICE_SHOWN).join('');
}

/** An instant in the language and time zone of the browser; a dash for nothing. */
export function when(value: unknown, locale: string): string {
  const text = plainText(value);
  return text === '' ? DASH : formatInstant(text, locale);
}

/** A duration as hours, minutes and seconds; a dash when it is not a duration (a number of 0 or more). */
export function formatDuration(seconds: unknown, t: Translate): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return DASH;
  const whole = Math.floor(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  if (h > 0) return t('sessions.duration.hms', { h, m, s });
  if (m > 0) return t('sessions.duration.ms', { m, s });
  return t('sessions.duration.s', { s });
}

/** A number for a card or a cell: at most `digits` decimals in the language of the interface. */
export function formatDecimal(value: number, locale: string, digits: number): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
}
