import { describe, expect, it } from 'vitest';
import { validateBands } from './validateBands';

const band = (min: number | null, max: number | null) => ({
  inputMinTokens: min,
  inputMaxTokens: max,
});

describe('validateBands (contract 14.2: the first band starts at 0, the next starts one above the end of the one before, the last has no upper bound)', () => {
  it('accepts one band that starts at 0 and has no upper bound', () => {
    expect(validateBands([band(0, null)])).toEqual({ ok: true });
  });

  it('accepts several bands that join without a gap or an overlap', () => {
    expect(validateBands([band(0, 32000), band(32001, 128000), band(128001, null)])).toEqual({
      ok: true,
    });
  });

  it('accepts a band of one token', () => {
    expect(validateBands([band(0, 0), band(1, null)])).toEqual({ ok: true });
  });

  it('refuses no band at all', () => {
    expect(validateBands([])).toEqual({ ok: false, reasonKey: 'cost.bands.empty' });
  });

  it('first band: refuses a lower bound that is not 0 (1 and 5), accepts 0', () => {
    expect(validateBands([band(1, null)])).toEqual({
      ok: false,
      reasonKey: 'cost.bands.firstNotZero',
    });
    expect(validateBands([band(5, 10), band(11, null)])).toEqual({
      ok: false,
      reasonKey: 'cost.bands.firstNotZero',
    });
    expect(validateBands([band(0, 10), band(11, null)]).ok).toBe(true);
  });

  it('gap: refuses a next lower bound above the previous upper bound plus one', () => {
    expect(validateBands([band(0, 100), band(102, null)])).toEqual({
      ok: false,
      reasonKey: 'cost.bands.gap',
    });
    expect(validateBands([band(0, 100), band(101, null)]).ok).toBe(true);
  });

  it('overlap: refuses a next lower bound at or below the previous upper bound', () => {
    expect(validateBands([band(0, 100), band(100, null)])).toEqual({
      ok: false,
      reasonKey: 'cost.bands.overlap',
    });
    expect(validateBands([band(0, 100), band(50, null)])).toEqual({
      ok: false,
      reasonKey: 'cost.bands.overlap',
    });
    expect(validateBands([band(0, 100), band(101, null)]).ok).toBe(true);
  });

  it('last band: refuses an upper bound, accepts none', () => {
    expect(validateBands([band(0, 100)])).toEqual({
      ok: false,
      reasonKey: 'cost.bands.lastHasMax',
    });
    expect(validateBands([band(0, 100), band(101, 200)])).toEqual({
      ok: false,
      reasonKey: 'cost.bands.lastHasMax',
    });
    expect(validateBands([band(0, 100), band(101, null)]).ok).toBe(true);
  });

  it('a band before the last one needs an upper bound', () => {
    expect(validateBands([band(0, null), band(101, null)])).toEqual({
      ok: false,
      reasonKey: 'cost.bands.middleOpen',
    });
  });

  it('an upper bound below the lower bound of the same band is refused', () => {
    expect(validateBands([band(0, 100), band(101, 50), band(51, null)])).toEqual({
      ok: false,
      reasonKey: 'cost.bands.maxBelowMin',
    });
  });

  it('bounds are integers: refuses a fraction, a negative number, NaN, and a number past the safe integers', () => {
    expect(validateBands([band(0, 10.5), band(11, null)])).toEqual({
      ok: false,
      reasonKey: 'cost.bands.notInteger',
    });
    expect(validateBands([band(0, 10), band(10.5, null)])).toEqual({
      ok: false,
      reasonKey: 'cost.bands.notInteger',
    });
    expect(validateBands([band(-1, null)])).toEqual({
      ok: false,
      reasonKey: 'cost.bands.notInteger',
    });
    expect(validateBands([band(0, Number.NaN), band(1, null)])).toEqual({
      ok: false,
      reasonKey: 'cost.bands.notInteger',
    });
    expect(validateBands([band(0, 2 ** 53), band(2 ** 53 + 1, null)])).toEqual({
      ok: false,
      reasonKey: 'cost.bands.notInteger',
    });
    expect(validateBands([band(0, 10), band(11, null)]).ok).toBe(true);
  });

  it('a lower bound that is not filled in is refused', () => {
    expect(validateBands([band(0, 10), band(null, null)])).toEqual({
      ok: false,
      reasonKey: 'cost.bands.minMissing',
    });
    expect(validateBands([band(null, null)])).toEqual({
      ok: false,
      reasonKey: 'cost.bands.minMissing',
    });
  });

  it('does not sort: bands out of order are an overlap', () => {
    expect(validateBands([band(0, 100), band(101, 200), band(201, null)]).ok).toBe(true);
    expect(validateBands([band(101, 200), band(0, 100), band(201, null)]).ok).toBe(false);
  });
});
