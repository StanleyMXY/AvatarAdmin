import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import {
  ackSubscriptionEvent,
  featureValueBody,
  getAccountEntitlements,
  getSubscription,
  getSubscriptionStats,
  grantPromoEntitlement,
  listEntitlementDefs,
  listFeatureGates,
  listSubscriptionEvents,
  listSubscriptionProducts,
  listSubscriptions,
  reprocessSubscriptionEvent,
  revokePromoEntitlement,
  saveEntitlementFeatures,
  saveGateCreditCost,
  saveGateDefault,
  saveSubscriptionProduct,
} from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const answer = (data: unknown = { items: [], total: 0 }) =>
  stubFetch(() => jsonResponse(200, envelope('200', data)));
const bodyOf = (call: { init: RequestInit }) => JSON.parse(call.init.body as string);

describe('featureValueBody: the three states of a feature value on the wire', () => {
  it('writes UNSET and UNLIMITED without a value, VALUE with it', () => {
    expect(featureValueBody({ mode: 'UNSET' })).toEqual({ mode: 'UNSET' });
    expect(featureValueBody({ mode: 'UNLIMITED' })).toEqual({ mode: 'UNLIMITED' });
    expect(featureValueBody({ mode: 'VALUE', value: 0 })).toEqual({ mode: 'VALUE', value: 0 });
    expect(featureValueBody({ mode: 'VALUE', value: false })).toEqual({
      mode: 'VALUE',
      value: false,
    });
    expect(featureValueBody({ mode: 'VALUE', value: 'premium' })).toEqual({
      mode: 'VALUE',
      value: 'premium',
    });
  });
});

describe('subscription reads', () => {
  it('lists subscriptions with the filters and the paging, leaving out the empty ones', async () => {
    const calls = answer();
    await listSubscriptions({
      page: 2,
      pageSize: 50,
      accountId: '10',
      state: 'ACTIVE',
      store: '',
      productId: undefined,
    });
    expect(calls[0].url).toBe(
      '/api/admin/subscriptions?page=2&pageSize=50&accountId=10&state=ACTIVE',
    );
    expect(calls[0].init.method).toBe('GET');
  });

  it('reads one subscription, the definitions, the switches, the products', async () => {
    const calls = answer({ items: [] });
    await getSubscription('500');
    await listEntitlementDefs();
    await listFeatureGates();
    await listSubscriptionProducts();
    expect(calls.map((c) => c.url)).toEqual([
      '/api/admin/subscriptions/500',
      '/api/admin/entitlement-defs',
      '/api/admin/feature-gates',
      '/api/admin/subscription-products',
    ]);
  });

  it('asks the events for status and needsAttention only when they are set', async () => {
    const calls = answer();
    await listSubscriptionEvents({ page: 1, pageSize: 20 });
    await listSubscriptionEvents({ page: 1, pageSize: 20, status: 'FAILED', needsAttention: true });
    expect(calls[0].url).toBe('/api/admin/subscription-events?page=1&pageSize=20');
    expect(calls[1].url).toBe(
      '/api/admin/subscription-events?page=1&pageSize=20&status=FAILED&needsAttention=true',
    );
  });

  it('sends the statistics days exactly as picked', async () => {
    const calls = answer({ items: [] });
    await getSubscriptionStats({ from: '2026-10-01', to: '2026-10-07' });
    expect(calls[0].url).toBe('/api/admin/subscriptions/stats?from=2026-10-01&to=2026-10-07');
  });

  it('reads the entitlements of an account by id', async () => {
    const calls = answer({ effective: [], entitlements: [] });
    await getAccountEntitlements('10000000001');
    expect(calls[0].url).toBe('/api/admin/accounts/10000000001/entitlements');
  });
});

describe('subscription writes', () => {
  it('saves the feature values of an entitlement as { features }, each in its own shape', async () => {
    const calls = answer({});
    await saveEntitlementFeatures('premium', [
      { featureKey: 'assets.avatar_max', value: { mode: 'VALUE', value: 3 } },
      { featureKey: 'assets.voice_max', value: { mode: 'UNLIMITED' } },
      { featureKey: 'ads.removed', value: { mode: 'UNSET' } },
    ]);
    expect(calls[0].url).toBe('/api/admin/entitlement-defs/premium/features');
    expect(calls[0].init.method).toBe('PUT');
    expect(bodyOf(calls[0])).toEqual({
      features: [
        { featureKey: 'assets.avatar_max', mode: 'VALUE', value: 3 },
        { featureKey: 'assets.voice_max', mode: 'UNLIMITED' },
        { featureKey: 'ads.removed', mode: 'UNSET' },
      ],
    });
  });

  it('puts a key that has a dot or a space in the path encoded', async () => {
    const calls = answer({});
    await saveGateDefault('call.daily_minutes', { mode: 'UNSET' });
    await saveGateCreditCost('assets.avatar_max', 30);
    await saveGateCreditCost('assets.avatar_max', null);
    expect(calls[0].url).toBe('/api/admin/feature-gates/call.daily_minutes/default');
    expect(bodyOf(calls[0])).toEqual({ mode: 'UNSET' });
    expect(calls[1].url).toBe('/api/admin/feature-gates/assets.avatar_max/credit-cost');
    expect(bodyOf(calls[1])).toEqual({ creditCost: 30 });
    expect(bodyOf(calls[2])).toEqual({ creditCost: null });
  });

  it('saves one product mapping with PUT', async () => {
    const calls = answer({});
    await saveSubscriptionProduct({
      store: 'APPLE',
      productId: 'p',
      entitlementKey: 'premium',
      enabled: true,
      sortOrder: 1,
      surfaces: [],
    });
    expect(calls[0].url).toBe('/api/admin/subscription-products');
    expect(calls[0].init.method).toBe('PUT');
    expect(bodyOf(calls[0])).toMatchObject({ store: 'APPLE', productId: 'p', enabled: true });
  });

  it('reprocesses and acknowledges an event with POST and no body', async () => {
    const calls = answer({});
    await reprocessSubscriptionEvent('9001');
    await ackSubscriptionEvent('9001');
    expect(calls.map((c) => [c.init.method, c.url])).toEqual([
      ['POST', '/api/admin/subscription-events/9001/reprocess'],
      ['POST', '/api/admin/subscription-events/9001/ack'],
    ]);
  });

  it('grants a limited-time entitlement and revokes it', async () => {
    const calls = answer({ id: '7100' });
    await grantPromoEntitlement('10000000001', {
      entitlementKey: 'plus_th',
      durationDays: 7,
      reason: 'ทดลองใช้',
    });
    await revokePromoEntitlement('7100');
    expect(calls[0].url).toBe('/api/admin/accounts/10000000001/promo-entitlements');
    expect(bodyOf(calls[0])).toEqual({
      entitlementKey: 'plus_th',
      durationDays: 7,
      reason: 'ทดลองใช้',
    });
    expect(calls[1].url).toBe('/api/admin/promo-entitlements/7100/revoke');
    expect(calls[1].init.method).toBe('POST');
  });

  it('lets the refusal of the backend through with its details', async () => {
    stubFetch(() =>
      jsonResponse(
        400,
        envelope('INVALID_REQUEST', { details: [{ ref: 'memory.tier', reason: 'OUT_OF_RANGE' }] }),
      ),
    );
    await expect(saveEntitlementFeatures('premium', [])).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      details: [{ ref: 'memory.tier', reason: 'OUT_OF_RANGE' }],
    });
  });
});
