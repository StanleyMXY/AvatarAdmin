import { countCodePoints } from '../src/utils/codePoints';
import { trimSpec } from '../src/utils/trimSpec';
import {
  type AnalyticsEventRow,
  analyticsStore,
  maskIp,
  type SavedFunnelRow,
} from './_core/analyticsData';
import { guard, hasPermission } from './_core/auth';
import { currentValue } from './_core/configStore';
import { type AdminReq, fail, invalidRequest, MockHttpError, type MockReq, ok } from './_core/http';
import { META_DEFAULTS } from './_core/meta';
import { paginateQuery } from './_core/paginate';
import { daysIn, text, validDay } from './_core/statRange';
import { store } from './_core/store';

// Contract 17.4, "埋点管理": the four live endpoints read the event log and refuse a range longer
// than analytics.live_max_range_days; the saved funnels are read with ANALYTICS:VIEW and written
// with ANALYTICS:FUNNEL_MANAGE. A range is two UTC days, both included, as for the statistics
// (the contract does not say; see docs/contract-requests/2026-10-26-admin-frontend-analytics.md).

type Detail = { ref: string; reason: string };

/** `from` and `to`, both required; 400 INVALID_REQUEST naming the parameter that is wrong. */
function liveRange(req: MockReq): { from: string; to: string; start: number; end: number } {
  const from = text(req.query.from);
  const to = text(req.query.to);
  const details: Detail[] = [];
  if (!validDay(from)) details.push({ ref: 'from', reason: 'OUT_OF_RANGE' });
  if (!validDay(to)) details.push({ ref: 'to', reason: 'OUT_OF_RANGE' });
  if (details.length === 0 && from > to) details.push({ ref: 'from', reason: 'OUT_OF_RANGE' });
  if (details.length === 0 && daysIn(from, to).length > META_DEFAULTS.analyticsLiveMaxRangeDays) {
    details.push({ ref: 'to', reason: 'OUT_OF_RANGE' });
  }
  if (details.length > 0) {
    throw invalidRequest('from and to must be days, at most 31 days apart', details);
  }
  return {
    from,
    to,
    start: Date.parse(`${from}T00:00:00.000Z`),
    end: Date.parse(`${to}T00:00:00.000Z`) + 86400000,
  };
}

const inRange = (events: AnalyticsEventRow[], range: { start: number; end: number }) =>
  events.filter((e) => {
    const t = Date.parse(e.receivedAt);
    return t >= range.start && t < range.end;
  });

const byTime = (a: AnalyticsEventRow, b: AnalyticsEventRow) =>
  a.receivedAt < b.receivedAt ? -1 : a.receivedAt > b.receivedAt ? 1 : a.seq - b.seq;

const present = (e: AnalyticsEventRow, withIp: boolean) => ({
  id: e.id,
  eventName: e.eventName,
  accountId: e.accountId,
  deviceId: e.deviceId,
  receivedAt: e.receivedAt,
  clientTime: e.clientTime,
  country: e.country,
  ip: e.ip === null ? null : withIp ? e.ip : maskIp(e.ip),
  params: e.params,
  context: e.context,
});

/** The subject of an event: the account, else the account the same device signed in with, else the device. */
function subjectsOf(events: AnalyticsEventRow[]): Map<string, AnalyticsEventRow[]> {
  const accountOfDevice = new Map<string, string>();
  for (const e of [...events].sort(byTime)) {
    if (e.accountId !== null && !accountOfDevice.has(e.deviceId)) {
      accountOfDevice.set(e.deviceId, e.accountId);
    }
  }
  const subjects = new Map<string, AnalyticsEventRow[]>();
  for (const e of [...events].sort(byTime)) {
    const key = e.accountId ?? accountOfDevice.get(e.deviceId) ?? `device:${e.deviceId}`;
    subjects.set(key, [...(subjects.get(key) ?? []), e]);
  }
  return subjects;
}

/** How many steps in order, each within the window of the one before, a subject got through. */
function depthOf(list: AnalyticsEventRow[], steps: string[], windowMs: number): number {
  let best = 0;
  list.forEach((first, startIndex) => {
    if (first.eventName !== steps[0]) return;
    let depth = 1;
    let at = startIndex;
    let time = Date.parse(first.receivedAt);
    while (depth < steps.length) {
      const next = list.findIndex(
        (e, i) =>
          i > at && e.eventName === steps[depth] && Date.parse(e.receivedAt) - time <= windowMs,
      );
      if (next < 0) break;
      at = next;
      time = Date.parse(list[next].receivedAt);
      depth += 1;
    }
    best = Math.max(best, depth);
  });
  return best;
}

const integerParam = (value: unknown): number =>
  typeof value === 'string' && /^-?\d+$/.test(value.trim()) ? Number(value) : Number.NaN;

function checkSteps(steps: unknown): string[] {
  if (
    !Array.isArray(steps) ||
    steps.some((s) => typeof s !== 'string' || s === '' || s.includes(','))
  ) {
    throw invalidRequest('steps must be 2 to 10 event names', [
      { ref: 'steps', reason: 'OUT_OF_RANGE' },
    ]);
  }
  if (steps.length < 2 || steps.length > 10) {
    throw invalidRequest('steps must be 2 to 10 event names', [
      { ref: 'steps', reason: 'OUT_OF_RANGE' },
    ]);
  }
  return steps as string[];
}

function checkWindow(hours: number): number {
  if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
    throw invalidRequest('windowHours must be 1 to 720', [
      { ref: 'windowHours', reason: 'OUT_OF_RANGE' },
    ]);
  }
  return hours;
}

type FunnelBody = { name: string; steps: string[]; windowHours: number };

function funnelBodyOf(raw: unknown): FunnelBody {
  const body = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const details: Detail[] = [];
  const name = typeof body.name === 'string' ? trimSpec(body.name) : '';
  if (name === '' || countCodePoints(name) > 100)
    details.push({ ref: 'name', reason: 'OUT_OF_RANGE' });
  const steps = body.steps;
  if (
    !Array.isArray(steps) ||
    steps.length < 2 ||
    steps.length > 10 ||
    steps.some((s) => typeof s !== 'string' || s === '' || s.includes(','))
  ) {
    details.push({ ref: 'steps', reason: 'OUT_OF_RANGE' });
  }
  const hours = body.windowHours;
  if (typeof hours !== 'number' || !Number.isInteger(hours) || hours < 1 || hours > 720) {
    details.push({ ref: 'windowHours', reason: 'OUT_OF_RANGE' });
  }
  if (details.length > 0) throw invalidRequest('the funnel is not valid', details);
  return { name, steps: steps as string[], windowHours: hours as number };
}

const findFunnel = (id: string | undefined): SavedFunnelRow => {
  const funnel = analyticsStore.funnels.find((f) => f.id === id);
  if (!funnel) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such funnel');
  return funnel;
};

const writable = (id: string | undefined): SavedFunnelRow => {
  const funnel = findFunnel(id);
  if (funnel.isPreset) {
    throw new MockHttpError(409, 'INVALID_STATE', 'A preset funnel is read only', {
      status: 'PRESET',
    });
  }
  return funnel;
};

const sameNameElsewhere = (name: string, id?: string) =>
  analyticsStore.funnels.some((f) => f.name === name && f.id !== id);

const presentFunnel = (f: SavedFunnelRow) => ({
  ...f,
  createdByUsername:
    f.createdBy === null ? null : (store.admins.get(f.createdBy)?.username ?? null),
});

export default {
  'GET /api/admin/analytics/events': guard('ANALYTICS:VIEW', (req: AdminReq) => {
    const range = liveRange(req);
    const { accountId, deviceId, eventName } = {
      accountId: text(req.query.accountId),
      deviceId: text(req.query.deviceId),
      eventName: text(req.query.eventName),
    };
    const rows = inRange(analyticsStore.events, range)
      .filter(
        (e) =>
          (accountId === '' || e.accountId === accountId) &&
          (deviceId === '' || e.deviceId === deviceId) &&
          (eventName === '' || e.eventName === eventName),
      )
      .sort((a, b) => byTime(b, a));
    const withIp = hasPermission(req.admin, 'ANALYTICS:IP_VIEW');
    const page = paginateQuery(rows, req);
    return ok({ items: page.items.map((e) => present(e, withIp)), total: page.total });
  }),

  'GET /api/admin/analytics/event-summary': guard('ANALYTICS:VIEW', (req) => {
    const stats = new Map<string, { pv: number; accounts: Set<string> }>();
    for (const e of inRange(analyticsStore.events, liveRange(req))) {
      const entry = stats.get(e.eventName) ?? { pv: 0, accounts: new Set<string>() };
      entry.pv += 1;
      if (e.accountId !== null) entry.accounts.add(e.accountId);
      stats.set(e.eventName, entry);
    }
    const items = [...stats.entries()]
      .map(([eventName, s]) => ({ eventName, pv: s.pv, uv: s.accounts.size }))
      .sort(
        (a, b) =>
          b.pv - a.pv || (a.eventName < b.eventName ? -1 : a.eventName > b.eventName ? 1 : 0),
      );
    return ok({ items });
  }),

  'GET /api/admin/analytics/event-names': guard('ANALYTICS:VIEW', (req) => {
    const names = new Set(inRange(analyticsStore.events, liveRange(req)).map((e) => e.eventName));
    return ok({ items: [...names].sort() });
  }),

  // Checked in this order: the steps, the window, the range, then the limit of funnels being computed
  // (analytics.funnel_max_concurrency, 2 by default): at the limit the answer is 429 RATE_LIMITED at
  // once, with no data and no Retry-After.
  'GET /api/admin/analytics/funnel': guard('ANALYTICS:VIEW', (req) => {
    const steps = checkSteps(text(req.query.steps) === '' ? [] : text(req.query.steps).split(','));
    const hours = checkWindow(
      req.query.windowHours === undefined ? 24 : integerParam(req.query.windowHours),
    );
    const range = liveRange(req);
    const limit = currentValue('analytics.funnel_max_concurrency');
    if (analyticsStore.funnelInFlight >= (typeof limit === 'number' ? limit : 2)) {
      return fail(429, 'RATE_LIMITED', 'Too many funnels are being computed');
    }
    const depths = [...subjectsOf(inRange(analyticsStore.events, range)).values()].map((list) =>
      depthOf(list, steps, hours * 3600000),
    );
    const counts = steps.map((_, i) => depths.filter((d) => d >= i + 1).length);
    return ok({
      steps: steps.map((eventName, i) => ({
        eventName,
        count: counts[i],
        conversionFromPrevious: i === 0 || counts[i - 1] === 0 ? null : counts[i] / counts[i - 1],
      })),
    });
  }),

  'GET /api/admin/analytics/funnels': guard('ANALYTICS:VIEW', () =>
    ok({
      items: [...analyticsStore.funnels]
        .sort((a, b) => Number(b.isPreset) - Number(a.isPreset) || Number(a.id) - Number(b.id))
        .map(presentFunnel),
    }),
  ),

  'POST /api/admin/analytics/funnels': guard('ANALYTICS:FUNNEL_MANAGE', (req) => {
    const body = funnelBodyOf(req.body);
    if (sameNameElsewhere(body.name)) {
      throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'A funnel has this name', {
        field: 'name',
      });
    }
    const now = new Date().toISOString();
    const funnel: SavedFunnelRow = {
      id: String(Math.max(200, ...analyticsStore.funnels.map((f) => Number(f.id))) + 1),
      ...body,
      isPreset: false,
      createdBy: req.admin.id,
      createdAt: now,
      updatedAt: now,
    };
    analyticsStore.funnels.push(funnel);
    return ok(presentFunnel(funnel));
  }),

  'PUT /api/admin/analytics/funnels/:id': guard('ANALYTICS:FUNNEL_MANAGE', (req) => {
    const funnel = writable(req.params.id);
    const body = funnelBodyOf(req.body);
    if (sameNameElsewhere(body.name, funnel.id)) {
      throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'A funnel has this name', {
        field: 'name',
      });
    }
    Object.assign(funnel, body, { updatedAt: new Date().toISOString() });
    return ok(presentFunnel(funnel));
  }),

  'DELETE /api/admin/analytics/funnels/:id': guard('ANALYTICS:FUNNEL_MANAGE', (req) => {
    const funnel = writable(req.params.id);
    analyticsStore.funnels = analyticsStore.funnels.filter((f) => f.id !== funnel.id);
    return ok(null);
  }),
};
