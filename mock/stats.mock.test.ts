import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, todayOf } from './_core/statData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import channels from './channels.mock';
import stats from './stats.mock';

beforeEach(() => resetStore());

const as = (username: string) => bearer(issueToken(adminOf(username)).token).authorization;
const get = (path: string, user: string, query: Record<string, string> = {}) => {
  const handler = (stats as unknown as Record<string, never>)[
    `GET /api/admin/stats/${path}`
  ] as Parameters<typeof call>[0];
  return call(handler, { headers: { authorization: as(user) }, query });
};
const today = todayOf();
const range = { from: addDays(today, -9), to: today };

describe('daily', () => {
  it('has one row per day of the range, in order', async () => {
    const { status, body } = await get('daily', 'support', range);
    expect(status).toBe(200);
    expect(body.data.items).toHaveLength(10);
    expect(body.data.items.map((r: { statDate: string }) => r.statDate)).toEqual(
      Array.from({ length: 10 }, (_, i) => addDays(range.from, i)),
    );
  });

  it('gives the business columns only for platform ALL, null for the others', async () => {
    const all = (await get('daily', 'support', range)).body.data.items[0];
    expect(all.newAccountsRegistered).toEqual(expect.any(Number));
    for (const platform of ['ANDROID', 'IOS', 'unknown']) {
      const row = (await get('daily', 'support', { ...range, platform })).body.data.items[0];
      expect(row.newAccountsRegistered).toBeNull();
      expect(row.callSecondsTotal).toBeNull();
      expect(row.activeSubscriptions).toBeNull();
      expect(row.dau).toEqual(expect.any(Number));
    }
  });

  it('has no active-subscription count for today, and for some earlier days', async () => {
    const rows = (await get('daily', 'support', { from: addDays(today, -60), to: today })).body.data
      .items;
    expect(rows.at(-1).activeSubscriptions).toBeNull();
    expect(
      rows
        .slice(0, -1)
        .some((r: { activeSubscriptions: number | null }) => r.activeSubscriptions === null),
    ).toBe(true);
    expect(
      rows
        .slice(0, -1)
        .some((r: { activeSubscriptions: number | null }) => r.activeSubscriptions !== null),
    ).toBe(true);
  });

  it('has no active-subscription count when a channel is chosen, and no back-fill flag without a snapshot', async () => {
    const rows = (
      await get('daily', 'support', { from: addDays(today, -30), to: today, channel: 'play' })
    ).body.data.items;
    expect(
      rows.every((r: { activeSubscriptions: number | null }) => r.activeSubscriptions === null),
    ).toBe(true);
    const all = (await get('daily', 'support', { from: addDays(today, -30), to: today })).body.data
      .items;
    for (const r of all) {
      if (r.activeSubscriptions === null) expect(r.activeSubscriptionsBackfilled).toBeNull();
      else expect(typeof r.activeSubscriptionsBackfilled).toBe('boolean');
    }
  });

  it('is the same on every call', async () => {
    const a = (await get('daily', 'support', range)).body.data;
    const b = (await get('daily', 'support', range)).body.data;
    expect(a).toEqual(b);
  });

  it('defaults to the last 7 days', async () => {
    const { body } = await get('daily', 'support');
    expect(body.data.items).toHaveLength(7);
    expect(body.data.items.at(-1).statDate).toBe(today);
  });
});

describe('ranges and parameters', () => {
  it('refuses a range longer than stats.max_range_days with 400 INVALID_REQUEST', async () => {
    const { status, body } = await get('daily', 'support', {
      from: addDays(today, -400),
      to: today,
    });
    expect(status).toBe(400);
    expect(body.code).toBe('INVALID_REQUEST');
    expect(body.data.details[0].ref).toBe('to');
  });

  it('accepts exactly 366 days', async () => {
    const { status } = await get('daily', 'support', { from: addDays(today, -365), to: today });
    expect(status).toBe(200);
  });

  it.each([
    { from: 'yesterday', to: '2026-10-01' },
    { from: '2026-13-01', to: '2026-10-01' },
    { from: '2026-10-05', to: '2026-10-01' },
  ])('refuses a bad range %j', async (query) => {
    const { status, body } = await get('daily', 'support', query);
    expect(status).toBe(400);
    expect(body.code).toBe('INVALID_REQUEST');
  });

  it('refuses a platform or channel it does not know', async () => {
    expect((await get('daily', 'support', { ...range, platform: 'WINDOWS' })).status).toBe(400);
    expect((await get('daily', 'support', { ...range, channel: 'Bad Code!' })).status).toBe(400);
    expect((await get('daily', 'support', { ...range, channel: 'play' })).status).toBe(200);
  });
});

describe('retention', () => {
  it('has null for the days that have not come yet and numbers for the days that have', async () => {
    const rows = (
      await get('retention', 'support', { from: addDays(today, -40), to: addDays(today, -1) })
    ).body.data.items;
    const recent = rows.at(-1);
    expect(recent.cohortDate).toBe(addDays(today, -1));
    expect(recent.d1).toBeNull(); // day 1 after yesterday is today, which has not finished
    expect(recent.d90).toBeNull();
    const old = rows[0];
    expect(old.d1).toEqual(expect.any(Number));
    expect(old.d30).toEqual(expect.any(Number)); // 40 days ago + 30 = 10 days ago
    expect(old.d60).toBeNull();
  });

  it('a day is filled only when cohortDate + N is up to yesterday', async () => {
    const eight = addDays(today, -8);
    expect(
      (await get('retention', 'support', { from: eight, to: eight })).body.data.items[0].d7,
    ).toEqual(expect.any(Number));
    const seven = addDays(today, -7);
    expect(
      (await get('retention', 'support', { from: seven, to: seven })).body.data.items[0].d7,
    ).toBeNull();
  });

  it('keeps counts inside the cohort and the CALL type below the ACTIVE type', async () => {
    const q = { from: addDays(today, -30), to: addDays(today, -20) };
    const active = (await get('retention', 'support', q)).body.data.items;
    const call_ = (await get('retention', 'support', { ...q, type: 'CALL' })).body.data.items;
    for (const row of active) expect(row.d1).toBeLessThanOrEqual(row.cohortSize);
    expect(call_[0].d1).toBeLessThan(active[0].d1);
    expect(call_[0].retentionType).toBe('CALL');
  });

  it('refuses another type', async () => {
    expect((await get('retention', 'support', { ...range, type: 'OTHER' })).status).toBe(400);
  });
});

describe('the other reports', () => {
  it.each([
    'reactivation',
    'guest/daily',
    'guest/cohort',
    'guest/retention',
    'session-quality',
    'push',
    'checkin/daily-users',
    'tasks/daily',
  ])('%s gives one list of rows for the range', async (path) => {
    const { status, body } = await get(path, 'support', range);
    expect(status).toBe(200);
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.items.length).toBeGreaterThan(0);
  });

  it('reactivation takes 7, 14 or 30 silence days and no other', async () => {
    expect(
      (await get('reactivation', 'support', { ...range, silenceDays: '14' })).body.data.items[0]
        .silenceDays,
    ).toBe(14);
    expect((await get('reactivation', 'support', { ...range, silenceDays: '5' })).status).toBe(400);
  });

  it('guest quota is one object with six buckets', async () => {
    const { body } = await get('guest/quota', 'support', range);
    expect(Object.keys(body.data.buckets)).toEqual([
      'ZERO',
      'LE_25',
      'LE_50',
      'LE_75',
      'LT_100',
      'GE_100',
    ]);
    expect(body.data.items).toBeUndefined();
  });

  it('session quality times add up to the connected sessions', async () => {
    const row = (await get('session-quality', 'support', range)).body.data.items[0];
    expect(row.joinLe2s + row.joinLe5s + row.joinLe10s + row.joinGt10s).toBe(row.connected);
  });

  it('session quality has a clearly bad day in any seven days, so that the red frames of the page can be seen on the fake backend', async () => {
    // Any run of seven days: the success rate of the total is under 95% and the share of connects
    // slower than 10 seconds is over 5% (the limits of the build by default).
    for (const start of [-30, -17, -8, -3]) {
      const week = { from: addDays(today, start), to: addDays(today, start + 6) };
      const items = (await get('session-quality', 'support', week)).body.data.items as {
        connected: number;
        agentUnavailable: number;
        joinGt10s: number;
      }[];
      const sum = (key: 'connected' | 'agentUnavailable' | 'joinGt10s') =>
        items.reduce((total, row) => total + row[key], 0);
      expect(
        sum('connected') / (sum('connected') + sum('agentUnavailable')),
        String(start),
      ).toBeLessThan(0.95);
      expect(sum('joinGt10s') / sum('connected'), String(start)).toBeGreaterThan(0.05);
    }
  });

  it('push rows can be limited to one trigger reason of the contract', async () => {
    const rows = (await get('push', 'support', { ...range, triggerReason: 'daily_recall' })).body
      .data.items;
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((r: { triggerReason: string }) => r.triggerReason))).toEqual(
      new Set(['daily_recall']),
    );
  });

  it('push rows use the four trigger reasons of the contract, and refuse a value that is not one', async () => {
    const all = (await get('push', 'support', range)).body.data.items;
    expect(new Set(all.map((r: { triggerReason: string }) => r.triggerReason))).toEqual(
      new Set(['daily_recall', 'streak_at_risk', 'admin', 'system_event']),
    );
    const bad = await get('push', 'support', { ...range, triggerReason: 'recall' });
    expect(bad.status).toBe(400);
  });

  it('task summary has one row per task, with names in several scripts and a null rate for no records', async () => {
    const rows = (await get('tasks/summary', 'support', range)).body.data.items;
    expect(rows).toHaveLength(7);
    expect(rows.some((r: { taskName: string }) => /[฀-๿]/.test(r.taskName))).toBe(true);
    expect(rows.some((r: { taskName: string }) => /\p{Script=Arabic}/u.test(r.taskName))).toBe(
      true,
    );
  });

  it('streak buckets have one row per consecutive day count', async () => {
    const rows = (await get('checkin/streak-buckets', 'support', range)).body.data.items;
    expect(rows.map((r: { consecutiveDays: number }) => r.consecutiveDays)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
  });
});

describe('permissions', () => {
  it('refuses a report without STATS:VIEW with 403 ADMIN_FORBIDDEN', async () => {
    const { status, body } = await get('daily', 'reviewer', range);
    expect(status).toBe(403);
    expect(body.code).toBe('ADMIN_FORBIDDEN');
  });

  it('refuses a report without a token with 401', async () => {
    const handler = (stats as unknown as Record<string, never>)[
      'GET /api/admin/stats/daily'
    ] as Parameters<typeof call>[0];
    const { status, body } = await call(handler, { query: range });
    expect(status).toBe(401);
    expect(body.code).toBe('ADMIN_INVALID_TOKEN');
  });

  it('usage cost needs COST:VIEW, not STATS:VIEW', async () => {
    expect((await get('usage-cost', 'support', range)).status).toBe(403);
    const ok = await get('usage-cost', 'finance', range);
    expect(ok.status).toBe(200);
  });

  it('usage cost keeps currencies apart, with a row without a price under NONE', async () => {
    const rows = (await get('usage-cost', 'finance', range)).body.data.items;
    const none = rows.find((r: { currency: string }) => r.currency === 'NONE');
    expect(none.costAmount).toBeNull();
    expect(none.unpricedRequests).toBe(none.requests);
    const only = (await get('usage-cost', 'finance', { ...range, currency: 'USD' })).body.data
      .items;
    expect(only.every((r: { currency: string }) => r.currency === 'USD')).toBe(true);
  });
});

describe('POST /stats/land/:name', () => {
  const land = (user: string, name: string, date: string) =>
    call(
      (stats as unknown as Record<string, never>)['POST /api/admin/stats/land/:name'] as Parameters<
        typeof call
      >[0],
      {
        headers: { authorization: as(user) },
        params: { name },
        query: { date },
      },
    );

  it('needs STATS:LAND', async () => {
    expect((await land('support', 'daily-event', addDays(today, -1))).status).toBe(403);
    expect((await land('finance', 'daily-event', addDays(today, -1))).status).toBe(200);
  });

  it('refuses a name it does not know with 404, and a bad or future date with 400', async () => {
    expect((await land('root', 'nope', addDays(today, -1))).status).toBe(404);
    expect((await land('root', 'push', 'yesterday')).status).toBe(400);
    expect((await land('root', 'push', addDays(today, 3))).status).toBe(400);
  });
});

describe('GET /channels', () => {
  const read = (user?: string) =>
    call(
      (channels as unknown as Record<string, never>)['GET /api/admin/channels'] as Parameters<
        typeof call
      >[0],
      {
        headers: user ? { authorization: as(user) } : {},
      },
    );

  it('gives the three preset channels to any signed-in administrator', async () => {
    const { status, body } = await read('reviewer');
    expect(status).toBe(200);
    expect(body.data.items.map((c: { code: string }) => c.code)).toEqual([
      'play',
      'direct',
      'appstore',
    ]);
  });

  it('needs a token', async () => {
    expect((await read()).status).toBe(401);
  });
});
