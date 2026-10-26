import type { GuestCohortRow } from '../../../services/stats/types';
import { safeRatio } from '../../../utils/ratio';

type Column = 'd0' | 'd1' | 'd2' | 'd3' | 'd5' | 'd7' | 'd14' | 'd30';

/**
 * The buckets of the conversion delay. Each one is the difference of two neighbouring cumulative
 * columns (`dN` = devices that converted within N days of their first day). A bucket is counted for
 * a cohort only when both of its columns have a value: a column of a day that has not come yet is
 * null, and counting it as 0 would make late conversions look like they never happen.
 */
const BUCKETS: { key: string; end: Column; start: Column | null }[] = [
  { key: 'D0', end: 'd0', start: null },
  { key: 'D1', end: 'd1', start: 'd0' },
  { key: 'D2', end: 'd2', start: 'd1' },
  { key: 'D3', end: 'd3', start: 'd2' },
  { key: 'D4-D5', end: 'd5', start: 'd3' },
  { key: 'D6-D7', end: 'd7', start: 'd5' },
  { key: 'D8-D14', end: 'd14', start: 'd7' },
  { key: 'D15-D30', end: 'd30', start: 'd14' },
];

export const CONVERSION_BUCKET_KEYS = BUCKETS.map((b) => b.key);

const known = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** The devices that converted inside one bucket for one cohort, or null when it is not due. */
function bucketOf(row: GuestCohortRow, end: Column, start: Column | null): number | null {
  const last = row[end];
  if (!known(last)) return null;
  if (start === null) return last;
  const first = row[start];
  // Cumulative counts never fall; if the data says so, the bucket is empty, never negative.
  return known(first) ? Math.max(0, last - first) : null;
}

/**
 * "Conversion delay": the eight buckets (same day, D1, D2, D3, D4-D5, D6-D7, D8-D14, D15-D30)
 * summed over the cohorts. `bucket` is the stable key above; the page writes its label.
 */
export function buildConversionDistribution(
  rows: GuestCohortRow[],
): { bucket: string; devices: number }[] {
  return BUCKETS.map(({ key, end, start }) => ({
    bucket: key,
    devices: rows.reduce((sum, row) => sum + (bucketOf(row, end, start) ?? 0), 0),
  }));
}

const STACK_SEGMENTS: { key: string; end: Column; start: Column | null }[] = [
  { key: 'D0', end: 'd0', start: null },
  { key: 'D1', end: 'd1', start: 'd0' },
  { key: 'D2', end: 'd2', start: 'd1' },
];
const LATER: Column[] = ['d30', 'd14', 'd7', 'd5', 'd3'];

/**
 * One column per cohort in the stacked chart, split into same day, next day, day 2, and day 3 and
 * later. "Day 3 and later" is everything after D2 up to the last column that is due. A segment that
 * is not due is left out (not drawn as 0), and so is a cohort with nothing due.
 */
export function buildConversionStack(
  rows: GuestCohortRow[],
): { cohortDate: string; segment: string; devices: number }[] {
  return rows.flatMap((row) => {
    const segments = STACK_SEGMENTS.flatMap(({ key, end, start }) => {
      const devices = bucketOf(row, end, start);
      return devices === null ? [] : [{ cohortDate: row.cohortDate, segment: key, devices }];
    });
    const lastDue = LATER.find((column) => known(row[column]));
    if (lastDue && known(row.d2) && known(row[lastDue])) {
      segments.push({
        cohortDate: row.cohortDate,
        segment: 'D3-later',
        devices: Math.max(0, (row[lastDue] as number) - row.d2),
      });
    }
    return segments;
  });
}

/**
 * New devices that converted today over devices that appeared today. These are different devices
 * (a device converts on a later day than it appeared), so it is not the rate of one batch and can
 * exceed 100%. No new devices today: no rate (null), never 0.
 */
export function dailyConversionRate(row: {
  guestDevicesNew: number | null;
  guestDevicesConverted: number | null;
}): number | null {
  return safeRatio(row.guestDevicesConverted, row.guestDevicesNew);
}
