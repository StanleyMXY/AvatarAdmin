import { beforeEach, describe, expect, it } from 'vitest';
import { avatarState, resetAvatarStore } from './_core/avatarData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import complaints from './complaints.mock';

beforeEach(() => {
  resetStore();
  resetAvatarStore();
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (complaints as unknown as Record<string, H>)[name];
const token = (user: string) => bearer(issueToken(adminOf(user)).token).authorization;
const get = (name: string, user = 'reviewer', query: Record<string, unknown> = {}, params = {}) =>
  call(h(name), { headers: { authorization: token(user) }, query, params });
const send = (name: string, body: unknown, params = {}, user = 'reviewer') =>
  call(h(name), { headers: { authorization: token(user) }, body, params });

const LIST = 'GET /api/admin/likeness-complaints';
const ONE = 'GET /api/admin/likeness-complaints/:id';
const EVIDENCE = 'GET /api/admin/likeness-complaints/:id/evidence/:index';
const STATUS = 'PUT /api/admin/likeness-complaints/:id/status';
const REMOVE = 'POST /api/admin/likeness-complaints/:id/remove-avatars';

const byStatus = (status: string) => {
  const found = avatarState.complaints.find((c) => c.status === status);
  if (!found) throw new Error(`no complaint ${status}`);
  return found;
};

describe('permissions', () => {
  it('lets COMPLAINT:VIEW read and COMPLAINT:MANAGE write, and nobody else do either', async () => {
    const id = byStatus('RECEIVED').id;
    expect((await get(LIST, 'finance')).status).toBe(403);
    expect((await get(LIST, 'support')).status).toBe(200);
    expect((await get(EVIDENCE, 'finance', {}, { id, index: '0' })).status).toBe(403);
    expect((await send(STATUS, { status: 'INVESTIGATING' }, { id }, 'support')).status).toBe(403);
    expect((await send(REMOVE, { assetIds: ['a'] }, { id }, 'support')).status).toBe(403);
  });

  it('answers 401 without a token on every endpoint', async () => {
    for (const name of Object.keys(complaints)) {
      expect((await call(h(name), { params: { id: '1', index: '0' } })).status, name).toBe(401);
    }
  });
});

describe('GET /likeness-complaints', () => {
  it("lists by the due time, nearest first, with overdue, evidenceCount and the handler's username, and no evidence references", async () => {
    const { body } = await get(LIST, 'reviewer', { pageSize: '200' });
    const rows = body.data.items;
    expect(rows.map((r: { dueAt: string }) => r.dueAt)).toEqual(
      [...rows.map((r: { dueAt: string }) => r.dueAt)].sort(),
    );
    expect('evidenceRefs' in rows[0]).toBe(false);
    expect('evidence' in rows[0]).toBe(false);
    expect(typeof rows[0].overdue).toBe('boolean');
    const overdue = rows.filter((r: { overdue: boolean }) => r.overdue);
    expect(overdue.length).toBeGreaterThan(0);
    expect(
      overdue.every(
        (r: { status: string }) =>
          !['REJECTED', 'RESOLVED_REMOVED', 'RESOLVED_NOT_FOUND'].includes(r.status),
      ),
    ).toBe(true);
    const handled = rows.find((r: { handledBy: string | null }) => r.handledBy === '1002');
    expect(handled.handledByUsername).toBe('support');
    const deleted = rows.find((r: { handledBy: string | null }) => r.handledBy === '9999');
    expect(deleted.handledByUsername).toBeNull();
  });

  it('filters by status and refuses a status that does not exist', async () => {
    const { body } = await get(LIST, 'reviewer', { status: 'REJECTED' });
    expect(body.data.items.every((r: { status: string }) => r.status === 'REJECTED')).toBe(true);
    const bad = await get(LIST, 'reviewer', { status: 'OPEN' });
    expect(bad.status).toBe(400);
    expect(bad.body.data.details[0].ref).toBe('status');
  });

  it('pages and refuses a page size over 200', async () => {
    const page = await get(LIST, 'reviewer', { page: '2', pageSize: '10' });
    expect(page.body.data.items).toHaveLength(10);
    expect(page.body.data.total).toBe(avatarState.complaints.length);
    expect((await get(LIST, 'reviewer', { pageSize: '201' })).status).toBe(400);
  });
});

describe('GET /likeness-complaints/{id}', () => {
  it("has the events in ascending order of time, with the administrator's username (null for a deleted one)", async () => {
    const { body } = await get(ONE, 'reviewer', {}, { id: byStatus('RESOLVED_REMOVED').id });
    const times = body.data.events.map((e: { createdAt: string }) => e.createdAt);
    expect(times).toEqual([...times].sort());
    expect(body.data.events[0]).toMatchObject({
      fromStatus: 'RECEIVED',
      toStatus: 'INVESTIGATING',
      adminUsername: 'root',
    });
    const gone = await get(ONE, 'reviewer', {}, { id: byStatus('RESOLVED_NOT_FOUND').id });
    expect(gone.body.data.events[0].adminUsername).toBeNull();
    expect(gone.body.data.events[0].adminId).toBe('9999');
    expect((await get(ONE, 'reviewer', {}, { id: 'nope' })).status).toBe(404);
  });
});

describe('the evidence', () => {
  it('is read by index from 0, with a media type and a new address each time, and each read is audited', async () => {
    const two = avatarState.complaints.find((c) => c.evidence.length === 3);
    if (!two) throw new Error('no complaint with three files');
    const first = await get(EVIDENCE, 'reviewer', {}, { id: two.id, index: '0' });
    expect(first.status).toBe(200);
    expect(first.body.data.mediaType).toBe(two.evidence[0]);
    const again = await get(EVIDENCE, 'reviewer', {}, { id: two.id, index: '0' });
    expect(again.body.data.url).not.toBe(first.body.data.url);
    const pdf = await get(EVIDENCE, 'reviewer', {}, { id: two.id, index: '2' });
    expect(pdf.body.data).toMatchObject({ mediaType: 'application/pdf' });
    expect(pdf.body.data.url).toContain('.pdf');
    expect(avatarState.evidenceReads.map((r) => r.index)).toEqual([0, 0, 2]);
  });

  it('answers 404 RESOURCE_NOT_FOUND past the last index, for a negative or odd index, and for an unknown complaint', async () => {
    const one = avatarState.complaints.find((c) => c.evidence.length === 1);
    if (!one) throw new Error('no complaint with one file');
    for (const index of ['1', '-1', 'x', '1.5']) {
      const r = await get(EVIDENCE, 'reviewer', {}, { id: one.id, index });
      expect(r.status, index).toBe(404);
      expect(r.body.code).toBe('RESOURCE_NOT_FOUND');
    }
    expect((await get(EVIDENCE, 'reviewer', {}, { id: 'nope', index: '0' })).status).toBe(404);
    expect(avatarState.evidenceReads).toHaveLength(0);
  });
});

describe('PUT /likeness-complaints/{id}/status', () => {
  it('moves an open complaint, records an event with the administrator and the note, and closes it for REJECTED', async () => {
    const complaint = byStatus('RECEIVED');
    const moved = await send(
      STATUS,
      { status: 'INVESTIGATING', note: '  Asked for the photo  ' },
      { id: complaint.id },
    );
    expect(moved.status).toBe(200);
    expect(moved.body.data.status).toBe('INVESTIGATING');
    expect(moved.body.data.handledByUsername).toBe('reviewer');
    expect(moved.body.data.events.at(-1)).toMatchObject({
      fromStatus: 'RECEIVED',
      toStatus: 'INVESTIGATING',
      note: 'Asked for the photo',
      adminUsername: 'reviewer',
    });
    const closed = await send(STATUS, { status: 'REJECTED' }, { id: complaint.id });
    expect(closed.body.data.status).toBe('REJECTED');
    expect(closed.body.data.resolvedAt).not.toBeNull();
    expect(closed.body.data.overdue).toBe(false);
    expect(closed.body.data.events.at(-1).note).toBeNull();
  });

  it('refuses RESOLVED_REMOVED and RECEIVED as a target, and a note over 1000 code points (Arabic and emoji count one each)', async () => {
    const { id } = byStatus('RECEIVED');
    for (const status of ['RESOLVED_REMOVED', 'RECEIVED', 'DONE']) {
      const r = await send(STATUS, { status }, { id });
      expect(r.status, status).toBe(400);
      expect(r.body.data.details[0].ref).toBe('status');
    }
    const tooLong = await send(STATUS, { status: 'INVESTIGATING', note: 'ب'.repeat(1001) }, { id });
    expect(tooLong.body.data.details).toEqual([{ ref: 'note', reason: 'TOO_LONG' }]);
    expect(
      (await send(STATUS, { status: 'INVESTIGATING', note: '😀'.repeat(1000) }, { id })).status,
    ).toBe(200);
  });

  it('answers 409 INVALID_STATE with the current state for a closed complaint, and changes nothing', async () => {
    const closed = byStatus('REJECTED');
    const events = closed.events.length;
    const r = await send(STATUS, { status: 'INVESTIGATING' }, { id: closed.id });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('INVALID_STATE');
    expect(r.body.data.status).toBe('REJECTED');
    expect(closed.events).toHaveLength(events);
    expect((await send(STATUS, { status: 'INVESTIGATING' }, { id: 'nope' })).status).toBe(404);
  });
});

describe('POST /likeness-complaints/{id}/remove-avatars', () => {
  it('records the avatar ids, closes the complaint as RESOLVED_REMOVED and adds an event', async () => {
    const { id } = byStatus('INVESTIGATING');
    const r = await send(REMOVE, { assetIds: ['asset-1', 'asset-2', 'asset-1'] }, { id });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('RESOLVED_REMOVED');
    expect(r.body.data.relatedAvatarAssetIds).toEqual(['asset-1', 'asset-2']);
    expect(r.body.data.events.at(-1)).toMatchObject({
      fromStatus: 'INVESTIGATING',
      toStatus: 'RESOLVED_REMOVED',
    });
    expect(r.body.data.resolvedAt).not.toBeNull();
  });

  it('refuses an empty list or a blank id, and answers 409 for a closed complaint', async () => {
    const { id } = byStatus('RECEIVED');
    expect((await send(REMOVE, { assetIds: [] }, { id })).status).toBe(400);
    expect((await send(REMOVE, { assetIds: [' '] }, { id })).status).toBe(400);
    expect((await send(REMOVE, {}, { id })).body.data.details[0].ref).toBe('assetIds');
    const closed = byStatus('RESOLVED_NOT_FOUND');
    const r = await send(REMOVE, { assetIds: ['a'] }, { id: closed.id });
    expect(r.status).toBe(409);
    expect(r.body.data.status).toBe('RESOLVED_NOT_FOUND');
    expect(closed.relatedAvatarAssetIds).toEqual([]);
  });
});
