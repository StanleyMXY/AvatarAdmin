import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import { getFeedback, listFeedback, retryFeedback } from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

describe('support services', () => {
  it('lists feedback with the paging, reads one, and sends one to be forwarded again', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', { items: [], total: 0 })));
    await listFeedback({ page: 3, pageSize: 10 });
    await getFeedback('9');
    await retryFeedback('9');
    expect(calls[0].url).toBe('/api/admin/support/feedback?page=3&pageSize=10');
    expect(calls[1].url).toBe('/api/admin/support/feedback/9');
    expect(calls[2].url).toBe('/api/admin/support/feedback/9/retry');
    expect(calls[2].init.method).toBe('POST');
  });
});
