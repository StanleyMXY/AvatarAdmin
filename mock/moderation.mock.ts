// The content moderation endpoints of the mock backend (contract 11.2 to 11.4 and 17.4, content
// moderation row; backend reply 8 for the rule list, the backend note for the transcript). State
// lives in _core/moderationData.ts. The filter by content type is not in the contract; the question
// is in docs/contract-requests/2026-10-26-admin-frontend-moderation.md.
import { countCodePoints } from '../src/utils/codePoints';
import { trimSpec } from '../src/utils/trimSpec';
import { guard } from './_core/auth';
import { currentValue } from './_core/configStore';
import { bodyOf, invalidRequest, MockHttpError, type MockReq, ok, toUmiFile } from './_core/http';
import {
  findRecord,
  MEDIA_TYPE,
  type MockRecord,
  type MockRule,
  mediaFile,
  moderationState,
  nextRuleId,
  signAddress,
} from './_core/moderationData';
import { paginateQuery } from './_core/paginate';
import { rangeOf, text } from './_core/statRange';
import { store } from './_core/store';

type Detail = { ref: string; reason: string };

const STATUSES = ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'BLOCKED'];
const SOURCES = ['AUTO', 'REPORT', 'COMPLAINT'];
const CONTENT_TYPES = [
  'AVATAR',
  'VOICE',
  'MESSAGE',
  'PERSONA',
  'COMPANION_NAME',
  'AVATAR_IMAGE',
  'ACTION_CLIP',
];
const MATCH_MODES = ['SUBSTRING', 'WORD', 'REGEX'];
const LEVELS = ['REVIEW', 'BLOCK'];
const PATTERN_MAX = 200;
const NOTE_MAX = 200;
const DECISION_NOTE_MAX = 500;
const RULES_MAX_DEFAULT = 200;

const usernameOf = (adminId: string | null): string | null =>
  adminId === null ? null : (store.admins.get(adminId)?.username ?? null);

const recordRow = (record: MockRecord) => ({
  ...record,
  reviewedByUsername: usernameOf(record.reviewedBy),
});

function enumParam(req: MockReq, name: string, allowed: readonly string[]): string {
  const value = text(req.query[name]);
  if (value !== '' && !allowed.includes(value)) {
    throw invalidRequest(`${name} is not one of ${allowed.join(', ')}`, [
      { ref: name, reason: 'OUT_OF_RANGE' },
    ]);
  }
  return value;
}

/** Waiting ones first, the longest waiting first; then the others, the newest first. */
function byQueueOrder(a: MockRecord, b: MockRecord): number {
  const aWaits = a.status === 'PENDING_REVIEW';
  const bWaits = b.status === 'PENDING_REVIEW';
  if (aWaits !== bWaits) return aWaits ? -1 : 1;
  if (aWaits) return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
}

const notFound = () => new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such record');

/** Mean of the handling times, in seconds, of the records handled in the range; null when there is none. */
function averageHandleSeconds(records: MockRecord[], from: string, to: string): number | null {
  const handled = records.filter(
    (r) =>
      (r.status === 'APPROVED' || r.status === 'REJECTED') &&
      r.reviewedAt !== null &&
      r.reviewedAt.slice(0, 10) >= from &&
      r.reviewedAt.slice(0, 10) <= to,
  );
  if (handled.length === 0) return null;
  const total = handled.reduce(
    (sum, r) => sum + (Date.parse(r.reviewedAt as string) - Date.parse(r.createdAt)) / 1000,
    0,
  );
  return Math.round(total / handled.length);
}

type Cell = {
  statDate: string;
  contentType: string;
  source: string;
  created: number;
  approved: number;
  rejected: number;
  blocked: number;
};

function statRows(records: MockRecord[], from: string, to: string): Cell[] {
  const cells = new Map<string, Cell>();
  const cell = (day: string, r: MockRecord): Cell | null => {
    if (day < from || day > to) return null;
    const key = `${day}|${r.contentType}|${r.source}`;
    let found = cells.get(key);
    if (!found) {
      found = {
        statDate: day,
        contentType: r.contentType,
        source: r.source,
        created: 0,
        approved: 0,
        rejected: 0,
        blocked: 0,
      };
      cells.set(key, found);
    }
    return found;
  };
  for (const r of records) {
    const created = cell(r.createdAt.slice(0, 10), r);
    if (created) {
      created.created += 1;
      if (r.status === 'BLOCKED') created.blocked += 1;
    }
    if (r.reviewedAt && (r.status === 'APPROVED' || r.status === 'REJECTED')) {
      const decided = cell(r.reviewedAt.slice(0, 10), r);
      if (decided) {
        if (r.status === 'APPROVED') decided.approved += 1;
        else decided.rejected += 1;
      }
    }
  }
  return [...cells.values()].sort(
    (a, b) =>
      a.statDate.localeCompare(b.statDate) ||
      a.contentType.localeCompare(b.contentType) ||
      a.source.localeCompare(b.source),
  );
}

type RuleInput = {
  id?: unknown;
  pattern?: unknown;
  matchMode?: unknown;
  level?: unknown;
  note?: unknown;
};

/** Problems of one element, with the reasons of contract 11.2 (the mock compiles with JS, the backend with Java `Pattern`). */
function ruleProblems(input: RuleInput, index: number): Detail[] {
  const ref = String(index);
  const details: Detail[] = [];
  const pattern = typeof input.pattern === 'string' ? trimSpec(input.pattern) : '';
  if (pattern === '') details.push({ ref, reason: 'EMPTY_NOT_ALLOWED' });
  else if (countCodePoints(pattern) > PATTERN_MAX) details.push({ ref, reason: 'TOO_LONG' });
  if (typeof input.matchMode !== 'string' || !MATCH_MODES.includes(input.matchMode)) {
    details.push({ ref, reason: 'OUT_OF_RANGE' });
  }
  if (typeof input.level !== 'string' || !LEVELS.includes(input.level)) {
    details.push({ ref, reason: 'OUT_OF_RANGE' });
  }
  if (input.matchMode === 'REGEX' && pattern !== '') {
    try {
      new RegExp(pattern, 'iu');
    } catch {
      details.push({ ref, reason: 'INVALID_PATTERN' });
    }
  }
  const note = typeof input.note === 'string' ? trimSpec(input.note) : '';
  if (countCodePoints(note) > NOTE_MAX) details.push({ ref, reason: 'TOO_LONG' });
  return details;
}

const rulesMax = (): number => {
  const value = currentValue('moderation.text_rules_max');
  return typeof value === 'number' && value >= 1 ? value : RULES_MAX_DEFAULT;
};

export default {
  'GET /api/admin/moderation/records': guard('MODERATION:VIEW', (req) => {
    const status = enumParam(req, 'status', STATUSES);
    const source = enumParam(req, 'source', SOURCES);
    const contentType = enumParam(req, 'contentType', CONTENT_TYPES);
    const rows = moderationState.records
      .filter((r) => (status === '' ? true : r.status === status))
      .filter((r) => (source === '' ? true : r.source === source))
      .filter((r) => (contentType === '' ? true : r.contentType === contentType))
      .sort(byQueueOrder);
    const page = paginateQuery(rows, req);
    return ok({ items: page.items.map(recordRow), total: page.total });
  }),

  'GET /api/admin/moderation/records/:id': guard('MODERATION:VIEW', (req) => {
    const found = findRecord(req.params.id);
    if (!found) throw notFound();
    return ok(recordRow(found));
  }),

  'GET /api/admin/moderation/records/:id/content': guard('MODERATION:REVIEW', (req) => {
    const found = findRecord(req.params.id);
    if (!found) throw notFound();
    const content = moderationState.contents[found.id] ?? null;
    if (found.status === 'BLOCKED' || content === null) {
      throw new MockHttpError(404, 'CONTENT_NOT_STORED', 'The original is not stored any more');
    }
    moderationState.views.push({
      recordId: found.id,
      adminId: req.admin.id,
      at: new Date().toISOString(),
    });
    if (content.kind === 'TEXT') return ok({ kind: 'TEXT', text: content.text });
    return ok({
      kind: 'FILE',
      mediaType: MEDIA_TYPE[content.media],
      url: signAddress(content.media),
      ...(content.text ? { text: content.text } : {}),
    });
  }),

  'POST /api/admin/moderation/records/:id/decision': guard('MODERATION:REVIEW', (req) => {
    const body = bodyOf(req);
    const details: Detail[] = [];
    if (body.decision !== 'APPROVE' && body.decision !== 'REJECT') {
      details.push({ ref: 'decision', reason: 'OUT_OF_RANGE' });
    }
    const note = typeof body.note === 'string' ? trimSpec(body.note) : '';
    if (body.decision === 'REJECT' && note === '') {
      details.push({ ref: 'note', reason: 'EMPTY_NOT_ALLOWED' });
    } else if (countCodePoints(note) > DECISION_NOTE_MAX) {
      details.push({ ref: 'note', reason: 'TOO_LONG' });
    }
    if (details.length > 0) throw invalidRequest('invalid decision', details);

    const found = findRecord(req.params.id);
    if (!found) throw notFound();
    if (found.status !== 'PENDING_REVIEW') {
      throw new MockHttpError(409, 'INVALID_STATE', 'The record was handled already', {
        status: found.status,
      });
    }
    found.status = body.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    found.reviewedBy = req.admin.id;
    found.reviewedAt = new Date().toISOString();
    found.note = note === '' ? null : note;
    return ok(null);
  }),

  'GET /api/admin/moderation/stats': guard('MODERATION:VIEW', (req) => {
    const { from, to } = rangeOf(req);
    const pending = moderationState.records.filter((r) => r.status === 'PENDING_REVIEW');
    const oldest = pending.reduce<number | null>((min, r) => {
      const at = Date.parse(r.createdAt);
      return min === null || at < min ? at : min;
    }, null);
    return ok({
      items: statRows(moderationState.records, from, to),
      avgHandleSeconds: averageHandleSeconds(moderationState.records, from, to),
      oldestPendingSeconds:
        oldest === null ? null : Math.max(0, Math.round((Date.now() - oldest) / 1000)),
    });
  }),

  'GET /api/admin/moderation/text-rules': guard('MODERATION:CONFIG', () =>
    ok({ items: moderationState.rules.map((rule) => ({ ...rule })) }),
  ),

  'PUT /api/admin/moderation/text-rules': guard('MODERATION:CONFIG', (req) => {
    const body = bodyOf(req);
    if (!Array.isArray(body.items)) {
      throw invalidRequest('items must be a list', [{ ref: 'items', reason: 'OUT_OF_RANGE' }]);
    }
    const items = body.items as RuleInput[];
    if (items.length > rulesMax()) {
      throw invalidRequest('there are more rules than allowed', [
        { ref: 'items', reason: 'OUT_OF_RANGE' },
      ]);
    }
    const details = items.flatMap((item, index) => ruleProblems(item ?? {}, index));
    if (details.length > 0) throw invalidRequest('invalid rule list', details);

    const current = new Set(moderationState.rules.map((rule) => rule.id));
    const next: MockRule[] = items.map((item) => ({
      id: typeof item.id === 'string' && current.has(item.id) ? item.id : nextRuleId(),
      pattern: trimSpec(item.pattern as string),
      matchMode: item.matchMode as MockRule['matchMode'],
      level: item.level as MockRule['level'],
      note: typeof item.note === 'string' ? trimSpec(item.note) : '',
    }));
    moderationState.rules = next;
    return ok({ items: next.map((rule) => ({ ...rule })) });
  }),

  // The address a signed file answer points to (the mock's stand-in for the storage service). It
  // takes no token, as a real signed address does; the signature decides.
  'GET /api/admin/moderation/mock-media/:kind': toUmiFile((req) => {
    const signature = text(req.query.sig);
    const until = moderationState.signatures[signature];
    const file = mediaFile(req.params.kind);
    if (until === undefined || until < Date.now() || !file) {
      return {
        status: 403,
        body: { code: 'ADMIN_FORBIDDEN', message: 'The address is not valid any more', data: null },
      };
    }
    return { file };
  }),
};
