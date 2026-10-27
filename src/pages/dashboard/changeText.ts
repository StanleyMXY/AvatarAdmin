import { DASH } from '../../utils/ratio';
import type { ChangeKind } from './cardChange';

export type ChangeView = { text: string; tone: 'rise' | 'fall' | 'flat' | 'none' };

/**
 * A change as the card writes it: "+12.5%" or "-3 pp", rounded to one decimal; a dash when it
 * cannot be told. A change that rounds to 0 is written "0%" and has no colour.
 */
export function describeChange(
  value: number | null,
  kind: ChangeKind,
  locale: string,
  pointUnit: string,
): ChangeView {
  if (value === null || !Number.isFinite(value)) return { text: DASH, tone: 'none' };
  const rounded = Math.round(value * 10) / 10 + 0;
  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(rounded);
  return {
    text: kind === 'points' ? `${number} ${pointUnit}` : `${number}%`,
    tone: rounded > 0 ? 'rise' : rounded < 0 ? 'fall' : 'flat',
  };
}
