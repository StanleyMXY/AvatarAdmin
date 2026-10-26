import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WINDOW_HOURS,
  funnelProblems,
  MAX_STEPS,
  MAX_WINDOW_HOURS,
  MIN_STEPS,
  MIN_WINDOW_HOURS,
  normalizeSteps,
} from './funnelRules';

const names = (count: number) => Array.from({ length: count }, (_, i) => `step_${i}`);

describe('funnel rules (contract 17.4: 2 to 10 steps, window 1 to 720 hours)', () => {
  it('has the limits of the contract and a default window of 24 hours', () => {
    expect([
      MIN_STEPS,
      MAX_STEPS,
      MIN_WINDOW_HOURS,
      MAX_WINDOW_HOURS,
      DEFAULT_WINDOW_HOURS,
    ]).toEqual([2, 10, 1, 720, 24]);
  });

  it('accepts 2 and 10 steps and a window of 1, 24 and 720 hours', () => {
    expect(funnelProblems(names(2), 24)).toEqual([]);
    expect(funnelProblems(names(10), 1)).toEqual([]);
    expect(funnelProblems(names(5), 720)).toEqual([]);
  });

  it('refuses fewer than 2 and more than 10 steps', () => {
    expect(funnelProblems([], 24)).toEqual(['tooFewSteps']);
    expect(funnelProblems(names(1), 24)).toEqual(['tooFewSteps']);
    expect(funnelProblems(names(11), 24)).toEqual(['tooManySteps']);
  });

  it('refuses a window outside 1 to 720, a fraction, and a missing number', () => {
    for (const bad of [0, -1, 721, 1.5, Number.NaN, null]) {
      expect(funnelProblems(names(3), bad), String(bad)).toEqual(['windowInvalid']);
    }
  });

  it('refuses a step with a comma, because the steps travel as one comma-joined parameter', () => {
    expect(funnelProblems(['a', 'b,c'], 24)).toEqual(['commaInStep']);
    expect(funnelProblems(['a,b'], 24)).toContain('commaInStep');
  });

  it('refuses an empty step, also one that is only blanks', () => {
    expect(funnelProblems(['a', '   '], 24)).toEqual(['emptyStep']);
  });

  it('reports every problem at once', () => {
    expect(funnelProblems(['a,b'], 0)).toEqual(['tooFewSteps', 'commaInStep', 'windowInvalid']);
  });

  it('trims the steps by the spec blanks, not by String.trim, and keeps their order', () => {
    const nel = String.fromCharCode(0x85); // trimmed by the contract, kept by String.trim
    const bom = String.fromCharCode(0xfeff); // kept by the contract, trimmed by String.trim
    expect(normalizeSteps([` a ${nel}`, `${nel}b`, `${String.fromCharCode(0x3000)}c`])).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(normalizeSteps([`${bom}d`])).toEqual([`${bom}d`]);
  });
});
