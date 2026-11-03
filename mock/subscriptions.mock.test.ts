import { beforeEach, describe, expect, it } from 'vitest';
import { resetConfigStore, saved } from './_core/configStore';
import { issueToken, resetStore } from './_core/store';
import { resetSubscriptionsStore, subscriptionsState } from './_core/subscriptionsData';
import { adminOf, bearer, call } from './_core/testing';
import { USER } from './_core/usersData';
import subscriptions from './subscriptions.mock';

beforeEach(() => {
  resetStore();
  resetConfigStore();
  resetSubscriptionsStore();
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (subscriptions as unknown as Record<string, H>)[name];

/** A named preset administrator with exactly these permissions. */
const as = (permissions: string[]) => {
  const admin = adminOf('support');
  admin.permissions = permissions as typeof admin.permissions;
  admin.superAdmin = false;
  return bearer(issueToken(admin).token);
};
const root = () => bearer(issueToken(adminOf('root')).token);

const get = (name: string, headers: Record<string, string>, query = {}, params = {}) =>
  call(h(name), { headers, query, params });
const send = (name: string, headers: Record<string, string>, body: unknown, params = {}) =>
  call(h(name), { headers, body, params });

describe('permissions', () => {
  it('reads need SUBSCRIPTION:VIEW; the definitions are also readable with GRANT', async () => {
    const none = as(['USER:VIEW']);
    for (const name of [
      'GET /api/admin/subscriptions',
      'GET /api/admin/feature-gates',
      'GET /api/admin/subscription-products',
      'GET /api/admin/subscription-events',
      'GET /api/admin/entitlement-defs',
    ]) {
      expect((await get(name, none)).status, name).toBe(403);
    }
    expect((await get('GET /api/admin/subscriptions', as(['SUBSCRIPTION:VIEW']))).status).toBe(200);
    expect((await get('GET /api/admin/entitlement-defs', as(['SUBSCRIPTION:GRANT']))).status).toBe(
      200,
    );
    expect((await get('GET /api/admin/feature-gates', as(['SUBSCRIPTION:GRANT']))).status).toBe(
      403,
    );
  });

  it('writes need SUBSCRIPTION:CONFIG, reprocess/ack/promo need SUBSCRIPTION:GRANT, stats FINANCE:VIEW', async () => {
    const viewOnly = as(['SUBSCRIPTION:VIEW']);
    expect(
      (
        await send(
          'PUT /api/admin/entitlement-defs/:key/features',
          viewOnly,
          { features: [] },
          { key: 'premium' },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await send(
          'PUT /api/admin/feature-gates/:key/default',
          viewOnly,
          { mode: 'UNSET' },
          { key: 'call.daily_minutes' },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await send(
          'PUT /api/admin/feature-gates/:key/credit-cost',
          viewOnly,
          { creditCost: 5 },
          { key: 'assets.avatar_max' },
        )
      ).status,
    ).toBe(403);
    expect((await send('PUT /api/admin/subscription-products', viewOnly, {})).status).toBe(403);
    expect(
      (
        await send(
          'POST /api/admin/subscription-events/:id/reprocess',
          viewOnly,
          {},
          { id: '9001' },
        )
      ).status,
    ).toBe(403);
    expect(
      (await send('POST /api/admin/subscription-events/:id/ack', viewOnly, {}, { id: '9001' }))
        .status,
    ).toBe(403);
    expect(
      (
        await send(
          'POST /api/admin/accounts/:id/promo-entitlements',
          viewOnly,
          {},
          { id: '10000000001' },
        )
      ).status,
    ).toBe(403);
    expect(
      (await send('POST /api/admin/promo-entitlements/:id/revoke', viewOnly, {}, { id: '7002' }))
        .status,
    ).toBe(403);
    // CONFIG does not open the GRANT endpoints and GRANT does not open CONFIG ones
    expect(
      (
        await send(
          'POST /api/admin/subscription-events/:id/ack',
          as(['SUBSCRIPTION:CONFIG']),
          {},
          { id: '9001' },
        )
      ).status,
    ).toBe(403);
    expect(
      (await send('PUT /api/admin/subscription-products', as(['SUBSCRIPTION:GRANT']), {})).status,
    ).toBe(403);
    expect((await get('GET /api/admin/subscriptions/stats', viewOnly)).status).toBe(403);
    expect((await get('GET /api/admin/subscriptions/stats', as(['FINANCE:VIEW']))).status).toBe(
      200,
    );
  });

  it('answers 401 without a token', async () => {
    expect((await call(h('GET /api/admin/subscriptions'))).status).toBe(401);
  });
});

describe('GET /subscriptions', () => {
  it('pages the list, newest first, with every column and no events', async () => {
    const { body } = await get('GET /api/admin/subscriptions', root(), { pageSize: '10' });
    expect(body.data.total).toBe(30);
    expect(body.data.items).toHaveLength(10);
    const ids = body.data.items.map((r: { createdAt: string }) => r.createdAt);
    expect(ids).toEqual([...ids].sort().reverse());
    const row = body.data.items[0];
    expect(Object.keys(row).sort()).toEqual(
      [
        'id',
        'accountId',
        'store',
        'storeRef',
        'storeRefSuffix',
        'linkedPurchaseTokenSuffix',
        'productId',
        'state',
        'currentPeriodStart',
        'currentPeriodEnd',
        'gracePeriodEndsAt',
        'autoRenew',
        'environment',
        'acknowledgementState',
        'purchasedAt',
        'firstActiveAt',
        'voidedAt',
        'lastEventSignedAt',
        'periodOrderId',
        'lastSyncedAt',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
    expect(row.events).toBeUndefined();
  });

  it('filters by account (exact), state, store and product', async () => {
    const all = subscriptionsState().subscriptions;
    const account = all[0].accountId as string;
    const byAccount = await get('GET /api/admin/subscriptions', root(), { accountId: account });
    expect(
      byAccount.body.data.items.every((r: { accountId: string }) => r.accountId === account),
    ).toBe(true);
    expect(byAccount.body.data.total).toBe(all.filter((r) => r.accountId === account).length);
    expect(
      (await get('GET /api/admin/subscriptions', root(), { accountId: account.slice(0, 5) })).body
        .data.total,
    ).toBe(0);
    const byState = await get('GET /api/admin/subscriptions', root(), { state: 'ACTIVE' });
    expect(byState.body.data.total).toBe(all.filter((r) => r.state === 'ACTIVE').length);
    const byStore = await get('GET /api/admin/subscriptions', root(), { store: 'GOOGLE' });
    expect(byStore.body.data.items.every((r: { store: string }) => r.store === 'GOOGLE')).toBe(
      true,
    );
    const byProduct = await get('GET /api/admin/subscriptions', root(), {
      productId: 'avatar.premium.yearly',
    });
    expect(byProduct.body.data.total).toBe(
      all.filter((r) => r.productId === 'avatar.premium.yearly').length,
    );
  });

  it('refuses a page size above 200 with the parameter name, and a state that does not exist', async () => {
    const big = await get('GET /api/admin/subscriptions', root(), { pageSize: '201' });
    expect(big.status).toBe(400);
    expect(big.body.data.details).toEqual([{ ref: 'pageSize', reason: 'OUT_OF_RANGE' }]);
    const bad = await get('GET /api/admin/subscriptions', root(), { state: 'NOPE' });
    expect(bad.status).toBe(400);
    expect(bad.body.data.details[0]).toEqual({ ref: 'state', reason: 'OUT_OF_RANGE' });
  });
});

describe('GET /subscriptions/{id}', () => {
  it('adds the events, newest signed first, without the payload', async () => {
    const { status, body } = await get(
      'GET /api/admin/subscriptions/:id',
      root(),
      {},
      { id: '500' },
    );
    expect(status).toBe(200);
    const events = body.data.events as { eventSignedAt: string; payload?: unknown }[];
    expect(events.length).toBeGreaterThan(1);
    const times = events.map((e) => e.eventSignedAt);
    expect(times).toEqual([...times].sort().reverse());
    expect(Object.keys(events[0]).sort()).toEqual(
      [
        'id',
        'type',
        'subtype',
        'eventSignedAt',
        'receivedAt',
        'processedAt',
        'error',
        'needsAttention',
      ].sort(),
    );
    expect(body.data.id).toBe('500');
    expect(body.data.accountId).toBeDefined();
  });

  it('answers 404 RESOURCE_NOT_FOUND for an id that does not exist', async () => {
    const { status, body } = await get('GET /api/admin/subscriptions/:id', root(), {}, { id: '1' });
    expect(status).toBe(404);
    expect(body.code).toBe('RESOURCE_NOT_FOUND');
  });
});

const SECRET = 'gp-token-SECRETVALUE-abc123';

describe('Google purchase tokens: the answers carry only the last six characters', () => {
  const googleRow = () => {
    const row = subscriptionsState().subscriptions.find((r) => r.store === 'GOOGLE');
    if (!row) throw new Error('the seed has a Google subscription');
    row.storeRef = SECRET;
    (row as { linkedPurchaseToken: string | null }).linkedPurchaseToken =
      'linked-SECRETLINK-9z8y7x';
    return row;
  };

  it('the list and the detail give null for a Google storeRef, the suffixes, and no linkedPurchaseToken', async () => {
    const row = googleRow();
    const list = await get('GET /api/admin/subscriptions', root(), {
      store: 'GOOGLE',
      pageSize: '100',
    });
    const one = list.body.data.items.find((r: { id: string }) => r.id === row.id);
    const detail = await get('GET /api/admin/subscriptions/:id', root(), {}, { id: row.id });
    for (const item of [one, detail.body.data]) {
      expect(item.storeRef).toBeNull();
      expect(item.storeRefSuffix).toBe('abc123');
      expect(item.linkedPurchaseTokenSuffix).toBe('9z8y7x');
      expect('linkedPurchaseToken' in item).toBe(false);
    }
    expect(JSON.stringify(list.body)).not.toContain('SECRETVALUE');
    expect(JSON.stringify(detail.body)).not.toContain('SECRETLINK');
  });

  it('a Google row without a linked token gives null for its suffix; Apple keeps the whole storeRef and also gets a suffix', async () => {
    const google = googleRow();
    (google as { linkedPurchaseToken: string | null }).linkedPurchaseToken = null;
    const apple = subscriptionsState().subscriptions.find((r) => r.store === 'APPLE');
    if (!apple) throw new Error('the seed has an Apple subscription');
    apple.storeRef = '2000000123456789';
    const g = await get('GET /api/admin/subscriptions/:id', root(), {}, { id: google.id });
    expect(g.body.data.linkedPurchaseTokenSuffix).toBeNull();
    const a = await get('GET /api/admin/subscriptions/:id', root(), {}, { id: apple.id });
    expect(a.body.data.storeRef).toBe('2000000123456789');
    expect(a.body.data.storeRefSuffix).toBe('456789');
  });

  it('a Google event gives its sourceEventId cut at the first colon to six characters, and renames the tokens at every level of the payload', async () => {
    const event = subscriptionsState().events.find((e) => e.store === 'GOOGLE');
    if (!event) throw new Error('the seed has a Google event');
    event.sourceEventId = `${SECRET}:1761000000000:extra:colons`;
    event.payload = {
      version: '1.0',
      subscriptionNotification: {
        purchaseToken: SECRET,
        pendingRefundToken: 'refund-SECRETREFUND-q1w2e3',
      },
      nested: [{ deeper: { purchaseToken: SECRET } }],
    };
    const res = await get('GET /api/admin/subscription-events', root(), { pageSize: '100' });
    const item = res.body.data.items.find((e: { id: string }) => e.id === event.id);
    expect(item.sourceEventId).toBe('abc123:1761000000000:extra:colons');
    expect(item.payload).toEqual({
      version: '1.0',
      subscriptionNotification: {
        purchaseTokenSuffix: 'abc123',
        pendingRefundTokenSuffix: 'q1w2e3',
      },
      nested: [{ deeper: { purchaseTokenSuffix: 'abc123' } }],
    });
    expect(JSON.stringify(res.body)).not.toMatch(/SECRETVALUE|SECRETREFUND/);
  });

  it('an Apple event is given as it is', async () => {
    const event = subscriptionsState().events.find((e) => e.store === 'APPLE');
    if (!event) throw new Error('the seed has an Apple event');
    event.sourceEventId = 'apple-notification-uuid-1';
    event.payload = { data: { transactionInfo: { originalTransactionId: '2000000123456789' } } };
    const res = await get('GET /api/admin/subscription-events', root(), { pageSize: '100' });
    const item = res.body.data.items.find((e: { id: string }) => e.id === event.id);
    expect(item.sourceEventId).toBe('apple-notification-uuid-1');
    expect(item.payload).toEqual(event.payload);
  });

  it('the answer of reprocess and ack is masked in the same way', async () => {
    const event = subscriptionsState().events.find((e) => e.store === 'GOOGLE' && e.error !== null);
    if (!event) throw new Error('the seed has a failed Google event');
    event.sourceEventId = `${SECRET}:1`;
    event.payload = { subscriptionNotification: { purchaseToken: SECRET } };
    const res = await send(
      'POST /api/admin/subscription-events/:id/reprocess',
      root(),
      {},
      { id: event.id },
    );
    expect(JSON.stringify(res.body)).not.toContain('SECRETVALUE');
  });
});

describe('entitlement definitions and their feature values', () => {
  it('lists by priority, each with every declared switch by key, UNSET where there is no row', async () => {
    const { body } = await get('GET /api/admin/entitlement-defs', root());
    const items = body.data.items as {
      key: string;
      priority: number;
      features: { featureKey: string; mode: string; value: unknown }[];
    }[];
    expect(items.map((d) => d.priority)).toEqual(
      [...items.map((d) => d.priority)].sort((a, b) => a - b),
    );
    const basic = items.find((d) => d.key === 'basic');
    expect(basic?.features).toHaveLength(15);
    expect(basic?.features.every((f) => f.mode === 'UNSET' && f.value === null)).toBe(true);
    const keys = basic?.features.map((f) => f.featureKey) ?? [];
    expect(keys).toEqual([...keys].sort());
    const premium = items.find((d) => d.key === 'premium');
    expect(premium?.features.find((f) => f.featureKey === 'assets.voice_max')).toEqual({
      featureKey: 'assets.voice_max',
      mode: 'UNLIMITED',
      value: null,
    });
    expect(premium?.features.find((f) => f.featureKey === 'call.monthly_minutes')?.value).toBe(600);
  });

  it('saves VALUE, UNLIMITED and UNSET (UNSET removes the row) and leaves the switches not sent alone', async () => {
    const put = (features: unknown[]) =>
      send('PUT /api/admin/entitlement-defs/:key/features', root(), { features }, { key: 'basic' });
    const res = await put([
      { featureKey: 'assets.avatar_max', mode: 'VALUE', value: 3 },
      { featureKey: 'ads.removed', mode: 'VALUE', value: true },
      { featureKey: 'assets.voice_max', mode: 'UNLIMITED' },
    ]);
    expect(res.status).toBe(200);
    let basic = (await get('GET /api/admin/entitlement-defs', root())).body.data.items.find(
      (d: { key: string }) => d.key === 'basic',
    );
    const of = (k: string) =>
      basic.features.find((f: { featureKey: string }) => f.featureKey === k);
    expect(of('assets.avatar_max')).toMatchObject({ mode: 'VALUE', value: 3 });
    expect(of('assets.voice_max')).toMatchObject({ mode: 'UNLIMITED', value: null });
    await put([{ featureKey: 'assets.avatar_max', mode: 'UNSET' }]);
    basic = (await get('GET /api/admin/entitlement-defs', root())).body.data.items.find(
      (d: { key: string }) => d.key === 'basic',
    );
    expect(of('assets.avatar_max')).toMatchObject({ mode: 'UNSET', value: null });
    expect(of('ads.removed')).toMatchObject({ mode: 'VALUE', value: true });
  });

  it('refuses call.lifetime_minutes, an unlimited credits.period_grant, a VALUE without value and a wrong type', async () => {
    const put = (feature: unknown) =>
      send(
        'PUT /api/admin/entitlement-defs/:key/features',
        root(),
        { features: [feature] },
        { key: 'basic' },
      );
    const lifetime = await put({ featureKey: 'call.lifetime_minutes', mode: 'VALUE', value: 10 });
    expect(lifetime.status).toBe(400);
    expect(lifetime.body.data.details[0].ref).toBe('call.lifetime_minutes');
    expect((await put({ featureKey: 'credits.period_grant', mode: 'UNLIMITED' })).status).toBe(400);
    const empty = await put({ featureKey: 'assets.avatar_max', mode: 'VALUE' });
    expect(empty.body.data.details).toEqual([
      { ref: 'assets.avatar_max', reason: 'EMPTY_NOT_ALLOWED' },
    ]);
    expect(
      (await put({ featureKey: 'assets.avatar_max', mode: 'VALUE', value: 1.5 })).body.data
        .details[0].reason,
    ).toBe('NOT_AN_INTEGER');
    expect(
      (await put({ featureKey: 'assets.avatar_max', mode: 'VALUE', value: -1 })).body.data
        .details[0].reason,
    ).toBe('OUT_OF_RANGE');
    expect(
      (await put({ featureKey: 'ads.removed', mode: 'VALUE', value: 'yes' })).body.data.details[0]
        .reason,
    ).toBe('NOT_BOOLEAN');
    expect((await put({ featureKey: 'ads.removed', mode: 'UNLIMITED' })).status).toBe(400);
    expect(
      (await put({ featureKey: 'memory.tier', mode: 'VALUE', value: 'nope' })).body.data.details[0]
        .ref,
    ).toBe('memory.tier');
    expect(
      (await put({ featureKey: 'chat.model_tier', mode: 'VALUE', value: 'nope' })).status,
    ).toBe(400);
    expect((await put({ featureKey: 'no.such_key', mode: 'UNSET' })).status).toBe(400);
  });

  it('refuses a limit above entitlement.limit_max, the value GET /meta gives as entitlementLimitMax, whatever it has been set to', async () => {
    const put = (value: number) =>
      send(
        'PUT /api/admin/entitlement-defs/:key/features',
        root(),
        { features: [{ featureKey: 'assets.avatar_max', mode: 'VALUE', value }] },
        { key: 'basic' },
      );
    expect((await put(1_000_000)).status).toBe(200);
    expect((await put(1_000_001)).body.data.details).toEqual([
      { ref: 'assets.avatar_max', reason: 'OUT_OF_RANGE' },
    ]);
    const setMax = (value: number) =>
      saved.set('entitlement.limit_max', {
        value,
        updatedAt: '',
        updatedBy: '',
        updatedByUsername: '',
      });
    setMax(500);
    expect((await put(500)).status).toBe(200);
    expect((await put(501)).body.data.details).toEqual([
      { ref: 'assets.avatar_max', reason: 'OUT_OF_RANGE' },
    ]);
    setMax(2_000_000);
    expect((await put(2_000_000)).status).toBe(200);
    expect((await put(2_000_001)).status).toBe(400);
  });

  it('is atomic: one bad value saves none of the others', async () => {
    const res = await send(
      'PUT /api/admin/entitlement-defs/:key/features',
      root(),
      {
        features: [
          { featureKey: 'assets.avatar_max', mode: 'VALUE', value: 3 },
          { featureKey: 'ads.removed', mode: 'VALUE', value: 'yes' },
        ],
      },
      { key: 'basic' },
    );
    expect(res.status).toBe(400);
    expect(subscriptionsState().features.has('basic|assets.avatar_max')).toBe(false);
  });

  it('answers 404 for features of an unknown entitlement', async () => {
    const res = await send(
      'PUT /api/admin/entitlement-defs/:key/features',
      root(),
      { features: [] },
      { key: 'nope' },
    );
    expect(res.status).toBe(404);
  });

  it('creates a definition and answers { key }; edits one and answers data null; a key or a priority that is taken is 409 DUPLICATE_RESOURCE with the field', async () => {
    const created = await send('POST /api/admin/entitlement-defs', root(), {
      key: 'gold',
      name: 'Gold',
      priority: 50,
    });
    expect(created.status).toBe(200);
    expect(created.body.data).toEqual({ key: 'gold' });
    const sameKey = await send('POST /api/admin/entitlement-defs', root(), {
      key: 'gold',
      name: 'Gold 2',
      priority: 51,
    });
    expect(sameKey.status).toBe(409);
    expect(sameKey.body.code).toBe('DUPLICATE_RESOURCE');
    expect(sameKey.body.data.field).toBe('key');
    const samePriority = await send('POST /api/admin/entitlement-defs', root(), {
      key: 'silver',
      name: 'Silver',
      priority: 50,
    });
    expect(samePriority.body.data.field).toBe('priority');
    const edit = await send(
      'PUT /api/admin/entitlement-defs/:key',
      root(),
      { name: 'Gold!', priority: 55 },
      { key: 'gold' },
    );
    expect(edit.status).toBe(200);
    expect(edit.body.data).toBeNull();
    const clash = await send(
      'PUT /api/admin/entitlement-defs/:key',
      root(),
      { name: 'Gold!', priority: 20 },
      { key: 'gold' },
    );
    expect(clash.status).toBe(409);
    expect(clash.body.data.field).toBe('priority');
    expect(
      (
        await send(
          'PUT /api/admin/entitlement-defs/:key',
          root(),
          { name: 'x', priority: 1 },
          { key: 'nope' },
        )
      ).status,
    ).toBe(404);
  });

  it('names the priority, not the key, when the key is taken and the priority is held by another entitlement (the backend asks who holds the priority)', async () => {
    const both = await send('POST /api/admin/entitlement-defs', root(), {
      key: 'basic',
      name: 'Basic again',
      priority: 20,
    });
    expect(both.status).toBe(409);
    expect(both.body.data.field).toBe('priority');
    // the priority is free now: the key is what is taken
    const keyOnly = await send('POST /api/admin/entitlement-defs', root(), {
      key: 'basic',
      name: 'Basic again',
      priority: 9999,
    });
    expect(keyOnly.body.data.field).toBe('key');
  });

  it('checks the key ([A-Za-z0-9][A-Za-z0-9._-]{0,63}), the name (1 to 100 code points after the ends are trimmed) and the priority (a whole number, any value)', async () => {
    const post = (over: Record<string, unknown>) =>
      send('POST /api/admin/entitlement-defs', root(), {
        key: 'valid-key',
        name: 'Valid',
        priority: 700,
        ...over,
      });
    const details = async (over: Record<string, unknown>) =>
      (await post(over)).body.data?.details as { ref: string; reason: string }[] | undefined;
    expect(await details({ key: ' ' })).toEqual([{ ref: 'key', reason: 'EMPTY_NOT_ALLOWED' }]);
    for (const key of ['-start', '.start', '_start', 'has space', 'ก', 'a'.repeat(65), 'a/b']) {
      expect(await details({ key }), key).toEqual([{ ref: 'key', reason: 'OUT_OF_RANGE' }]);
    }
    expect((await post({ key: 'a'.repeat(64) })).status).toBe(200);
    expect((await post({ key: '9.x_y-z', priority: 701 })).status).toBe(200);
    expect(await details({ name: '   ' })).toEqual([{ ref: 'name', reason: 'EMPTY_NOT_ALLOWED' }]);
    expect(await details({ name: 'ก'.repeat(101) })).toEqual([{ ref: 'name', reason: 'TOO_LONG' }]);
    expect((await post({ key: 'k100', name: '😀'.repeat(100), priority: 702 })).status).toBe(200);
    expect(await details({ priority: undefined })).toEqual([
      { ref: 'priority', reason: 'EMPTY_NOT_ALLOWED' },
    ]);
    expect(await details({ priority: 1.5 })).toEqual([
      { ref: 'priority', reason: 'NOT_AN_INTEGER' },
    ]);
    // the range of the priority is not limited: zero and a negative number are fine
    expect((await post({ key: 'zero', priority: 0 })).status).toBe(200);
    expect((await post({ key: 'minus', priority: -5 })).status).toBe(200);
  });

  it('does not check the key of an edit: it is the path, and the body only has the name and the priority', async () => {
    const edit = await send(
      'PUT /api/admin/entitlement-defs/:key',
      root(),
      { key: 'ignored', name: 'Basic!', priority: 10 },
      { key: 'basic' },
    );
    expect(edit.status).toBe(200);
    const defs = (await get('GET /api/admin/entitlement-defs', root())).body.data.items;
    expect(defs.find((d: { key: string }) => d.key === 'basic')?.name).toBe('Basic!');
    expect(defs.some((d: { key: string }) => d.key === 'ignored')).toBe(false);
  });
});

describe('feature gates', () => {
  it('lists the fifteen by key with defaultMode, and UNSET only on the five quota keys', async () => {
    const { body } = await get('GET /api/admin/feature-gates', root());
    const items = body.data.items as {
      key: string;
      defaultMode: string;
      defaultValue: unknown;
      limitScope: string | null;
      kind: string;
    }[];
    expect(items).toHaveLength(15);
    expect(items.map((g) => g.key)).toEqual([...items.map((g) => g.key)].sort());
    expect(
      items
        .filter((g) => g.defaultMode === 'UNSET')
        .map((g) => g.key)
        .sort(),
    ).toEqual([
      'call.daily_minutes',
      'call.lifetime_minutes',
      'call.monthly_minutes',
      'chat.daily_messages',
      'chat.monthly_messages',
    ]);
    expect(items.filter((g) => g.limitScope !== null).every((g) => g.kind === 'LIMIT')).toBe(true);
    expect(items.find((g) => g.key === 'memory.tier')).toMatchObject({
      defaultMode: 'VALUE',
      defaultValue: 'default',
    });
  });

  it('changes the default: UNSET only on a quota key, never an unlimited credits.period_grant', async () => {
    const put = (key: string, body: unknown) =>
      send('PUT /api/admin/feature-gates/:key/default', root(), body, { key });
    expect((await put('call.daily_minutes', { mode: 'VALUE', value: 5 })).status).toBe(200);
    expect(subscriptionsState().gates.find((g) => g.key === 'call.daily_minutes')).toMatchObject({
      defaultMode: 'VALUE',
      defaultValue: 5,
    });
    expect((await put('call.daily_minutes', { mode: 'UNSET' })).status).toBe(200);
    expect(subscriptionsState().gates.find((g) => g.key === 'call.daily_minutes')).toMatchObject({
      defaultMode: 'UNSET',
      defaultValue: null,
    });
    expect((await put('assets.avatar_max', { mode: 'UNSET' })).status).toBe(400);
    expect((await put('credits.period_grant', { mode: 'UNLIMITED' })).status).toBe(400);
    expect((await put('avatar.looks_max', { mode: 'UNLIMITED' })).status).toBe(200);
    expect((await put('call.lifetime_minutes', { mode: 'UNLIMITED' })).status).toBe(200);
    expect((await put('ads.removed', { mode: 'UNLIMITED' })).status).toBe(400);
    expect((await put('nope', { mode: 'UNSET' })).status).toBe(404);
  });

  it('sets a credit price only on assets.avatar_max and assets.voice_max, clears it with null on any switch, and answers data null', async () => {
    const put = (key: string, body: unknown) =>
      send('PUT /api/admin/feature-gates/:key/credit-cost', root(), body, { key });
    const price = (key: string) =>
      subscriptionsState().gates.find((g) => g.key === key)?.creditCost;
    const set = await put('assets.voice_max', { creditCost: 12 });
    expect(set.status).toBe(200);
    expect(set.body.data).toBeNull();
    expect(price('assets.voice_max')).toBe(12);
    expect((await put('assets.voice_max', { creditCost: null })).status).toBe(200);
    expect(price('assets.voice_max')).toBeNull();
    for (const key of [
      'avatar.looks_max',
      'credits.period_grant',
      'call.daily_minutes',
      'call.lifetime_minutes',
      'chat.daily_messages',
      'ads.removed',
      'memory.tier',
    ]) {
      const refused = await put(key, { creditCost: 5 });
      expect(refused.status, key).toBe(400);
      expect(refused.body.data.details, key).toEqual([
        { ref: 'creditCost', reason: 'OUT_OF_RANGE' },
      ]);
      // clearing is allowed everywhere
      expect((await put(key, { creditCost: null })).status, key).toBe(200);
    }
    expect((await put('nope', { creditCost: 5 })).status).toBe(404);
  });

  it('wants a whole number from 1 with no upper limit, and a creditCost that is there (null or a number)', async () => {
    const put = (body: unknown) =>
      send('PUT /api/admin/feature-gates/:key/credit-cost', root(), body, {
        key: 'assets.avatar_max',
      });
    expect((await put({ creditCost: 0 })).body.data.details[0].reason).toBe('OUT_OF_RANGE');
    expect((await put({ creditCost: -1 })).body.data.details[0].reason).toBe('OUT_OF_RANGE');
    expect((await put({ creditCost: 1.5 })).body.data.details[0].reason).toBe('NOT_AN_INTEGER');
    expect((await put({ creditCost: 1 })).status).toBe(200);
    expect((await put({ creditCost: 5_000_000 })).status).toBe(200);
    const missing = await put({});
    expect(missing.status).toBe(400);
    expect(missing.body.data.details).toEqual([{ ref: 'creditCost', reason: 'EMPTY_NOT_ALLOWED' }]);
  });
});

describe('subscription products', () => {
  const put = (items: unknown, headers = root()) =>
    send('PUT /api/admin/subscription-products', headers, { items });

  it('lists the six columns and upserts by (store, productId) from an items list', async () => {
    const list = await get('GET /api/admin/subscription-products', root());
    expect(list.body.data.items).toHaveLength(4);
    const first = list.body.data.items[0];
    expect(Object.keys(first).sort()).toEqual([
      'enabled',
      'entitlementKey',
      'productId',
      'sortOrder',
      'store',
      'surfaces',
    ]);
    const saved = await put([{ ...first, enabled: false, sortOrder: 9 }]);
    expect(saved.status).toBe(200);
    // the backend answers data null: the list has to be read again
    expect(saved.body.data).toBeNull();
    const again = await get('GET /api/admin/subscription-products', root());
    expect(again.body.data.items).toHaveLength(4);
    expect(
      again.body.data.items.find((p: { productId: string }) => p.productId === first.productId),
    ).toMatchObject({ enabled: false, sortOrder: 9 });
    await put([
      {
        store: 'APPLE',
        productId: 'new.one',
        entitlementKey: 'basic',
        enabled: true,
        sortOrder: 5,
        surfaces: [],
      },
    ]);
    expect(
      (await get('GET /api/admin/subscription-products', root())).body.data.items,
    ).toHaveLength(5);
  });

  it('does not accept one mapping outside an items list', async () => {
    const first = (await get('GET /api/admin/subscription-products', root())).body.data.items[0];
    const bare = await send('PUT /api/admin/subscription-products', root(), first);
    expect(bare.status).toBe(400);
    expect(bare.body.data.details[0].ref).toBe('items');
    const empty = await put([]);
    expect(empty.status).toBe(400);
  });

  it('answers 404 RESOURCE_NOT_FOUND, not 400, for an entitlement that does not exist, and saves nothing', async () => {
    const first = (await get('GET /api/admin/subscription-products', root())).body.data.items[0];
    const missing = await put([
      { ...first, sortOrder: 77 },
      {
        store: 'APPLE',
        productId: 'x',
        entitlementKey: 'nope',
        enabled: true,
        sortOrder: 1,
        surfaces: [],
      },
    ]);
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('RESOURCE_NOT_FOUND');
    // one transaction: the first item is not kept
    const after = (await get('GET /api/admin/subscription-products', root())).body.data.items;
    expect(after.find((p: { productId: string }) => p.productId === first.productId)).toEqual(
      first,
    );
    expect(after).toHaveLength(4);
  });

  it('refuses empty fields and a missing surfaces list (null is not "keep")', async () => {
    const empty = await put([
      {
        store: '',
        productId: '',
        entitlementKey: 'basic',
        enabled: true,
        sortOrder: 1,
        surfaces: [],
      },
    ]);
    expect(empty.status).toBe(400);
    expect(empty.body.data.details.map((d: { ref: string }) => d.ref).sort()).toEqual([
      'productId',
      'store',
    ]);
    const noSurfaces = await put([
      { store: 'APPLE', productId: 'y', entitlementKey: 'basic', enabled: true, sortOrder: 1 },
    ]);
    expect(noSurfaces.status).toBe(400);
    expect(noSurfaces.body.data.details).toEqual([
      { ref: 'surfaces', reason: 'EMPTY_NOT_ALLOWED' },
    ]);
    const noEnabled = await put([
      { store: 'APPLE', productId: 'y', entitlementKey: 'basic', sortOrder: 1, surfaces: [] },
    ]);
    expect(noEnabled.body.data.details).toEqual([{ ref: 'enabled', reason: 'EMPTY_NOT_ALLOWED' }]);
  });

  it('refuses a store outside [A-Z][A-Z0-9_]{1,31}, a product id over 255 code points, and a surface outside ANDROID or IOS', async () => {
    const base = { entitlementKey: 'basic', enabled: true, sortOrder: 1, surfaces: [] };
    const store = await put([{ ...base, store: 'apple', productId: 'a' }]);
    expect(store.body.data.details[0].ref).toBe('store');
    const long = await put([{ ...base, store: 'APPLE', productId: 'x'.repeat(256) }]);
    expect(long.body.data.details[0]).toEqual({ ref: 'productId', reason: 'TOO_LONG' });
    const surface = await put([
      { ...base, store: 'APPLE', productId: 'a', surfaces: [{ platform: 'WEB', channel: null }] },
    ]);
    expect(surface.status).toBe(400);
  });

  it('answers 409 DUPLICATE_RESOURCE with field productId for the same mapping twice in one request', async () => {
    const row = {
      store: 'APPLE',
      productId: 'twice',
      entitlementKey: 'basic',
      enabled: true,
      sortOrder: 1,
      surfaces: [],
    };
    const dup = await put([row, { ...row, sortOrder: 2 }]);
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('DUPLICATE_RESOURCE');
    expect(dup.body.data).toEqual({ field: 'productId' });
  });
});

describe('subscription events', () => {
  it('filters by status=FAILED and needsAttention=true, paged, newest signed first', async () => {
    const failed = await get('GET /api/admin/subscription-events', root(), {
      status: 'FAILED',
      pageSize: '100',
    });
    expect(failed.body.data.total).toBeGreaterThan(0);
    expect(failed.body.data.items.every((e: { error: string | null }) => e.error !== null)).toBe(
      true,
    );
    const times = failed.body.data.items.map((e: { eventSignedAt: string }) => e.eventSignedAt);
    expect(times).toEqual([...times].sort().reverse());
    const attention = await get('GET /api/admin/subscription-events', root(), {
      needsAttention: 'true',
      pageSize: '100',
    });
    expect(attention.body.data.total).toBeGreaterThan(0);
    expect(
      attention.body.data.items.every((e: { needsAttention: boolean }) => e.needsAttention),
    ).toBe(true);
    expect(
      (await get('GET /api/admin/subscription-events', root(), { status: 'NOPE' })).status,
    ).toBe(400);
    expect(
      (await get('GET /api/admin/subscription-events', root(), { needsAttention: 'maybe' })).status,
    ).toBe(400);
  });

  it('reprocess clears the error of a failed event; a processed one is 409 INVALID_STATE with the status', async () => {
    const failed = subscriptionsState().events.find((e) => e.error !== null);
    const done = subscriptionsState().events.find((e) => e.error === null);
    const res = await send(
      'POST /api/admin/subscription-events/:id/reprocess',
      root(),
      {},
      { id: (failed as { id: string }).id },
    );
    expect(res.status).toBe(200);
    expect(subscriptionsState().events.find((e) => e.id === failed?.id)?.error).toBeNull();
    const again = await send(
      'POST /api/admin/subscription-events/:id/reprocess',
      root(),
      {},
      { id: (done as { id: string }).id },
    );
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('INVALID_STATE');
    expect(again.body.data.status).toBe('PROCESSED');
    expect(
      (await send('POST /api/admin/subscription-events/:id/reprocess', root(), {}, { id: '1' }))
        .status,
    ).toBe(404);
  });

  it('ack clears needsAttention once; a second ack is 409 INVALID_STATE', async () => {
    const event = subscriptionsState().events.find((e) => e.needsAttention) as { id: string };
    expect(
      (await send('POST /api/admin/subscription-events/:id/ack', root(), {}, { id: event.id }))
        .status,
    ).toBe(200);
    expect(subscriptionsState().events.find((e) => e.id === event.id)?.needsAttention).toBe(false);
    const again = await send(
      'POST /api/admin/subscription-events/:id/ack',
      root(),
      {},
      { id: event.id },
    );
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('INVALID_STATE');
  });
});

describe('account entitlements', () => {
  const account = '10000000001';

  it('knows an account of the user module that has no entitlement yet: an empty list, not 404', async () => {
    const { status, body } = await get(
      'GET /api/admin/accounts/:id/entitlements',
      root(),
      {},
      { id: USER.rich },
    );
    expect(status).toBe(200);
    expect(body.data.entitlements).toEqual([]);
    expect(body.data.effective.length).toBeGreaterThan(0);
  });

  it('gives one effective row per switch with the source, and the entitlement rows newest start first', async () => {
    const { status, body } = await get(
      'GET /api/admin/accounts/:id/entitlements',
      root(),
      {},
      { id: account },
    );
    expect(status).toBe(200);
    const effective = body.data.effective as {
      featureKey: string;
      kind: string;
      mode: string;
      value: unknown;
      source: string;
      entitlementKey: string | null;
    }[];
    expect(effective).toHaveLength(15);
    const of = (k: string) => effective.find((e) => e.featureKey === k);
    // premium (STORE, active) and vip_ar (PROMO, active) are in force; vip_ar is the higher priority
    expect(of('call.monthly_minutes')).toMatchObject({
      mode: 'VALUE',
      value: 600,
      source: 'ENTITLEMENT',
      entitlementKey: 'premium',
    });
    expect(of('call.daily_minutes')).toMatchObject({
      mode: 'VALUE',
      value: 120,
      source: 'ENTITLEMENT',
      entitlementKey: 'vip_ar',
    });
    expect(of('chat.daily_messages')).toMatchObject({
      mode: 'UNLIMITED',
      value: null,
      source: 'ENTITLEMENT',
    });
    expect(of('memory.tier')).toMatchObject({
      mode: 'VALUE',
      value: 'default',
      source: 'DEFAULT',
      entitlementKey: null,
    });
    expect(of('call.lifetime_minutes')).toMatchObject({
      mode: 'UNSET',
      value: null,
      source: 'NONE',
      entitlementKey: null,
    });
    const rows = body.data.entitlements as {
      startsAt: string;
      status: string;
      source: string;
      entitlementName: string;
    }[];
    expect(rows.map((r) => r.startsAt)).toEqual([...rows.map((r) => r.startsAt)].sort().reverse());
    expect(rows.map((r) => r.status)).toEqual(
      expect.arrayContaining(['ACTIVE', 'EXPIRED', 'REVOKED']),
    );
    expect(rows[0].entitlementName).toBeTruthy();
  });

  it('an account with nothing still gets the defaults; an unknown account is 404', async () => {
    const empty = await get(
      'GET /api/admin/accounts/:id/entitlements',
      root(),
      {},
      { id: '10000000005' },
    );
    expect(empty.body.data.entitlements).toEqual([]);
    expect(
      empty.body.data.effective.every((e: { source: string }) => e.source !== 'ENTITLEMENT'),
    ).toBe(true);
    expect(
      (await get('GET /api/admin/accounts/:id/entitlements', root(), {}, { id: '42' })).status,
    ).toBe(404);
  });

  it('grants a promo entitlement for some days, then revokes it (data null); revoking twice is 409 with the status, a STORE row or a row that is not there is 404', async () => {
    const grant = await send(
      'POST /api/admin/accounts/:id/promo-entitlements',
      root(),
      { entitlementKey: 'plus_th', durationDays: 7, reason: 'trial' },
      { id: account },
    );
    expect(grant.status).toBe(200);
    const id = grant.body.data.id as string;
    const after = await get(
      'GET /api/admin/accounts/:id/entitlements',
      root(),
      {},
      { id: account },
    );
    const row = after.body.data.entitlements.find((r: { id: string }) => r.id === id);
    expect(row).toMatchObject({
      source: 'PROMO',
      status: 'ACTIVE',
      entitlementKey: 'plus_th',
      reason: 'trial',
      grantedByUsername: 'root',
    });
    expect(Date.parse(row.expiresAt) - Date.parse(row.startsAt)).toBe(7 * 86_400_000);
    const revoked = await send('POST /api/admin/promo-entitlements/:id/revoke', root(), undefined, {
      id,
    });
    expect(revoked.status).toBe(200);
    expect(revoked.body.data).toBeNull();
    const again = await send('POST /api/admin/promo-entitlements/:id/revoke', root(), undefined, {
      id,
    });
    expect(again.status).toBe(409);
    expect(again.body.data.status).toBe('REVOKED');
    // a row from a store subscription is not a limited-time entitlement: the backend says it is not there
    const store = await send('POST /api/admin/promo-entitlements/:id/revoke', root(), undefined, {
      id: '7001',
    });
    expect(store.status).toBe(404);
    expect(store.body.code).toBe('RESOURCE_NOT_FOUND');
    expect(
      (await send('POST /api/admin/promo-entitlements/:id/revoke', root(), undefined, { id: '1' }))
        .status,
    ).toBe(404);
  });

  it('refuses a grant with a wrong duration (1 to 3650 days), an empty or long reason, and an entitlement that does not exist (404, not 400)', async () => {
    const grant = (body: unknown) =>
      send('POST /api/admin/accounts/:id/promo-entitlements', root(), body, { id: account });
    expect(
      (await grant({ entitlementKey: 'plus_th', durationDays: 0, reason: 'x' })).body.data
        .details[0],
    ).toEqual({ ref: 'durationDays', reason: 'OUT_OF_RANGE' });
    expect(
      (await grant({ entitlementKey: 'plus_th', durationDays: 3651, reason: 'x' })).body.data
        .details[0],
    ).toEqual({ ref: 'durationDays', reason: 'OUT_OF_RANGE' });
    expect(
      (await grant({ entitlementKey: 'plus_th', durationDays: 3650, reason: 'x' })).status,
    ).toBe(200);
    expect(
      (await grant({ entitlementKey: 'plus_th', durationDays: 1.5, reason: 'x' })).body.data
        .details[0].reason,
    ).toBe('NOT_AN_INTEGER');
    expect((await grant({ entitlementKey: 'plus_th', reason: 'x' })).body.data.details[0]).toEqual({
      ref: 'durationDays',
      reason: 'EMPTY_NOT_ALLOWED',
    });
    expect(
      (await grant({ entitlementKey: 'plus_th', durationDays: 3, reason: '  ' })).body.data
        .details[0],
    ).toEqual({ ref: 'reason', reason: 'EMPTY_NOT_ALLOWED' });
    expect(
      (await grant({ entitlementKey: 'plus_th', durationDays: 3, reason: 'x'.repeat(501) })).body
        .data.details[0].reason,
    ).toBe('TOO_LONG');
    const missing = await grant({ entitlementKey: 'nope', durationDays: 3, reason: 'x' });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('RESOURCE_NOT_FOUND');
    const unknown = await send(
      'POST /api/admin/accounts/:id/promo-entitlements',
      root(),
      { entitlementKey: 'plus_th', durationDays: 3, reason: 'x' },
      { id: '42' },
    );
    expect(unknown.status).toBe(404);
  });
});

describe('GET /subscriptions/stats', () => {
  it('gives one row per day, store and product with the listed columns; active is null on days without a snapshot', async () => {
    const { status, body } = await get('GET /api/admin/subscriptions/stats', root(), {
      from: '2026-10-01',
      to: '2026-10-07',
    });
    expect(status).toBe(200);
    const items = body.data.items as Record<string, unknown>[];
    expect(items.length).toBe(7 * 4);
    expect(Object.keys(items[0]).sort()).toEqual(
      [
        'statDate',
        'store',
        'productId',
        'active',
        'new',
        'renewed',
        'canceled',
        'expired',
        'refunded',
        'listPriceAmount',
        'listPriceCurrency',
      ].sort(),
    );
    expect(items.some((r) => r.active === null)).toBe(true);
    expect(items.some((r) => typeof r.active === 'number')).toBe(true);
    expect(
      items.every((r) => String(r.statDate) >= '2026-10-01' && String(r.statDate) <= '2026-10-07'),
    ).toBe(true);
  });

  it('gives the list price of a Google row as a decimal string with no trailing zeros, or null with its currency; an Apple row is as before', async () => {
    const { body } = await get('GET /api/admin/subscriptions/stats', root(), {
      from: '2026-10-01',
      to: '2026-10-07',
    });
    const items = body.data.items as {
      store: string;
      listPriceAmount: string | null;
      listPriceCurrency: string | null;
    }[];
    const google = items.filter((r) => r.store === 'GOOGLE');
    expect(google.length).toBeGreaterThan(0);
    for (const r of google) {
      expect(r.listPriceAmount === null, 'both or neither').toBe(r.listPriceCurrency === null);
      if (r.listPriceAmount !== null) {
        expect(typeof r.listPriceAmount).toBe('string');
        expect(r.listPriceAmount).toMatch(/^\d+(\.\d*[1-9])?$/);
        expect(r.listPriceCurrency).toMatch(/^[A-Z]{3}$/);
      }
    }
    expect(google.some((r) => r.listPriceAmount === null)).toBe(true);
    expect(google.some((r) => r.listPriceAmount !== null)).toBe(true);
    const apple = items.filter((r) => r.store === 'APPLE');
    expect(apple.map((r) => r.listPriceAmount)).toEqual(
      expect.arrayContaining(['9.99', '1290.00']),
    );
  });

  it('refuses a range that is not days, reversed, or longer than the limit, naming the parameter', async () => {
    const bad = await get('GET /api/admin/subscriptions/stats', root(), {
      from: '2026-10-07',
      to: '2026-10-01',
    });
    expect(bad.status).toBe(400);
    expect(bad.body.data.details[0].reason).toBe('OUT_OF_RANGE');
    const long = await get('GET /api/admin/subscriptions/stats', root(), {
      from: '2020-01-01',
      to: '2026-10-01',
    });
    expect(long.body.data.details[0]).toEqual({ ref: 'to', reason: 'OUT_OF_RANGE' });
    expect(
      (await get('GET /api/admin/subscriptions/stats', root(), { from: 'x', to: '2026-10-01' }))
        .body.data.details[0].ref,
    ).toBe('from');
  });
});
