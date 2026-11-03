import type { AdminMeta } from '../services/auth';

/** What the pipeline monitor allowed before `GET /meta` told it (`monitor.max_range_days` default). */
export const DEFAULT_MONITOR_MAX_RANGE_DAYS = 7;

const wholeAbove0 = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

/** `monitor.max_range_days` in force; the earlier fixed value when `GET /meta` has none that can be right. */
export const monitorMaxRangeDaysOf = (meta: Partial<AdminMeta>): number =>
  wholeAbove0(meta.monitorMaxRangeDays) ? meta.monitorMaxRangeDays : DEFAULT_MONITOR_MAX_RANGE_DAYS;

/**
 * The daily-task types the backend declares, as text, each once and in its order; `fallback` (what
 * the page held before) when `GET /meta` has no list with a usable entry.
 */
export function taskTypesOf(meta: Partial<AdminMeta>, fallback: readonly string[]): string[] {
  const listed = Array.isArray(meta.taskTypes) ? meta.taskTypes : [];
  const types = [
    ...new Set(listed.filter((t): t is string => typeof t === 'string' && t.trim() !== '')),
  ];
  return types.length > 0 ? types : [...fallback];
}

/** `entitlement.limit_max` in force, or undefined when `GET /meta` has none that can be right (then the upper end is left to the backend). */
export const entitlementLimitMaxOf = (meta: Partial<AdminMeta>): number | undefined =>
  wholeAbove0(meta.entitlementLimitMax) ? meta.entitlementLimitMax : undefined;
