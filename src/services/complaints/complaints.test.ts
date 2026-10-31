import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import {
  COMPLAINT_FILTER_STATUSES,
  getComplaint,
  getComplaintEvidence,
  listComplaints,
  removeComplaintAvatars,
  setComplaintStatus,
} from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const answer = (data: unknown) => stubFetch(() => jsonResponse(200, envelope('200', data)));
const body = (call: { init: RequestInit }) => JSON.parse(call.init.body as string);

describe('likeness complaints', () => {
  it('lists with the paging and the status filter', async () => {
    const calls = answer({ items: [], total: 0 });
    await listComplaints({ page: 1, pageSize: 20, status: 'RECEIVED' });
    await listComplaints({ page: 2, pageSize: 50 });
    await listComplaints({ page: 1, pageSize: 20, status: 'OPEN' });
    expect(calls[2].url).toBe('/api/admin/likeness-complaints?page=1&pageSize=20&status=OPEN');
    expect(calls[0].url).toBe('/api/admin/likeness-complaints?page=1&pageSize=20&status=RECEIVED');
    expect(calls[1].url).toBe('/api/admin/likeness-complaints?page=2&pageSize=50');
  });

  it('offers "not closed" first, then the five states, and nothing else, as the filter', () => {
    expect(COMPLAINT_FILTER_STATUSES).toEqual([
      'OPEN',
      'RECEIVED',
      'INVESTIGATING',
      'RESOLVED_REMOVED',
      'RESOLVED_NOT_FOUND',
      'REJECTED',
    ]);
  });

  it('reads one complaint with its events', async () => {
    const calls = answer({ id: 'c1', events: [] });
    await getComplaint('c1');
    expect(calls[0].url).toBe('/api/admin/likeness-complaints/c1');
  });

  it('moves the status with the note only when there is one', async () => {
    const calls = answer({});
    await setComplaintStatus('c1', 'INVESTIGATING', 'Looking into it');
    await setComplaintStatus('c1', 'REJECTED');
    await setComplaintStatus('c1', 'REJECTED', '');
    expect(calls[0].init.method).toBe('PUT');
    expect(calls[0].url).toBe('/api/admin/likeness-complaints/c1/status');
    expect(body(calls[0])).toEqual({ status: 'INVESTIGATING', note: 'Looking into it' });
    expect(body(calls[1])).toEqual({ status: 'REJECTED' });
    expect(body(calls[2])).toEqual({ status: 'REJECTED' });
  });

  it('removes avatars with the ids', async () => {
    const calls = answer({});
    await removeComplaintAvatars('c1', ['a1', 'a2']);
    expect(calls[0].url).toBe('/api/admin/likeness-complaints/c1/remove-avatars');
    expect(calls[0].init.method).toBe('POST');
    expect(body(calls[0])).toEqual({ assetIds: ['a1', 'a2'] });
  });

  it('reads one piece of evidence by its index counted from 0', async () => {
    const calls = answer({ url: 'https://files.example/e0', mediaType: 'image/png' });
    expect(await getComplaintEvidence('c1', 0)).toEqual({
      url: 'https://files.example/e0',
      mediaType: 'image/png',
    });
    expect(calls[0].url).toBe('/api/admin/likeness-complaints/c1/evidence/0');
  });
});
