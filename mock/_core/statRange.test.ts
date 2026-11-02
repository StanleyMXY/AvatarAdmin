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

// Contract 17.6: every statistics endpoint reads the range the same way. With one date given the
// other is six days away from it, and never later than today; with none, the last 7 days.
describe('the range of a query with one date, or none, or a wrong one (contract 17.6)', () => {
  const read = (query: Record<string, unknown>) => rangeOf(req(query), NOW);
  const refusal = (query: Record<string, unknown>): MockHttpError | undefined => {
    try {
      read(query);
    } catch (error) {
      return error as MockHttpError;
    }
    return undefined;
  };

  it('takes the last 7 days to today when no date is given', () => {
    expect(read({})).toEqual({ from: '2026-10-20', to: '2026-10-26', today: '2026-10-26' });
  });

  it('takes the day six days after a `from` given alone', () => {
    expect(read({ from: '2026-10-01' })).toMatchObject({ from: '2026-10-01', to: '2026-10-07' });
  });

  it('takes the day six days before a `to` given alone', () => {
    expect(read({ to: '2026-10-10' })).toMatchObject({ from: '2026-10-04', to: '2026-10-10' });
  });

  it('stops at today when `from` given alone is closer than six days to it', () => {
    expect(read({ from: '2026-10-24' })).toMatchObject({ from: '2026-10-24', to: '2026-10-26' });
    expect(read({ from: '2026-10-26' })).toMatchObject({ from: '2026-10-26', to: '2026-10-26' });
  });

  it('names `from` ("from is after to") when `from` given alone is after today, because the end stops at today', () => {
    const error = refusal({ from: '2026-10-28' });
    expect(error?.httpStatus).toBe(400);
    expect(error?.code).toBe('INVALID_REQUEST');
    expect(error?.message).toBe('from is after to');
    expect(error?.data).toMatchObject({ details: [{ ref: 'from', reason: 'OUT_OF_RANGE' }] });
  });

  it('does not move a `to` given alone that is after today, and keeps its start six days before it', () => {
    expect(read({ to: '2026-10-28' })).toMatchObject({ from: '2026-10-22', to: '2026-10-28' });
  });

  it('keeps a start of year 1 at the first day when six days before `to` would be year 0', () => {
    expect(read({ to: '0001-01-03' })).toMatchObject({ from: '0001-01-01', to: '0001-01-03' });
  });

  it('keeps a `from` of the last day of year 9999 given alone, and refuses it as after today', () => {
    expect(refusal({ from: '9999-12-31' })?.data).toMatchObject({
      details: [{ ref: 'from', reason: 'OUT_OF_RANGE' }],
    });
  });

  it('treats an empty value as not given', () => {
    expect(read({ from: '', to: '2026-10-10' })).toMatchObject({ from: '2026-10-04' });
    expect(read({ from: '2026-10-01', to: '' })).toMatchObject({ to: '2026-10-07' });
  });

  it.each([
    ['from', { from: '2026-13-01' }],
    ['from', { from: '2026-02-30' }],
    ['from', { from: '0000-01-01' }],
    ['to', { to: '26-10-01' }],
    ['to', { from: '2026-10-01', to: '2026-10-01T00:00:00Z' }],
  ])(
    'names `%s` as OUT_OF_RANGE ("<ref> must be YYYY-MM-DD") when it is not a day',
    (ref, query) => {
      const error = refusal(query);
      expect(error?.httpStatus).toBe(400);
      expect(error?.message).toBe(`${ref} must be YYYY-MM-DD`);
      expect(error?.data).toMatchObject({ details: [{ ref, reason: 'OUT_OF_RANGE' }] });
    },
  );

  it('checks the format of `from` before that of `to`, and both before the order and the length', () => {
    expect(refusal({ from: 'x', to: 'y' })?.data).toMatchObject({ details: [{ ref: 'from' }] });
    expect(refusal({ from: '2026-10-20', to: 'y' })?.data).toMatchObject({
      details: [{ ref: 'to' }],
    });
  });

  it('names `from` for a reversed range and `to` for one over the limit; the reversed one first', () => {
    expect(refusal({ from: '2026-10-20', to: '2026-10-10' })?.message).toBe('from is after to');
    expect(refusal({ from: '2020-01-01', to: '2026-10-01' })?.message).toBe(
      'The range exceeds stats.max_range_days',
    );
    saved.set('stats.max_range_days', {
      value: 5,
      updatedAt: 'x',
      updatedBy: '1',
      updatedByUsername: 'root',
    });
    // 7 days is the default range, and a limit of 5 refuses it: the page has to ask for less.
    expect(refusal({})?.data).toMatchObject({ details: [{ ref: 'to', reason: 'OUT_OF_RANGE' }] });
    // one date alone is six days away from the other (7 days with both counted): over a limit of 5 too
    expect(refusal({ from: '2026-10-01' })?.data).toMatchObject({
      details: [{ ref: 'to', reason: 'OUT_OF_RANGE' }],
    });
  });
});
