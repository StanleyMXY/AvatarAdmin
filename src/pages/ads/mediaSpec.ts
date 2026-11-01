// What the page says about a file against the spec of a placement (contract 22.2 and 22.9). The
// server decides; this tells the person why a file would be refused before the form is sent.
import { formatBytesPair } from '../../utils/format';

/** `ads.creative_aspect_tolerance_percent` when it cannot be read (contract 22.2). */
export const DEFAULT_TOLERANCE_PERCENT = 3;

export type MediaFacts = {
  width: number | null | undefined;
  height: number | null | undefined;
  bytes: number | null | undefined;
};

export type SpecFacts = {
  creativeAspect?: string | null;
  creativeMinShortSide?: number | null;
  creativeMaxBytes?: number | null;
};

export type SpecProblem = {
  code: 'ratio' | 'shortSide' | 'bytes';
  /** The numbers for the sentence of the language file. */
  values: Record<string, string | number>;
};

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** `1080 x 1920` as `9:16`; a ratio that is not whole numbers small enough to read is written to two places. */
function ratioText(width: number, height: number): string {
  const d = gcd(width, height);
  const [w, h] = [width / d, height / d];
  return w <= 100 && h <= 100 ? `${w}:${h}` : `${(width / height).toFixed(2)}:1`;
}

/**
 * Checks the file against the spec: the ratio within the tolerance (relative to the ratio of the
 * spec), the shorter side at least the minimum, the size at most the maximum. What the spec or the
 * file does not give is not checked. The problems are in the order ratio, shorter side, size.
 */
export function checkMediaSpec(
  media: MediaFacts,
  spec: SpecFacts,
  tolerancePercent: number | null | undefined,
): { fits: boolean; problems: SpecProblem[] } {
  const percent =
    typeof tolerancePercent === 'number' && Number.isFinite(tolerancePercent)
      ? tolerancePercent
      : DEFAULT_TOLERANCE_PERCENT;
  const problems: SpecProblem[] = [];
  const { width, height, bytes } = media;

  const wanted = /^(\d+):(\d+)$/.exec(spec.creativeAspect ?? '');
  if (wanted && isCount(width) && isCount(height)) {
    const target = Number(wanted[1]) / Number(wanted[2]);
    const actual = width / height;
    if (
      Number.isFinite(target) &&
      target > 0 &&
      Math.abs(actual - target) / target > percent / 100
    ) {
      problems.push({
        code: 'ratio',
        values: {
          actual: ratioText(width, height),
          wanted: spec.creativeAspect as string,
          percent,
        },
      });
    }
  }
  if (isCount(spec.creativeMinShortSide) && isCount(width) && isCount(height)) {
    const shorter = Math.min(width, height);
    if (shorter < spec.creativeMinShortSide) {
      problems.push({
        code: 'shortSide',
        values: { actual: shorter, wanted: spec.creativeMinShortSide },
      });
    }
  }
  if (
    isCount(spec.creativeMaxBytes) &&
    typeof bytes === 'number' &&
    bytes > spec.creativeMaxBytes
  ) {
    problems.push({ code: 'bytes', values: { actual: bytes, wanted: spec.creativeMaxBytes } });
  }
  return { fits: problems.length === 0, problems };
}

/** The file size and the limit of a `bytes` problem as text; two different sizes never read the same. */
export function bytesProblemTexts(
  values: SpecProblem['values'],
  locale: string,
): { actual: string; wanted: string } {
  const [actual, wanted] = formatBytesPair(Number(values.actual), Number(values.wanted), locale);
  return { actual, wanted };
}
