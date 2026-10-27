import { apiRequest } from '../../request/apiClient';
import type {
  DepthStats,
  InviteChain,
  InviteCode,
  InviteRecord,
  InviteStats,
  Page,
  ShareChannelRow,
  ShareFunnelRow,
} from './types';

export * from './types';

/** `GET /invites/codes` (`INVITE:VIEW`). */
export const listInviteCodes = (params: {
  page: number;
  pageSize: number;
}): Promise<Page<InviteCode>> => apiRequest({ method: 'GET', url: '/invites/codes', params });

/** `GET /invites/records` (`INVITE:VIEW`), newest redemption first; `rewardStatus` filters. */
export const listInviteRecords = (params: {
  page: number;
  pageSize: number;
  rewardStatus?: string;
}): Promise<Page<InviteRecord>> => apiRequest({ method: 'GET', url: '/invites/records', params });

/** `GET /invites/stats` (`INVITE:VIEW`): read from the records as they are, not from a summary table. */
export const getInviteStats = (params: {
  from: string;
  to: string;
  limit?: number;
}): Promise<InviteStats> => apiRequest({ method: 'GET', url: '/invites/stats', params });

/** `GET /invites/depth-stats` (`INVITE:VIEW`). */
export const getDepthStats = (params: { from: string; to: string }): Promise<DepthStats> =>
  apiRequest({ method: 'GET', url: '/invites/depth-stats', params });

/** `GET /invites/chain` (`INVITE:VIEW`): the descendants of one account down to `maxDepth` levels. */
export const getInviteChain = (params: {
  rootAccountId: string;
  maxDepth?: number;
}): Promise<InviteChain> => apiRequest({ method: 'GET', url: '/invites/chain', params });

/** `GET /invites/share-funnel` (`INVITE:VIEW`): one row per landed day. */
export const getShareFunnel = (params: {
  from: string;
  to: string;
}): Promise<{ items: ShareFunnelRow[] }> =>
  apiRequest({ method: 'GET', url: '/invites/share-funnel', params });

/** `GET /invites/share-channels` (`INVITE:VIEW`): one row per landed day and share channel. */
export const getShareChannels = (params: {
  from: string;
  to: string;
  shareChannel?: string;
}): Promise<{ items: ShareChannelRow[] }> =>
  apiRequest({ method: 'GET', url: '/invites/share-channels', params });
