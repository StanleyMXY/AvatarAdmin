import { plainText } from '../../utils/plainText';
import { count } from './numbers';

export type ChannelGroup = {
  name: string;
  /** True for the group that holds every channel outside the first ones. */
  other: boolean;
  total: number;
  /** Shares (PV) by UTC day. */
  byDay: Record<string, number>;
};

export const OTHER = 'Other';

type Row = { statDate: unknown; shareChannel: unknown; sharePv: unknown };

/**
 * The channels with the most shares over the rows (ties by name), at most `keep` of them, and one
 * group "Other" with the sum of all the rest, also by day. Rows without a valid day or a valid
 * number are left out, and so is a channel that has no shares at all. The rest is summed from its
 * own rows, never taken as a total minus the first ones.
 */
export function groupChannels(
  rows: readonly Row[],
  keep: number,
): { groups: ChannelGroup[]; total: number } {
  const byChannel = new Map<string, ChannelGroup>();
  for (const row of rows) {
    const pv = count(row.sharePv);
    if (pv === null || typeof row.statDate !== 'string') continue;
    const name = plainText(row.shareChannel);
    const group = byChannel.get(name) ?? { name, other: false, total: 0, byDay: {} };
    group.total += pv;
    group.byDay[row.statDate] = (group.byDay[row.statDate] ?? 0) + pv;
    byChannel.set(name, group);
  }
  const ranked = [...byChannel.values()]
    .filter((group) => group.total > 0)
    .sort((a, b) => b.total - a.total || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const total = ranked.reduce((n, group) => n + group.total, 0);
  const groups = ranked.slice(0, keep);
  const rest = ranked.slice(keep);
  if (rest.length > 0) {
    const other: ChannelGroup = { name: OTHER, other: true, total: 0, byDay: {} };
    for (const group of rest) {
      other.total += group.total;
      for (const [day, pv] of Object.entries(group.byDay))
        other.byDay[day] = (other.byDay[day] ?? 0) + pv;
    }
    groups.push(other);
  }
  return { groups, total };
}
