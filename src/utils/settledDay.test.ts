import { describe, expect, it } from 'vitest';
import { changeIsFinal, hasProvisionalDay, isProvisionalDay, isSettledDay } from './settledDay';
import { todayUtc } from './utcDay';

const TODAY = '2026-10-26';

describe('isSettledDay: a day is complete when its UTC date is before the UTC date of today', () => {
  it('counts yesterday and older days as complete and today as not', () => {
    expect(isSettledDay('2026-10-25', TODAY)).toBe(true);
    expect(isSettledDay('2026-01-01', TODAY)).toBe(true);
    expect(isSettledDay(TODAY, TODAY)).toBe(false);
  });

  it('does not count a day after today as complete', () => {
    expect(isSettledDay('2026-10-27', TODAY)).toBe(false);
  });

  it('crosses month and year ends by calendar days, not by string order of parts', () => {
    expect(isSettledDay('2025-12-31', '2026-01-01')).toBe(true);
    expect(isSettledDay('2026-01-01', '2026-01-01')).toBe(false);
    expect(isSettledDay('2026-02-28', '2026-03-01')).toBe(true);
    expect(isSettledDay('2024-02-29', '2024-03-01')).toBe(true);
  });

  it('waits `lagDays` more days for a figure that is counted on the days after it', () => {
    // D1 of the cohort of 10-25 is counted during 10-26, so it is still being counted that day.
    expect(isSettledDay('2026-10-25', TODAY, 1)).toBe(false);
    expect(isSettledDay('2026-10-24', TODAY, 1)).toBe(true);
  });

  it('is false for text that is not a real calendar day, never an exception', () => {
    for (const bad of [
      '',
      '2026-13-01',
      '2026-02-30',
      '26-10-25',
      'yesterday',
      '2026-10-25T00:00:00Z',
    ]) {
      expect(isSettledDay(bad, TODAY), bad).toBe(false);
      expect(isSettledDay(TODAY, bad), bad).toBe(false);
    }
  });

  it('reads the UTC date of the clock, not the date of the browser', () => {
    // 2026-10-26 23:30 UTC is already the 27th in Asia/Bangkok; the statistics day is still the 26th.
    expect(todayUtc(new Date('2026-10-26T23:30:00Z'))).toBe('2026-10-26');
    expect(isSettledDay('2026-10-26', todayUtc(new Date('2026-10-26T23:30:00Z')))).toBe(false);
    expect(isSettledDay('2026-10-26', todayUtc(new Date('2026-10-27T00:00:00Z')))).toBe(true);
  });
});

describe('isProvisionalDay: today (or a day still being counted), never a future or a bad day', () => {
  it('is true for today and false for complete days', () => {
    expect(isProvisionalDay(TODAY, TODAY)).toBe(true);
    expect(isProvisionalDay('2026-10-25', TODAY)).toBe(false);
  });

  it('is false for a day after today: nothing is counted for it yet, it is not a provisional value', () => {
    expect(isProvisionalDay('2026-10-27', TODAY)).toBe(false);
  });

  it('follows the lag: with one day of lag, yesterday and today are provisional', () => {
    expect(isProvisionalDay('2026-10-25', TODAY, 1)).toBe(true);
    expect(isProvisionalDay(TODAY, TODAY, 1)).toBe(true);
    expect(isProvisionalDay('2026-10-24', TODAY, 1)).toBe(false);
  });

  it('is false for text that is not a day', () => {
    expect(isProvisionalDay('nope', TODAY)).toBe(false);
    expect(isProvisionalDay(TODAY, 'nope')).toBe(false);
  });
});

describe('changeIsFinal: a rise or fall may be judged only when both days are complete', () => {
  it('is true when both days are complete', () => {
    expect(changeIsFinal('2026-10-25', '2026-10-24', TODAY)).toBe(true);
  });

  it('is false when the day asked for is today', () => {
    expect(changeIsFinal(TODAY, '2026-10-25', TODAY)).toBe(false);
    expect(changeIsFinal(TODAY, '2026-10-19', TODAY)).toBe(false);
  });

  it('is false when the earlier day is not complete either', () => {
    expect(changeIsFinal('2026-10-25', TODAY, TODAY)).toBe(false);
  });

  it('applies the lag to both days', () => {
    expect(changeIsFinal('2026-10-25', '2026-10-24', TODAY, 1)).toBe(false);
    expect(changeIsFinal('2026-10-24', '2026-10-23', TODAY, 1)).toBe(true);
  });
});

describe('hasProvisionalDay', () => {
  it('is true when any of the days is provisional', () => {
    expect(hasProvisionalDay(['2026-10-24', TODAY], TODAY)).toBe(true);
  });
  it('is false for complete days only and for no days', () => {
    expect(hasProvisionalDay(['2026-10-24', '2026-10-25'], TODAY)).toBe(false);
    expect(hasProvisionalDay([], TODAY)).toBe(false);
  });
});
