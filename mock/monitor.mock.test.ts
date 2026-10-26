import { beforeEach, describe, expect, it } from 'vitest';
import { ALERT_TYPES } from '../src/services/monitor/alertTypes';
import { monitorStore, resetMonitorStore } from './_core/monitorData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import monitor from './monitor.mock';

beforeEach(() => {
  resetStore();
  resetMonitorStore();
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (monitor as unknown as Record<string, H>)[name];
const as = (user: string) => bearer(issueToken(adminOf(user)).token).authorization;
const viewer = () => {
  adminOf('reviewer').permissions = ['MONITOR:VIEW'];
  return 'reviewer';
};
const manager = () => {
  adminOf('reviewer').permissions = ['MONITOR:VIEW', 'MONITOR:MANAGE'];
  return 'reviewer';
};
const get = (name: string, user: string, query: Record<string, string> = {}, params = {}) =>
  call(h(name), { headers: { authorization: as(user) }, query, params });

const HOUR = 3600_000;
const pipeline = (user: string, query: Record<string, string> = {}) =>
  get('GET /api/admin/monitor/pipeline', user, query);

describe('GET /monitor/pipeline', () => {
  it('gives the last 24 hours when from and to are left out, oldest first, with truncated false', async () => {
    const { status, body } = await pipeline(viewer());
    expect(status).toBe(200);
    expect(body.data.truncated).toBe(false);
    const items = body.data.items as { effectiveAt: string }[];
    expect(items.length).toBeGreaterThan(0);
    const times = items.map((i) => Date.parse(i.effectiveAt));
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(Date.now() - times[0]).toBeLessThanOrEqual(24 * HOUR + 1000);
  });

  it('gives each point reportedAt, effectiveAt, source and the three figures, some of them null', async () => {
    const { body } = await pipeline(viewer());
    const items = body.data.items as Record<string, unknown>[];
    expect(Object.keys(items[0]).sort()).toEqual(
      ['effectiveAt', 'errorCount', 'errorRate', 'gpuUtilization', 'reportedAt', 'source'].sort(),
    );
    expect(items.some((i) => i.gpuUtilization === null)).toBe(true);
    expect(items.some((i) => i.errorRate === null)).toBe(true);
    expect(items.some((i) => i.errorRate !== null)).toBe(true);
  });

  it('filters by source, and gives an empty list (not an error) for a source with no data', async () => {
    const one = await pipeline(viewer(), { source: 'agent-server-2' });
    expect(new Set((one.body.data.items as { source: string }[]).map((i) => i.source))).toEqual(
      new Set(['agent-server-2']),
    );
    const none = await pipeline(viewer(), { source: 'no-such-source' });
    expect(none.status).toBe(200);
    expect(none.body.data).toEqual({ items: [], truncated: false });
  });

  it('gives an empty list when nothing has been reported at all', async () => {
    monitorStore.pipelineEmpty = true;
    const { status, body } = await pipeline(viewer());
    expect([status, body.data]).toEqual([200, { items: [], truncated: false }]);
  });

  it('refuses a range longer than 7 days and a range that is not instants, with the parameter as the ref', async () => {
    const to = new Date();
    const from = new Date(to.getTime() - 8 * 24 * HOUR);
    const long = await pipeline(viewer(), { from: from.toISOString(), to: to.toISOString() });
    expect(long.status).toBe(400);
    expect(long.body.data.details).toEqual([{ ref: 'from', reason: 'OUT_OF_RANGE' }]);
    const bad = await pipeline(viewer(), { from: 'yesterday' });
    expect(bad.body.data.details).toEqual([{ ref: 'from', reason: 'INVALID_PATH' }]);
  });

  it('cuts at 5000 points, keeps the latest ones and says truncated', async () => {
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 24 * HOUR);
    const { body } = await pipeline(viewer(), { from: from.toISOString(), to: to.toISOString() });
    expect(body.data.items).toHaveLength(5000);
    expect(body.data.truncated).toBe(true);
    const last = body.data.items.at(-1).effectiveAt;
    expect(to.getTime() - Date.parse(last)).toBeLessThan(HOUR);
  });

  it('needs MONITOR:VIEW', async () => {
    expect((await pipeline('support')).status).toBe(403);
  });
});

describe('GET /alerts', () => {
  const list = (user: string, query: Record<string, string> = {}) =>
    get('GET /api/admin/alerts', user, query);

  it('has an alert of every one of the fourteen types, newest first', async () => {
    const { body } = await list(viewer(), { pageSize: '100' });
    const types = new Set((body.data.items as { type: string }[]).map((a) => a.type));
    for (const type of ALERT_TYPES) expect(types.has(type), type).toBe(true);
    const times = (body.data.items as { createdAt: string }[]).map((a) => Date.parse(a.createdAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('gives the fields of AdminAlert', async () => {
    const { body } = await list(viewer());
    expect(Object.keys(body.data.items[0]).sort()).toEqual(
      [
        'accountId',
        'createdAt',
        'detail',
        'id',
        'refId',
        'refType',
        'resolvedAt',
        'status',
        'type',
      ].sort(),
    );
    expect(typeof body.data.total).toBe('number');
  });

  it('filters by status and by type, and pages', async () => {
    const open = await list(viewer(), { status: 'OPEN', pageSize: '100' });
    expect((open.body.data.items as { status: string }[]).every((a) => a.status === 'OPEN')).toBe(
      true,
    );
    const resolved = await list(viewer(), { status: 'RESOLVED', pageSize: '100' });
    expect(resolved.body.data.total).toBeGreaterThan(0);
    expect(open.body.data.total + resolved.body.data.total).toBe(
      (await list(viewer(), { pageSize: '100' })).body.data.total,
    );
    const one = await list(viewer(), { type: 'DELETION_FAILED', pageSize: '100' });
    expect(
      (one.body.data.items as { type: string }[]).every((a) => a.type === 'DELETION_FAILED'),
    ).toBe(true);
    const paged = await list(viewer(), { page: '2', pageSize: '5' });
    expect(paged.body.data.items).toHaveLength(5);
  });

  it('refuses a status that is not OPEN or RESOLVED, and a page size over 200', async () => {
    const status = await list(viewer(), { status: 'DONE' });
    expect(status.status).toBe(400);
    expect(status.body.data.details).toEqual([{ ref: 'status', reason: 'OUT_OF_RANGE' }]);
    expect((await list(viewer(), { pageSize: '201' })).body.data.details[0].ref).toBe('pageSize');
  });

  it('needs MONITOR:VIEW', async () => {
    expect((await list('support')).status).toBe(403);
  });
});

describe('POST /alerts/:id/resolve', () => {
  const resolve = (user: string, id: string) =>
    get('POST /api/admin/alerts/:id/resolve', user, {}, { id });
  const firstOpen = (type?: string) =>
    monitorStore.alerts.find((a) => a.status === 'OPEN' && (!type || a.type === type));

  it('needs MONITOR:MANAGE', async () => {
    const alert = firstOpen();
    const refused = await resolve(viewer(), alert?.id ?? '');
    expect([refused.status, refused.body.code]).toEqual([403, 'ADMIN_FORBIDDEN']);
    expect(alert?.status).toBe('OPEN');
  });

  it('closes an open alert and records the time', async () => {
    const alert = firstOpen();
    expect((await resolve(manager(), alert?.id ?? '')).status).toBe(200);
    expect(alert?.status).toBe('RESOLVED');
    expect(Date.parse(alert?.resolvedAt ?? '')).not.toBeNaN();
  });

  it('answers 409 INVALID_STATE with the current status when the alert is already resolved, 404 when it is not there', async () => {
    const alert = firstOpen();
    await resolve(manager(), alert?.id ?? '');
    const again = await resolve(manager(), alert?.id ?? '');
    expect([again.status, again.body.code, again.body.data]).toEqual([
      409,
      'INVALID_STATE',
      { status: 'RESOLVED' },
    ]);
    const missing = await resolve(manager(), '999999');
    expect([missing.status, missing.body.code]).toEqual([404, 'RESOURCE_NOT_FOUND']);
  });

  it('resets the failure count of the driving package when it closes a LOOK_PACKAGE_PREPARE_FAILED alert', async () => {
    const alert = firstOpen('LOOK_PACKAGE_PREPARE_FAILED');
    expect(monitorStore.lookPackageResets).toEqual([]);
    await resolve(manager(), alert?.id ?? '');
    expect(monitorStore.lookPackageResets).toEqual([alert?.refId]);
    const other = firstOpen('DELETION_FAILED');
    await resolve(manager(), other?.id ?? '');
    expect(monitorStore.lookPackageResets).toHaveLength(1);
  });
});
