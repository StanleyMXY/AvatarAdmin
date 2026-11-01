import { describe, expect, it } from 'vitest';
import { bytesProblemTexts, checkMediaSpec, DEFAULT_TOLERANCE_PERCENT } from './mediaSpec';

const SPEC = { creativeAspect: '9:16', creativeMinShortSide: 720, creativeMaxBytes: 10_485_760 };
const media = (width: number, height: number, bytes = 1000) => ({ width, height, bytes });

describe('checkMediaSpec', () => {
  it('passes a file that fits the ratio, the shorter side and the size', () => {
    expect(checkMediaSpec(media(1080, 1920), SPEC, 3)).toEqual({ fits: true, problems: [] });
  });

  it('allows a ratio that is within the tolerance, relative to the ratio of the spec, and refuses one that is not', () => {
    // 1080 x 1940 is 1.03% off 9:16
    expect(checkMediaSpec(media(1080, 1940), SPEC, 3).fits).toBe(true);
    expect(checkMediaSpec(media(1080, 1940), SPEC, 1).fits).toBe(false);
    const wide = checkMediaSpec(media(1280, 720), SPEC, 3);
    expect(wide.fits).toBe(false);
    expect(wide.problems.map((p) => p.code)).toEqual(['ratio']);
    expect(wide.problems[0].values).toMatchObject({ actual: '16:9', wanted: '9:16', percent: 3 });
  });

  it('refuses a file whose shorter side is below the minimum, in either orientation', () => {
    expect(checkMediaSpec(media(600, 1067), SPEC, 3).problems.map((p) => p.code)).toEqual([
      'shortSide',
    ]);
    expect(
      checkMediaSpec(media(1067, 600), { ...SPEC, creativeAspect: '16:9' }, 3).problems.map(
        (p) => p.code,
      ),
    ).toEqual(['shortSide']);
    expect(checkMediaSpec(media(720, 1280), SPEC, 3).fits).toBe(true);
  });

  it('refuses a file that is larger than the maximum, and takes one of exactly the maximum', () => {
    const big = checkMediaSpec(media(1080, 1920, 10_485_761), SPEC, 3);
    expect(big.problems.map((p) => p.code)).toEqual(['bytes']);
    expect(checkMediaSpec(media(1080, 1920, 10_485_760), SPEC, 3).fits).toBe(true);
  });

  it('reports every problem there is, in the order ratio, shorter side, size', () => {
    const all = checkMediaSpec(media(500, 500, 99_999_999), SPEC, 3);
    expect(all.problems.map((p) => p.code)).toEqual(['ratio', 'shortSide', 'bytes']);
  });

  it('does not check what the spec or the file does not say, and never says "fits" for a file with no size', () => {
    expect(checkMediaSpec(media(1080, 1920), {}, 3)).toEqual({ fits: true, problems: [] });
    expect(
      checkMediaSpec(
        media(1080, 1920),
        { creativeAspect: 'x', creativeMinShortSide: null, creativeMaxBytes: null },
        3,
      ),
    ).toEqual({ fits: true, problems: [] });
    expect(checkMediaSpec({ width: null, height: null, bytes: null }, SPEC, 3)).toEqual({
      fits: true,
      problems: [],
    });
    expect(checkMediaSpec(media(0, 0), SPEC, 3).fits).toBe(true);
  });

  it('takes a tolerance that is not a number as the default of the contract', () => {
    expect(DEFAULT_TOLERANCE_PERCENT).toBe(3);
    expect(checkMediaSpec(media(1080, 1940), SPEC, null).fits).toBe(true);
    expect(checkMediaSpec(media(1080, 1940), SPEC, Number.NaN).fits).toBe(true);
    expect(checkMediaSpec(media(1080, 2200), SPEC, null).fits).toBe(false);
  });
});

describe('bytesProblemTexts', () => {
  it('writes the size of the file and the limit in the language of the page', () => {
    expect(bytesProblemTexts({ actual: 12_582_912, wanted: 10_485_760 }, 'en-US')).toEqual({
      actual: '12 MB',
      wanted: '10 MB',
    });
  });

  it('does not write a file that is one byte over the limit with the same text as the limit', () => {
    const texts = bytesProblemTexts({ actual: 10_485_761, wanted: 10_485_760 }, 'en-US');
    expect(texts.actual).not.toBe(texts.wanted);
    expect(texts).toEqual({ actual: '10,485,761 B', wanted: '10,485,760 B' });
  });
});
