import { plainText } from '../../utils/plainText';
import { DASH, formatPercent } from '../../utils/ratio';

// The numbers of the campaign pages. An amount comes as a number or as a decimal written as text; a
// value that is neither is nothing (a dash). A number worked out from two others is never negative,
// and never worked out from a zero: it is a dash then.

const DECIMAL = /^-?\d+(?:\.\d+)?$/;

/** A finite number, or a decimal written as text; `null` for anything else. */
export function numberOf(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && DECIMAL.test(value)) return Number(value);
  return null;
}

/** An amount with two decimals, the thousands written as the language of the page does. */
export function moneyText(value: unknown, locale: string): string {
  const n = numberOf(value);
  if (n === null) return DASH;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * A rate from its two counts (`numerator / denominator`). The counts decide: with a denominator of
 * 0 or below, or a negative count, there is no rate, whatever the backend sent. Only when a count is
 * missing (and none is bad) is the rate the backend sent used, when it is a number that is not negative.
 */
export function rateText(
  given: unknown,
  numerator: unknown,
  denominator: unknown,
  locale: string,
): string {
  const n = numberOf(numerator);
  const d = numberOf(denominator);
  // A denominator of 0 or below, or a negative count, leaves nothing to divide, whatever else is known.
  if ((d !== null && d <= 0) || (n !== null && n < 0)) return DASH;
  if (n !== null && d !== null) return formatPercent(n / d, locale);
  const g = numberOf(given);
  return g !== null && g >= 0 ? formatPercent(g, locale) : DASH;
}

/** A cost for each unit (a registration, an install): the same rules, the answer as an amount. */
export function unitCostText(
  given: unknown,
  cost: unknown,
  count: unknown,
  locale: string,
): string {
  const c = numberOf(cost);
  const d = numberOf(count);
  if ((d !== null && d <= 0) || (c !== null && c < 0)) return DASH;
  if (c !== null && d !== null) return moneyText(c / d, locale);
  const g = numberOf(given);
  return g !== null && g >= 0 ? moneyText(g, locale) : DASH;
}

/** `part` as a percentage of `whole`; a dash when the whole is 0 or less or a number is missing. */
export function shareText(part: unknown, whole: unknown, locale: string): string {
  const p = numberOf(part);
  const w = numberOf(whole);
  return p !== null && w !== null && w > 0 && p >= 0 ? formatPercent(p / w, locale) : DASH;
}

/** "USD 12.30 / EUR 4.00": each currency apart, never added up; a dash when there is no cost. */
export function costsText(costs: unknown, locale: string): string {
  if (!Array.isArray(costs)) return DASH;
  const parts = costs.flatMap((entry) => {
    const { currency, amount } = (typeof entry === 'object' && entry !== null ? entry : {}) as {
      currency?: unknown;
      amount?: unknown;
    };
    return numberOf(amount) === null
      ? []
      : [`${plainText(currency)} ${moneyText(amount, locale)}`.trim()];
  });
  return parts.length > 0 ? parts.join(' / ') : DASH;
}
