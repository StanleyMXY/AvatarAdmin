/** The two bounds of a band, in tokens of the input length; both ends are included. `null` upper bound = no limit. */
export type BandBounds = { inputMinTokens: number | null; inputMaxTokens: number | null };

export type BandsVerdict = { ok: true } | { ok: false; reasonKey: string };

const isBound = (n: number) => Number.isSafeInteger(n) && n >= 0;

/**
 * The rules of contract 14.2 for the bands of an LLM price, checked band by band from the first: every
 * bound is a whole number, the first band starts at 0, the next one starts one above the end of the
 * one before (a larger start is a gap, a smaller or equal one an overlap), and only the last band
 * has no upper bound. The bands are checked in the order given, they are not sorted. The first
 * problem found comes back as a language key (`cost.bands.*`); the backend checks again.
 */
export function validateBands(bands: readonly BandBounds[]): BandsVerdict {
  const fail = (reasonKey: string): BandsVerdict => ({ ok: false, reasonKey });
  if (bands.length === 0) return fail('cost.bands.empty');

  const last = bands.length - 1;
  for (let i = 0; i <= last; i += 1) {
    const { inputMinTokens: min, inputMaxTokens: max } = bands[i];
    if (min === null) return fail('cost.bands.minMissing');
    if (!isBound(min) || (max !== null && !isBound(max))) return fail('cost.bands.notInteger');
    if (i === 0 && min !== 0) return fail('cost.bands.firstNotZero');
    if (i > 0) {
      // The band before has an upper bound: it was checked on the way here.
      const startsAt = (bands[i - 1].inputMaxTokens as number) + 1;
      if (min > startsAt) return fail('cost.bands.gap');
      if (min < startsAt) return fail('cost.bands.overlap');
    }
    if (i === last) return max === null ? { ok: true } : fail('cost.bands.lastHasMax');
    if (max === null) return fail('cost.bands.middleOpen');
    if (max < min) return fail('cost.bands.maxBelowMin');
  }
  return { ok: true };
}
