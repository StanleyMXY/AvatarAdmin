import { apiRequest } from '../../request/apiClient';

export type ChannelRow = {
  channelCode: string;
  name: string;
  platform: string;
  distribution: string;
  packageName: string | null;
  enabled: boolean;
  createdAt: string | null;
};

/**
 * `GET /channels` (any signed-in administrator). The answer is read as `{ items: [...] }`, or as a
 * bare list; the contract does not say which (see docs/contract-requests). Rows without a channel
 * code are dropped; the code is read from `code` (the column of the contract) or `channelCode`.
 */
export async function getChannels(): Promise<ChannelRow[]> {
  const data = await apiRequest<unknown>({ method: 'GET', url: '/channels' });
  const list = Array.isArray(data) ? data : (data as { items?: unknown } | null)?.items;
  if (!Array.isArray(list)) return [];
  // The contract names the column `code` (24.7); `channelCode` is also accepted.
  return list.flatMap((row): ChannelRow[] => {
    if (typeof row !== 'object' || row === null) return [];
    const { code, channelCode } = row as { code?: unknown; channelCode?: unknown };
    const value = typeof channelCode === 'string' && channelCode !== '' ? channelCode : code;
    return typeof value === 'string' && value !== ''
      ? [{ ...(row as ChannelRow), channelCode: value }]
      : [];
  });
}
