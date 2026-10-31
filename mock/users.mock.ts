// The user endpoints of the mock backend (contract 17.4: user management, authentication events, abuse
// detection, and the account state matrix). State lives in _core/usersData.ts. The names of the
// filters of `GET /users` and the fields of `GET /users/{id}/sessions` follow
// docs/contract-requests/2026-10-26-admin-frontend-users.md (the contract does not name them).
import { countCodePoints } from '../src/utils/codePoints';
import { trimSpec } from '../src/utils/trimSpec';
import { authenticate, guard, hasPermission } from './_core/auth';
import {
  bodyOf,
  fail,
  invalidRequest,
  MockHttpError,
  type MockReq,
  ok,
  toUmiFile,
} from './_core/http';
import { META_DEFAULTS } from './_core/meta';
import { paginateQuery } from './_core/paginate';
import { sessionsState } from './_core/sessionsData';
import { text } from './_core/statRange';
import { store } from './_core/store';
import {
  findUser,
  type MockDeletion,
  type MockUser,
  maskEmail,
  maskPhone,
  nextDeletionId,
  normaliseEmail,
  usersState,
} from './_core/usersData';
import { buildXlsx, XLSX_CONTENT_TYPE } from './_core/xlsx';

type Detail = { ref: string; reason: string };

const STATUSES = ['ACTIVE', 'BANNED', 'PENDING_DELETION', 'DELETING'];
const TRAFFIC = ['PAID', 'ORGANIC'];
const DELETION_STATUSES = ['SCHEDULED', 'CANCELED', 'PENDING', 'RUNNING', 'FAILED', 'COMPLETED'];
const BAN_REASON_MAX = 500;
const DELETION_REASON_MAX = 200;
const GRACE_DAYS = 14;
const EXPORTS_PER_HOUR = 10;

type Seen = { canEmail: boolean; canPhone: boolean };

const seenBy = (admin: Parameters<typeof hasPermission>[0]): Seen => ({
  canEmail: hasPermission(admin, 'USER:EMAIL_VIEW'),
  canPhone: hasPermission(admin, 'USER:PHONE_VIEW'),
});

const emailFor = (user: MockUser, seen: Seen): string | null =>
  user.email === null ? null : seen.canEmail ? user.email : maskEmail(user.email);
const phoneFor = (user: MockUser, seen: Seen): string | null =>
  user.phone === null ? null : seen.canPhone ? user.phone : maskPhone(user.phone);

const notFound = () => new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such account');
const invalidState = (status: string, message: string) =>
  new MockHttpError(409, 'INVALID_STATE', message, { status });

const userOf = (req: MockReq): MockUser => {
  const found = findUser(req.params.id ?? '');
  if (!found) throw notFound();
  return found;
};

const byNewest = (a: { createdAt: string; id: string }, b: { createdAt: string; id: string }) =>
  a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? 1 : -1;

// ---- the list ----

function filteredUsers(req: MockReq): MockUser[] {
  const status = text(req.query.status);
  if (status !== '' && !STATUSES.includes(status)) {
    throw invalidRequest('status is not a state', [{ ref: 'status', reason: 'OUT_OF_RANGE' }]);
  }
  const traffic = text(req.query.trafficType);
  if (traffic !== '' && !TRAFFIC.includes(traffic)) {
    throw invalidRequest('trafficType is PAID or ORGANIC', [
      { ref: 'trafficType', reason: 'OUT_OF_RANGE' },
    ]);
  }
  const accountId = trimSpec(text(req.query.accountId));
  const email = normaliseEmail(text(req.query.email));
  const phone = trimSpec(text(req.query.phone));
  const channelCode = trimSpec(text(req.query.channelCode));
  const mediaSource = trimSpec(text(req.query.mediaSource));
  return [...usersState.users]
    .filter((u) => (accountId === '' ? true : u.id === accountId))
    .filter((u) => (email === '' ? true : u.email !== null && normaliseEmail(u.email) === email))
    .filter((u) => (phone === '' ? true : u.phone === phone))
    .filter((u) => (status === '' ? true : u.status === status))
    .filter((u) => (channelCode === '' ? true : u.channelCode === channelCode))
    .filter((u) => (traffic === '' ? true : u.trafficType === traffic))
    .filter((u) =>
      mediaSource === ''
        ? true
        : (u.attribution?.mediaSource ?? '').toLowerCase() === mediaSource.toLowerCase(),
    )
    .sort(byNewest);
}

const listRow = (user: MockUser, seen: Seen) => ({
  id: user.id,
  email: emailFor(user, seen),
  phone: phoneFor(user, seen),
  status: user.status,
  channelCode: user.channelCode,
  trafficType: user.trafficType,
  createdAt: user.createdAt,
  timezone: user.timezone,
  conversationLanguage: user.conversationLanguage,
});

function detailRow(user: MockUser, seen: Seen) {
  return {
    id: user.id,
    email: emailFor(user, seen),
    emailVerifiedAt: user.emailVerifiedAt,
    phone: phoneFor(user, seen),
    phoneVerifiedAt: user.phoneVerifiedAt,
    status: user.status,
    banReason: user.banReason,
    bannedAt: user.bannedAt,
    currentAvatarAssetId: user.currentAvatarAssetId,
    currentVoiceAssetId: user.currentVoiceAssetId,
    personaModerationStatus: user.personaModerationStatus,
    companionName: user.companionName,
    timezone: user.timezone,
    conversationLanguage: user.conversationLanguage,
    lifetimeGrantSeconds: user.lifetimeGrantSeconds,
    lifetimeUsedSeconds: user.lifetimeUsedSeconds,
    channelCode: user.channelCode,
    registerPlatform: user.registerPlatform,
    priorInviteeRewarded: user.priorInviteeRewarded,
    inviteRewardedCount: user.inviteRewardedCount,
    createdAt: user.createdAt,
    loginMethods: [...user.loginMethods],
    trafficType: user.trafficType,
    companionship: { ...user.companionship },
    counts: { ...user.counts },
    attribution: user.attribution === null ? null : { ...user.attribution },
  };
}

// ---- reasons ----

/** A reason the contract trims (1.9) and counts in code points. */
function reasonProblem(value: unknown, max: number): { value: string; problem: Detail | null } {
  const trimmed = typeof value === 'string' ? trimSpec(value) : '';
  if (trimmed === '') return { value: '', problem: { ref: 'reason', reason: 'EMPTY_NOT_ALLOWED' } };
  if (countCodePoints(trimmed) > max) {
    return { value: trimmed, problem: { ref: 'reason', reason: 'TOO_LONG' } };
  }
  return { value: trimmed, problem: null };
}

// ---- deletion tasks ----

const deletionRow = (task: MockDeletion) => ({
  ...task,
  requestedByUsername:
    task.requestedBy === null ? null : (store.admins.get(task.requestedBy)?.username ?? null),
});

// ---- abuse clusters ----

function instantQuery(req: MockReq, name: 'from' | 'to', fallback: number): number {
  const raw = text(req.query[name]);
  if (raw === '') return fallback;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    throw invalidRequest(`${name} is not a time`, [{ ref: name, reason: 'OUT_OF_RANGE' }]);
  }
  return ms;
}

function byOf(req: MockReq): 'DEVICE' | 'IP' {
  const by = text(req.query.by);
  if (by !== 'DEVICE' && by !== 'IP') {
    throw invalidRequest('by is DEVICE or IP', [{ ref: 'by', reason: 'OUT_OF_RANGE' }]);
  }
  return by;
}

const keyOf = (user: MockUser, by: 'DEVICE' | 'IP'): string =>
  by === 'DEVICE' ? user.deviceKey : user.ipKey;

/**
 * A ban ends the calls the account has running with the end reason BANNED. The real backend does it
 * at once or, when that fails, in the next scan of its worker (`session.deadline_scan_seconds`); the
 * mock does it at once, in the calls of the account and in the call records.
 */
function endRunningCalls(accountId: string, at: string): void {
  const endedAt = Date.parse(at);
  for (const row of usersState.sessions.get(accountId) ?? []) {
    if (row.endedAt !== null) continue;
    row.endedAt = at;
    row.endReason = 'BANNED';
    row.durationSeconds = Math.max(
      0,
      Math.round((endedAt - Date.parse(row.startedAt ?? at)) / 1000),
    );
  }
  for (const call of sessionsState.sessions) {
    if (call.accountId !== accountId || call.endedAt !== null) continue;
    call.endedAt = at;
    call.userLeftAt = at;
    call.endReason = 'BANNED';
    call.durationSeconds = Math.max(0, Math.round((endedAt - Date.parse(call.startedAt)) / 1000));
  }
}

export default {
  // ---- the list and the export (the export first: `:id` would take "export" for an id) ----
  'GET /api/admin/users/export': toUmiFile((req) => {
    const admin = authenticate(req);
    if (!hasPermission(admin, 'USER:EXPORT') || !hasPermission(admin, 'USER:VIEW')) {
      throw new MockHttpError(
        403,
        'ADMIN_FORBIDDEN',
        'The administrator lacks the permission for this export',
      );
    }
    const now = Date.now();
    const recent = (store.exportUses.get(admin.id) ?? []).filter((t) => now - t < 3_600_000);
    if (recent.length >= EXPORTS_PER_HOUR) {
      store.exportUses.set(admin.id, recent);
      return fail(429, 'RATE_LIMITED', 'Too many exports this hour');
    }
    const seen = seenBy(admin);
    const rows = filteredUsers(req);
    store.exportUses.set(admin.id, [...recent, now]);
    const header = [
      'id',
      'email',
      'phone',
      'status',
      'channelCode',
      'trafficType',
      'createdAt',
      'timezone',
      'conversationLanguage',
    ];
    const sheet: (string | number | null)[][] = [
      header,
      ...rows.map((u) => {
        const row = listRow(u, seen);
        return header.map((key) => (row as Record<string, string | null>)[key]);
      }),
    ];
    return {
      file: {
        contentType: XLSX_CONTENT_TYPE,
        filename: `users-${new Date(now).toISOString().slice(0, 10)}.xlsx`,
        body: buildXlsx(sheet),
      },
    };
  }),

  'GET /api/admin/users': guard('USER:VIEW', (req) => {
    const seen = seenBy(req.admin);
    const page = paginateQuery(filteredUsers(req), req);
    return ok({ items: page.items.map((u) => listRow(u, seen)), total: page.total });
  }),

  'GET /api/admin/users/:id': guard('USER:VIEW', (req) =>
    ok(detailRow(userOf(req), seenBy(req.admin))),
  ),

  'GET /api/admin/users/:id/sessions': guard('USER:VIEW', (req) => {
    const user = userOf(req);
    const rows = [...(usersState.sessions.get(user.id) ?? [])].sort((a, b) =>
      a.requestedAt < b.requestedAt ? 1 : -1,
    );
    return ok(paginateQuery(rows, req));
  }),

  'GET /api/admin/users/:id/devices': guard('USER:VIEW', (req) => {
    const user = userOf(req);
    const rows = [...(usersState.devices.get(user.id) ?? [])].sort((a, b) =>
      a.lastSeenAt < b.lastSeenAt ? 1 : -1,
    );
    return ok({ items: rows.map((d) => ({ ...d })) });
  }),

  'GET /api/admin/users/:id/auth-events': guard('USER:VIEW', (req) => {
    const user = userOf(req);
    const rows = [...(usersState.authEvents.get(user.id) ?? [])].sort((a, b) =>
      a.at < b.at ? 1 : -1,
    );
    return ok(paginateQuery(rows, req));
  }),

  // ---- ban and unban (USER:BAN); the matrix of contract 17.4 ----
  'POST /api/admin/users/:id/ban': guard('USER:BAN', (req) => {
    const reason = reasonProblem(bodyOf(req).reason, BAN_REASON_MAX);
    if (reason.problem) throw invalidRequest('reason is not valid', [reason.problem]);
    const user = userOf(req);
    if (user.status !== 'ACTIVE') throw invalidState(user.status, 'The account cannot be banned');
    user.status = 'BANNED';
    user.banReason = reason.value;
    user.bannedAt = new Date().toISOString();
    endRunningCalls(user.id, user.bannedAt);
    return ok(null);
  }),

  'POST /api/admin/users/:id/unban': guard('USER:BAN', (req) => {
    const user = userOf(req);
    if (user.status !== 'BANNED') throw invalidState(user.status, 'The account is not banned');
    user.status = 'ACTIVE';
    user.banReason = null;
    user.bannedAt = null;
    return ok(null);
  }),

  // ---- deletion started and cancelled by an administrator (USER:DELETION) ----
  'POST /api/admin/users/:id/deletion': guard('USER:DELETION', (req) => {
    const reason = reasonProblem(bodyOf(req).reason, DELETION_REASON_MAX);
    if (reason.problem) throw invalidRequest('reason is not valid', [reason.problem]);
    const user = userOf(req);
    if (user.status !== 'ACTIVE' && user.status !== 'BANNED') {
      throw invalidState(user.status, 'A deletion is waiting or running already');
    }
    const now = new Date();
    usersState.deletions.push({
      id: nextDeletionId(),
      accountId: user.id,
      requestedBy: req.admin.id,
      reason: null, // only the user's own choice is kept here; the administrator's reason is for the audit log
      status: 'SCHEDULED',
      executeAfter: new Date(now.getTime() + GRACE_DAYS * 24 * 3_600_000).toISOString(),
      statusBefore: user.status,
      canceledAt: null,
      attempts: 0,
      lastError: null,
      nextAttemptAt: null,
      createdAt: now.toISOString(),
      completedAt: null,
    });
    user.status = 'PENDING_DELETION';
    return ok({ scheduledAt: usersState.deletions[usersState.deletions.length - 1].executeAfter });
  }),

  'POST /api/admin/users/:id/deletion/cancel': guard('USER:DELETION', (req) => {
    const user = userOf(req);
    const task = usersState.deletions.find(
      (t) => t.accountId === user.id && t.status === 'SCHEDULED',
    );
    if (user.status !== 'PENDING_DELETION' || !task) {
      throw invalidState(user.status, 'No deletion is waiting in its grace period');
    }
    task.status = 'CANCELED';
    task.canceledAt = new Date().toISOString();
    user.status = task.statusBefore ?? 'ACTIVE';
    return ok(null);
  }),

  // ---- deletion tasks ----
  'GET /api/admin/account-deletions': guard('USER:DELETION', (req) => {
    const status = text(req.query.status);
    if (status !== '' && !DELETION_STATUSES.includes(status)) {
      throw invalidRequest('status is not a task state', [
        { ref: 'status', reason: 'OUT_OF_RANGE' },
      ]);
    }
    const rows = usersState.deletions
      .filter((t) => (status === '' ? true : t.status === status))
      .sort(byNewest);
    const page = paginateQuery(rows, req);
    return ok({ items: page.items.map(deletionRow), total: page.total });
  }),

  'POST /api/admin/account-deletions/:id/retry': guard('USER:DELETION', (req) => {
    const task = usersState.deletions.find((t) => t.id === req.params.id);
    if (!task) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such task');
    if (task.status !== 'FAILED')
      throw invalidState(task.status, 'Only a failed task can be retried');
    // The executor claims the task as soon as it is due; the mock shows it already running.
    task.status = 'RUNNING';
    task.nextAttemptAt = new Date().toISOString();
    return ok(null);
  }),

  // ---- abuse clusters (ABUSE:VIEW) ----
  'GET /api/admin/abuse/clusters': guard('ABUSE:VIEW', (req) => {
    const by = byOf(req);
    const now = Date.now();
    const from = instantQuery(req, 'from', now - 7 * 24 * 3_600_000);
    const to = instantQuery(req, 'to', now + 1);
    const rawMin = text(req.query.minFreeAccounts);
    let min: number = META_DEFAULTS.abuseClusterMinFreeAccounts;
    if (rawMin !== '') {
      min = /^\d+$/.test(rawMin) ? Number(rawMin) : Number.NaN;
      if (Number.isNaN(min)) {
        throw invalidRequest('minFreeAccounts must be a whole number of zero or more', [
          { ref: 'minFreeAccounts', reason: 'OUT_OF_RANGE' },
        ]);
      }
    }
    const groups = new Map<string, MockUser[]>();
    for (const user of usersState.users) {
      const created = Date.parse(user.createdAt);
      if (created < from || created >= to) continue;
      const key = keyOf(user, by);
      groups.set(key, [...(groups.get(key) ?? []), user]);
    }
    const rows = [...groups.entries()]
      .map(([key, members]) => {
        const times = members.map((m) => m.createdAt).sort();
        const paidAccounts = members.filter((m) => m.paid).length;
        return {
          key,
          accounts: members.length,
          freeAccounts: members.length - paidAccounts,
          paidAccounts,
          firstCreatedAt: times[0],
          lastCreatedAt: times[times.length - 1],
        };
      })
      .filter((row) => row.freeAccounts >= min)
      .sort((a, b) => b.freeAccounts - a.freeAccounts || (a.key < b.key ? -1 : 1));
    return ok(paginateQuery(rows, req));
  }),

  'GET /api/admin/abuse/clusters/accounts': guard('ABUSE:VIEW', (req) => {
    const by = byOf(req);
    const key = text(req.query.key);
    const members = usersState.users.filter((u) => key !== '' && keyOf(u, by) === key);
    if (members.length === 0) {
      throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such cluster');
    }
    const page = paginateQuery([...members].sort(byNewest), req);
    return ok({
      items: page.items.map((u) => ({
        accountId: u.id,
        createdAt: u.createdAt,
        status: u.status,
        paid: u.paid,
        registerMethod: u.registerMethod,
      })),
      total: page.total,
    });
  }),
};
