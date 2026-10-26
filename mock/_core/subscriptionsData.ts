// Sample data and state of the subscription endpoints of the mock backend (contract 15.3 to 15.6,
// 17.4). The state hangs on `globalThis` like the rest of the mock state, so saving a mock file does
// not lose it; `resetSubscriptionsStore()` puts the seed back (tests call it in `beforeEach`).
import { daysAgoIso, sampleAny, sampleText } from './fixtures';

export type Mode = 'VALUE' | 'UNLIMITED' | 'UNSET';
export type Kind = 'BOOLEAN' | 'LIMIT' | 'STRING';

export type Gate = {
  key: string;
  kind: Kind;
  limitScope: 'PERMANENT' | 'PERIODIC' | 'LIFETIME' | null;
  defaultMode: Mode;
  defaultValue: unknown;
  creditCost: number | null;
  description: string;
};

export type Def = { key: string; name: string; priority: number };

export type FeatureRow = { mode: 'VALUE' | 'UNLIMITED'; value: unknown };

export type Product = {
  store: string;
  productId: string;
  entitlementKey: string;
  enabled: boolean;
  sortOrder: number;
  surfaces: string[];
};

export type SubscriptionRow = {
  id: string;
  accountId: string | null;
  store: string;
  storeRef: string;
  linkedPurchaseToken: string | null;
  productId: string;
  state: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  gracePeriodEndsAt: string | null;
  autoRenew: boolean;
  environment: 'PRODUCTION' | 'SANDBOX';
  acknowledgementState: string | null;
  purchasedAt: string;
  firstActiveAt: string | null;
  voidedAt: string | null;
  lastEventSignedAt: string | null;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type EventRow = {
  id: string;
  subscriptionId: string | null;
  accountId: string | null;
  store: string;
  sourceEventId: string;
  type: string;
  subtype: string | null;
  eventSignedAt: string;
  receivedAt: string;
  processedAt: string | null;
  error: string | null;
  needsAttention: boolean;
};

export type AccountEntitlementRow = {
  id: string;
  accountId: string;
  entitlementKey: string;
  source: 'STORE' | 'PROMO';
  subscriptionId: string | null;
  startsAt: string;
  expiresAt: string | null;
  grantedBy: string | null;
  grantedByUsername: string | null;
  reason: string | null;
  revokedAt: string | null;
  expiryHandledAt: string | null;
};

export const SUBSCRIPTION_STATES = [
  'PENDING',
  'ACTIVE',
  'CANCELED',
  'IN_GRACE_PERIOD',
  'ON_HOLD',
  'PAUSED',
  'EXPIRED',
  'REVOKED',
] as const;

export const QUOTA_KEYS = [
  'call.daily_minutes',
  'call.monthly_minutes',
  'call.lifetime_minutes',
  'chat.daily_messages',
  'chat.monthly_messages',
];

const gate = (
  key: string,
  kind: Kind,
  limitScope: Gate['limitScope'],
  defaultMode: Mode,
  defaultValue: unknown,
  description: string,
  creditCost: number | null = null,
): Gate => ({ key, kind, limitScope, defaultMode, defaultValue, creditCost, description });

// The fifteen switches the code declares (contract 15.3), with their defaults.
const seedGates = (): Gate[] =>
  [
    gate('memory.tier', 'STRING', null, 'VALUE', 'default', 'Memory tier name of the account'),
    gate(
      'assets.avatar_max',
      'LIMIT',
      'PERMANENT',
      'UNLIMITED',
      null,
      'Most avatars in the library',
      30,
    ),
    gate(
      'assets.voice_max',
      'LIMIT',
      'PERMANENT',
      'UNLIMITED',
      null,
      'Most voices in the library',
      20,
    ),
    gate('call.daily_minutes', 'LIMIT', 'PERIODIC', 'UNSET', null, 'Call minutes per local day'),
    gate(
      'call.monthly_minutes',
      'LIMIT',
      'PERIODIC',
      'UNSET',
      null,
      'Call minutes per usage period',
    ),
    gate('call.lifetime_minutes', 'LIMIT', 'LIFETIME', 'UNSET', null, 'Call minutes, whole life'),
    gate('chat.daily_messages', 'LIMIT', 'PERIODIC', 'UNSET', null, 'Text messages per local day'),
    gate(
      'chat.monthly_messages',
      'LIMIT',
      'PERIODIC',
      'UNSET',
      null,
      'Text messages per usage period',
    ),
    gate('chat.model_tier', 'STRING', null, 'VALUE', 'standard', 'Model tier of the companion'),
    gate('ads.removed', 'BOOLEAN', null, 'VALUE', false, 'The account sees no in-app ads'),
    gate('avatar.looks_max', 'LIMIT', 'PERMANENT', 'VALUE', 5, 'Most looks for each avatar'),
    gate('avatar.look_free', 'BOOLEAN', null, 'VALUE', false, 'New looks cost no credits'),
    gate(
      'credits.period_grant',
      'LIMIT',
      'PERIODIC',
      'VALUE',
      0,
      'Credits granted each billing period',
    ),
    gate('render.cloud', 'BOOLEAN', null, 'VALUE', false, 'Cloud rendering tier'),
    gate('chat.voice_reply', 'BOOLEAN', null, 'VALUE', false, 'Voice replies in text chat'),
  ].sort((a, b) => (a.key < b.key ? -1 : 1));

// Names in every target language, long and unspaced ones included.
const seedDefs = (): Def[] => [
  { key: 'basic', name: sampleText('es', 0), priority: 10 },
  { key: 'premium', name: `Premium ${sampleText('zh', 0)}`, priority: 20 },
  { key: 'plus_th', name: sampleText('th', 2), priority: 30 },
  { key: 'vip_ar', name: sampleText('ar', 2), priority: 40 },
];

const seedFeatures = (): Map<string, FeatureRow> =>
  new Map<string, FeatureRow>([
    ['premium|assets.avatar_max', { mode: 'VALUE', value: 10 }],
    ['premium|call.monthly_minutes', { mode: 'VALUE', value: 600 }],
    ['premium|chat.model_tier', { mode: 'VALUE', value: 'premium' }],
    ['premium|ads.removed', { mode: 'VALUE', value: true }],
    ['premium|credits.period_grant', { mode: 'VALUE', value: 100 }],
    ['premium|assets.voice_max', { mode: 'UNLIMITED', value: null }],
    ['vip_ar|chat.daily_messages', { mode: 'UNLIMITED', value: null }],
    ['vip_ar|call.daily_minutes', { mode: 'VALUE', value: 120 }],
  ]);

const seedProducts = (): Product[] => [
  {
    store: 'APPLE',
    productId: 'avatar.premium.monthly',
    entitlementKey: 'premium',
    enabled: true,
    sortOrder: 1,
    surfaces: [],
  },
  {
    store: 'APPLE',
    productId: 'avatar.premium.yearly',
    entitlementKey: 'premium',
    enabled: true,
    sortOrder: 2,
    surfaces: [],
  },
  {
    store: 'GOOGLE',
    productId: 'avatar_premium_monthly',
    entitlementKey: 'premium',
    enabled: true,
    sortOrder: 1,
    surfaces: [],
  },
  {
    store: 'GOOGLE',
    productId: 'avatar_plus_monthly',
    entitlementKey: 'plus_th',
    enabled: false,
    sortOrder: 3,
    surfaces: ['ANDROID'],
  },
];

const PRODUCT_IDS = [
  ['APPLE', 'avatar.premium.monthly'],
  ['APPLE', 'avatar.premium.yearly'],
  ['GOOGLE', 'avatar_premium_monthly'],
  ['GOOGLE', 'avatar_plus_monthly'],
] as const;

export const ACCOUNT_IDS = Array.from({ length: 10 }, (_, i) => String(10000000001 + i));

const stateAt = (i: number) => SUBSCRIPTION_STATES[(i * 3) % SUBSCRIPTION_STATES.length];

const seedSubscriptions = (): SubscriptionRow[] =>
  Array.from({ length: 30 }, (_, i) => {
    const [store, productId] = PRODUCT_IDS[i % PRODUCT_IDS.length];
    const state = i < 4 ? SUBSCRIPTION_STATES[i + 1] : stateAt(i);
    const purchasedAt = daysAgoIso(5 + i * 3);
    return {
      id: String(500 + i),
      accountId: i % 9 === 8 ? null : ACCOUNT_IDS[i % ACCOUNT_IDS.length],
      store,
      storeRef: store === 'APPLE' ? `20000000${1000 + i}` : `gp-token-${'x'.repeat(40)}-${i}`,
      linkedPurchaseToken: null,
      productId,
      state,
      currentPeriodStart: daysAgoIso(i),
      currentPeriodEnd: daysAgoIso(i - 30),
      gracePeriodEndsAt: state === 'IN_GRACE_PERIOD' ? daysAgoIso(i - 36) : null,
      autoRenew: state === 'ACTIVE' || state === 'IN_GRACE_PERIOD',
      environment: i % 7 === 3 ? 'SANDBOX' : 'PRODUCTION',
      acknowledgementState: store === 'GOOGLE' ? 'ACKNOWLEDGED' : null,
      purchasedAt,
      firstActiveAt: state === 'PENDING' ? null : purchasedAt,
      voidedAt: state === 'REVOKED' ? daysAgoIso(1) : null,
      lastEventSignedAt: daysAgoIso(i),
      lastSyncedAt: daysAgoIso(0),
      createdAt: purchasedAt,
      updatedAt: daysAgoIso(i),
    };
  });

const EVENT_TYPES: [string, string | null][] = [
  ['SUBSCRIBED', 'INITIAL_BUY'],
  ['DID_RENEW', null],
  ['DID_CHANGE_RENEWAL_STATUS', 'AUTO_RENEW_DISABLED'],
  ['SUBSCRIPTION_RENEWED', null],
  ['REFUND', null],
];

const seedEvents = (subscriptions: SubscriptionRow[]): EventRow[] => {
  const events: EventRow[] = [];
  subscriptions.forEach((subscription, i) => {
    for (let k = 0; k < 3; k++) {
      const [type, subtype] = EVENT_TYPES[(i + k) % EVENT_TYPES.length];
      const failed = (i + k) % 5 === 1;
      const signedAt = daysAgoIso(i + (2 - k) * 9);
      events.push({
        id: String(9000 + events.length),
        subscriptionId: subscription.id,
        accountId: subscription.accountId,
        store: subscription.store,
        sourceEventId: `evt-${subscription.id}-${k}`,
        type,
        subtype,
        eventSignedAt: signedAt,
        receivedAt: new Date(Date.parse(signedAt) + 4000).toISOString(),
        processedAt: failed ? null : new Date(Date.parse(signedAt) + 6000).toISOString(),
        // Failures carry text in any language, and some very long ones without spaces.
        error: failed
          ? events.length % 3 === 0
            ? 'x'.repeat(5000)
            : `Processing failed: ${sampleAny(events.length)}`
          : null,
        needsAttention: type === 'REFUND' && (i + k) % 2 === 0,
      });
    }
  });
  return events;
};

const seedAccountEntitlements = (): AccountEntitlementRow[] => {
  const base = ACCOUNT_IDS[0];
  return [
    {
      id: '7001',
      accountId: base,
      entitlementKey: 'premium',
      source: 'STORE',
      subscriptionId: '500',
      startsAt: daysAgoIso(40),
      expiresAt: daysAgoIso(-20),
      grantedBy: null,
      grantedByUsername: null,
      reason: null,
      revokedAt: null,
      expiryHandledAt: null,
    },
    {
      id: '7002',
      accountId: base,
      entitlementKey: 'vip_ar',
      source: 'PROMO',
      subscriptionId: null,
      startsAt: daysAgoIso(3),
      expiresAt: daysAgoIso(-27),
      grantedBy: '1',
      grantedByUsername: 'root',
      reason: sampleText('ar', 0),
      revokedAt: null,
      expiryHandledAt: null,
    },
    {
      id: '7003',
      accountId: base,
      entitlementKey: 'plus_th',
      source: 'PROMO',
      subscriptionId: null,
      startsAt: daysAgoIso(60),
      expiresAt: daysAgoIso(30),
      grantedBy: '1',
      grantedByUsername: 'root',
      reason: sampleText('th', 1),
      revokedAt: null,
      expiryHandledAt: daysAgoIso(30),
    },
    {
      id: '7004',
      accountId: base,
      entitlementKey: 'basic',
      source: 'PROMO',
      subscriptionId: null,
      startsAt: daysAgoIso(20),
      expiresAt: daysAgoIso(-10),
      grantedBy: null,
      grantedByUsername: null,
      reason: sampleText('vi', 2),
      revokedAt: daysAgoIso(15),
      expiryHandledAt: null,
    },
  ];
};

export type SubscriptionsState = {
  gates: Gate[];
  defs: Def[];
  features: Map<string, FeatureRow>;
  products: Product[];
  subscriptions: SubscriptionRow[];
  events: EventRow[];
  accountEntitlements: AccountEntitlementRow[];
  nextPromoId: number;
};

const seed = (): SubscriptionsState => {
  const subscriptions = seedSubscriptions();
  return {
    gates: seedGates(),
    defs: seedDefs(),
    features: seedFeatures(),
    products: seedProducts(),
    subscriptions,
    events: seedEvents(subscriptions),
    accountEntitlements: seedAccountEntitlements(),
    nextPromoId: 7100,
  };
};

type Holder = { __avatarAdminMockSubscriptions?: { current: SubscriptionsState } };
const holder = globalThis as Holder;
holder.__avatarAdminMockSubscriptions ??= { current: seed() };
const slot = holder.__avatarAdminMockSubscriptions;

/** The live state; read it again after `resetSubscriptionsStore()`, which replaces it. */
export const subscriptionsState = (): SubscriptionsState => slot.current;

export function resetSubscriptionsStore(): void {
  slot.current = seed();
}

/** The memory tiers `memory.tier` may name, and the model tiers `chat.model_tier` may name. */
export const MEMORY_TIERS = ['default', 'plus', 'pro'];
export const MODEL_TIERS = ['standard', 'premium'];
