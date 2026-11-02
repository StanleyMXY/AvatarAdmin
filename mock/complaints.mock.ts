// The likeness complaint endpoints of the mock backend (contract 11.6 and 17.4, the "投诉" row, and
// the backend reply of 2026-10-21, point 19). State lives in _core/avatarData.ts. What the contract
// leaves open (the answers of the two writes) follows docs/contract-requests/
// 2026-10-26-admin-frontend-cosmetics-complaints.md.
import { countCodePoints } from '../src/utils/codePoints';
import { trimSpec } from '../src/utils/trimSpec';
import { guard } from './_core/auth';
import {
  avatarState,
  CLOSED,
  type MockComplaint,
  type MockComplaintStatus,
  nextId,
  signedUrl,
} from './_core/avatarData';
import { bodyOf, invalidRequest, MockHttpError, ok } from './_core/http';
import { paginateQuery } from './_core/paginate';
import { text } from './_core/statRange';
import { store } from './_core/store';

const STATUSES = [
  'RECEIVED',
  'INVESTIGATING',
  'RESOLVED_REMOVED',
  'RESOLVED_NOT_FOUND',
  'REJECTED',
];
const SETTABLE = ['INVESTIGATING', 'RESOLVED_NOT_FOUND', 'REJECTED'];
const NOTE_MAX = 1000;
/** `assetIds` of a removal takes at most this many (contract 11.6). */
const ASSET_IDS_MAX = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A control character: C0, DEL and C1, a new line and a tab included (contract 11.6: "note" has none). */
// biome-ignore lint/suspicious/noControlCharactersInRegex: this is the check for them
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

const usernameOf = (adminId: string | null): string | null =>
  adminId === null ? null : (store.admins.get(adminId)?.username ?? null);

const overdueOf = (c: MockComplaint, now = Date.now()): boolean =>
  !CLOSED.includes(c.status) && Date.parse(c.dueAt) < now;

/** The columns of the entity plus the derived ones; the evidence references are never sent. */
function summary(c: MockComplaint) {
  const { evidence, events: _events, ...columns } = c;
  return {
    ...columns,
    relatedAvatarAssetIds: [...c.relatedAvatarAssetIds],
    handledByUsername: usernameOf(c.handledBy),
    overdue: overdueOf(c),
    evidenceCount: evidence.length,
  };
}

function detail(c: MockComplaint) {
  return {
    ...summary(c),
    events: [...c.events]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((e) => ({ ...e, adminUsername: usernameOf(e.adminId) })),
  };
}

const found = (id: string): MockComplaint => {
  const complaint = avatarState.complaints.find((c) => c.id === id);
  if (!complaint) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such complaint');
  return complaint;
};

const closedError = (c: MockComplaint) =>
  new MockHttpError(409, 'INVALID_STATE', 'The complaint is closed', { status: c.status });

function record(
  c: MockComplaint,
  to: MockComplaintStatus,
  note: string | null,
  adminId: string,
): void {
  const from = c.status;
  c.status = to;
  c.handledBy = adminId;
  if (CLOSED.includes(to)) c.resolvedAt = new Date().toISOString();
  c.events.push({
    id: nextId(),
    fromStatus: from,
    toStatus: to,
    note,
    adminId,
    createdAt: new Date().toISOString(),
  });
}

export default {
  // Sorted by the due time, the nearest first.
  'GET /api/admin/likeness-complaints': guard('COMPLAINT:VIEW', (req) => {
    // The error of the paging comes before the one of the status. No status, or an empty one, is no
    // filter; OPEN is "not closed" (RECEIVED and INVESTIGATING); anything else must be one of the
    // five states in exactly that spelling: `open`, ` OPEN` and `OPEN,RECEIVED` are refused.
    paginateQuery([], req);
    const status = text(req.query.status);
    if (status !== '' && status !== 'OPEN' && !STATUSES.includes(status)) {
      throw invalidRequest('status is not one of the states', [
        { ref: 'status', reason: 'OUT_OF_RANGE' },
      ]);
    }
    const rows = avatarState.complaints
      .filter((c) =>
        status === '' ? true : status === 'OPEN' ? !CLOSED.includes(c.status) : c.status === status,
      )
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const page = paginateQuery(rows, req);
    return ok({ items: page.items.map(summary), total: page.total });
  }),

  'GET /api/admin/likeness-complaints/:id': guard('COMPLAINT:VIEW', (req) =>
    ok(detail(found(req.params.id))),
  ),

  // Reading a piece of evidence is written to the audit trail, every time.
  'GET /api/admin/likeness-complaints/:id/evidence/:index': guard('COMPLAINT:VIEW', (req) => {
    const complaint = found(req.params.id);
    const raw = req.params.index ?? '';
    const index = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
    if (!Number.isInteger(index) || index >= complaint.evidence.length) {
      throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such evidence');
    }
    avatarState.evidenceReads.push({
      complaintId: complaint.id,
      index,
      adminId: req.admin.id,
    });
    const mediaType = complaint.evidence[index];
    const file = `evidence-${complaint.id.slice(-4)}-${index}.${mediaType === 'application/pdf' ? 'pdf' : 'svg'}`;
    return ok({ url: signedUrl(file), mediaType });
  }),

  'PUT /api/admin/likeness-complaints/:id/status': guard('COMPLAINT:MANAGE', (req) => {
    const complaint = found(req.params.id);
    const body = bodyOf(req);
    if (typeof body.status !== 'string' || !SETTABLE.includes(body.status)) {
      // RESOLVED_REMOVED is only the result of removing avatars.
      throw invalidRequest('status is not one that can be set', [
        { ref: 'status', reason: 'OUT_OF_RANGE' },
      ]);
    }
    let note: string | null = null;
    if (body.note !== undefined && body.note !== null) {
      note = typeof body.note === 'string' ? trimSpec(body.note) : '';
      if (note !== '' && countCodePoints(note) > NOTE_MAX) {
        throw invalidRequest('the note is too long', [{ ref: 'note', reason: 'TOO_LONG' }]);
      }
      // The contract names no reason code for this one, so there is a message and no field list.
      if (CONTROL.test(note)) {
        throw new MockHttpError(400, 'INVALID_REQUEST', 'note must not contain control characters');
      }
      if (note === '') note = null;
    }
    // The order is the contract's: the complaint (404), the body (400), the state (409). A closed
    // complaint and a complaint set to the state it already has are both 409.
    if (CLOSED.includes(complaint.status) || complaint.status === body.status) {
      throw closedError(complaint);
    }
    record(complaint, body.status as MockComplaintStatus, note, req.admin.id);
    return ok(null);
  }),

  'POST /api/admin/likeness-complaints/:id/remove-avatars': guard('COMPLAINT:MANAGE', (req) => {
    const complaint = found(req.params.id);
    const ids = bodyOf(req).assetIds;
    // Contract 11.6: not a list, or empty, is EMPTY_NOT_ALLOWED; more than 20, a repeated id (a UUID
    // in another case is the same one) or an element that is not a UUID string is OUT_OF_RANGE.
    if (!Array.isArray(ids) || ids.length === 0) {
      throw invalidRequest('assetIds must be a list of avatar ids', [
        { ref: 'assetIds', reason: 'EMPTY_NOT_ALLOWED' },
      ]);
    }
    const lower = ids.map((id) => (typeof id === 'string' ? id.toLowerCase() : id));
    if (
      ids.length > ASSET_IDS_MAX ||
      ids.some((id) => typeof id !== 'string' || !UUID.test(id)) ||
      new Set(lower).size !== ids.length
    ) {
      throw invalidRequest('assetIds must be at most 20 different UUIDs', [
        { ref: 'assetIds', reason: 'OUT_OF_RANGE' },
      ]);
    }
    if (CLOSED.includes(complaint.status)) throw closedError(complaint);
    // An avatar that is not there is 404, every missing id named, and nothing is deleted.
    const owners = new Map<string, string>();
    for (const [account, list] of avatarState.accountAvatars) {
      for (const avatar of list) owners.set(avatar.assetId.toLowerCase(), account);
    }
    const missing = (ids as string[]).filter((id) => !owners.has(id.toLowerCase()));
    if (missing.length > 0) {
      throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'Some avatars are not there', {
        details: missing.map((ref) => ({ ref, reason: 'RESOURCE_NOT_FOUND' })),
      });
    }
    for (const [account, list] of avatarState.accountAvatars) {
      avatarState.accountAvatars.set(
        account,
        list.filter((avatar) => !lower.includes(avatar.assetId.toLowerCase())),
      );
    }
    complaint.relatedAvatarAssetIds = [
      ...new Set([...complaint.relatedAvatarAssetIds, ...(ids as string[])]),
    ];
    record(complaint, 'RESOLVED_REMOVED', null, req.admin.id);
    // The backend answers nothing; the page reads the complaint again.
    return ok(null);
  }),
};
