import { countCodePoints } from '../src/utils/codePoints';
import { trimSpec } from '../src/utils/trimSpec';
import {
  type AnalyticsEventRow,
  analyticsStore,
  FUNNEL_RATE_LIMIT_STEP,
  maskIp,
  type SavedFunnelRow,
} from './_core/analyticsData';
import { guard, hasPermission } from './_core/auth';
import { currentValue } from './_core/configStore';
import { type AdminReq, fail, invalidRequest, MockHttpError, type MockReq, ok } from './_core/http';
import { META_DEFAULTS } from './_core/meta';
import { paginateQuery } from './_core/paginate';
import { text } from './_core/statRange';
import { store } from './_core/store';

// Contract 17.4, "埋点管理", with the backend's answers 26 and 56 (docs/backend-inputs, 2026-11-02): the
// four live endpoints read the event log over a range of two ISO-8601 instants `[from, to)` (both
// required, no default range) and refuse a range longer than analytics.live_max_range_days as a
// length of time; the saved funnels are read with ANALYTICS:VIEW and written with
// ANALYTICS:FUNNEL_MANAGE.

type Detail = { ref: string; reason: string };

const EVENT_NAME = /^[a-z0-9_]{1,64}$/;

// Only the form ending in `Z` is accepted: the backend parses with `Instant.parse`, and whether an
// offset such as `+08:00` is accepted too was not checked (answer 54, item 4), so the page must not send one.
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?Z$/;

/** An instant of the query: a 400 on that parameter when it is missing (MISSING) or not an instant (INVALID_FORMAT). */
function instantParam(req: MockReq, ref: 'from' | 'to'): number {
  const raw = text(req.query[ref]);
  if (raw === '') throw invalidRequest(`${ref} is required`, [{ ref, reason: 'MISSING' }]);
  const match = INSTANT.exec(raw);
  const ms = match ? Date.parse(raw) : Number.NaN;
  const real =
    match !== null &&
    Number.isFinite(ms) &&
    new Date(ms).toISOString().slice(0, 10) === `${match[1]}-${match[2]}-${match[3]}` &&
    Number(match[4]) < 24 &&
    Number(match[5]) < 60 &&
    Number(match[6]) < 60;
  if (!real) throw invalidRequest(`${ref} is not an instant`, [{ ref, reason: 'INVALID_FORMAT' }]);
  return ms;
}

/**
 * `from` and `to`, both required (`from` is named first when both are missing); `to` not after
 * `from`, or a range longer than the limit in days, is OUT_OF_RANGE on `to`; a read that could not
 * be finished is on `from`.
 */
function liveRange(
  req: MockReq,
  kind: 'events' | 'funnel' = 'events',
): { start: number; end: number } {
  const start = instantParam(req, 'from');
  const end = instantParam(req, 'to');
  const limit = currentValue('analytics.live_max_range_days');
  const maxDays = typeof limit === 'number' ? limit : META_DEFAULTS.analyticsLiveMaxRangeDays;
  const outOfRange = (message: string) =>
    invalidRequest(message, [{ ref: 'to', reason: 'OUT_OF_RANGE' }] satisfies Detail[]);
  if (end <= start) throw outOfRange('to must be after from');
  if (end - start > maxDays * 86400000)
    throw outOfRange(`The range is longer than ${maxDays} days`);
  const slow = analyticsStore.readFailure;
  if (slow === 'TOO_SLOW' || (slow === 'TOO_MANY_EVENTS' && kind === 'funnel')) {
    throw invalidRequest('The events could not be read', [{ ref: 'from', reason: slow }]);
  }
  return { start, end };
}

const inRange = (events: AnalyticsEventRow[], range: { start: number; end: number }) =>
  events.filter((e) => {
    const t = Date.parse(e.receivedAt);
    return t >= range.start && t < range.end;
  });

const byTime = (a: AnalyticsEventRow, b: AnalyticsEventRow) =>
  a.receivedAt < b.receivedAt ? -1 : a.receivedAt > b.receivedAt ? 1 : a.seq - b.seq;

// The row of the event list: the name is `name` here (the summary and the funnel say `eventName`).
const present = (e: AnalyticsEventRow, withIp: boolean) => ({
  id: e.id,
  accountId: e.accountId,
  deviceId: e.deviceId,
  name: e.eventName,
  source: e.source,
  params: e.params,
  context: e.context,
  clientTime: e.clientTime,
  receivedAt: e.receivedAt,
  seq: e.seq,
  ip: e.ip === null ? null : withIp ? e.ip : maskIp(e.ip),
  country: e.country,
});

/** The subject of an event: the account, else the account the same device signed in with, else the device. */
function subjectsOf(events: AnalyticsEventRow[]): Map<string, AnalyticsEventRow[]> {
  const accountOfDevice = new Map<string, string>();
  for (const e of [...events].sort(byTime)) {
    if (e.accountId !== null && e.deviceId !== null && !accountOfDevice.has(e.deviceId)) {
      accountOfDevice.set(e.deviceId, e.accountId);
    }
  }
  const subjects = new Map<string, AnalyticsEventRow[]>();
  for (const e of [...events].sort(byTime)) {
    // an event of the backend itself has no device: it is the subject's only if it has an account
    const key =
      e.accountId ??
      (e.deviceId === null ? null : (accountOfDevice.get(e.deviceId) ?? `device:${e.deviceId}`));
    if (key === null) continue;
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
    // the range first, then the name (answer 56)
    const range = liveRange(req);
    const { accountId, deviceId, eventName } = {
      accountId: text(req.query.accountId),
      deviceId: text(req.query.deviceId),
      eventName: text(req.query.name),
    };
    if (eventName !== '' && !EVENT_NAME.test(eventName)) {
      throw invalidRequest('name must be 1 to 64 characters of a-z, 0-9 and _', [
        { ref: 'name', reason: 'INVALID_FORMAT' },
      ]);
    }
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
    const range = liveRange(req, 'funnel');
    const limit = currentValue('analytics.funnel_max_concurrency');
    if (
      steps.includes(FUNNEL_RATE_LIMIT_STEP) ||
      analyticsStore.funnelInFlight >= (typeof limit === 'number' ? limit : 2)
    ) {
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
