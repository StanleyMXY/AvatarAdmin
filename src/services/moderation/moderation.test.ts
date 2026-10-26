import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import {
  decideModeration,
  getModerationContent,
  getModerationRecord,
  getModerationStats,
  getTextRules,
  listModerationRecords,
  saveTextRules,
} from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const answer = (data: unknown) => stubFetch(() => jsonResponse(200, envelope('200', data)));
const body = (call: { init: RequestInit }) => JSON.parse(call.init.body as string);
const WIDE_SPACE = String.fromCodePoint(0x3000);

describe('the moderation services', () => {
  it('lists with the paging and the three filters, and leaves out the ones that are not set', async () => {
    const calls = answer({ items: [], total: 0 });
    await listModerationRecords({
      page: 2,
      pageSize: 50,
      status: 'PENDING_REVIEW',
      source: 'COMPLAINT',
      contentType: 'ACTION_CLIP',
    });
    expect(calls[0].url).toBe(
      '/api/admin/moderation/records?page=2&pageSize=50&status=PENDING_REVIEW&source=COMPLAINT&contentType=ACTION_CLIP',
    );
    await listModerationRecords({ page: 1, pageSize: 20 });
    expect(calls[1].url).toBe('/api/admin/moderation/records?page=1&pageSize=20');
  });

  it('writes the id into the path safely', async () => {
    const calls = answer({});
    await getModerationRecord('a/b c');
    await getModerationContent('a/b c');
    expect(calls[0].url).toBe('/api/admin/moderation/records/a%2Fb%20c');
    expect(calls[1].url).toBe('/api/admin/moderation/records/a%2Fb%20c/content');
    expect(calls[1].init.method).toBe('GET');
  });

  it('asks for the content every time and returns what the backend says, untouched', async () => {
    const file = {
      kind: 'FILE',
      mediaType: 'audio/wav',
      url: 'https://files.example/a?sig=1',
      text: 'สวัสดี',
    };
    const calls = answer(file);
    expect(await getModerationContent('7')).toEqual(file);
    expect(await getModerationContent('7')).toEqual(file);
    expect(calls).toHaveLength(2);
  });

  it('sends the decision with the note trimmed with the contract set, and without a note field when there is none', async () => {
    const calls = answer(null);
    await decideModeration('9', { decision: 'REJECT', note: `${WIDE_SPACE} ไม่เหมาะสม ` });
    expect(calls[0].url).toBe('/api/admin/moderation/records/9/decision');
    expect(calls[0].init.method).toBe('POST');
    expect(body(calls[0])).toEqual({ decision: 'REJECT', note: 'ไม่เหมาะสม' });
    await decideModeration('9', { decision: 'APPROVE' });
    expect(body(calls[1])).toEqual({ decision: 'APPROVE' });
    await decideModeration('9', { decision: 'APPROVE', note: `  ${WIDE_SPACE}` });
    expect(body(calls[2])).toEqual({ decision: 'APPROVE' });
  });

  it('asks for the statistics of the UTC days as they are', async () => {
    const calls = answer({ items: [], avgHandleSeconds: null, oldestPendingSeconds: null });
    const stats = await getModerationStats({ from: '2026-10-01', to: '2026-10-26' });
    expect(calls[0].url).toBe('/api/admin/moderation/stats?from=2026-10-01&to=2026-10-26');
    expect(stats.avgHandleSeconds).toBeNull();
  });

  it('reads the rule list and replaces it as {items}', async () => {
    const calls = answer({ items: [] });
    await getTextRules();
    expect(calls[0].url).toBe('/api/admin/moderation/text-rules');
    const items = [
      { pattern: 'كلمة', matchMode: 'SUBSTRING' as const, level: 'BLOCK' as const, note: '' },
    ];
    await saveTextRules(items);
    expect(calls[1].url).toBe('/api/admin/moderation/text-rules');
    expect(calls[1].init.method).toBe('PUT');
    expect(body(calls[1])).toEqual({ items });
  });
});
