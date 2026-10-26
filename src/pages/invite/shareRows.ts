import type { ShareChannelRow, ShareFunnelRow } from '../../services/invite';

/** The rows that have a day, oldest first. A row without a day cannot be put on any axis or in any sum of a day. */
export function funnelRowsOf(items: readonly ShareFunnelRow[] | undefined): ShareFunnelRow[] {
  return (items ?? [])
    .filter((row) => row && typeof row.statDate === 'string')
    .sort((a, b) => (a.statDate < b.statDate ? -1 : a.statDate > b.statDate ? 1 : 0));
}

export function channelRowsOf(items: readonly ShareChannelRow[] | undefined): ShareChannelRow[] {
  return (items ?? []).filter((row) => row && typeof row.statDate === 'string');
}
