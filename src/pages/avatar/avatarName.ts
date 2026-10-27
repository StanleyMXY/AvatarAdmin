import { countCodePoints } from '../../utils/codePoints';
import { trimSpec } from '../../utils/trimSpec';

/** Contract 2.5.1: a name is 1 to 30 code points once the ends are trimmed. */
export const NAME_MAX = 30;

export type NameProblem = 'EMPTY' | 'TOO_LONG' | 'FORBIDDEN_CHARACTER';

// Control characters (category Cc) and the bidirectional override and isolate characters can make a
// name look like something else on screen. U+200C and U+200D belong to Arabic, Persian and Indic
// scripts and stay allowed.
const BIDI_CONTROLS = [
  [0x202a, 0x202e],
  [0x2066, 0x2069],
]
  .map(([from, to]) => `${String.fromCharCode(from)}-${String.fromCharCode(to)}`)
  .join('');
const FORBIDDEN = new RegExp(`[\\p{Cc}${BIDI_CONTROLS}]`, 'u');

/** The problem with a name as the contract's rule sees it, or `null` when the name is acceptable. */
export function nameProblem(value: string | undefined): NameProblem | null {
  const name = trimSpec(value ?? '');
  const length = countCodePoints(name);
  if (length === 0) return 'EMPTY';
  if (length > NAME_MAX) return 'TOO_LONG';
  if (FORBIDDEN.test(name)) return 'FORBIDDEN_CHARACTER';
  return null;
}
