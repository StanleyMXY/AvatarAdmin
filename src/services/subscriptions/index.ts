import { apiRequest } from '../../request/apiClient';
import type { Page } from '../../request/errors';
import type {
  AccountEntitlements,
  EntitlementDef,
  FeatureGate,
  FeatureValue,
  Subscription,
  SubscriptionDetail,
  SubscriptionEvent,
  SubscriptionProduct,
  SubscriptionStatRow,
} from './types';

export * from './types';

const enc = encodeURIComponent;

/** The request form of a feature value: UNSET and UNLIMITED carry no value, VALUE must. */
export const featureValueBody = (
  value: FeatureValue,
): { mode: FeatureValue['mode']; value?: unknown } =>
  value.mode === 'VALUE' ? { mode: 'VALUE', value: value.value } : { mode: value.mode };

// ---- subscriptions ----

export type SubscriptionFilter = {
  page: number;
  pageSize: number;
  accountId?: string;
  state?: string;
  store?: string;
  productId?: string;
};

/** `GET /subscriptions`: filters on account (exact), state, store and product; newest first. */
export const listSubscriptions = (params: SubscriptionFilter): Promise<Page<Subscription>> =>
  apiRequest<Page<Subscription>>({ method: 'GET', url: '/subscriptions', params });

/** `GET /subscriptions/{id}`: the columns plus the event timeline. */
export const getSubscription = (id: string): Promise<SubscriptionDetail> =>
  apiRequest<SubscriptionDetail>({ method: 'GET', url: `/subscriptions/${enc(id)}` });

/** `GET /subscriptions/stats?from=&to=`: needs `FINANCE:VIEW`; the days are UTC days. */
export const getSubscriptionStats = (params: {
  from: string;
  to: string;
}): Promise<{ items: SubscriptionStatRow[] }> =>
  apiRequest<{ items: SubscriptionStatRow[] }>({
    method: 'GET',
    url: '/subscriptions/stats',
    params,
  });

// ---- entitlement definitions and feature switches ----

/** `GET /entitlement-defs`: by priority; readable with `SUBSCRIPTION:VIEW` or `SUBSCRIPTION:GRANT`. */
export const listEntitlementDefs = (): Promise<{ items: EntitlementDef[] }> =>
  apiRequest<{ items: EntitlementDef[] }>({ method: 'GET', url: '/entitlement-defs' });

export type EntitlementDefInput = { key: string; name: string; priority: number };

/** `POST /entitlement-defs` (`SUBSCRIPTION:CONFIG`); the key or the priority taken is 409 DUPLICATE_RESOURCE. */
export const createEntitlementDef = (input: EntitlementDefInput): Promise<EntitlementDef> =>
  apiRequest<EntitlementDef>({ method: 'POST', url: '/entitlement-defs', body: input });

/** `PUT /entitlement-defs/{key}` (`SUBSCRIPTION:CONFIG`): the name and the priority. */
export const updateEntitlementDef = (
  key: string,
  input: { name: string; priority: number },
): Promise<EntitlementDef> =>
  apiRequest<EntitlementDef>({ method: 'PUT', url: `/entitlement-defs/${enc(key)}`, body: input });

/**
 * `PUT /entitlement-defs/{key}/features` (`SUBSCRIPTION:CONFIG`): the switches that are listed are
 * saved, the ones left out keep what they have. UNSET removes the configuration of that switch.
 */
export const saveEntitlementFeatures = (
  key: string,
  features: { featureKey: string; value: FeatureValue }[],
): Promise<EntitlementDef> =>
  apiRequest<EntitlementDef>({
    method: 'PUT',
    url: `/entitlement-defs/${enc(key)}/features`,
    body: {
      features: features.map(({ featureKey, value }) => ({
        featureKey,
        ...featureValueBody(value),
      })),
    },
  });

/** `GET /feature-gates`: the declared switches by key, not paged. */
export const listFeatureGates = (): Promise<{ items: FeatureGate[] }> =>
  apiRequest<{ items: FeatureGate[] }>({ method: 'GET', url: '/feature-gates' });

/** `PUT /feature-gates/{key}/default`: UNSET is accepted only for the five quota switches. */
export const saveGateDefault = (key: string, value: FeatureValue): Promise<FeatureGate> =>
  apiRequest<FeatureGate>({
    method: 'PUT',
    url: `/feature-gates/${enc(key)}/default`,
    body: featureValueBody(value),
  });

/** `PUT /feature-gates/{key}/credit-cost`: credits for one more unit; null means it cannot be bought. */
export const saveGateCreditCost = (key: string, creditCost: number | null): Promise<FeatureGate> =>
  apiRequest<FeatureGate>({
    method: 'PUT',
    url: `/feature-gates/${enc(key)}/credit-cost`,
    body: { creditCost },
  });

// ---- product mapping ----

/** `GET /subscription-products`: the mapping of a store product to an entitlement. */
export const listSubscriptionProducts = (): Promise<{ items: SubscriptionProduct[] }> =>
  apiRequest<{ items: SubscriptionProduct[] }>({ method: 'GET', url: '/subscription-products' });

/** `PUT /subscription-products`: one mapping, by (store, productId): changed if it exists, else added. */
export const saveSubscriptionProduct = (input: SubscriptionProduct): Promise<SubscriptionProduct> =>
  apiRequest<SubscriptionProduct>({ method: 'PUT', url: '/subscription-products', body: input });

// ---- events ----

export type SubscriptionEventFilter = {
  page: number;
  pageSize: number;
  status?: 'FAILED';
  needsAttention?: boolean;
};

/** `GET /subscription-events?status=FAILED` and `?needsAttention=true`. */
export const listSubscriptionEvents = (
  params: SubscriptionEventFilter,
): Promise<Page<SubscriptionEvent>> =>
  apiRequest<Page<SubscriptionEvent>>({ method: 'GET', url: '/subscription-events', params });

/** `POST /subscription-events/{id}/reprocess` (`SUBSCRIPTION:GRANT`). */
export const reprocessSubscriptionEvent = (id: string): Promise<unknown> =>
  apiRequest<unknown>({ method: 'POST', url: `/subscription-events/${enc(id)}/reprocess` });

/** `POST /subscription-events/{id}/ack` (`SUBSCRIPTION:GRANT`): the event no longer needs attention. */
export const ackSubscriptionEvent = (id: string): Promise<unknown> =>
  apiRequest<unknown>({ method: 'POST', url: `/subscription-events/${enc(id)}/ack` });

// ---- one account ----

/** `GET /accounts/{id}/entitlements`: the value in force for every switch, and every entitlement row. */
export const getAccountEntitlements = (accountId: string): Promise<AccountEntitlements> =>
  apiRequest<AccountEntitlements>({
    method: 'GET',
    url: `/accounts/${enc(accountId)}/entitlements`,
  });

/** `POST /accounts/{id}/promo-entitlements` (`SUBSCRIPTION:GRANT`): a limited-time entitlement; the store subscription is not touched. */
export const grantPromoEntitlement = (
  accountId: string,
  input: { entitlementKey: string; durationDays: number; reason: string },
): Promise<{ id: string }> =>
  apiRequest<{ id: string }>({
    method: 'POST',
    url: `/accounts/${enc(accountId)}/promo-entitlements`,
    body: input,
  });

/** `POST /promo-entitlements/{id}/revoke` (`SUBSCRIPTION:GRANT`). */
export const revokePromoEntitlement = (promoId: string): Promise<unknown> =>
  apiRequest<unknown>({ method: 'POST', url: `/promo-entitlements/${enc(promoId)}/revoke` });
