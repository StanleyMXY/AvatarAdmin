import { beforeEach, describe, expect, it } from 'vitest';
import type { PermissionCode } from '../src/access/permissionCodes';
import { sampleAny } from './_core/fixtures';
import type { MockReq, MockRes } from './_core/http';
import { GUEST_DEVICE, resetSessionsStore, SESSION, sessionsState } from './_core/sessionsData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import sessions from './sessions.mock';

beforeEach(() => {
  resetStore();
  resetSessionsStore();
});

type H = (req: MockReq, res: MockRes) => unknown;
const h = (name: string) => (sessions as unknown as Record<string, H>)[name];

const LIST = 'GET /api/admin/sessions';
const DETAIL = 'GET /api/admin/sessions/:id';

// `root` holds every permission; to try a missing one a preset administrator gets exactly these codes.
const tokenOf = (user: string, codes?: PermissionCode[]) => {
  const admin = adminOf(codes ? 'support' : user);
  if (codes) admin.permissions = codes;
  return bearer(issueToken(admin).token).authorization;
};
const list = (query: Record<string, unknown> = {}, codes?: PermissionCode[]) =>
  call(h(LIST), { headers: { authorization: tokenOf('root', codes) }, query });
const detail = (id: string, codes?: PermissionCode[]) =>
  call(h(DETAIL), { headers: { authorization: tokenOf('root', codes) }, params: { id } });

type Row = {
  id: string;
  accountId: string | null;
  deviceId: string | null;
  requestedAt: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  modelTier: string | null;
  language: string | null;
};

describe('the session endpoints of the mock backend', () => {
  it('serves exactly the two endpoints of the contract', () => {
    expect(Object.keys(sessions).sort()).toEqual([DETAIL, LIST].sort());
  });

  it('needs a sign-in and SESSION:VIEW', async () => {
    const noToken = await call(h(LIST), {});
    expect(noToken.status).toBe(401);
    const forbidden = await list({}, ['STATS:VIEW']);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('ADMIN_FORBIDDEN');
    expect((await detail(SESSION.registered, ['STATS:VIEW'])).status).toBe(403);
    expect((await list({}, ['SESSION:VIEW'])).status).toBe(200);
  });

  it('lists the columns of the contract and no more, newest request first, 20 to a page', async () => {
    const { body } = await list();
    expect(body.data.items).toHaveLength(20);
    expect(body.data.total).toBe(sessionsState.sessions.length);
    expect(Object.keys(body.data.items[0]).sort()).toEqual(
      [
        'id',
        'accountId',
        'deviceId',
        'requestedAt',
        'startedAt',
        'endedAt',
        'durationSeconds',
        'modelTier',
        'language',
      ].sort(),
    );
    const times = (body.data.items as Row[]).map((r) => r.requestedAt);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('pages with page and pageSize and refuses a value out of range without cutting it', async () => {
    const second = await list({ page: '2', pageSize: '10' });
    const first = await list({ page: '1', pageSize: '10' });
    expect(second.body.data.items).toHaveLength(10);
    expect(second.body.data.items[0].id).not.toBe(first.body.data.items[0].id);
    const bad = await list({ pageSize: '201' });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('INVALID_REQUEST');
    expect(bad.body.data.details).toEqual([{ ref: 'pageSize', reason: 'OUT_OF_RANGE' }]);
  });

  it('has guest sessions with a device and no account, and account sessions with an account and no device', async () => {
    const { body } = await list({ pageSize: '200' });
    const rows = body.data.items as Row[];
    const guests = rows.filter((r) => r.accountId === null);
    const accounts = rows.filter((r) => r.accountId !== null);
    expect(guests.length).toBeGreaterThan(3);
    expect(accounts.length).toBeGreaterThan(10);
    for (const g of guests) expect(typeof g.deviceId).toBe('string');
    for (const a of accounts) expect(a.deviceId).toBeNull();
  });

  it('filters by guest=true and guest=false, and refuses another value', async () => {
    const guests = (await list({ guest: 'true', pageSize: '200' })).body.data.items as Row[];
    expect(guests.length).toBeGreaterThan(0);
    expect(guests.every((r) => r.accountId === null)).toBe(true);
    const accounts = (await list({ guest: 'false', pageSize: '200' })).body.data.items as Row[];
    expect(accounts.length).toBeGreaterThan(0);
    expect(accounts.every((r) => r.accountId !== null)).toBe(true);
    // only the lower-case words are known (answer 54): anything else is 400 OUT_OF_RANGE on the parameter
    for (const value of ['maybe', 'TRUE', 'True', '1', 'yes']) {
      const bad = await list({ guest: value });
      expect([value, bad.status, bad.body.data.details]).toEqual([
        value,
        400,
        [{ ref: 'guest', reason: 'OUT_OF_RANGE' }],
      ]);
    }
    // an empty value is the same as not sent
    expect((await list({ guest: '', pageSize: '200' })).body.data.total).toBe(
      sessionsState.sessions.length,
    );
  });

  it('filters by the account id, matched whole', async () => {
    const mine = (await list({ accountId: SESSION.registeredAccount, pageSize: '200' })).body.data
      .items as Row[];
    expect(mine.length).toBeGreaterThan(1);
    expect(mine.every((r) => r.accountId === SESSION.registeredAccount)).toBe(true);
    // an account id that is not a UUID is refused, not looked for (answer 54)
    for (const value of [SESSION.registeredAccount.slice(0, 12), '2005', 'x']) {
      const part = await list({ accountId: value });
      expect([value, part.status, part.body.data.details]).toEqual([
        value,
        400,
        [{ ref: 'accountId', reason: 'INVALID_FORMAT' }],
      ]);
    }
    const none = await list({ accountId: '00000000-0000-4000-8000-0000000000ff' });
    expect(none.status).toBe(200);
    expect(none.body.data.total).toBe(0);
  });

  it('filters by the requested time: from is included, to is not', async () => {
    const all = (await list({ pageSize: '200' })).body.data.items as Row[];
    const from = all[10].requestedAt;
    const to = all[3].requestedAt;
    const inside = (await list({ from, to, pageSize: '200' })).body.data.items as Row[];
    expect(inside.map((r) => r.id)).toEqual(all.slice(4, 11).map((r) => r.id));
    expect(inside.some((r) => r.requestedAt === to)).toBe(false);
    expect(inside.some((r) => r.requestedAt === from)).toBe(true);
  });

  it('refuses a time that is not an instant ending in Z as INVALID_FORMAT on its own parameter', async () => {
    const bad = await list({ from: '2026-10-01' });
    expect(bad.status).toBe(400);
    expect(bad.body.data.details).toEqual([{ ref: 'from', reason: 'INVALID_FORMAT' }]);
    const badTo = await list({ to: 'today' });
    expect(badTo.body.data.details).toEqual([{ ref: 'to', reason: 'INVALID_FORMAT' }]);
    // an offset is not known to be accepted (answer 54, item 4): only the Z form is
    const offset = await list({ from: '2026-10-01T08:00:00+08:00' });
    expect(offset.body.data.details).toEqual([{ ref: 'from', reason: 'INVALID_FORMAT' }]);
  });

  it('does not check that from is before to and has no longest range: a backwards range finds nothing, it is not an error', async () => {
    const reversed = await list({ from: '2026-10-02T00:00:00Z', to: '2026-10-01T00:00:00Z' });
    expect(reversed.status).toBe(200);
    expect(reversed.body.data.total).toBe(0);
    const wide = await list({ from: '2000-01-01T00:00:00Z', to: '2100-01-01T00:00:00Z' });
    expect(wide.status).toBe(200);
    expect(wide.body.data.total).toBe(sessionsState.sessions.length);
    // either end can be sent alone
    expect((await list({ from: '2000-01-01T00:00:00Z' })).status).toBe(200);
    expect((await list({ to: '2100-01-01T00:00:00Z' })).status).toBe(200);
  });

  it('filters the sessions that are still going (no end) and the ones that ended, with inProgress', async () => {
    const going = (await list({ inProgress: 'true', pageSize: '200' })).body.data.items as Row[];
    expect(going.length).toBeGreaterThan(1);
    expect(going.every((r) => r.endedAt === null && r.durationSeconds === null)).toBe(true);
    const ended = (await list({ inProgress: 'false', pageSize: '200' })).body.data.items as Row[];
    expect(ended.every((r) => r.endedAt !== null)).toBe(true);
    expect(going.length + ended.length).toBe(sessionsState.sessions.length);
    for (const value of ['x', '1', 'TRUE']) {
      const bad = await list({ inProgress: value });
      expect([value, bad.status, bad.body.data.details]).toEqual([
        value,
        400,
        [{ ref: 'inProgress', reason: 'OUT_OF_RANGE' }],
      ]);
    }
    // an empty value is the same as not sent
    expect((await list({ inProgress: '', pageSize: '200' })).body.data.total).toBe(
      sessionsState.sessions.length,
    );
  });

  it('ignores a parameter it does not know, as the backend does: `ongoing` filters nothing and is no error', async () => {
    const all = await list({ ongoing: 'true', pageSize: '200' });
    expect(all.status).toBe(200);
    expect(all.body.data.total).toBe(sessionsState.sessions.length);
  });

  it('filters the sessions ended by the deadline with endReason=DEADLINE, and refuses an unknown reason', async () => {
    const forced = (await list({ endReason: 'DEADLINE', pageSize: '200' })).body.data
      .items as Row[];
    const expected = sessionsState.sessions.filter((s) => s.endReason === 'DEADLINE');
    expect(forced).toHaveLength(expected.length);
    expect(expected.length).toBeGreaterThan(1);
    expect((await list({ endReason: 'USER_LEFT' })).status).toBe(200);
    const bad = await list({ endReason: 'EXPLODED' });
    expect(bad.status).toBe(400);
    expect(bad.body.data.details).toEqual([{ ref: 'endReason', reason: 'OUT_OF_RANGE' }]);
  });

  it('combines the filters', async () => {
    const rows = (
      await list({ guest: 'false', inProgress: 'false', endReason: 'DEADLINE', pageSize: '200' })
    ).body.data.items as Row[];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.accountId).not.toBeNull();
      expect(r.endedAt).not.toBeNull();
    }
  });

  it('opens one session with the columns of the Session entity, a guest one with its device', async () => {
    const { status, body } = await detail(SESSION.registered);
    expect(status).toBe(200);
    expect(body.data).toMatchObject({
      id: SESSION.registered,
      accountId: SESSION.registeredAccount,
      deviceId: null,
    });
    for (const key of [
      'freeTier',
      'roomName',
      'timezone',
      'renderMode',
      'deadlineAt',
      'endReason',
      'agentJoinedAt',
      'userJoinedAt',
      'userLeftAt',
      'durationSeconds',
      'maxDurationMinutes',
    ]) {
      expect(body.data, key).toHaveProperty(key);
    }
    const guest = await detail(SESSION.guest);
    expect(guest.body.data.accountId).toBeNull();
    expect(guest.body.data.deviceId).toBe(GUEST_DEVICE);
  });

  it('gives the longest length the call had when it was made, as whole minutes, in the details and not in the list', async () => {
    for (const s of sessionsState.sessions) {
      const { body } = await detail(s.id);
      expect(Number.isInteger(body.data.maxDurationMinutes), s.id).toBe(true);
      expect(body.data.maxDurationMinutes, s.id).toBeGreaterThanOrEqual(0);
    }
    // a call whose limit was not the usual one: the deadline is that many minutes after the start
    const odd = sessionsState.sessions.find((s) => s.maxDurationMinutes !== 60);
    expect(odd).toBeTruthy();
    expect(Date.parse(odd?.deadlineAt ?? '') - Date.parse(odd?.startedAt ?? '')).toBe(
      (odd?.maxDurationMinutes ?? 0) * 60_000,
    );
    const { body } = await list({ pageSize: '100' });
    expect(Object.keys(body.data.items[0]).sort()).toEqual(
      [
        'accountId',
        'deviceId',
        'durationSeconds',
        'endedAt',
        'id',
        'language',
        'modelTier',
        'requestedAt',
        'startedAt',
      ].sort(),
    );
  });

  it('answers 404 RESOURCE_NOT_FOUND for a session that does not exist', async () => {
    const { status, body } = await detail('no-such-session');
    expect(status).toBe(404);
    expect(body.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('has the seven languages and hostile text in the sample rows', async () => {
    const rows = sessionsState.sessions;
    const languages = new Set(rows.map((r) => r.language));
    for (const tag of ['th', 'ar', 'id', 'vi', 'es', 'en', 'zh'])
      expect(languages.has(tag)).toBe(true);
    const hostile = rows.find((r) => r.id === SESSION.hostile);
    expect(hostile?.accountId?.length).toBeGreaterThanOrEqual(5000);
    expect(sampleAny(0)).toBeTruthy();
  });

  it('gives back the same data after a reset', async () => {
    const before = (await list({ pageSize: '200' })).body.data.items;
    sessionsState.sessions.length = 0;
    expect((await list()).body.data.total).toBe(0);
    resetSessionsStore();
    expect((await list({ pageSize: '200' })).body.data.items).toEqual(before);
  });
});
