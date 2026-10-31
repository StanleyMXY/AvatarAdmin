import { DASH } from '../../utils/ratio';
import type { ChangeKind } from './cardChange';

/** `provisional`: the figure has a day that is not over on one side, so it is not judged (neutral grey). */
export type ChangeView = {
  text: string;
  tone: 'rise' | 'fall' | 'flat' | 'provisional' | 'none';
};

/**
 * A change as the card writes it: "+12.5%" or "-3 pp", rounded to one decimal; a dash when it
 * cannot be told. A change that rounds to 0 is written "0%" and has no colour. When `final` is
 * false (one of the two days is not over) the figure is written the same but its tone is
 * `provisional`, never rise or fall: it is not good or bad news yet.
 */
export function describeChange(
  value: number | null,
  kind: ChangeKind,
  locale: string,
  pointUnit: string,
  final: boolean,
): ChangeView {
  if (value === null || !Number.isFinite(value)) return { text: DASH, tone: 'none' };
  const rounded = Math.round(value * 10) / 10 + 0;
  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(rounded);
  return {
    text: kind === 'points' ? `${number} ${pointUnit}` : `${number}%`,
    tone: !final ? 'provisional' : rounded > 0 ? 'rise' : rounded < 0 ? 'fall' : 'flat',
  };
}
