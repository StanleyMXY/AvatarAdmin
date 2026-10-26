import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import { getSession, listSessions } from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

describe('the session functions', () => {
  it('lists with the paging and only the filters that were given, booleans as true and false', async () => {
    const calls = stubFetch(async () =>
      jsonResponse(200, envelope('200', { items: [], total: 0 })),
    );
    await listSessions({ page: 2, pageSize: 50 });
    await listSessions({
      page: 1,
      pageSize: 20,
      accountId: 'acc 1/2',
      guest: false,
      from: '2026-10-01T00:00:00Z',
      to: '2026-10-02T00:00:00Z',
      ongoing: true,
      endReason: 'DEADLINE',
    });
    expect(calls[0].url).toBe('/api/admin/sessions?page=2&pageSize=50');
    expect(calls[1].url).toBe(
      '/api/admin/sessions?page=1&pageSize=20&accountId=acc+1%2F2&guest=false&from=2026-10-01T00%3A00%3A00Z&to=2026-10-02T00%3A00%3A00Z&ongoing=true&endReason=DEADLINE',
    );
    expect(calls[0].init.method).toBe('GET');
  });

  it('reads one session by its id, encoded', async () => {
    const calls = stubFetch(async () => jsonResponse(200, envelope('200', { id: 'a/b' })));
    await getSession('a/b?x');
    expect(calls[0].url).toBe('/api/admin/sessions/a%2Fb%3Fx');
  });
});
