// Types of the subscription endpoints. Field names are the backend's (contract 15.3 and 17.4, and
// the reply of 2026-10-21, points 2 to 4); a field that is not named there is a column of the
// entity in contract 15.3.

/** The stores of contract 15.3 today; the list can grow, so a store outside it is still shown as it is. */
export const SUBSCRIPTION_STORES = ['APPLE', 'GOOGLE'] as const;

/** The three states of a feature value: a number or text or switch, "no limit", or "not configured". */
export type FeatureValue =
  | { mode: 'VALUE'; value: unknown }
  | { mode: 'UNLIMITED' }
  | { mode: 'UNSET' };

export type FeatureMode = FeatureValue['mode'];
export type FeatureKind = 'BOOLEAN' | 'LIMIT' | 'STRING';
export type LimitScope = 'PERMANENT' | 'PERIODIC' | 'LIFETIME';

/** One feature of an entitlement as the list gives it (`value` only with VALUE, else null). */
export type EntitlementFeatureRow = {
  featureKey: string;
  mode: FeatureMode;
  value: unknown | null;
};

export type EntitlementDef = {
  key: string;
  name: string;
  priority: number;
  /** Every declared switch, by `featureKey`; no configuration row means `UNSET`. */
  features: EntitlementFeatureRow[];
};

export type FeatureGate = {
  key: string;
  kind: FeatureKind;
  /** Only for `LIMIT` switches. */
  limitScope: LimitScope | null;
  defaultMode: FeatureMode;
  defaultValue: unknown | null;
  creditCost: number | null;
  description: string;
};

export type SubscriptionState =
  | 'PENDING'
  | 'ACTIVE'
  | 'CANCELED'
  | 'IN_GRACE_PERIOD'
  | 'ON_HOLD'
  | 'PAUSED'
  | 'EXPIRED'
  | 'REVOKED';

export type Subscription = {
  id: string;
  accountId: string | null;
  store: string;
  storeRef: string;
  linkedPurchaseToken: string | null;
  productId: string;
  state: SubscriptionState | string;
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

/** An event in the timeline of one subscription (no `payload`). */
export type TimelineEvent = {
  id: string;
  type: string;
  subtype: string | null;
  eventSignedAt: string;
  receivedAt: string;
  processedAt: string | null;
  error: string | null;
  needsAttention: boolean;
};

export type SubscriptionDetail = Subscription & { events: TimelineEvent[] };

/** A row of `GET /subscription-events`: the columns of `SubscriptionEvent` (contract 15.3) without `payload`. */
export type SubscriptionEvent = TimelineEvent & {
  subscriptionId: string | null;
  accountId: string | null;
  store: string;
  sourceEventId: string;
};

export type SubscriptionProduct = {
  store: string;
  productId: string;
  entitlementKey: string;
  enabled: boolean;
  sortOrder: number;
  /** Where the product is shown ([] is every surface); kept as read when a row is saved. */
  surfaces: string[];
};

export type EffectiveFeature = {
  featureKey: string;
  kind: FeatureKind;
  mode: FeatureMode;
  value: unknown | null;
  source: 'ENTITLEMENT' | 'DEFAULT' | 'NONE';
  entitlementKey: string | null;
};

export type AccountEntitlementStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export type AccountEntitlement = {
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
  entitlementName: string;
  status: AccountEntitlementStatus;
};

export type AccountEntitlements = {
  effective: EffectiveFeature[];
  entitlements: AccountEntitlement[];
};

export type SubscriptionStatRow = {
  statDate: string;
  store: string;
  productId: string;
  /** From the daily snapshot; null on a day that has none. */
  active: number | null;
  new: number;
  renewed: number;
  canceled: number;
  expired: number;
  refunded: number;
  /**
   * The list price, not what was paid. The amount is a decimal string such as "24.99" (trailing zeros
   * cut for a Google row), or null when the day has none; a string is never turned into a floating point
   * number. A row of the other store may carry a JSON number such as 9.99 (the backend has not said), which
   * the page formats as the number it is.
   */
  listPriceAmount: number | string | null;
  listPriceCurrency: string | null;
};
