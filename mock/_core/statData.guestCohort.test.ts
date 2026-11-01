import { describe, expect, it } from 'vitest';
import { guestCohortRow } from './statData';

const DAYS = ['d0', 'd1', 'd2', 'd3', 'd5', 'd7', 'd14', 'd30'] as const;

describe('the fake guest cohorts', () => {
  it('count devices converted within N days, so no cell is below the one before it and a cell not due is empty', () => {
    const today = '2026-10-26';
    for (let offset = 1; offset <= 60; offset += 1) {
      const date = new Date(Date.UTC(2026, 9, 26 - offset)).toISOString().slice(0, 10);
      const row = guestCohortRow(date, today) as unknown as Record<string, number | null>;
      let before = 0;
      let due = true;
      for (const key of DAYS) {
        const value = row[key];
        if (value === null) {
          due = false;
          continue;
        }
        expect(due, `${date} ${key} is filled after a cell that is not due`).toBe(true);
        expect(value, `${date} ${key}`).toBeGreaterThanOrEqual(before);
        before = value;
      }
    }
  });
});
