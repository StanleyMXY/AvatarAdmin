import { beforeEach, describe, expect, it } from 'vitest';
import type { PermissionCode } from '../src/access/permissionCodes';
import type { MockReq, MockRes } from './_core/http';
import { resetSessionsStore, SESSION, sessionsState } from './_core/sessionsData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import { maskEmail, maskPhone, resetUsersStore, USER, usersState } from './_core/usersData';
import users from './users.mock';

beforeEach(() => {
  resetStore();
  resetUsersStore();
  resetSessionsStore();
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (users as unknown as Record<string, H>)[name];

/** A token of the preset administrator `user`, whose permissions are replaced when `codes` is given. */
const tokenOf = (user: string, codes?: PermissionCode[]) => {
  const admin = adminOf(user);
  if (codes) admin.permissions = codes;
  return bearer(issueToken(admin).token).authorization;
};
const get = (name: string, user: string, query: Record<string, unknown> = {}, params = {}) =>
  call(h(name), { headers: { authorization: tokenOf(user) }, query, params });
const getAs = (name: string, codes: PermissionCode[], query = {}, params = {}) =>
  call(h(name), { headers: { authorization: tokenOf('support', codes) }, query, params });
const send = (name: string, user: string, body: unknown, params = {}) =>
  call(h(name), { headers: { authorization: tokenOf(user) }, body, params });

const LIST = 'GET /api/admin/users';
const EXPORT = 'GET /api/admin/users/export';
const DETAIL = 'GET /api/admin/users/:id';
const SESSIONS = 'GET /api/admin/users/:id/sessions';
const DEVICES = 'GET /api/admin/users/:id/devices';
const EVENTS = 'GET /api/admin/users/:id/auth-events';
const BAN = 'POST /api/admin/users/:id/ban';
const UNBAN = 'POST /api/admin/users/:id/unban';
const START = 'POST /api/admin/users/:id/deletion';
const CANCEL = 'POST /api/admin/users/:id/deletion/cancel';
const TASKS = 'GET /api/admin/account-deletions';
const RETRY = 'POST /api/admin/account-deletions/:id/retry';
const CLUSTERS = 'GET /api/admin/abuse/clusters';
const CLUSTER_ACCOUNTS = 'GET /api/admin/abuse/clusters/accounts';

const statusOf = (id: string) => usersState.users.find((u) => u.id === id)?.status;

describe('masks', () => {
  it('keeps the first character of the local part and of every domain label but the last, and only the last four digits of a phone number', () => {
    expect(maskEmail('maria.garcia@example.com')).toBe('m***@e***.com');
    expect(maskEmail('a@b.org')).toBe('*@b***.org');
    expect(maskEmail('x.y@mail.example.co.uk')).toBe('x***@m***.e***.c***.uk');
    expect(maskPhone('+34612345678')).toBe('****5678');
  });
});

describe('permissions (contract 17.4, user row and the state matrix)', () => {
  const cases: [string, PermissionCode[], string][] = [
    [LIST, ['SUBSCRIPTION:VIEW'], 'USER:VIEW'],
    [DETAIL, ['SUBSCRIPTION:VIEW'], 'USER:VIEW'],
    [SESSIONS, ['SUBSCRIPTION:VIEW'], 'USER:VIEW'],
    [DEVICES, ['SUBSCRIPTION:VIEW'], 'USER:VIEW'],
    [EVENTS, ['SUBSCRIPTION:VIEW'], 'USER:VIEW'],
    [BAN, ['USER:VIEW'], 'USER:BAN'],
    [UNBAN, ['USER:VIEW'], 'USER:BAN'],
    [START, ['USER:VIEW', 'USER:BAN'], 'USER:DELETION'],
    [CANCEL, ['USER:VIEW', 'USER:BAN'], 'USER:DELETION'],
    [TASKS, ['USER:VIEW'], 'USER:DELETION'],
    [RETRY, ['USER:VIEW'], 'USER:DELETION'],
    [CLUSTERS, ['USER:VIEW', 'USER:BAN'], 'ABUSE:VIEW'],
    [CLUSTER_ACCOUNTS, ['USER:VIEW', 'USER:BAN'], 'ABUSE:VIEW'],
  ];
  it.each(cases)(
    '%s answers 403 ADMIN_FORBIDDEN to an administrator who has %j and lacks %s',
    async (name, codes) => {
      const { status, body } = await getAs(name, codes, { by: 'DEVICE' }, { id: USER.rich });
      expect(status).toBe(403);
      expect(body.code).toBe('ADMIN_FORBIDDEN');
    },
  );

  it('answers 401 without a token on every endpoint', async () => {
    for (const name of Object.keys(users)) {
      const { status } = await call(h(name), { params: { id: '1' } });
      expect(status, name).toBe(401);
    }
  });

  it('needs both USER:EXPORT and USER:VIEW for the export', async () => {
    const run = async (codes: PermissionCode[]) => {
      let status = 0;
      const res: MockRes = {
        status(code) {
          status = code;
          return res;
        },
        json: () => undefined,
        setHeader: () => undefined,
        end: () => undefined,
      };
      const req: MockReq = {
        headers: { authorization: tokenOf('support', codes) },
        query: {},
        params: {},
        body: undefined,
      };
      await (h(EXPORT) as unknown as (r: MockReq, s: MockRes) => Promise<void>)(req, res);
      return status;
    };
    expect(await run(['USER:EXPORT'])).toBe(403);
    expect(await run(['USER:VIEW'])).toBe(403);
    expect(await run(['USER:VIEW', 'USER:EXPORT'])).toBe(200);
  });
});

describe('GET /users', () => {
  it('lists the fields of the contract, newest account first, with a total', async () => {
    const { status, body } = await get(LIST, 'root', { pageSize: '200' });
    expect(status).toBe(200);
    const { items, total } = body.data;
    expect(total).toBe(usersState.users.length);
    expect(Object.keys(items[0]).sort()).toEqual(
      [
        'id',
        'email',
        'phone',
        'status',
        'channelCode',
        'trafficType',
        'createdAt',
        'timezone',
        'conversationLanguage',
      ].sort(),
    );
    const times = items.map((u: { createdAt: string }) => u.createdAt);
    expect(times).toEqual([...times].sort().reverse());
  });

  it('masks e-mail and phone for an administrator without the two view codes, and shows them whole to one with them', async () => {
    const masked = await getAs(LIST, ['USER:VIEW'], { accountId: USER.rich });
    const row = masked.body.data.items[0];
    expect(row.email).toBe('m***@e***.com');
    expect(row.phone).toBe('****5678');
    const emailOnly = await getAs(LIST, ['USER:VIEW', 'USER:EMAIL_VIEW'], { accountId: USER.rich });
    expect(emailOnly.body.data.items[0].email).toBe('maria.garcia@example.com');
    expect(emailOnly.body.data.items[0].phone).toBe('****5678');
    const both = await get(LIST, 'root', { accountId: USER.rich });
    expect(both.body.data.items[0].phone).toBe('+34612345678');
  });

  it('shows null for an account that has no e-mail or no phone number', async () => {
    const { body } = await get(LIST, 'root', { accountId: USER.noAttribution });
    expect(body.data.items[0].email).toBeNull();
    expect(body.data.items[0].phone).toBe('+66812345678');
  });

  it('filters by account id, full e-mail, full phone number, state, channel, traffic type and media source, each exact', async () => {
    const one = async (query: Record<string, string>) =>
      (await get(LIST, 'root', { ...query, pageSize: '200' })).body.data;
    expect((await one({ accountId: USER.rich })).items.map((u: { id: string }) => u.id)).toEqual([
      USER.rich,
    ]);
    // e-mail: a full address, in any case, with the ends cleaned; a part of it finds nothing
    expect((await one({ email: ' Maria.Garcia@Example.com ' })).total).toBe(1);
    expect((await one({ email: 'maria' })).total).toBe(0);
    expect((await one({ email: 'm***@e***.com' })).total).toBe(0);
    expect((await one({ phone: '+34612345678' })).total).toBe(1);
    expect((await one({ phone: '5678' })).total).toBe(0);
    const banned = await one({ status: 'BANNED' });
    expect(banned.total).toBeGreaterThan(0);
    expect(banned.items.every((u: { status: string }) => u.status === 'BANNED')).toBe(true);
    const paid = await one({ trafficType: 'PAID' });
    const organic = await one({ trafficType: 'ORGANIC' });
    expect(paid.total).toBeGreaterThan(0);
    expect(paid.total + organic.total).toBe(usersState.users.length);
    const channel = usersState.users.find((u) => u.channelCode)?.channelCode as string;
    expect(
      (await one({ channelCode: channel })).items.every(
        (u: { channelCode: string }) => u.channelCode === channel,
      ),
    ).toBe(true);
    const media = await one({ mediaSource: 'Facebook Ads' });
    expect(media.total).toBeGreaterThan(0);
    expect(media.items.map((u: { id: string }) => u.id)).toContain(USER.rich);
    // a filter that matches nothing is an empty page, not an error
    expect((await one({ accountId: 'no-such-account' })).total).toBe(0);
  });

  it('answers 400 INVALID_REQUEST with the parameter name for a page or size out of range, and does not clamp', async () => {
    for (const query of [{ pageSize: '201' }, { pageSize: '0' }, { page: '0' }, { page: 'x' }]) {
      const { status, body } = await get(LIST, 'root', query);
      expect(status).toBe(400);
      expect(body.code).toBe('INVALID_REQUEST');
      expect(body.data.details[0].ref).toBe(Object.keys(query)[0]);
    }
    const bad = await get(LIST, 'root', { status: 'NOPE' });
    expect(bad.status).toBe(400);
    expect(bad.body.data.details[0].ref).toBe('status');
  });
});

describe('GET /users/{id}', () => {
  it('returns the columns of User and the five derived fields, and nothing the backend keeps back', async () => {
    const { status, body } = await get(DETAIL, 'root', {}, { id: USER.rich });
    expect(status).toBe(200);
    const detail = body.data;
    expect(Object.keys(detail).sort()).toEqual(
      [
        'id',
        'email',
        'emailVerifiedAt',
        'phone',
        'phoneVerifiedAt',
        'status',
        'banReason',
        'bannedAt',
        'currentAvatarAssetId',
        'currentVoiceAssetId',
        'personaModerationStatus',
        'companionName',
        'timezone',
        'conversationLanguage',
        'lifetimeGrantSeconds',
        'lifetimeUsedSeconds',
        'channelCode',
        'registerPlatform',
        'priorInviteeRewarded',
        'inviteRewardedCount',
        'createdAt',
        'loginMethods',
        'trafficType',
        'companionship',
        'counts',
        'attribution',
      ].sort(),
    );
    expect(detail.loginMethods).toEqual(expect.arrayContaining(['EMAIL', 'GOOGLE']));
    expect(Object.keys(detail.companionship).sort()).toEqual(
      ['currentStreak', 'interactionCount', 'lastInteractionAt', 'lastInteractionDate'].sort(),
    );
    expect(Object.keys(detail.counts).sort()).toEqual(['avatars', 'cosmetics', 'looks', 'voices']);
    expect(Object.keys(detail.attribution).sort()).toEqual(
      ['campaign', 'installTime', 'matchType', 'mediaSource', 'registeredAt', 'source'].sort(),
    );
  });

  it('masks the e-mail and the phone number like the list does', async () => {
    const masked = await getAs(DETAIL, ['USER:VIEW'], {}, { id: USER.rich });
    expect(masked.body.data.email).toBe('m***@e***.com');
    expect(masked.body.data.phone).toBe('****5678');
  });

  it('has attribution null and companionship 0, 0, null, null for an account with neither', async () => {
    const { body } = await get(DETAIL, 'root', {}, { id: USER.noAttribution });
    expect(body.data.attribution).toBeNull();
    expect(body.data.companionship).toEqual({
      interactionCount: 0,
      currentStreak: 0,
      lastInteractionDate: null,
      lastInteractionAt: null,
    });
  });

  it('answers 404 RESOURCE_NOT_FOUND for an account that does not exist', async () => {
    const { status, body } = await get(DETAIL, 'root', {}, { id: 'nobody' });
    expect(status).toBe(404);
    expect(body.code).toBe('RESOURCE_NOT_FOUND');
  });
});

describe('sessions, devices and authentication events', () => {
  it('lists the sessions of the account, newest first, paged', async () => {
    const { body } = await get(SESSIONS, 'root', { page: '1', pageSize: '2' }, { id: USER.rich });
    expect(body.data.items).toHaveLength(2);
    expect(body.data.total).toBeGreaterThan(2);
    const times = body.data.items.map((s: { requestedAt: string }) => s.requestedAt);
    expect(times).toEqual([...times].sort().reverse());
  });

  it('gives the last six characters of the push token, never the token, and no paging', async () => {
    const { body } = await get(DEVICES, 'root', {}, { id: USER.rich });
    expect(body.data.total).toBeUndefined();
    expect(body.data.items.length).toBeGreaterThan(0);
    for (const device of body.data.items) {
      expect(Object.keys(device).sort()).toEqual(
        ['appVersion', 'id', 'lastSeenAt', 'locale', 'platform', 'tokenSuffix'].sort(),
      );
      expect(device.tokenSuffix).toHaveLength(6);
    }
  });

  it('gives eight-character hash prefixes, null for a missing device hash, newest first, with a total', async () => {
    const { body } = await get(EVENTS, 'root', { pageSize: '200' }, { id: USER.rich });
    const events = body.data.items;
    expect(body.data.total).toBe(events.length);
    expect(events.length).toBeGreaterThan(3);
    for (const event of events) {
      expect(Object.keys(event).sort()).toEqual(
        ['at', 'deviceIdHashPrefix', 'ipHashPrefix', 'reason', 'type'].sort(),
      );
      expect(event.ipHashPrefix).toMatch(/^[0-9a-f]{8}$/);
      if (event.deviceIdHashPrefix !== null)
        expect(event.deviceIdHashPrefix).toMatch(/^[0-9a-f]{8}$/);
    }
    expect(events.some((e: { deviceIdHashPrefix: unknown }) => e.deviceIdHashPrefix === null)).toBe(
      true,
    );
    expect(events.some((e: { reason: unknown }) => e.reason === null)).toBe(true);
    const times = events.map((e: { at: string }) => e.at);
    expect(times).toEqual([...times].sort().reverse());
  });

  it('answers 404 for the tabs of an account that does not exist', async () => {
    for (const name of [SESSIONS, DEVICES, EVENTS]) {
      expect((await get(name, 'root', {}, { id: 'nobody' })).status, name).toBe(404);
    }
  });
});

describe('ban and unban (contract 17.4 state matrix)', () => {
  const ban = (id: string, reason: unknown) => send(BAN, 'root', { reason }, { id });

  it('bans an active account: the state, the reason as trimmed and the time are set', async () => {
    const { status } = await ban(USER.negative, '  Spam links  ');
    expect(status).toBe(200);
    const detail = (await get(DETAIL, 'root', {}, { id: USER.negative })).body.data;
    expect(detail.status).toBe('BANNED');
    expect(detail.banReason).toBe('Spam links');
    expect(detail.bannedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('refuses an empty reason and a reason over 500 code points (not UTF-16 units) with the field', async () => {
    for (const reason of ['', '   ', undefined]) {
      const { status, body } = await ban(USER.negative, reason);
      expect(status).toBe(400);
      expect(body.data.details).toEqual([{ ref: 'reason', reason: 'EMPTY_NOT_ALLOWED' }]);
    }
    const tooLong = await ban(USER.negative, '😀'.repeat(501));
    expect(tooLong.body.data.details).toEqual([{ ref: 'reason', reason: 'TOO_LONG' }]);
    expect((await ban(USER.negative, '😀'.repeat(500))).status).toBe(200);
  });

  it('answers 409 INVALID_STATE with the current state for an account that is not active', async () => {
    for (const id of [USER.banned, USER.pendingDeletion, USER.deleting]) {
      const before = statusOf(id);
      const { status, body } = await ban(id, 'x');
      expect(status).toBe(409);
      expect(body.code).toBe('INVALID_STATE');
      expect(body.data).toEqual({ status: before });
    }
  });

  it('ends the calls the account has running with the end reason BANNED, in the calls of the account', async () => {
    const running = [...usersState.sessions.entries()].find(
      ([id, rows]) =>
        usersState.users.find((u) => u.id === id)?.status === 'ACTIVE' &&
        rows.some((r) => r.endedAt === null) &&
        rows.some((r) => r.endedAt !== null && r.endReason !== 'BANNED'),
    );
    expect(running).toBeTruthy();
    const id = (running as [string, unknown])[0];
    const before = (usersState.sessions.get(id) ?? []).map((r) => ({ ...r }));
    const open = before.filter((r) => r.endedAt === null).map((r) => r.id);
    expect((await ban(id, 'Spam')).status).toBe(200);
    for (const row of usersState.sessions.get(id) ?? []) {
      if (!open.includes(row.id)) continue;
      expect(row.endReason).toBe('BANNED');
      expect(Date.parse(row.endedAt ?? '')).not.toBeNaN();
      expect(row.durationSeconds).toBeGreaterThanOrEqual(0);
    }
    // a call that had ended already keeps its own reason
    const ended = before.find((r) => r.endedAt !== null && r.endReason !== 'BANNED');
    expect(ended).toBeTruthy();
    expect(usersState.sessions.get(id)?.find((r) => r.id === ended?.id)?.endReason).toBe(
      ended?.endReason,
    );
  });

  it('ends the running call of the call records page the same way', async () => {
    const running = sessionsState.sessions.find((s) => s.id === SESSION.ongoing);
    expect(running).toMatchObject({ accountId: USER.negative, endedAt: null, endReason: null });
    expect((await ban(USER.negative, 'Spam')).status).toBe(200);
    expect(running?.endReason).toBe('BANNED');
    expect(Date.parse(running?.endedAt ?? '')).not.toBeNaN();
    expect(running?.userLeftAt).toBe(running?.endedAt);
    expect(running?.durationSeconds).toBeGreaterThanOrEqual(0);
    // the call of a guest and the calls of another account are not touched
    expect(sessionsState.sessions.find((s) => s.id === SESSION.guestOngoing)?.endReason).toBeNull();
  });

  it('does not touch the calls of the account when the ban is refused', async () => {
    const before = JSON.stringify(usersState.sessions.get(USER.pendingDeletion));
    expect((await ban(USER.pendingDeletion, 'x')).status).toBe(409);
    expect(JSON.stringify(usersState.sessions.get(USER.pendingDeletion))).toBe(before);
  });

  it('unbans only a banned account and clears the reason and the time', async () => {
    expect((await send(UNBAN, 'root', {}, { id: USER.banned })).status).toBe(200);
    const detail = (await get(DETAIL, 'root', {}, { id: USER.banned })).body.data;
    expect(detail.status).toBe('ACTIVE');
    expect(detail.banReason).toBeNull();
    expect(detail.bannedAt).toBeNull();
    for (const id of [USER.rich, USER.pendingDeletion, USER.deleting]) {
      const { status, body } = await send(UNBAN, 'root', {}, { id });
      expect(status).toBe(409);
      expect(body.data).toEqual({ status: statusOf(id) });
    }
  });

  it('answers 404 for an account that does not exist', async () => {
    expect((await ban('nobody', 'x')).status).toBe(404);
    expect((await send(UNBAN, 'root', {}, { id: 'nobody' })).status).toBe(404);
  });
});

describe('starting and cancelling a deletion (contract 17.4 state matrix)', () => {
  const start = (id: string, reason: unknown) => send(START, 'root', { reason }, { id });
  const cancel = (id: string) => send(CANCEL, 'root', {}, { id });
  const tasksOf = async (query: Record<string, unknown> = {}) =>
    (await get(TASKS, 'root', { pageSize: '200', ...query })).body.data.items as {
      id: string;
      accountId: string;
      status: string;
      requestedBy: string | null;
      reason: string | null;
      statusBefore: string | null;
    }[];

  it('starts a deletion for an active account: it waits in its grace period, a task is scheduled and records who asked', async () => {
    const { status } = await start(USER.negative, ' The user wrote to support ');
    expect(status).toBe(200);
    expect(statusOf(USER.negative)).toBe('PENDING_DELETION');
    const task = (await tasksOf()).find((t) => t.accountId === USER.negative);
    expect(task).toMatchObject({
      status: 'SCHEDULED',
      requestedBy: adminOf('root').id,
      reason: null,
      statusBefore: 'ACTIVE',
    });
  });

  it('starts one for a banned account, and cancelling it brings the ban back', async () => {
    expect((await start(USER.banned, 'x')).status).toBe(200);
    expect(statusOf(USER.banned)).toBe('PENDING_DELETION');
    expect((await cancel(USER.banned)).status).toBe(200);
    expect(statusOf(USER.banned)).toBe('BANNED');
  });

  it('refuses an empty reason and one over 200 code points', async () => {
    const empty = await start(USER.negative, '  ');
    expect(empty.body.data.details).toEqual([{ ref: 'reason', reason: 'EMPTY_NOT_ALLOWED' }]);
    const long = await start(USER.negative, 'あ'.repeat(201));
    expect(long.body.data.details).toEqual([{ ref: 'reason', reason: 'TOO_LONG' }]);
    expect((await start(USER.negative, '😀'.repeat(200))).status).toBe(200);
  });

  it('answers 409 INVALID_STATE with the current state when a deletion is waiting or running', async () => {
    for (const id of [USER.pendingDeletion, USER.deleting]) {
      const { status, body } = await start(id, 'x');
      expect(status).toBe(409);
      expect(body.data).toEqual({ status: statusOf(id) });
    }
  });

  it('cancels only in the grace period: the account is active again and the task is canceled', async () => {
    expect((await cancel(USER.pendingDeletion)).status).toBe(200);
    expect(statusOf(USER.pendingDeletion)).toBe('ACTIVE');
    expect((await tasksOf()).find((t) => t.accountId === USER.pendingDeletion)?.status).toBe(
      'CANCELED',
    );
    for (const id of [USER.rich, USER.banned, USER.deleting, USER.pendingDeletion]) {
      const { status, body } = await cancel(id);
      expect(status).toBe(409);
      expect(body.data).toEqual({ status: statusOf(id) });
    }
  });
});

describe('GET /account-deletions and its retry', () => {
  it('lists the tasks newest first with the name of the administrator, null for one who was deleted, and filters by state', async () => {
    const all = (await get(TASKS, 'root', { pageSize: '200' })).body.data;
    expect(
      all.items.some((t: { requestedByUsername: unknown }) => t.requestedByUsername === 'root'),
    ).toBe(true);
    expect(
      all.items.some(
        (t: { requestedBy: unknown; requestedByUsername: unknown }) =>
          t.requestedBy !== null && t.requestedByUsername === null,
      ),
    ).toBe(true);
    const statuses = new Set(all.items.map((t: { status: string }) => t.status));
    expect([...statuses].sort()).toEqual(
      ['CANCELED', 'COMPLETED', 'FAILED', 'PENDING', 'RUNNING', 'SCHEDULED'].sort(),
    );
    const reasons = new Set(all.items.map((t: { reason: string | null }) => t.reason));
    expect(reasons.size).toBe(7); // the six reasons and null
    const failed = (await get(TASKS, 'root', { status: 'FAILED' })).body.data;
    expect(failed.items.every((t: { status: string }) => t.status === 'FAILED')).toBe(true);
    expect(failed.total).toBeGreaterThan(1);
    expect((await get(TASKS, 'root', { status: 'NOPE' })).status).toBe(400);
  });

  it('retries a failed task and answers 409 INVALID_STATE with the task state for any other', async () => {
    const tasks = usersState.deletions;
    const failed = tasks.find((t) => t.status === 'FAILED');
    expect(failed).toBeDefined();
    expect((await send(RETRY, 'root', {}, { id: failed?.id })).status).toBe(200);
    expect(failed?.status).toBe('RUNNING');
    const other = tasks.find((t) => t.status === 'COMPLETED');
    const { status, body } = await send(RETRY, 'root', {}, { id: other?.id });
    expect(status).toBe(409);
    expect(body.data).toEqual({ status: 'COMPLETED' });
    expect((await send(RETRY, 'root', {}, { id: 'nope' })).status).toBe(404);
  });
});

describe('abuse clusters (contract 17.4, abuse row)', () => {
  const range = () => {
    const to = new Date(Date.now() + 86_400_000).toISOString();
    const from = new Date(Date.now() - 7 * 86_400_000).toISOString();
    return { from, to };
  };

  it('lists only the clusters with at least the default threshold of free accounts, most free accounts first, whole keys', async () => {
    const { status, body } = await get(CLUSTERS, 'root', { by: 'DEVICE', ...range() });
    expect(status).toBe(200);
    const rows = body.data.items;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r: { freeAccounts: number }) => r.freeAccounts >= 5)).toBe(true);
    const free = rows.map((r: { freeAccounts: number }) => r.freeAccounts);
    expect(free).toEqual([...free].sort((a, b) => b - a));
    expect(Object.keys(rows[0]).sort()).toEqual(
      ['accounts', 'firstCreatedAt', 'freeAccounts', 'key', 'lastCreatedAt', 'paidAccounts'].sort(),
    );
    expect(rows[0].key).toHaveLength(64);
    expect(rows[0].accounts).toBe(rows[0].freeAccounts + rows[0].paidAccounts);
    expect(body.data.total).toBe(rows.length);
  });

  it('shows smaller clusters when the threshold is lower, and the IP view differs from the device view', async () => {
    const dflt = (await get(CLUSTERS, 'root', { by: 'DEVICE', ...range() })).body.data.total;
    const low = (await get(CLUSTERS, 'root', { by: 'DEVICE', minFreeAccounts: '2', ...range() }))
      .body.data.total;
    expect(low).toBeGreaterThan(dflt);
    const ip = (await get(CLUSTERS, 'root', { by: 'IP', ...range() })).body.data;
    expect(ip.total).toBeGreaterThan(0);
  });

  it('counts only the accounts created in the range', async () => {
    const narrow = {
      from: new Date(Date.now() + 86_400_000).toISOString(),
      to: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    };
    expect((await get(CLUSTERS, 'root', { by: 'DEVICE', ...narrow })).body.data.total).toBe(0);
  });

  it('answers 400 INVALID_REQUEST with the parameter for a bad by, range or threshold', async () => {
    const ref = async (query: Record<string, unknown>) => {
      const { status, body } = await get(CLUSTERS, 'root', query);
      expect(status).toBe(400);
      return body.data.details[0].ref;
    };
    expect(await ref({ by: 'COUNTRY', ...range() })).toBe('by');
    expect(await ref({ by: 'IP', from: 'yesterday', to: range().to })).toBe('from');
    expect(await ref({ by: 'IP', minFreeAccounts: '-1', ...range() })).toBe('minFreeAccounts');
  });

  it('lists the accounts of a cluster with the paid flag, the method and the state, and 404 for a key that is not one', async () => {
    const cluster = (await get(CLUSTERS, 'root', { by: 'DEVICE', ...range() })).body.data.items[0];
    const { status, body } = await get(CLUSTER_ACCOUNTS, 'root', {
      by: 'DEVICE',
      key: cluster.key,
    });
    expect(status).toBe(200);
    expect(body.data.total).toBe(cluster.accounts);
    for (const account of body.data.items) {
      expect(Object.keys(account).sort()).toEqual(
        ['accountId', 'createdAt', 'paid', 'registerMethod', 'status'].sort(),
      );
      expect(typeof account.paid).toBe('boolean');
      expect(['EMAIL', 'GOOGLE', 'APPLE', 'PHONE']).toContain(account.registerMethod);
    }
    expect(body.data.items.filter((a: { paid: boolean }) => a.paid)).toHaveLength(
      cluster.paidAccounts,
    );
    expect((await get(CLUSTER_ACCOUNTS, 'root', { by: 'DEVICE', key: 'nope' })).status).toBe(404);
  });

  it('shows the new state in the cluster after a ban', async () => {
    const cluster = (await get(CLUSTERS, 'root', { by: 'DEVICE', ...range() })).body.data.items[0];
    const first = (
      await get(CLUSTER_ACCOUNTS, 'root', { by: 'DEVICE', key: cluster.key })
    ).body.data.items.find(
      (a: { paid: boolean; status: string }) => !a.paid && a.status === 'ACTIVE',
    );
    await send(BAN, 'root', { reason: 'Multiple accounts' }, { id: first.accountId });
    const after = (
      await get(CLUSTER_ACCOUNTS, 'root', { by: 'DEVICE', key: cluster.key })
    ).body.data.items.find((a: { accountId: string }) => a.accountId === first.accountId);
    expect(after.status).toBe('BANNED');
  });
});

describe('GET /users/export', () => {
  const download = async (codes: PermissionCode[], query: Record<string, string> = {}) => {
    const answer: { status: number; file?: Buffer; type?: string; json?: { code: string } } = {
      status: 0,
    };
    const res: MockRes = {
      status(code) {
        answer.status = code;
        return res;
      },
      json(body) {
        answer.json = body as { code: string };
        return undefined;
      },
      setHeader(key, value) {
        if (key === 'Content-Type') answer.type = value;
      },
      end(body) {
        answer.file = body as Buffer;
      },
    };
    const req: MockReq = {
      headers: { authorization: tokenOf('support', codes) },
      query,
      params: {},
      body: undefined,
    };
    await (h(EXPORT) as unknown as (r: MockReq, s: MockRes) => Promise<void>)(req, res);
    return answer;
  };

  it('writes the rows of the filter, masked unless the administrator may see them, and nothing else', async () => {
    const masked = await download(['USER:VIEW', 'USER:EXPORT'], { accountId: USER.rich });
    expect(masked.type).toMatch(/spreadsheetml/);
    const text = (masked.file as Buffer).toString('utf8');
    expect(text).toContain('m***@e***.com');
    expect(text).toContain('****5678');
    expect(text).not.toContain('maria.garcia@example.com');
    expect(text).not.toContain(USER.negative);
    const whole = await download(
      ['USER:VIEW', 'USER:EXPORT', 'USER:EMAIL_VIEW', 'USER:PHONE_VIEW'],
      { accountId: USER.rich },
    );
    expect((whole.file as Buffer).toString('utf8')).toContain('+34612345678');
  });

  it('answers 429 after the hourly number of exports, with JSON and no file', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await download(['USER:VIEW', 'USER:EXPORT'])).status).toBe(200);
    }
    const refused = await download(['USER:VIEW', 'USER:EXPORT']);
    expect(refused.status).toBe(429);
    expect(refused.file).toBeUndefined();
    expect(refused.json?.code).toBe('RATE_LIMITED');
  });
});
