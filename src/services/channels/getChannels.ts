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
 * code are dropped.
 */
export async function getChannels(): Promise<ChannelRow[]> {
  const data = await apiRequest<unknown>({ method: 'GET', url: '/channels' });
  const list = Array.isArray(data) ? data : (data as { items?: unknown } | null)?.items;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (row): row is ChannelRow =>
      typeof row === 'object' &&
      row !== null &&
      typeof (row as { channelCode?: unknown }).channelCode === 'string' &&
      (row as { channelCode: string }).channelCode !== '',
  );
}
