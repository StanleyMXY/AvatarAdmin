import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import {
  banUser,
  cancelDeletion,
  getUser,
  listAbuseClusters,
  listAccountDeletions,
  listAuthEvents,
  listClusterAccounts,
  listDevices,
  listUserSessions,
  listUsers,
  retryAccountDeletion,
  startDeletion,
  USERS_EXPORT_URL,
  unbanUser,
} from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const answer = (data: unknown) => stubFetch(() => jsonResponse(200, envelope('200', data)));
const body = (call: { init: RequestInit }) => JSON.parse(call.init.body as string);

describe('the user list', () => {
  it('sends the paging and the seven filters under the names written in the contract request, and leaves empty ones out', async () => {
    const calls = answer({ items: [], total: 0 });
    await listUsers({
      page: 2,
      pageSize: 50,
      accountId: '42',
      email: 'a@b.com',
      phone: '+66812345678',
      status: 'BANNED',
      channelCode: 'huawei',
      trafficType: 'PAID',
      mediaSource: 'Facebook Ads',
    });
    const url = new URL(calls[0].url, 'http://x');
    expect(url.pathname).toBe('/api/admin/users');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '2',
      pageSize: '50',
      accountId: '42',
      email: 'a@b.com',
      phone: '+66812345678',
      status: 'BANNED',
      channelCode: 'huawei',
      trafficType: 'PAID',
      mediaSource: 'Facebook Ads',
    });
    await listUsers({ page: 1, pageSize: 20, email: '' });
    expect(calls[1].url).toBe('/api/admin/users?page=1&pageSize=20');
  });

  it('exports from /users/export', () => {
    expect(USERS_EXPORT_URL).toBe('/users/export');
  });
});

describe('the user detail and its tabs', () => {
  it('writes the account id into the path safely', async () => {
    const calls = answer({ id: 'a/b' });
    await getUser('a/b');
    await listDevices('a b');
    await listAuthEvents('x?y', { page: 1, pageSize: 20 });
    await listUserSessions('a#b', { page: 3, pageSize: 10 });
    expect(calls.map((c) => c.url)).toEqual([
      '/api/admin/users/a%2Fb',
      '/api/admin/users/a%20b/devices',
      '/api/admin/users/x%3Fy/auth-events?page=1&pageSize=20',
      '/api/admin/users/a%23b/sessions?page=3&pageSize=10',
    ]);
  });
});

describe('ban, unban and deletion', () => {
  it('bans with the reason only, unbans with no body field', async () => {
    const calls = answer(null);
    await banUser('9', 'Spam');
    expect(calls[0].url).toBe('/api/admin/users/9/ban');
    expect(calls[0].init.method).toBe('POST');
    expect(body(calls[0])).toEqual({ reason: 'Spam' });
    await unbanUser('9');
    expect(calls[1].url).toBe('/api/admin/users/9/unban');
    expect(calls[1].init.method).toBe('POST');
  });

  it('starts a deletion with the reason and cancels it without one', async () => {
    const calls = answer(null);
    await startDeletion('9', 'Asked by support');
    expect(calls[0].url).toBe('/api/admin/users/9/deletion');
    expect(body(calls[0])).toEqual({ reason: 'Asked by support' });
    await cancelDeletion('9');
    expect(calls[1].url).toBe('/api/admin/users/9/deletion/cancel');
    expect(calls[1].init.method).toBe('POST');
  });
});

describe('deletion tasks', () => {
  it('lists with the paging and the state filter, and retries by id', async () => {
    const calls = answer({ items: [], total: 0 });
    await listAccountDeletions({ page: 1, pageSize: 20, status: 'FAILED' });
    expect(calls[0].url).toBe('/api/admin/account-deletions?page=1&pageSize=20&status=FAILED');
    await retryAccountDeletion('d/1');
    expect(calls[1].url).toBe('/api/admin/account-deletions/d%2F1/retry');
    expect(calls[1].init.method).toBe('POST');
  });
});

describe('abuse clusters', () => {
  it('sends by, the range, the paging, and the threshold only when there is one', async () => {
    const calls = answer({ items: [], total: 0 });
    await listAbuseClusters({
      by: 'DEVICE',
      from: '2026-10-19T00:00:00Z',
      to: '2026-10-27T00:00:00Z',
      page: 1,
      pageSize: 20,
    });
    expect(calls[0].url).toBe(
      '/api/admin/abuse/clusters?by=DEVICE&from=2026-10-19T00%3A00%3A00Z&to=2026-10-27T00%3A00%3A00Z&page=1&pageSize=20',
    );
    await listAbuseClusters({
      by: 'IP',
      from: 'f',
      to: 't',
      minFreeAccounts: 0,
      page: 1,
      pageSize: 20,
    });
    expect(new URL(calls[1].url, 'http://x').searchParams.get('minFreeAccounts')).toBe('0');
  });

  it('reads the accounts of a cluster by the opaque key, as received', async () => {
    const calls = answer({ items: [], total: 0 });
    await listClusterAccounts({ by: 'IP', key: 'ab+/=cd', page: 1, pageSize: 100 });
    const url = new URL(calls[0].url, 'http://x');
    expect(url.pathname).toBe('/api/admin/abuse/clusters/accounts');
    expect(url.searchParams.get('key')).toBe('ab+/=cd');
    expect(url.searchParams.get('by')).toBe('IP');
  });
});
