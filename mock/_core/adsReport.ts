// The numbers of the ad report endpoints of the mock backend (contract 22.8, 22.9). Every number
// comes from one function of (creative, day, country, platform, channel), and every table is the sum
// of those, so the totals, the days and the four tables agree with one another. The day that is not
// over yet has no numbers: the summary is landed after the day ends.

import { NO_FILL_REASONS } from '../../src/services/ads/types';
import { adsState, type MockCreative } from './adsData';
import { between, todayOf, unit } from './statData';

export const COUNTRIES = ['', 'TH', 'ID', 'VN', 'ES', 'US', 'SA'] as const;
const SHARE: Record<string, number> = {
  '': 0.1,
  TH: 0.3,
  ID: 0.25,
  VN: 0.15,
  ES: 0.08,
  US: 0.07,
  SA: 0.05,
};

export type Filter = { platform: string | null; channel: string | null };

const platformFactor = (platform: string | null) =>
  platform === 'ANDROID' ? 0.6 : platform === 'IOS' ? 0.4 : 1;
const channelFactor = (channel: string | null) =>
  channel === null ? 1 : channel === 'unknown' ? 0.05 : 0.3 + unit('ads-channel', channel) * 0.4;
export const scaleOf = (filter: Filter): number =>
  platformFactor(filter.platform) * channelFactor(filter.channel);

const ZERO = (): Record<CountName, number> => ({
  impressions: 0,
  guestImpressions: 0,
  starts: 0,
  viewableImpressions: 0,
  nonViewableImpressions: 0,
  undeterminedImpressions: 0,
  clicks: 0,
  completions: 0,
  skips: 0,
  errors: 0,
  totalWatchSeconds: 0,
});

export type CountName =
  | 'impressions'
  | 'guestImpressions'
  | 'starts'
  | 'viewableImpressions'
  | 'nonViewableImpressions'
  | 'undeterminedImpressions'
  | 'clicks'
  | 'completions'
  | 'skips'
  | 'errors'
  | 'totalWatchSeconds';

export type CountRow = Record<CountName, number>;

export const emptyCounts = ZERO;

/** What one creative did on one day in one country (the platform and the channel scale it). */
export function leaf(
  creative: MockCreative,
  day: string,
  country: string,
  filter: Filter,
  today: string,
): CountRow {
  const row = ZERO();
  if (creative.reviewStatus !== 'APPROVED' || day >= today) return row;
  const upload = adsState.uploads.get(creative.uploadId);
  const key = [creative.id, day, country];
  const scale = scaleOf(filter) * (SHARE[country] ?? 0.05);
  row.impressions = Math.round(between(60, 420, 'imp', ...key) * scale);
  if (row.impressions === 0) return row;
  row.guestImpressions = Math.min(
    row.impressions,
    Math.round(row.impressions * unit('g', ...key) * 0.3),
  );
  row.viewableImpressions = Math.round(row.impressions * (0.55 + unit('v', ...key) * 0.2));
  row.nonViewableImpressions = Math.min(
    row.impressions - row.viewableImpressions,
    Math.round(row.impressions * (0.1 + unit('n', ...key) * 0.1)),
  );
  row.undeterminedImpressions =
    row.impressions - row.viewableImpressions - row.nonViewableImpressions;
  row.clicks = Math.round(row.impressions * (0.01 + unit('c', ...key) * 0.04));
  row.errors = Math.round(row.impressions * 0.01 * unit('e', ...key));
  if (upload?.mediaType === 'VIDEO') {
    row.starts = Math.round(row.impressions * (0.6 + unit('s', ...key) * 0.3));
    row.completions = Math.round(row.starts * (0.35 + unit('p', ...key) * 0.3));
    row.skips = Math.min(row.starts - row.completions, Math.round(row.starts * 0.2));
    row.totalWatchSeconds = Math.round(row.starts * (4 + unit('w', ...key) * 8));
  }
  return row;
}

export function add(into: CountRow, row: CountRow): void {
  for (const name of Object.keys(into) as CountName[]) into[name] += row[name];
}

const ratio = (n: number, d: number): number | null => (d === 0 ? null : n / d);

/** The counts and the ratios the backend works out from the summed numerators and denominators (null for a denominator of 0). */
export function withRatios(counts: CountRow): CountRow & {
  ctr: number | null;
  completionRate: number | null;
  viewableRate: number | null;
  measurableRate: number | null;
  avgWatchSeconds: number | null;
} {
  const measured = counts.viewableImpressions + counts.nonViewableImpressions;
  return {
    ...counts,
    ctr: ratio(counts.clicks, counts.impressions),
    completionRate: ratio(counts.completions, counts.starts),
    viewableRate: ratio(counts.viewableImpressions, measured),
    measurableRate: ratio(measured, counts.impressions),
    avgWatchSeconds: ratio(counts.totalWatchSeconds, counts.starts),
  };
}

export const unitOf = (creative: MockCreative) => adsState.units.get(creative.adUnitId);

export { NO_FILL_REASONS, todayOf };

/** The no-ad counts: (day, slot, reason) rows of the filter's total, only the pairs that happened. */
export function noFillRows(days: string[], filter: Filter) {
  const scale = scaleOf(filter);
  const rows: { statDate: string; slotKey: string; reason: string; cnt: number }[] = [];
  const slots = [...adsState.placements.values()].map((p) => p.slotKey);
  for (const day of days) {
    for (const slotKey of slots) {
      for (const reason of NO_FILL_REASONS) {
        // A guest never gets the two slots that need an account.
        if (reason === 'NOT_FOR_GUEST' && !['history_feed', 'reward_credits'].includes(slotKey))
          continue;
        if (unit('nofill', day, slotKey, reason) >= 0.55) continue;
        const cnt = Math.max(
          1,
          Math.round(between(1, 400, 'nofill-n', day, slotKey, reason) * scale),
        );
        rows.push({ statDate: day, slotKey, reason, cnt });
      }
    }
  }
  return rows;
}
