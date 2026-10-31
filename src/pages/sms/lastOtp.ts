// Which channel or template is the last one that sends verification codes. The backend refuses to
// delete, switch off or change such a channel while phone sign-in is on or phone-number accounts
// exist (contract 23.4); the page asks first. The backend has the last word: these functions only
// decide whether to ask.

export type Coverage = {
  id: string;
  enabled: boolean;
  smsType: string;
  /** The countries served; empty or missing means all of them. */
  countries?: unknown;
};

type Covered = 'ALL' | Set<string>;

/** What a list of countries stands for. A list with entries that are not text serves only the text ones; something that is not a list serves nothing, unless it is the channel itself (then it is taken as all, which asks more often). */
function coveredBy(countries: unknown, isTarget: boolean): Covered {
  if (countries === null || countries === undefined) return 'ALL';
  if (!Array.isArray(countries)) return isTarget ? 'ALL' : new Set();
  if (countries.length === 0) return 'ALL';
  return new Set(
    countries
      .filter((c): c is string => typeof c === 'string')
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c !== ''),
  );
}

const isOtpOn = (c: { enabled: boolean; smsType: string }) =>
  c.enabled === true && c.smsType === 'OTP';

/** The countries only `target` serves among the enabled OTP channels, or null when others serve all of them. */
function uniqueCoverage(target: Coverage, others: Coverage[]): Covered | null {
  const theirs = others.map((o) => coveredBy(o.countries, false));
  if (theirs.some((c) => c === 'ALL')) return null;
  const mine = coveredBy(target.countries, true);
  if (mine === 'ALL') return 'ALL';
  const taken = new Set(theirs.flatMap((c) => [...(c as Set<string>)]));
  const left = new Set([...mine].filter((c) => !taken.has(c)));
  return left.size > 0 ? left : null;
}

const othersOf = (target: Coverage, all: Coverage[]) =>
  all.filter((c) => c.id !== target.id && isOtpOn(c));

/** True when `target` is an enabled OTP channel and some country is served by it and by no other enabled OTP channel. */
export function isLastOtpChannel(target: Coverage, all: Coverage[]): boolean {
  if (!isOtpOn(target)) return false;
  return uniqueCoverage(target, othersOf(target, all)) !== null;
}

/**
 * True when the edit leaves every country that only this channel served still served by it. An edit
 * of a channel that is not the last one always keeps the coverage. A change of the type to anything
 * but OTP loses it.
 */
export function keepsCoverage(
  before: Coverage,
  after: { smsType: string; countries?: unknown },
  all: Coverage[],
): boolean {
  if (!isOtpOn(before)) return true;
  const unique = uniqueCoverage(before, othersOf(before, all));
  if (unique === null) return true;
  if (after.smsType !== 'OTP') return false;
  const next = coveredBy(after.countries, true);
  if (next === 'ALL') return true;
  if (unique === 'ALL') return false;
  return [...unique].every((c) => next.has(c));
}

export type TemplateCoverage = { id: string; enabled: boolean; smsType: string };

/** True when `target` is an enabled OTP template and no other template is. */
export function isLastOtpTemplate(target: TemplateCoverage, all: TemplateCoverage[]): boolean {
  if (!isOtpOn(target)) return false;
  return !all.some((t) => t.id !== target.id && isOtpOn(t));
}

export type EnglishCoverage = {
  id: string;
  enabled: boolean;
  smsType: string;
  locale?: unknown;
  country?: unknown;
};

/** An enabled OTP template in `en` (any case, no other tag such as en-GB) with no country: the one that every country falls back to (contract 23.4). */
function servesEveryCountryInEnglish(t: {
  enabled: boolean;
  smsType: string;
  locale?: unknown;
  country?: unknown;
}): boolean {
  const locale = typeof t.locale === 'string' ? t.locale.trim().toLowerCase() : '';
  const country = typeof t.country === 'string' ? t.country.trim() : '';
  return isOtpOn(t) && locale === 'en' && country === '';
}

/**
 * True when `target` is an enabled OTP template in English with no country and no other template is.
 * The page only asks first; the backend refuses while phone sign-in is on or phone-number accounts exist.
 */
export function isLastEnglishFallbackTemplate(
  target: EnglishCoverage,
  all: EnglishCoverage[],
): boolean {
  if (!servesEveryCountryInEnglish(target)) return false;
  return !all.some((t) => t.id !== target.id && servesEveryCountryInEnglish(t));
}

/**
 * True when the edit leaves the template the way the rule needs it (OTP, `en`, no country, still
 * enabled) or when it was not the last such template anyway.
 */
export function keepsEnglishFallback(
  before: EnglishCoverage,
  after: { smsType: string; locale: unknown; country: unknown },
  all: EnglishCoverage[],
): boolean {
  if (!isLastEnglishFallbackTemplate(before, all)) return true;
  return servesEveryCountryInEnglish({ enabled: true, ...after });
}
