import { trimSpec } from '../../utils/trimSpec';

// What a funnel may be asked with (contract 17.4): 2 to 10 event names, a window of 1 to 720 hours,
// and no comma in a name because the names travel as one comma-joined value.
export const MIN_STEPS = 2;
export const MAX_STEPS = 10;
export const MIN_WINDOW_HOURS = 1;
export const MAX_WINDOW_HOURS = 720;
export const DEFAULT_WINDOW_HOURS = 24;

export type FunnelProblem =
  | 'tooFewSteps'
  | 'tooManySteps'
  | 'commaInStep'
  | 'emptyStep'
  | 'windowInvalid';

/** The steps as they are sent: each one trimmed by the blanks of contract 1.9, in the order given. */
export const normalizeSteps = (steps: readonly string[]): string[] =>
  steps.map((step) => trimSpec(step));

/** Every reason the funnel cannot be asked; empty when it can. */
export function funnelProblems(
  rawSteps: readonly string[],
  windowHours: number | null | undefined,
): FunnelProblem[] {
  const steps = normalizeSteps(rawSteps);
  const problems: FunnelProblem[] = [];
  if (steps.length < MIN_STEPS) problems.push('tooFewSteps');
  if (steps.length > MAX_STEPS) problems.push('tooManySteps');
  if (steps.some((step) => step.includes(','))) problems.push('commaInStep');
  if (steps.some((step) => step === '')) problems.push('emptyStep');
  if (
    typeof windowHours !== 'number' ||
    !Number.isInteger(windowHours) ||
    windowHours < MIN_WINDOW_HOURS ||
    windowHours > MAX_WINDOW_HOURS
  ) {
    problems.push('windowInvalid');
  }
  return problems;
}
