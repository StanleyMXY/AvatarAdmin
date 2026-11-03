// The subscription endpoints of the mock backend (contract 15.3 to 15.6, 17.4 "订阅管理", backend
// reply points 2 to 4). Only the default export is read by the Umi mock loader; the sample data and
// the state are in _core/subscriptionsData.ts.
import { guard } from './_core/auth';
import { daysAgoIso } from './_core/fixtures';
import { bodyOf, invalidRequest, MockHttpError, type MockReq, ok } from './_core/http';
import { currentMeta } from './_core/meta';
import { paginateQuery } from './_core/paginate';
import { rangeOf, text } from './_core/statRange';
import {
  ACCOUNT_IDS,
  type AccountEntitlementRow,
  type Def,
  type EventRow,
  type Gate,
  MEMORY_TIERS,
  MODEL_TIERS,
  type Mode,
  type Product,
  publicEvent,
  publicSubscription,
  QUOTA_KEYS,
  SUBSCRIPTION_STATES,
  subscriptionsState,
} from './_core/subscriptionsData';
import { usersState } from './_core/usersData';

const state = subscriptionsState;
const DAY_MS = 86_400_000;

const notFound = (what: string) =>
  new MockHttpError(404, 'RESOURCE_NOT_FOUND', `There is no such ${what}`);
const bad = (ref: string, reason: string, message = `${ref} is not valid`) =>
  invalidRequest(message, [{ ref, reason }]);

/** Counts code points after the ends are trimmed, as the server counts text (contract 1.9). */
const codePointLength = (value: string) => [...value.trim()].length;

/** What the server refuses in the name and the priority of an entitlement (the key is checked on its own). */
function defProblems(body: Record<string, unknown>): { ref: string; reason: string }[] {
  const details: { ref: string; reason: string }[] = [];
  const name = typeof body.name === 'string' ? body.name : '';
  if (codePointLength(name) === 0) details.push({ ref: 'name', reason: 'EMPTY_NOT_ALLOWED' });
  else if (codePointLength(name) > 100) details.push({ ref: 'name', reason: 'TOO_LONG' });
  const priority = body.priority;
  if (priority === undefined || priority === null)
    details.push({ ref: 'priority', reason: 'EMPTY_NOT_ALLOWED' });
  else if (typeof priority !== 'number' || !Number.isInteger(priority))
    details.push({ ref: 'priority', reason: 'NOT_AN_INTEGER' });
  return details;
}

// ---- feature values ----

type FeatureInput = { mode: Mode; value: unknown };

/** The largest value of a LIMIT feature: `entitlement.limit_max`, the same value `GET /meta` gives as entitlementLimitMax. */
function limitMax(): number {
  const max = currentMeta().entitlementLimitMax;
  return typeof max === 'number' ? max : 1_000_000;
}

/** What the server would refuse about one feature value, as a reason code, or null. */
function valueProblem(gate: Gate, input: FeatureInput, forEntitlement: boolean): string | null {
  if (input.mode === 'UNSET') {
    if (!forEntitlement && !QUOTA_KEYS.includes(gate.key)) return 'OUT_OF_RANGE';
    return null;
  }
  if (input.mode === 'UNLIMITED') {
    if (gate.kind !== 'LIMIT' || gate.key === 'credits.period_grant') return 'OUT_OF_RANGE';
    return null;
  }
  const { value } = input;
  if (value === undefined || value === null) return 'EMPTY_NOT_ALLOWED';
  switch (gate.kind) {
    case 'BOOLEAN':
      return typeof value === 'boolean' ? null : 'NOT_BOOLEAN';
    case 'LIMIT':
      if (typeof value !== 'number' || !Number.isInteger(value)) return 'NOT_AN_INTEGER';
      return value < 0 || value > limitMax() ? 'OUT_OF_RANGE' : null;
    case 'STRING': {
      if (typeof value !== 'string' || value.trim() === '') return 'EMPTY_NOT_ALLOWED';
      if (gate.key === 'memory.tier') return MEMORY_TIERS.includes(value) ? null : 'OUT_OF_RANGE';
      if (gate.key === 'chat.model_tier')
        return MODEL_TIERS.includes(value) ? null : 'OUT_OF_RANGE';
      return null;
    }
  }
}

const modeOf = (raw: unknown): Mode | null =>
  raw === 'VALUE' || raw === 'UNLIMITED' || raw === 'UNSET' ? raw : null;

const inputOf = (raw: unknown): FeatureInput | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const mode = modeOf((raw as { mode?: unknown }).mode);
  return mode ? { mode, value: (raw as { value?: unknown }).value } : null;
};

const gateOf = (key: string): Gate | undefined => state().gates.find((g) => g.key === key);

// ---- shapes of the answers ----

const defView = (def: Def) => ({
  ...def,
  features: state()
    .gates.map((g) => g.key)
    .sort()
    .map((featureKey) => {
      const row = state().features.get(`${def.key}|${featureKey}`);
      return row
        ? { featureKey, mode: row.mode, value: row.mode === 'VALUE' ? row.value : null }
        : { featureKey, mode: 'UNSET' as Mode, value: null };
    }),
});

const entitlementStatus = (row: AccountEntitlementRow, now = Date.now()) => {
  if (row.revokedAt) return 'REVOKED';
  if (row.expiresAt && Date.parse(row.expiresAt) <= now) return 'EXPIRED';
  return 'ACTIVE';
};

/** The value in force for one account and one switch (contract 15.3): ENTITLEMENT, DEFAULT or NONE. */
function effectiveFor(gate: Gate, active: AccountEntitlementRow[]) {
  const defs = state().defs;
  const configured = active
    .map((row) => ({
      row,
      def: defs.find((d) => d.key === row.entitlementKey),
      feature: state().features.get(`${row.entitlementKey}|${gate.key}`),
    }))
    .filter((c) => c.def && c.feature);
  const base = { featureKey: gate.key, kind: gate.kind };
  const fromDefault = () =>
    gate.defaultMode === 'UNSET'
      ? { ...base, mode: 'UNSET' as Mode, value: null, source: 'NONE', entitlementKey: null }
      : {
          ...base,
          mode: gate.defaultMode,
          value: gate.defaultMode === 'VALUE' ? gate.defaultValue : null,
          source: 'DEFAULT',
          entitlementKey: null,
        };
  if (configured.length === 0 || gate.key === 'call.lifetime_minutes') return fromDefault();
  const from = (c: (typeof configured)[number]) => ({
    ...base,
    mode: (c.feature as { mode: Mode }).mode,
    value: (c.feature as { value: unknown }).value,
    source: 'ENTITLEMENT',
    entitlementKey: c.row.entitlementKey,
  });
  if (gate.kind === 'STRING') {
    const top = [...configured].sort(
      (a, b) => (b.def as Def).priority - (a.def as Def).priority,
    )[0];
    return from(top);
  }
  if (gate.kind === 'BOOLEAN') {
    // a tie with the default goes to the default
    const yes = configured.find((c) => c.feature?.value === true);
    return yes && !(gate.defaultMode === 'VALUE' && gate.defaultValue === true)
      ? from(yes)
      : fromDefault();
  }
  // LIMIT: the largest, unlimited largest of all, and the default counts too (ties go to the default)
  const rank = (mode: Mode, value: unknown) =>
    mode === 'UNLIMITED' ? Number.POSITIVE_INFINITY : mode === 'VALUE' ? Number(value) : -1;
  const defaultRank = rank(gate.defaultMode, gate.defaultValue);
  const best = [...configured].sort(
    (a, b) =>
      rank((b.feature as { mode: Mode }).mode, b.feature?.value) -
      rank((a.feature as { mode: Mode }).mode, a.feature?.value),
  )[0];
  return rank((best.feature as { mode: Mode }).mode, best.feature?.value) > defaultRank
    ? from(best)
    : fromDefault();
}

// ---- filters ----

const oneOfQuery = (req: MockReq, name: string, allowed: readonly string[]) => {
  const value = text(req.query[name]);
  if (value === '') return undefined;
  if (!allowed.includes(value)) throw bad(name, 'OUT_OF_RANGE');
  return value;
};

const idParam = (req: MockReq) => req.params.id ?? '';

// ---- stats ----

const STAT_COMBOS = [
  ['APPLE', 'avatar.premium.monthly', 'USD', '9.99'],
  ['APPLE', 'avatar.premium.yearly', 'THB', '1290.00'],
  ['GOOGLE', 'avatar_premium_monthly', 'IDR', '149000'],
  ['GOOGLE', 'avatar_plus_monthly', null, null],
] as const;

const hash = (...parts: (string | number)[]) =>
  [...parts.join('|')].reduce((h, c) => (h * 31 + (c.codePointAt(0) ?? 0)) % 100003, 7);

function statsRow(
  day: string,
  [store, productId, currency, amount]: (typeof STAT_COMBOS)[number],
  today: string,
) {
  const h = hash(day, store, productId);
  return {
    statDate: day,
    store,
    productId,
    // the snapshot is missing for some days
    active: day === today || h % 5 === 0 ? null : 200 + (h % 400),
    new: h % 17,
    renewed: h % 23,
    canceled: h % 7,
    expired: h % 5,
    refunded: h % 3,
    listPriceAmount: amount,
    listPriceCurrency: currency,
  };
}

// ---- the endpoints ----

export default {
  'GET /api/admin/subscriptions/stats': guard('FINANCE:VIEW', (req) => {
    const { from, to, today } = rangeOf(req);
    const days: string[] = [];
    for (
      let ms = Date.parse(`${from}T00:00:00Z`);
      ms <= Date.parse(`${to}T00:00:00Z`);
      ms += DAY_MS
    ) {
      days.push(new Date(ms).toISOString().slice(0, 10));
    }
    return ok({
      items: days.flatMap((day) => STAT_COMBOS.map((combo) => statsRow(day, combo, today))),
    });
  }),

  'GET /api/admin/subscriptions': guard('SUBSCRIPTION:VIEW', (req) => {
    const accountId = text(req.query.accountId);
    const stateFilter = oneOfQuery(req, 'state', SUBSCRIPTION_STATES);
    const store = text(req.query.store);
    const productId = text(req.query.productId);
    const rows = state()
      .subscriptions.filter(
        (r) =>
          (accountId === '' || r.accountId === accountId) &&
          (stateFilter === undefined || r.state === stateFilter) &&
          (store === '' || r.store === store) &&
          (productId === '' || r.productId === productId),
      )
      .sort((a, b) =>
        a.createdAt === b.createdAt
          ? Number(b.id) - Number(a.id)
          : a.createdAt < b.createdAt
            ? 1
            : -1,
      );
    return ok(paginateQuery(rows.map(publicSubscription), req));
  }),

  'GET /api/admin/subscriptions/:id': guard('SUBSCRIPTION:VIEW', (req) => {
    const row = state().subscriptions.find((r) => r.id === idParam(req));
    if (!row) throw notFound('subscription');
    const events = state()
      .events.filter((e) => e.subscriptionId === row.id)
      .sort((a, b) =>
        a.eventSignedAt === b.eventSignedAt
          ? b.receivedAt.localeCompare(a.receivedAt)
          : b.eventSignedAt.localeCompare(a.eventSignedAt),
      )
      .map((e) => ({
        id: e.id,
        type: e.type,
        subtype: e.subtype,
        eventSignedAt: e.eventSignedAt,
        receivedAt: e.receivedAt,
        processedAt: e.processedAt,
        error: e.error,
        needsAttention: e.needsAttention,
      }));
    return ok({ ...publicSubscription(row), events });
  }),

  'GET /api/admin/accounts/:id/entitlements': guard('SUBSCRIPTION:VIEW', (req) => {
    const accountId = idParam(req);
    // An account of the user module counts too: its detail page opens this tab, and an account
    // with no entitlement yet has an empty list.
    const known =
      ACCOUNT_IDS.includes(accountId) ||
      state().accountEntitlements.some((r) => r.accountId === accountId) ||
      usersState.users.some((u) => u.id === accountId);
    if (!known) throw notFound('account');
    const now = Date.now();
    const rows = state()
      .accountEntitlements.filter((r) => r.accountId === accountId)
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    const active = rows.filter((r) => entitlementStatus(r, now) === 'ACTIVE');
    return ok({
      effective: state().gates.map((g) => effectiveFor(g, active)),
      entitlements: rows.map((r) => ({
        ...r,
        entitlementName:
          state().defs.find((d) => d.key === r.entitlementKey)?.name ?? r.entitlementKey,
        status: entitlementStatus(r, now),
      })),
    });
  }),

  // Backend reply 106: the fields are checked first (400), then the account (404), then the entitlement
  // (404 RESOURCE_NOT_FOUND, not 400); the days are 1 to 3650; the answer is { id }.
  'POST /api/admin/accounts/:id/promo-entitlements': guard('SUBSCRIPTION:GRANT', (req) => {
    const accountId = idParam(req);
    const body = bodyOf(req);
    const details: { ref: string; reason: string }[] = [];
    const key = typeof body.entitlementKey === 'string' ? body.entitlementKey : '';
    if (key.trim() === '') details.push({ ref: 'entitlementKey', reason: 'EMPTY_NOT_ALLOWED' });
    const days = body.durationDays;
    if (days === undefined || days === null)
      details.push({ ref: 'durationDays', reason: 'EMPTY_NOT_ALLOWED' });
    else if (typeof days !== 'number' || !Number.isInteger(days))
      details.push({ ref: 'durationDays', reason: 'NOT_AN_INTEGER' });
    else if (days < 1 || days > 3650) details.push({ ref: 'durationDays', reason: 'OUT_OF_RANGE' });
    const reason = typeof body.reason === 'string' ? body.reason : '';
    if (codePointLength(reason) === 0) details.push({ ref: 'reason', reason: 'EMPTY_NOT_ALLOWED' });
    else if (codePointLength(reason) > 500) details.push({ ref: 'reason', reason: 'TOO_LONG' });
    if (details.length > 0) throw invalidRequest('the grant is not valid', details);
    if (!ACCOUNT_IDS.includes(accountId)) throw notFound('account');
    if (!state().defs.some((d) => d.key === key)) throw notFound('entitlement');
    const now = new Date();
    const row: AccountEntitlementRow = {
      id: String(state().nextPromoId++),
      accountId,
      entitlementKey: key,
      source: 'PROMO',
      subscriptionId: null,
      startsAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + (days as number) * DAY_MS).toISOString(),
      grantedBy: req.admin.id,
      grantedByUsername: req.admin.username,
      reason: reason.trim(),
      revokedAt: null,
      expiryHandledAt: null,
    };
    state().accountEntitlements.push(row);
    return ok({ id: row.id });
  }),

  // A row that is not there, or is a store subscription's, is 404; one that is no longer active is
  // 409 with its status; success is data null.
  'POST /api/admin/promo-entitlements/:id/revoke': guard('SUBSCRIPTION:GRANT', (req) => {
    const row = state().accountEntitlements.find((r) => r.id === idParam(req));
    if (row?.source !== 'PROMO') throw notFound('entitlement');
    const status = entitlementStatus(row);
    if (status !== 'ACTIVE')
      throw new MockHttpError(
        409,
        'INVALID_STATE',
        'Only an active promotional entitlement can be revoked',
        { status },
      );
    row.revokedAt = new Date().toISOString();
    return ok(null);
  }),

  'GET /api/admin/entitlement-defs': guard(['SUBSCRIPTION:VIEW', 'SUBSCRIPTION:GRANT'], () =>
    ok({ items: [...state().defs].sort((a, b) => a.priority - b.priority).map(defView) }),
  ),

  // Backend reply 104: the key is [A-Za-z0-9][A-Za-z0-9._-]{0,63} (only when made), the name 1 to 100
  // code points after trimming, the priority a whole number of any size and unique. A taken key or
  // priority is 409 DUPLICATE_RESOURCE with data.field; when the key is taken and the priority is held
  // by another entitlement too, it is the priority that is named. POST answers { key }, PUT data null.
  'POST /api/admin/entitlement-defs': guard('SUBSCRIPTION:CONFIG', (req) => {
    const body = bodyOf(req);
    const key = typeof body.key === 'string' ? body.key.trim() : '';
    const details = defProblems(body);
    if (key === '') details.unshift({ ref: 'key', reason: 'EMPTY_NOT_ALLOWED' });
    else if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(key))
      details.unshift({ ref: 'key', reason: 'OUT_OF_RANGE' });
    if (details.length > 0) throw invalidRequest('the definition is not valid', details);
    const name = (body.name as string).trim();
    const priority = body.priority as number;
    const holder = state().defs.find((d) => d.priority === priority);
    if (holder && holder.key !== key)
      throw new MockHttpError(
        409,
        'DUPLICATE_RESOURCE',
        'The entitlement priority already exists',
        {
          field: 'priority',
        },
      );
    if (state().defs.some((d) => d.key === key))
      throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The entitlement key already exists', {
        field: 'key',
      });
    state().defs.push({ key, name, priority });
    return ok({ key });
  }),

  'PUT /api/admin/entitlement-defs/:key': guard('SUBSCRIPTION:CONFIG', (req) => {
    const def = state().defs.find((d) => d.key === req.params.key);
    if (!def) throw notFound('entitlement');
    const body = bodyOf(req);
    const details = defProblems(body);
    if (details.length > 0) throw invalidRequest('the definition is not valid', details);
    const priority = body.priority as number;
    if (state().defs.some((d) => d.key !== def.key && d.priority === priority))
      throw new MockHttpError(
        409,
        'DUPLICATE_RESOURCE',
        'The entitlement priority already exists',
        {
          field: 'priority',
        },
      );
    def.name = (body.name as string).trim();
    def.priority = priority;
    return ok(null);
  }),

  'PUT /api/admin/entitlement-defs/:key/features': guard('SUBSCRIPTION:CONFIG', (req) => {
    const def = state().defs.find((d) => d.key === req.params.key);
    if (!def) throw notFound('entitlement');
    const list = bodyOf(req).features;
    if (!Array.isArray(list)) throw bad('features', 'EMPTY_NOT_ALLOWED');
    const details: { ref: string; reason: string }[] = [];
    const changes: { gate: Gate; input: FeatureInput }[] = [];
    for (const raw of list) {
      const featureKey = typeof raw?.featureKey === 'string' ? raw.featureKey : '';
      const gate = gateOf(featureKey);
      const input = inputOf(raw);
      if (!gate || !input) {
        details.push({ ref: featureKey || 'featureKey', reason: 'OUT_OF_RANGE' });
        continue;
      }
      // call.lifetime_minutes only applies to free accounts: it cannot be a value of an entitlement
      const problem =
        featureKey === 'call.lifetime_minutes' ? 'OUT_OF_RANGE' : valueProblem(gate, input, true);
      if (problem) details.push({ ref: featureKey, reason: problem });
      else changes.push({ gate, input });
    }
    if (details.length > 0) throw invalidRequest('a feature value is not valid', details);
    for (const { gate, input } of changes) {
      const slot = `${def.key}|${gate.key}`;
      if (input.mode === 'UNSET') state().features.delete(slot);
      else
        state().features.set(slot, {
          mode: input.mode,
          value: input.mode === 'VALUE' ? input.value : null,
        });
    }
    return ok(defView(def));
  }),

  'GET /api/admin/feature-gates': guard('SUBSCRIPTION:VIEW', () =>
    ok({ items: [...state().gates].sort((a, b) => (a.key < b.key ? -1 : 1)) }),
  ),

  'PUT /api/admin/feature-gates/:key/default': guard('SUBSCRIPTION:CONFIG', (req) => {
    const gate = gateOf(req.params.key ?? '');
    if (!gate) throw notFound('feature switch');
    const input = inputOf(req.body);
    if (!input) throw bad('mode', 'OUT_OF_RANGE');
    const problem = valueProblem(gate, input, false);
    if (problem) throw bad(input.mode === 'VALUE' ? 'value' : 'mode', problem);
    gate.defaultMode = input.mode;
    gate.defaultValue = input.mode === 'VALUE' ? input.value : null;
    return ok(gate);
  }),

  // Backend reply 105: { creditCost: whole number from 1, or null }; the field has to be there; a price
  // can be set on assets.avatar_max and assets.voice_max only (any other switch: 400 OUT_OF_RANGE on
  // creditCost), clearing it (null) is allowed on every switch; the answer is data null.
  'PUT /api/admin/feature-gates/:key/credit-cost': guard('SUBSCRIPTION:CONFIG', (req) => {
    const gate = gateOf(req.params.key ?? '');
    if (!gate) throw notFound('feature switch');
    const cost = bodyOf(req).creditCost;
    if (cost === undefined) throw bad('creditCost', 'EMPTY_NOT_ALLOWED');
    if (cost !== null) {
      if (typeof cost !== 'number' || !Number.isInteger(cost))
        throw bad('creditCost', 'NOT_AN_INTEGER');
      if (cost < 1) throw bad('creditCost', 'OUT_OF_RANGE');
      if (!['assets.avatar_max', 'assets.voice_max'].includes(gate.key))
        throw bad('creditCost', 'OUT_OF_RANGE');
    }
    gate.creditCost = cost;
    return ok(null);
  }),

  'GET /api/admin/subscription-products': guard('SUBSCRIPTION:VIEW', () =>
    ok({
      items: [...state().products].sort(
        (a, b) =>
          a.store.localeCompare(b.store) ||
          a.sortOrder - b.sortOrder ||
          a.productId.localeCompare(b.productId),
      ),
    }),
  ),

  // Backend reply 28: the body is { items: [...] }, every item carries all six fields; an item is added
  // or changed by (store, productId), the ones not listed stay; one transaction (a refusal saves
  // nothing); success is data null; an entitlement that does not exist is 404, not 400.
  'PUT /api/admin/subscription-products': guard('SUBSCRIPTION:CONFIG', (req) => {
    const list = bodyOf(req).items;
    if (!Array.isArray(list) || list.length === 0) throw bad('items', 'EMPTY_NOT_ALLOWED');
    const details: { ref: string; reason: string }[] = [];
    const items: Product[] = [];
    for (const raw of list as Record<string, unknown>[]) {
      const row = raw && typeof raw === 'object' ? raw : {};
      const add = (ref: string, reason: string) => details.push({ ref, reason });
      const store = typeof row.store === 'string' ? row.store : '';
      const productId = typeof row.productId === 'string' ? row.productId.trim() : '';
      if (store === '') add('store', 'EMPTY_NOT_ALLOWED');
      else if (!/^[A-Z][A-Z0-9_]{1,31}$/.test(store)) add('store', 'OUT_OF_RANGE');
      if (productId === '') add('productId', 'EMPTY_NOT_ALLOWED');
      else if ([...productId].length > 255) add('productId', 'TOO_LONG');
      if (typeof row.entitlementKey !== 'string' || row.entitlementKey.trim() === '')
        add('entitlementKey', 'EMPTY_NOT_ALLOWED');
      if (row.enabled === undefined || row.enabled === null) add('enabled', 'EMPTY_NOT_ALLOWED');
      else if (typeof row.enabled !== 'boolean') add('enabled', 'NOT_BOOLEAN');
      if (row.sortOrder === undefined || row.sortOrder === null)
        add('sortOrder', 'EMPTY_NOT_ALLOWED');
      else if (typeof row.sortOrder !== 'number' || !Number.isInteger(row.sortOrder))
        add('sortOrder', 'NOT_AN_INTEGER');
      const surfaces = row.surfaces;
      if (surfaces === undefined || surfaces === null) add('surfaces', 'EMPTY_NOT_ALLOWED');
      else if (
        !Array.isArray(surfaces) ||
        surfaces.length > 50 ||
        surfaces.some(
          (x) =>
            !x ||
            (x.platform !== 'ANDROID' && x.platform !== 'IOS') ||
            (x.channel !== null && x.channel !== undefined && typeof x.channel !== 'string'),
        )
      )
        add('surfaces', 'OUT_OF_RANGE');
      items.push({
        store,
        productId,
        entitlementKey: typeof row.entitlementKey === 'string' ? row.entitlementKey : '',
        enabled: row.enabled as boolean,
        sortOrder: row.sortOrder as number,
        surfaces: Array.isArray(surfaces) ? (surfaces as Product['surfaces']) : [],
      });
    }
    if (details.length > 0) throw invalidRequest('the product is not valid', details);
    const seen = new Set<string>();
    for (const item of items) {
      const id = `${item.store}|${item.productId}`;
      if (seen.has(id))
        throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The product is listed twice', {
          field: 'productId',
        });
      seen.add(id);
    }
    if (items.some((item) => !state().defs.some((d) => d.key === item.entitlementKey)))
      throw notFound('entitlement');
    for (const item of items) {
      const existing = state().products.find(
        (p) => p.store === item.store && p.productId === item.productId,
      );
      if (existing) Object.assign(existing, item);
      else state().products.push(item);
    }
    return ok(null);
  }),

  'GET /api/admin/subscription-events': guard('SUBSCRIPTION:VIEW', (req) => {
    const status = oneOfQuery(req, 'status', ['FAILED']);
    const attention = oneOfQuery(req, 'needsAttention', ['true', 'false']);
    const rows = state()
      .events.filter(
        (e) =>
          (status === undefined || e.error !== null) &&
          (attention === undefined || e.needsAttention === (attention === 'true')),
      )
      .sort(
        (a, b) => b.eventSignedAt.localeCompare(a.eventSignedAt) || Number(b.id) - Number(a.id),
      );
    return ok(paginateQuery(rows.map(publicEvent), req));
  }),

  'POST /api/admin/subscription-events/:id/reprocess': guard('SUBSCRIPTION:GRANT', (req) => {
    const event: EventRow | undefined = state().events.find((e) => e.id === idParam(req));
    if (!event) throw notFound('event');
    if (event.error === null)
      throw new MockHttpError(409, 'INVALID_STATE', 'Only a failed event can be processed again', {
        status: 'PROCESSED',
      });
    event.error = null;
    event.processedAt = daysAgoIso(0);
    return ok(publicEvent(event));
  }),

  'POST /api/admin/subscription-events/:id/ack': guard('SUBSCRIPTION:GRANT', (req) => {
    const event: EventRow | undefined = state().events.find((e) => e.id === idParam(req));
    if (!event) throw notFound('event');
    if (!event.needsAttention)
      throw new MockHttpError(409, 'INVALID_STATE', 'The event does not need attention', {
        status: 'HANDLED',
      });
    event.needsAttention = false;
    return ok(publicEvent(event));
  }),
};
