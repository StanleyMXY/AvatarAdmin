// The call endpoints of the mock backend (contract 17.4, the 通话 row): `GET /sessions` and
// `GET /sessions/{id}`, both `SESSION:VIEW`. The filters are the six the backend declares (its
// answer 54, docs/backend-inputs, 2026-11-02): `accountId` (a UUID), `guest` and `inProgress`
// (only `true` or `false`, else OUT_OF_RANGE), `from` and `to` (instants of `requestedAt`,
// `[from, to)`, no check that `from` is before `to` and no longest range), `endReason`. A parameter
// the backend does not declare is ignored without an error. The data is in _core/sessionsData.ts.
import { guard } from './_core/auth';
import { invalidRequest, MockHttpError, type MockReq, ok } from './_core/http';
import { paginateQuery } from './_core/paginate';
import { detailRow, listRow, type MockSession, sessionsState } from './_core/sessionsData';
import { text } from './_core/statRange';

const END_REASONS = ['DEADLINE', 'USER_LEFT', 'ROOM_FINISHED', 'BANNED', 'SUPERSEDED'];
// Only the form ending in `Z` is accepted: whether an offset such as `+08:00` is accepted too was
// not checked with the backend (answer 54, item 4), so the page must not send one.
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Detail = { ref: string; reason: string };

/** `true` or `false` in lower case; anything else but an empty value is OUT_OF_RANGE. */
const bool = (req: MockReq, name: string, problems: Detail[]): boolean | undefined => {
  const value = req.query[name];
  if (value === undefined || value === '') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  problems.push({ ref: name, reason: 'OUT_OF_RANGE' });
  return undefined;
};

const instant = (req: MockReq, name: string, problems: Detail[]): number | undefined => {
  const value = text(req.query[name]);
  if (value === '') return undefined;
  if (!INSTANT.test(value) || Number.isNaN(Date.parse(value))) {
    problems.push({ ref: name, reason: 'INVALID_FORMAT' });
    return undefined;
  }
  return Date.parse(value);
};

function filtered(req: MockReq): MockSession[] {
  const problems: Detail[] = [];
  const guest = bool(req, 'guest', problems);
  const inProgress = bool(req, 'inProgress', problems);
  const from = instant(req, 'from', problems);
  const to = instant(req, 'to', problems);
  const accountId = text(req.query.accountId);
  if (accountId !== '' && !UUID.test(accountId)) {
    problems.push({ ref: 'accountId', reason: 'INVALID_FORMAT' });
  }
  const endReason = text(req.query.endReason);
  if (endReason !== '' && !END_REASONS.includes(endReason)) {
    problems.push({ ref: 'endReason', reason: 'OUT_OF_RANGE' });
  }
  if (problems.length > 0) {
    throw invalidRequest(`invalid filter: ${problems.map((p) => p.ref).join(', ')}`, problems);
  }
  return sessionsState.sessions
    .filter((s) => {
      const requested = Date.parse(s.requestedAt);
      if (guest !== undefined && (s.accountId === null) !== guest) return false;
      if (inProgress !== undefined && (s.endedAt === null) !== inProgress) return false;
      if (accountId !== '' && s.accountId !== accountId) return false;
      if (endReason !== '' && s.endReason !== endReason) return false;
      if (from !== undefined && requested < from) return false;
      if (to !== undefined && requested >= to) return false;
      return true;
    })
    .sort((a, b) =>
      a.requestedAt === b.requestedAt
        ? a.id < b.id
          ? 1
          : -1
        : a.requestedAt < b.requestedAt
          ? 1
          : -1,
    );
}

export default {
  'GET /api/admin/sessions': guard('SESSION:VIEW', (req) => {
    const page = paginateQuery(filtered(req), req);
    return ok({ items: page.items.map(listRow), total: page.total });
  }),

  'GET /api/admin/sessions/:id': guard('SESSION:VIEW', (req) => {
    const found = sessionsState.sessions.find((s) => s.id === req.params.id);
    if (!found) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such session');
    return ok(detailRow(found));
  }),
};
