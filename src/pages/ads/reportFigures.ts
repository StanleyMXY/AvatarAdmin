import { DASH, formatCount } from '../../utils/ratio';

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * A ratio of the report, or `null` when it cannot be shown: the denominator is 0, missing or not a
 * number (nothing to divide by), or the value is negative or not a number. The server works the
 * ratios out from the summed numerators and denominators; when it did not send one at all (a
 * field that is missing, not a `null`), it is worked out here the same way.
 */
export function ratioOf(
  fromServer: unknown,
  numerator: unknown,
  denominator: unknown,
): number | null {
  if (!isNumber(denominator) || denominator <= 0) return null;
  if (fromServer === undefined) {
    return isNumber(numerator) && numerator >= 0 ? numerator / denominator : null;
  }
  return isNumber(fromServer) && fromServer >= 0 ? fromServer : null;
}

/** A ratio as a percentage with two decimals ("4.25%"); a dash when there is none. */
export function percentText(ratio: number | null, locale: string): string {
  if (ratio === null || !Number.isFinite(ratio)) return DASH;
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(ratio);
}

/** Seconds with two decimals and the unit ("7.50 s"); a dash when there is none. */
export function avgSecondsText(seconds: number | null, locale: string, unit: string): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return DASH;
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(seconds)} ${unit}`;
}

/** A count of the report with separators; 0 is 0, anything that is not a count (and a negative one) is a dash. */
export function countCell(value: unknown, locale: string): string {
  return isNumber(value) && value >= 0 ? formatCount(value, locale) : DASH;
}

/** The number of impressions that were neither seen nor not seen: derived, so never below 0. */
export function undeterminedOf(value: unknown): number | null {
  return isNumber(value) ? Math.max(0, value) : null;
}
