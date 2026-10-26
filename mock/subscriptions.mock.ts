// The subscription endpoints of the mock backend (contract 15.3 to 15.6, 17.4 "订阅管理", backend
// reply points 2 to 4). Only the default export is read by the Umi mock loader; the sample data and
// the state are in _core/subscriptionsData.ts.
import { guard } from './_core/auth';
import { daysAgoIso } from './_core/fixtures';
import { bodyOf, invalidRequest, MockHttpError, type MockReq, ok } from './_core/http';
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
  QUOTA_KEYS,
  SUBSCRIPTION_STATES,
  subscriptionsState,
} from './_core/subscriptionsData';

const state = subscriptionsState;
const DAY_MS = 86_400_000;

const notFound = (what: string) =>
  new MockHttpError(404, 'RESOURCE_NOT_FOUND', `There is no such ${what}`);
const bad = (ref: string, reason: string, message = `${ref} is not valid`) =>
  invalidRequest(message, [{ ref, reason }]);

/** Counts code points after the ends are trimmed, as the server counts text (contract 1.9). */
const codePointLength = (value: string) => [...value.trim()].length;

// ---- feature values ----

type FeatureInput = { mode: Mode; value: unknown };

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
      return value < 0 || value > 1_000_000 ? 'OUT_OF_RANGE' : null;
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
    return ok(paginateQuery(rows, req));
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
    return ok({ ...row, events });
  }),

  'GET /api/admin/accounts/:id/entitlements': guard('SUBSCRIPTION:VIEW', (req) => {
    const accountId = idParam(req);
    const known =
      ACCOUNT_IDS.includes(accountId) ||
      state().accountEntitlements.some((r) => r.accountId === accountId);
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

  'POST /api/admin/accounts/:id/promo-entitlements': guard('SUBSCRIPTION:GRANT', (req) => {
    const accountId = idParam(req);
    if (!ACCOUNT_IDS.includes(accountId)) throw notFound('account');
    const body = bodyOf(req);
    const details: { ref: string; reason: string }[] = [];
    const key = typeof body.entitlementKey === 'string' ? body.entitlementKey : '';
    if (!state().defs.some((d) => d.key === key))
      details.push({ ref: 'entitlementKey', reason: 'OUT_OF_RANGE' });
    const days = body.durationDays;
    if (typeof days !== 'number' || !Number.isInteger(days))
      details.push({ ref: 'durationDays', reason: 'NOT_AN_INTEGER' });
    else if (days < 1 || days > 3650) details.push({ ref: 'durationDays', reason: 'OUT_OF_RANGE' });
    const reason = typeof body.reason === 'string' ? body.reason : '';
    if (codePointLength(reason) === 0) details.push({ ref: 'reason', reason: 'EMPTY_NOT_ALLOWED' });
    else if (codePointLength(reason) > 500) details.push({ ref: 'reason', reason: 'TOO_LONG' });
    if (details.length > 0) throw invalidRequest('the grant is not valid', details);
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

  'POST /api/admin/promo-entitlements/:id/revoke': guard('SUBSCRIPTION:GRANT', (req) => {
    const row = state().accountEntitlements.find((r) => r.id === idParam(req));
    if (!row) throw notFound('entitlement');
    const status = row.source === 'STORE' ? 'STORE' : entitlementStatus(row);
    if (status !== 'ACTIVE')
      throw new MockHttpError(
        409,
        'INVALID_STATE',
        'Only an active promotional entitlement can be revoked',
        { status },
      );
    row.revokedAt = new Date().toISOString();
    return ok({ id: row.id });
  }),

  'GET /api/admin/entitlement-defs': guard(['SUBSCRIPTION:VIEW', 'SUBSCRIPTION:GRANT'], () =>
    ok({ items: [...state().defs].sort((a, b) => a.priority - b.priority).map(defView) }),
  ),

  'POST /api/admin/entitlement-defs': guard('SUBSCRIPTION:CONFIG', (req) => {
    const body = bodyOf(req);
    const key = typeof body.key === 'string' ? body.key.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const priority = body.priority;
    const details: { ref: string; reason: string }[] = [];
    if (key === '') details.push({ ref: 'key', reason: 'EMPTY_NOT_ALLOWED' });
    if (name === '') details.push({ ref: 'name', reason: 'EMPTY_NOT_ALLOWED' });
    if (typeof priority !== 'number' || !Number.isInteger(priority))
      details.push({ ref: 'priority', reason: 'NOT_AN_INTEGER' });
    if (details.length > 0) throw invalidRequest('the definition is not valid', details);
    if (state().defs.some((d) => d.key === key))
      throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The key is taken', { field: 'key' });
    if (state().defs.some((d) => d.priority === priority))
      throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The priority is taken', {
        field: 'priority',
      });
    const def: Def = { key, name, priority: priority as number };
    state().defs.push(def);
    return ok(defView(def));
  }),

  'PUT /api/admin/entitlement-defs/:key': guard('SUBSCRIPTION:CONFIG', (req) => {
    const def = state().defs.find((d) => d.key === req.params.key);
    if (!def) throw notFound('entitlement');
    const body = bodyOf(req);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const priority = body.priority;
    const details: { ref: string; reason: string }[] = [];
    if (name === '') details.push({ ref: 'name', reason: 'EMPTY_NOT_ALLOWED' });
    if (typeof priority !== 'number' || !Number.isInteger(priority))
      details.push({ ref: 'priority', reason: 'NOT_AN_INTEGER' });
    if (details.length > 0) throw invalidRequest('the definition is not valid', details);
    if (state().defs.some((d) => d.key !== def.key && d.priority === priority))
      throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The priority is taken', {
        field: 'priority',
      });
    def.name = name;
    def.priority = priority as number;
    return ok(defView(def));
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

  'PUT /api/admin/feature-gates/:key/credit-cost': guard('SUBSCRIPTION:CONFIG', (req) => {
    const gate = gateOf(req.params.key ?? '');
    if (!gate) throw notFound('feature switch');
    const cost = bodyOf(req).creditCost;
    if (cost !== null && cost !== undefined) {
      if (typeof cost !== 'number' || !Number.isInteger(cost))
        throw bad('creditCost', 'NOT_AN_INTEGER');
      if (cost < 0 || cost > 1_000_000) throw bad('creditCost', 'OUT_OF_RANGE');
    }
    // only a permanent limit can be bought with credits; avatar.looks_max and credits.period_grant never
    const buyable =
      gate.kind === 'LIMIT' && gate.limitScope === 'PERMANENT' && gate.key !== 'avatar.looks_max';
    if (!buyable && cost !== null && cost !== undefined) throw bad('creditCost', 'OUT_OF_RANGE');
    gate.creditCost = cost ?? null;
    return ok(gate);
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

  'PUT /api/admin/subscription-products': guard('SUBSCRIPTION:CONFIG', (req) => {
    const body = bodyOf(req);
    const store = typeof body.store === 'string' ? body.store.trim() : '';
    const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
    const entitlementKey = typeof body.entitlementKey === 'string' ? body.entitlementKey : '';
    const details: { ref: string; reason: string }[] = [];
    if (store === '') details.push({ ref: 'store', reason: 'EMPTY_NOT_ALLOWED' });
    if (productId === '') details.push({ ref: 'productId', reason: 'EMPTY_NOT_ALLOWED' });
    if (typeof body.enabled !== 'boolean') details.push({ ref: 'enabled', reason: 'NOT_BOOLEAN' });
    if (typeof body.sortOrder !== 'number' || !Number.isInteger(body.sortOrder))
      details.push({ ref: 'sortOrder', reason: 'NOT_AN_INTEGER' });
    if (details.length === 0 && !state().defs.some((d) => d.key === entitlementKey))
      details.push({ ref: 'entitlementKey', reason: 'OUT_OF_RANGE' });
    if (details.length > 0) throw invalidRequest('the product is not valid', details);
    const existing = state().products.find((p) => p.store === store && p.productId === productId);
    const next = {
      store,
      productId,
      entitlementKey,
      enabled: body.enabled as boolean,
      sortOrder: body.sortOrder as number,
      surfaces: Array.isArray(body.surfaces)
        ? (body.surfaces as string[])
        : (existing?.surfaces ?? []),
    };
    if (existing) Object.assign(existing, next);
    else state().products.push(next);
    return ok(next);
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
    return ok(paginateQuery(rows, req));
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
    return ok(event);
  }),

  'POST /api/admin/subscription-events/:id/ack': guard('SUBSCRIPTION:GRANT', (req) => {
    const event: EventRow | undefined = state().events.find((e) => e.id === idParam(req));
    if (!event) throw notFound('event');
    if (!event.needsAttention)
      throw new MockHttpError(409, 'INVALID_STATE', 'The event does not need attention', {
        status: 'HANDLED',
      });
    event.needsAttention = false;
    return ok(event);
  }),
};
