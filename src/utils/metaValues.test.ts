import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MONITOR_MAX_RANGE_DAYS,
  entitlementLimitMaxOf,
  monitorMaxRangeDaysOf,
  taskTypesOf,
} from './metaValues';

describe('the pipeline monitor range from GET /meta', () => {
  it('is the value of the backend when it is a whole number of days above 0', () => {
    expect(monitorMaxRangeDaysOf({ monitorMaxRangeDays: 3 })).toBe(3);
    expect(monitorMaxRangeDaysOf({ monitorMaxRangeDays: 30 })).toBe(30);
  });

  it('is 7 (the value this page held before) when meta could not be read or the value cannot be right', () => {
    expect(DEFAULT_MONITOR_MAX_RANGE_DAYS).toBe(7);
    for (const meta of [
      {},
      { monitorMaxRangeDays: 0 },
      { monitorMaxRangeDays: -1 },
      { monitorMaxRangeDays: 1.5 },
      { monitorMaxRangeDays: '7' },
      { monitorMaxRangeDays: null },
      { monitorMaxRangeDays: Number.NaN },
    ]) {
      expect(monitorMaxRangeDaysOf(meta as never), JSON.stringify(meta)).toBe(7);
    }
  });
});

describe('the task types from GET /meta', () => {
  const FALLBACK = ['daily_login', 'call_seconds', 'text_messages'] as const;

  it('are the list of the backend, in its order, as text (a type this app has no label for stays in)', () => {
    expect(taskTypesOf({ taskTypes: ['text_messages', 'ประกาศ', 'share_app'] }, FALLBACK)).toEqual([
      'text_messages',
      'ประกาศ',
      'share_app',
    ]);
  });

  it('keep only texts that are not empty, each once', () => {
    expect(
      taskTypesOf({ taskTypes: ['a', '', 'a', 5, null, '  ', 'b'] as never }, FALLBACK),
    ).toEqual(['a', 'b']);
  });

  it('are the three the page held before when meta could not be read or the list has nothing usable', () => {
    for (const meta of [
      {},
      { taskTypes: [] },
      { taskTypes: 'daily_login' },
      { taskTypes: [1, ''] },
    ]) {
      expect(taskTypesOf(meta as never, FALLBACK), JSON.stringify(meta)).toEqual([...FALLBACK]);
    }
  });
});

describe('the entitlement limit from GET /meta', () => {
  it('is the value of the backend when it is a whole number above 0, else nothing (the page then checks no upper end)', () => {
    expect(entitlementLimitMaxOf({ entitlementLimitMax: 1000000 })).toBe(1000000);
    expect(entitlementLimitMaxOf({ entitlementLimitMax: 50 })).toBe(50);
    for (const meta of [
      {},
      { entitlementLimitMax: 0 },
      { entitlementLimitMax: -5 },
      { entitlementLimitMax: 2.5 },
      { entitlementLimitMax: '50' },
      { entitlementLimitMax: null },
    ]) {
      expect(entitlementLimitMaxOf(meta as never), JSON.stringify(meta)).toBeUndefined();
    }
  });
});
