// Money is a decimal text from the backend to the screen and back. Nothing here goes through a
// float: a number is read as the text JavaScript writes for it, a text is scaled to an integer and
// added as a BigInt. `numeric(20,10)` prices and `numeric(24,10)` sums keep every digit this way,
// and a very small price never turns into `1e-10`.

type Scaled = { units: bigint; scale: number };

const PLAIN = /^-?\d+(?:\.\d+)?$/;
const SCIENTIFIC = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/;
const MAX_EXPONENT = 400;

const pow10 = (n: number): bigint => 10n ** BigInt(n);

function scaledOf(text: string): Scaled | null {
  if (PLAIN.test(text)) {
    const negative = text.startsWith('-');
    const [whole, fraction = ''] = (negative ? text.slice(1) : text).split('.');
    const units = BigInt(whole + fraction);
    return { units: negative ? -units : units, scale: fraction.length };
  }
  const match = SCIENTIFIC.exec(text);
  if (!match) return null;
  const exponent = Number(match[4]);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > MAX_EXPONENT) return null;
  const fraction = match[3] ?? '';
  const units = BigInt(match[2] + fraction);
  const scale = fraction.length - exponent;
  const signed = match[1] === '-' ? -units : units;
  return scale >= 0 ? { units: signed, scale } : { units: signed * pow10(-scale), scale: 0 };
}

function textOf({ units, scale }: Scaled): string {
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, '0');
  const whole = digits.slice(0, digits.length - scale);
  const fraction = digits.slice(digits.length - scale);
  return `${negative ? '-' : ''}${whole}${scale > 0 ? `.${fraction}` : ''}`;
}

const parsed = (text: string): Scaled => {
  const scaled = scaledOf(text);
  if (!scaled) throw new RangeError(`not a decimal: ${text}`);
  return scaled;
};

/**
 * A decimal from the backend as text without an exponent, or null when it is not a decimal. A
 * string keeps every digit it came with (`0.4000` stays `0.4000`); a number is written out in full;
 * a string with an exponent is expanded.
 */
export function toDecimalString(value: unknown): string | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const scaled = scaledOf(String(value));
    return scaled ? textOf(scaled) : null;
  }
  if (typeof value !== 'string') return null;
  if (PLAIN.test(value)) return value;
  const scaled = scaledOf(value);
  return scaled ? textOf(scaled) : null;
}

const aligned = (a: string, b: string) => {
  const left = parsed(a);
  const right = parsed(b);
  const scale = Math.max(left.scale, right.scale);
  return {
    scale,
    left: left.units * pow10(scale - left.scale),
    right: right.units * pow10(scale - right.scale),
  };
};

/** `a + b`, exactly; the result has as many decimals as the one with more. Throws on a text that is not a decimal. */
export function addDecimals(a: string, b: string): string {
  const { scale, left, right } = aligned(a, b);
  return textOf({ units: left + right, scale });
}

/** The sum of the decimals in the list, null ones skipped; null when there is none to add. */
export function sumDecimals(values: readonly (string | null)[]): string | null {
  let total: string | null = null;
  for (const value of values) {
    if (value === null) continue;
    total = total === null ? value : addDecimals(total, value);
  }
  return total;
}

export function compareDecimals(a: string, b: string): -1 | 0 | 1 {
  const { left, right } = aligned(a, b);
  return left < right ? -1 : left > right ? 1 : 0;
}

/** `text` with exactly `digits` decimals, the half rounded up (away from zero). */
export function roundDecimal(text: string, digits: number): string {
  const { units, scale } = parsed(text);
  if (scale <= digits) return textOf({ units: units * pow10(digits - scale), scale: digits });
  const factor = pow10(scale - digits);
  const negative = units < 0n;
  const magnitude = negative ? -units : units;
  let quotient = magnitude / factor;
  if ((magnitude % factor) * 2n >= factor) quotient += 1n;
  return textOf({ units: negative ? -quotient : quotient, scale: digits });
}

const MOST_DECIMALS = 6;
const LEAST_DECIMALS = 2;

/**
 * An amount for the screen: at most six decimals (contract 14.2), at least two, no grouping and no
 * exponent. An exact zero is `0`; an amount that is not zero but below one millionth is `<0.000001`
 * (not `0.000000`, which would read as nothing). A negative amount is null: costs are never negative.
 */
export function formatAmount(text: string): string | null {
  const scaled = scaledOf(text);
  if (!scaled || scaled.units < 0n) return null;
  if (scaled.units === 0n) return '0';
  const rounded = roundDecimal(text, MOST_DECIMALS);
  if (parsed(rounded).units === 0n) return `<0.${'0'.repeat(MOST_DECIMALS - 1)}1`;
  const [whole, fraction] = rounded.split('.');
  let kept = fraction;
  while (kept.length > LEAST_DECIMALS && kept.endsWith('0')) kept = kept.slice(0, -1);
  return `${whole}.${kept}`;
}

const PRICE = /^\d+(?:\.\d{1,10})?$/;

/**
 * The shape of a price: digits 0-9, optionally a point and one to ten decimals; no sign, no exponent,
 * no separators. The largest price (1000000, contract 14.2) is not checked here: the backend is the
 * judge of it, and its refusal is shown as such.
 */
export function isValidPrice(text: string): boolean {
  return PRICE.test(text);
}
