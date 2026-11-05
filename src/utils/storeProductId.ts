import { ApiError } from '../request/errors';
import type { FieldReason } from './fieldReasons';

/** What a product the page maps to a store may be called, as the backend checks it. */
export type ProductKind = 'credit' | 'subscription';

const APPLE_ID = /^[A-Za-z0-9._-]+$/;
const GOOGLE_ID = /^[a-z0-9][a-z0-9_.]*$/;

/** The longest product id: Apple 100; Google 100 for a credit pack and 40 for a subscription product. */
export function productIdMax(store: string | null | undefined, kind: ProductKind): number {
  return store === 'GOOGLE' && kind === 'subscription' ? 40 : 100;
}

/** The language-file key of the rule for a store, or null for a store the page has no rule for. */
export function productIdRuleKey(store: string | null | undefined): string | null {
  return store === 'APPLE' || store === 'GOOGLE' ? `pages.productId.rule.${store}` : null;
}

/** True when the id breaks the store's rule. A store with no rule here accepts anything non-empty. */
export function productIdBroken(
  store: string | null | undefined,
  productId: string,
  kind: ProductKind,
): boolean {
  if (store !== 'APPLE' && store !== 'GOOGLE') return false;
  const pattern = store === 'APPLE' ? APPLE_ID : GOOGLE_ID;
  return !pattern.test(productId) || [...productId].length > productIdMax(store, kind);
}

/**
 * The reasons of a refused save with the one for `productId` written as the store's rule when the
 * backend said OUT_OF_RANGE for it: the general words of that reason say nothing about what is
 * wrong with an id. Any other reason is left as it is.
 */
export function withProductIdRule(
  reasons: FieldReason[],
  error: unknown,
  store: string | null | undefined,
  kind: ProductKind,
): FieldReason[] {
  const ruleKey = productIdRuleKey(store);
  const refused =
    error instanceof ApiError &&
    error.details.some((d) => d.ref === 'productId' && d.reason === 'OUT_OF_RANGE');
  if (!ruleKey || !refused || !store) return reasons;
  return reasons.map((reason) =>
    reason.name === 'productId'
      ? {
          name: reason.name,
          write: (words) =>
            words.formatMessage({ id: ruleKey }, { max: productIdMax(store, kind) }),
        }
      : reason,
  );
}
