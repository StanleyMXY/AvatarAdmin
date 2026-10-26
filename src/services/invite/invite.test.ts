import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import {
  getDepthStats,
  getInviteChain,
  getInviteStats,
  getShareChannels,
  getShareFunnel,
  listInviteCodes,
  listInviteRecords,
} from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const answer = (data: unknown) => stubFetch(() => jsonResponse(200, envelope('200', data)));

describe('the invite services (contract 17.4, invite row)', () => {
  it('lists codes with the paging only', async () => {
    const calls = answer({ items: [], total: 0 });
    await listInviteCodes({ page: 3, pageSize: 50 });
    expect(calls[0].url).toBe('/api/admin/invites/codes?page=3&pageSize=50');
    expect(calls[0].init.method).toBe('GET');
  });

  it('lists records with the paging and the reward status, and leaves an empty status out', async () => {
    const calls = answer({ items: [], total: 0 });
    await listInviteRecords({ page: 1, pageSize: 20, rewardStatus: 'NOT_ELIGIBLE' });
    expect(calls[0].url).toBe(
      '/api/admin/invites/records?page=1&pageSize=20&rewardStatus=NOT_ELIGIBLE',
    );
    await listInviteRecords({ page: 1, pageSize: 20, rewardStatus: '' });
    expect(calls[1].url).toBe('/api/admin/invites/records?page=1&pageSize=20');
  });

  it('asks for the statistics with from, to and limit', async () => {
    const calls = answer({ daily: [], ranking: [] });
    await getInviteStats({ from: '2026-10-01', to: '2026-10-07', limit: 50 });
    expect(calls[0].url).toBe('/api/admin/invites/stats?from=2026-10-01&to=2026-10-07&limit=50');
  });

  it('asks for the depth statistics with the range only', async () => {
    const calls = answer({ depthDistribution: [] });
    await getDepthStats({ from: '2026-10-01', to: '2026-10-07' });
    expect(calls[0].url).toBe('/api/admin/invites/depth-stats?from=2026-10-01&to=2026-10-07');
  });

  it('asks for a chain by rootAccountId and maxDepth, encoding an id that is any text', async () => {
    const calls = answer({ root: {}, children: [] });
    await getInviteChain({ rootAccountId: 'a b&c/ก', maxDepth: 4 });
    const url = new URL(calls[0].url, 'http://x');
    expect(url.pathname).toBe('/api/admin/invites/chain');
    expect(url.searchParams.get('rootAccountId')).toBe('a b&c/ก');
    expect(url.searchParams.get('maxDepth')).toBe('4');
  });

  it('reads the two share tables with the range, and the channel only when one is chosen', async () => {
    const calls = answer({ items: [] });
    await getShareFunnel({ from: '2026-10-01', to: '2026-10-07' });
    expect(calls[0].url).toBe('/api/admin/invites/share-funnel?from=2026-10-01&to=2026-10-07');
    await getShareChannels({ from: '2026-10-01', to: '2026-10-07' });
    expect(calls[1].url).toBe('/api/admin/invites/share-channels?from=2026-10-01&to=2026-10-07');
    await getShareChannels({ from: '2026-10-01', to: '2026-10-07', shareChannel: 'whatsapp' });
    expect(calls[2].url).toBe(
      '/api/admin/invites/share-channels?from=2026-10-01&to=2026-10-07&shareChannel=whatsapp',
    );
  });

  it('returns the data of the envelope unchanged', async () => {
    answer({
      items: [
        { id: '1', code: 'K7M2Q9XD', ownerAccountId: 'a', createdAt: '2026-10-01T00:00:00Z' },
      ],
      total: 1,
    });
    const page = await listInviteCodes({ page: 1, pageSize: 20 });
    expect(page.total).toBe(1);
    expect(page.items[0].code).toBe('K7M2Q9XD');
  });
});
