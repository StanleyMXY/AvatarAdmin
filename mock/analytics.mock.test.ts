import { beforeEach, describe, expect, it } from 'vitest';
import {
  type AnalyticsEventRow,
  analyticsStore,
  maskIp,
  resetAnalyticsStore,
} from './_core/analyticsData';
import { resetConfigStore, saved } from './_core/configStore';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import analytics from './analytics.mock';

beforeEach(() => {
  resetStore();
  resetAnalyticsStore();
  resetConfigStore();
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (analytics as unknown as Record<string, H>)[name];
const tokenOf = (user: string, codes?: string[]) => {
  const admin = adminOf(user);
  if (codes) admin.permissions = codes as typeof admin.permissions;
  return bearer(issueToken(admin).token).authorization;
};
type Over = {
  query?: Record<string, string>;
  params?: Record<string, string>;
  body?: unknown;
};
const act = (name: string, user: string, over: Over = {}, codes?: string[]) =>
  call(h(name), { headers: { authorization: tokenOf(user, codes) }, ...over });

const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const wide = { from: day(30), to: day(0) };

const row = (over: Partial<AnalyticsEventRow>): AnalyticsEventRow => ({
  id: String(Math.random()),
  eventName: 'app_open',
  accountId: null,
  deviceId: 'd1',
  source: 'CLIENT',
  params: null,
  context: { platform: 'ANDROID', appVersion: '1.0.0', osVersion: '14' },
  clientTime: null,
  receivedAt: new Date().toISOString(),
  seq: 0,
  ip: '203.0.113.7',
  country: 'SG',
  ...over,
});
const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3600000).toISOString();

describe('permissions', () => {
  it('refuse a sign-in without ANALYTICS:VIEW on all read endpoints', async () => {
    for (const name of [
      'GET /api/admin/analytics/events',
      'GET /api/admin/analytics/event-summary',
      'GET /api/admin/analytics/event-names',
      'GET /api/admin/analytics/funnel',
      'GET /api/admin/analytics/funnels',
    ]) {
      const { status, body } = await act(name, 'support', { query: wide });
      expect([name, status, body.code]).toEqual([name, 403, 'ADMIN_FORBIDDEN']);
    }
  });

  it('refuse a request without a token', async () => {
    const { status } = await call(h('GET /api/admin/analytics/event-summary'), { query: wide });
    expect(status).toBe(401);
  });
});

describe('the time range of the four live endpoints', () => {
  const names = [
    'GET /api/admin/analytics/events',
    'GET /api/admin/analytics/event-summary',
    'GET /api/admin/analytics/event-names',
  ];
  it('is required: no from or to is 400 INVALID_REQUEST naming the parameter', async () => {
    for (const name of names) {
      const { status, body } = await act(name, 'root', { query: { to: day(0) } });
      expect([name, status, body.code]).toEqual([name, 400, 'INVALID_REQUEST']);
      expect(body.data.details).toEqual([{ ref: 'from', reason: 'OUT_OF_RANGE' }]);
    }
  });

  it('is at most 31 days including both ends (analytics.live_max_range_days)', async () => {
    const edge = await act('GET /api/admin/analytics/event-summary', 'root', {
      query: { from: day(30), to: day(0) },
    });
    expect(edge.status).toBe(200);
    const over = await act('GET /api/admin/analytics/event-summary', 'root', {
      query: { from: day(31), to: day(0) },
    });
    expect(over.status).toBe(400);
    expect(over.body.code).toBe('INVALID_REQUEST');
  });

  it('refuses a day that is not a calendar day and a range that runs backwards', async () => {
    const bad = await act('GET /api/admin/analytics/event-summary', 'root', {
      query: { from: '2026-02-30', to: day(0) },
    });
    expect(bad.status).toBe(400);
    const back = await act('GET /api/admin/analytics/event-summary', 'root', {
      query: { from: day(0), to: day(3) },
    });
    expect(back.status).toBe(400);
  });
});

describe('GET /analytics/events', () => {
  it('lists the newest first with total, and gives the columns of the detail', async () => {
    const { status, body } = await act('GET /api/admin/analytics/events', 'root', {
      query: { ...wide, pageSize: '100' },
    });
    expect(status).toBe(200);
    const items = body.data.items as { receivedAt: string }[];
    expect(items.length).toBeGreaterThan(20);
    const times = items.map((i) => Date.parse(i.receivedAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(body.data.total).toBeGreaterThanOrEqual(items.length);
    expect(Object.keys(items[0]).sort()).toEqual(
      [
        'accountId',
        'clientTime',
        'context',
        'country',
        'deviceId',
        'eventName',
        'id',
        'ip',
        'params',
        'receivedAt',
      ].sort(),
    );
  });

  it('pages with page and pageSize and refuses a page size over 200', async () => {
    const first = await act('GET /api/admin/analytics/events', 'root', {
      query: { ...wide, page: '1', pageSize: '10' },
    });
    const second = await act('GET /api/admin/analytics/events', 'root', {
      query: { ...wide, page: '2', pageSize: '10' },
    });
    expect(first.body.data.items).toHaveLength(10);
    expect(second.body.data.items[0].id).not.toBe(first.body.data.items[0].id);
    const bad = await act('GET /api/admin/analytics/events', 'root', {
      query: { ...wide, pageSize: '201' },
    });
    expect(bad.status).toBe(400);
    expect(bad.body.data.details).toEqual([{ ref: 'pageSize', reason: 'OUT_OF_RANGE' }]);
  });

  it('filters by account, device and event name (exact), and by the days of the range', async () => {
    analyticsStore.events = [
      row({ id: '1', eventName: 'app_open', accountId: '5', deviceId: 'dA', receivedAt: at(1) }),
      row({
        id: '2',
        eventName: 'session_started',
        accountId: '5',
        deviceId: 'dA',
        receivedAt: at(2),
      }),
      row({ id: '3', eventName: 'app_open', accountId: '6', deviceId: 'dB', receivedAt: at(3) }),
      row({
        id: '4',
        eventName: 'app_open',
        accountId: '5',
        deviceId: 'dA',
        receivedAt: at(24 * 5),
      }),
    ];
    const ids = async (query: Record<string, string>) =>
      (
        await act('GET /api/admin/analytics/events', 'root', { query: { ...wide, ...query } })
      ).body.data.items.map((i: { id: string }) => i.id);
    expect(await ids({ accountId: '5' })).toEqual(['1', '2', '4']);
    expect(await ids({ deviceId: 'dB' })).toEqual(['3']);
    expect(await ids({ eventName: 'app_open' })).toEqual(['1', '3', '4']);
    expect(await ids({ accountId: '5', eventName: 'app_open' })).toEqual(['1', '4']);
    expect(await ids({ from: day(1), to: day(0) })).toEqual(['1', '2', '3']);
  });

  it('masks the IP without ANALYTICS:IP_VIEW and gives it whole with it (IPv4 and IPv6)', async () => {
    analyticsStore.events = [
      row({ id: '1', ip: '203.0.113.7', receivedAt: at(1) }),
      row({ id: '2', ip: '2001:db8:85a3:0:0:8a2e:370:7334', receivedAt: at(2) }),
      row({ id: '3', ip: null, receivedAt: at(3) }),
    ];
    const ips = async (codes: string[]) =>
      (
        await act('GET /api/admin/analytics/events', 'support', { query: wide }, codes)
      ).body.data.items.map((i: { ip: string | null }) => i.ip);
    expect(await ips(['ANALYTICS:VIEW'])).toEqual(['203.0.113.*', '2001:db8:85a3:0:*:*:*:*', null]);
    expect(await ips(['ANALYTICS:VIEW', 'ANALYTICS:IP_VIEW'])).toEqual([
      '203.0.113.7',
      '2001:db8:85a3:0:0:8a2e:370:7334',
      null,
    ]);
    expect(maskIp('10.0.0.1')).toBe('10.0.0.*');
  });

  it('keeps params and context as the app sent them, in several languages, and has anonymous rows', async () => {
    const { body } = await act('GET /api/admin/analytics/events', 'root', {
      query: { ...wide, pageSize: '200' },
    });
    const items = body.data.items as { params: unknown; accountId: string | null }[];
    expect(items.some((i) => i.accountId === null)).toBe(true);
    const text = JSON.stringify(items.map((i) => i.params));
    for (const sample of ['สวัสดี', 'مرحبا', 'Halo', 'Xin chào', 'Hola', 'Hello', '你好']) {
      expect(text, sample).toContain(sample);
    }
    expect(text).toContain('ก็'.repeat(100));
  });
});

describe('GET /analytics/event-summary and /event-names', () => {
  it('counts triggers (pv) and distinct accounts (uv) per event name, most triggers first, ties by name', async () => {
    analyticsStore.events = [
      row({ eventName: 'b_evt', accountId: '1', receivedAt: at(1) }),
      row({ eventName: 'b_evt', accountId: '1', receivedAt: at(2) }),
      row({ eventName: 'b_evt', accountId: '2', receivedAt: at(3) }),
      row({ eventName: 'a_evt', accountId: '1', receivedAt: at(1) }),
      row({ eventName: 'a_evt', accountId: null, receivedAt: at(1) }),
      row({ eventName: 'a_evt', accountId: '3', receivedAt: at(1) }),
      row({ eventName: 'c_evt', accountId: '3', receivedAt: at(1) }),
      row({ eventName: 'old_evt', accountId: '3', receivedAt: at(24 * 20) }),
    ];
    const { body } = await act('GET /api/admin/analytics/event-summary', 'root', {
      query: { from: day(2), to: day(0) },
    });
    expect(body.data).toEqual({
      items: [
        { eventName: 'a_evt', pv: 3, uv: 2 },
        { eventName: 'b_evt', pv: 3, uv: 2 },
        { eventName: 'c_evt', pv: 1, uv: 1 },
      ],
    });
    expect(body.data.total).toBeUndefined();
  });

  it('returns all event names of the range in ascending order, as strings', async () => {
    analyticsStore.events = [
      row({ eventName: 'zeta', receivedAt: at(1) }),
      row({ eventName: 'alpha', receivedAt: at(1) }),
      row({ eventName: 'zeta', receivedAt: at(2) }),
      row({ eventName: 'old', receivedAt: at(24 * 20) }),
    ];
    const { body } = await act('GET /api/admin/analytics/event-names', 'root', {
      query: { from: day(2), to: day(0) },
    });
    expect(body.data).toEqual({ items: ['alpha', 'zeta'] });
  });

  it('has more than 50 event names in the sample data so the page has a second page', async () => {
    const { body } = await act('GET /api/admin/analytics/event-names', 'root', { query: wide });
    expect(body.data.items.length).toBeGreaterThan(50);
  });
});

describe('GET /analytics/funnel', () => {
  const funnel = (steps: string, extra: Record<string, string> = {}) =>
    act('GET /api/admin/analytics/funnel', 'root', {
      query: { ...wide, steps, windowHours: '24', ...extra },
    });

  it('counts the subjects that did the steps in order inside the window, same order as asked', async () => {
    analyticsStore.events = [
      // 1 does a, b, c in order
      row({ eventName: 'a', accountId: '1', receivedAt: at(10) }),
      row({ eventName: 'b', accountId: '1', receivedAt: at(9) }),
      row({ eventName: 'c', accountId: '1', receivedAt: at(8) }),
      // 2 does a, b only
      row({ eventName: 'a', accountId: '2', receivedAt: at(10) }),
      row({ eventName: 'b', accountId: '2', receivedAt: at(9) }),
      // 3 does b before a: does not count for b
      row({ eventName: 'b', accountId: '3', receivedAt: at(10) }),
      row({ eventName: 'a', accountId: '3', receivedAt: at(9) }),
      // 4 does b more than 24 hours after a: does not count for b
      row({ eventName: 'a', accountId: '4', receivedAt: at(100) }),
      row({ eventName: 'b', accountId: '4', receivedAt: at(50) }),
    ];
    const { status, body } = await funnel('a,b,c');
    expect(status).toBe(200);
    expect(body.data.steps).toEqual([
      { eventName: 'a', count: 4, conversionFromPrevious: null },
      { eventName: 'b', count: 2, conversionFromPrevious: 0.5 },
      { eventName: 'c', count: 1, conversionFromPrevious: 0.5 },
    ]);
  });

  it('gives null, not 0 or NaN, when the previous step has nobody', async () => {
    analyticsStore.events = [row({ eventName: 'b', accountId: '1', receivedAt: at(1) })];
    const { body } = await funnel('a,b,c');
    expect(body.data.steps).toEqual([
      { eventName: 'a', count: 0, conversionFromPrevious: null },
      { eventName: 'b', count: 0, conversionFromPrevious: null },
      { eventName: 'c', count: 0, conversionFromPrevious: null },
    ]);
  });

  it('joins an anonymous event to the account of the same device (open before sign-up)', async () => {
    analyticsStore.events = [
      row({ eventName: 'app_open', accountId: null, deviceId: 'dX', receivedAt: at(5) }),
      row({ eventName: 'register_completed', accountId: '9', deviceId: 'dX', receivedAt: at(4) }),
      row({ eventName: 'app_open', accountId: null, deviceId: 'dY', receivedAt: at(5) }),
    ];
    const { body } = await funnel('app_open,register_completed');
    expect(body.data.steps).toEqual([
      { eventName: 'app_open', count: 2, conversionFromPrevious: null },
      { eventName: 'register_completed', count: 1, conversionFromPrevious: 0.5 },
    ]);
  });

  it('keeps the order of events that arrived in one batch by seq, and can repeat an event name', async () => {
    const t = at(3);
    analyticsStore.events = [
      row({ eventName: 'a', accountId: '1', receivedAt: t, seq: 1 }),
      row({ eventName: 'b', accountId: '1', receivedAt: t, seq: 0 }),
      row({ eventName: 'a', accountId: '2', receivedAt: t, seq: 0 }),
      row({ eventName: 'b', accountId: '2', receivedAt: t, seq: 1 }),
    ];
    const { body } = await funnel('a,b');
    expect(body.data.steps.map((s: { count: number }) => s.count)).toEqual([2, 1]);
  });

  it('refuses fewer than 2 or more than 10 steps, a window outside 1 to 720, and a missing steps', async () => {
    const refs = async (steps: string, extra: Record<string, string> = {}) => {
      const { status, body } = await funnel(steps, extra);
      return [status, body.data?.details?.map((d: { ref: string }) => d.ref)];
    };
    expect(await refs('a')).toEqual([400, ['steps']]);
    expect(await refs('')).toEqual([400, ['steps']]);
    expect(await refs(Array.from({ length: 11 }, (_, i) => `e${i}`).join(','))).toEqual([
      400,
      ['steps'],
    ]);
    expect((await funnel(Array.from({ length: 10 }, (_, i) => `e${i}`).join(','))).status).toBe(
      200,
    );
    expect(await refs('a,b', { windowHours: '0' })).toEqual([400, ['windowHours']]);
    expect(await refs('a,b', { windowHours: '721' })).toEqual([400, ['windowHours']]);
    expect(await refs('a,b', { windowHours: '1.5' })).toEqual([400, ['windowHours']]);
    expect((await funnel('a,b', { windowHours: '720' })).status).toBe(200);
  });

  it('uses 24 hours when windowHours is not sent', async () => {
    const { status } = await act('GET /api/admin/analytics/funnel', 'root', {
      query: { ...wide, steps: 'a,b' },
    });
    expect(status).toBe(200);
  });
});

describe('GET /analytics/funnel: the limit of funnels being computed', () => {
  const funnel = (query: Record<string, string> = {}) =>
    act('GET /api/admin/analytics/funnel', 'root', {
      query: { ...wide, steps: 'a,b', windowHours: '24', ...query },
    });
  const limit = (value: number) =>
    saved.set('analytics.funnel_max_concurrency', {
      value,
      updatedAt: '',
      updatedBy: '',
      updatedByUsername: '',
    });

  it('answers 429 RATE_LIMITED with no data once as many funnels as the limit (2 by default) are being computed', async () => {
    analyticsStore.funnelInFlight = 2;
    const { status, body } = await funnel();
    expect(status).toBe(429);
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.data).toBeNull();
    analyticsStore.funnelInFlight = 1;
    expect((await funnel()).status).toBe(200);
  });

  it('reads the limit from analytics.funnel_max_concurrency', async () => {
    limit(3);
    analyticsStore.funnelInFlight = 2;
    expect((await funnel()).status).toBe(200);
    analyticsStore.funnelInFlight = 3;
    expect((await funnel()).status).toBe(429);
    limit(1);
    analyticsStore.funnelInFlight = 1;
    expect((await funnel()).status).toBe(429);
  });

  it('frees the place once it has answered: the count is the same after a good and after a refused request', async () => {
    analyticsStore.funnelInFlight = 0;
    await funnel();
    await funnel({ steps: 'a' });
    expect(analyticsStore.funnelInFlight).toBe(0);
  });

  it('checks the steps, the window and the range before the limit, so a bad request is 400 even when it is full', async () => {
    analyticsStore.funnelInFlight = 2;
    const code = async (query: Record<string, string>) => (await funnel(query)).status;
    expect(await code({ steps: 'a' })).toBe(400);
    expect(await code({ windowHours: '0' })).toBe(400);
    expect(await code({ from: 'x' })).toBe(400);
    expect(await code({ from: day(0), to: day(40) })).toBe(400);
    expect(await code({})).toBe(429);
  });

  it('does not limit the saved funnels', async () => {
    analyticsStore.funnelInFlight = 99;
    expect((await act('GET /api/admin/analytics/funnels', 'root')).status).toBe(200);
  });
});

describe('saved funnels', () => {
  it('start with the three presets of the contract, marked isPreset, in order', async () => {
    const { body } = await act('GET /api/admin/analytics/funnels', 'root');
    const items = body.data.items as {
      name: string;
      steps: string[];
      isPreset: boolean;
      windowHours: number;
    }[];
    const presets = items.filter((f) => f.isPreset);
    expect(presets.map((f) => f.steps)).toEqual([
      ['app_open', 'register_completed'],
      ['register_completed', 'avatar_created', 'voice_cloned', 'session_started'],
      ['paywall_viewed', 'purchase_initiated', 'subscription_started'],
    ]);
    expect(presets.every((f) => f.windowHours === 24)).toBe(true);
    expect(Object.keys(body.data.items[0]).sort()).toEqual(
      [
        'createdAt',
        'createdBy',
        'createdByUsername',
        'id',
        'isPreset',
        'name',
        'steps',
        'updatedAt',
        'windowHours',
      ].sort(),
    );
  });

  it('create needs ANALYTICS:FUNNEL_MANAGE, then shows up in the list with the name of the author', async () => {
    const body = { name: 'My funnel ✨', steps: ['a', 'b'], windowHours: 48 };
    const refused = await act('POST /api/admin/analytics/funnels', 'support', { body }, [
      'ANALYTICS:VIEW',
    ]);
    expect(refused.status).toBe(403);
    const made = await act('POST /api/admin/analytics/funnels', 'reviewer', { body }, [
      'ANALYTICS:VIEW',
      'ANALYTICS:FUNNEL_MANAGE',
    ]);
    expect(made.status).toBe(200);
    expect(made.body.data).toMatchObject({
      ...body,
      isPreset: false,
      createdByUsername: 'reviewer',
    });
    const list = await act('GET /api/admin/analytics/funnels', 'root');
    expect(list.body.data.items.map((f: { name: string }) => f.name)).toContain('My funnel ✨');
  });

  it('refuses a refused body: too few or many steps, window outside 1 to 720, empty name', async () => {
    const bad = async (body: unknown) =>
      (await act('POST /api/admin/analytics/funnels', 'root', { body })).body.data?.details?.map(
        (d: { ref: string }) => d.ref,
      );
    expect(await bad({ name: 'x', steps: ['a'], windowHours: 24 })).toEqual(['steps']);
    expect(
      await bad({
        name: 'x',
        steps: Array.from({ length: 11 }, (_, i) => `e${i}`),
        windowHours: 24,
      }),
    ).toEqual(['steps']);
    expect(await bad({ name: 'x', steps: ['a', 'b'], windowHours: 721 })).toEqual(['windowHours']);
    expect(await bad({ name: '  ', steps: ['a', 'b'], windowHours: 24 })).toEqual(['name']);
  });

  it('refuses a second funnel with the same name: 409 DUPLICATE_RESOURCE with the field', async () => {
    const body = { name: 'Same', steps: ['a', 'b'], windowHours: 24 };
    await act('POST /api/admin/analytics/funnels', 'root', { body });
    const again = await act('POST /api/admin/analytics/funnels', 'root', { body });
    expect([again.status, again.body.code, again.body.data]).toEqual([
      409,
      'DUPLICATE_RESOURCE',
      { field: 'name' },
    ]);
  });

  it('changes and deletes a custom funnel; a preset is read only (409 INVALID_STATE), an unknown id is 404', async () => {
    const made = await act('POST /api/admin/analytics/funnels', 'root', {
      body: { name: 'Mine', steps: ['a', 'b'], windowHours: 24 },
    });
    const id = made.body.data.id as string;
    const put = await act('PUT /api/admin/analytics/funnels/:id', 'root', {
      params: { id },
      body: { name: 'Mine 2', steps: ['a', 'b', 'c'], windowHours: 72 },
    });
    expect(put.status).toBe(200);
    expect(put.body.data).toMatchObject({
      id,
      name: 'Mine 2',
      steps: ['a', 'b', 'c'],
      windowHours: 72,
    });
    const del = await act('DELETE /api/admin/analytics/funnels/:id', 'root', { params: { id } });
    expect([del.status, del.body.data]).toEqual([200, null]);
    const gone = await act('DELETE /api/admin/analytics/funnels/:id', 'root', { params: { id } });
    expect([gone.status, gone.body.code]).toEqual([404, 'RESOURCE_NOT_FOUND']);

    const preset = (await act('GET /api/admin/analytics/funnels', 'root')).body.data.items.find(
      (f: { isPreset: boolean }) => f.isPreset,
    );
    for (const [name, body] of [
      ['PUT /api/admin/analytics/funnels/:id', { name: 'x', steps: ['a', 'b'], windowHours: 24 }],
      ['DELETE /api/admin/analytics/funnels/:id', undefined],
    ] as const) {
      const r = await act(name, 'root', { params: { id: preset.id }, body });
      expect([name, r.status, r.body.code]).toEqual([name, 409, 'INVALID_STATE']);
    }
  });

  it('refuses writes without ANALYTICS:FUNNEL_MANAGE', async () => {
    const codes = ['ANALYTICS:VIEW'];
    for (const [name, over] of [
      ['PUT /api/admin/analytics/funnels/:id', { params: { id: '1' }, body: {} }],
      ['DELETE /api/admin/analytics/funnels/:id', { params: { id: '1' } }],
    ] as const) {
      const r = await act(name, 'support', over, codes);
      expect([name, r.status]).toEqual([name, 403]);
    }
  });
});
