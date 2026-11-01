import { afterEach, describe, expect, it } from 'vitest';
import { resetConfigStore, saved } from './configStore';
import type { MockHttpError, MockReq } from './http';
import { addDays } from './statData';
import { rangeOf } from './statRange';

const req = (query: Record<string, unknown>): MockReq => ({
  headers: {},
  query,
  params: {},
  body: undefined,
});

const NOW = new Date('2026-10-26T12:00:00Z');
const ask = (days: number) =>
  rangeOf(req({ from: addDays('2026-10-26', -(days - 1)), to: '2026-10-26' }), NOW);
const refusal = (days: number): MockHttpError | undefined => {
  try {
    ask(days);
  } catch (error) {
    return error as MockHttpError;
  }
  return undefined;
};

afterEach(() => resetConfigStore());

describe('the longest range a report may ask for (stats.max_range_days, both ends counted)', () => {
  it('lets exactly the limit through (366 days by default) and refuses one day more, naming `to`', () => {
    expect(refusal(366)).toBeUndefined();
    const error = refusal(367);
    expect(error?.httpStatus).toBe(400);
    expect(error?.code).toBe('INVALID_REQUEST');
    expect(error?.data).toMatchObject({ details: [{ ref: 'to', reason: 'OUT_OF_RANGE' }] });
  });

  it('follows the configuration: after the key is saved with another value that value is the limit', () => {
    saved.set('stats.max_range_days', {
      value: 7,
      updatedAt: 'x',
      updatedBy: '1',
      updatedByUsername: 'root',
    });
    expect(refusal(7)).toBeUndefined();
    expect(refusal(8)?.code).toBe('INVALID_REQUEST');
    saved.set('stats.max_range_days', {
      value: 400,
      updatedAt: 'x',
      updatedBy: '1',
      updatedByUsername: 'root',
    });
    expect(refusal(400)).toBeUndefined();
    expect(refusal(401)?.code).toBe('INVALID_REQUEST');
  });

  it('is the default again after the key is reset', () => {
    saved.set('stats.max_range_days', {
      value: 7,
      updatedAt: 'x',
      updatedBy: '1',
      updatedByUsername: 'root',
    });
    saved.delete('stats.max_range_days');
    expect(refusal(366)).toBeUndefined();
  });
});
