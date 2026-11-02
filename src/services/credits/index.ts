import { apiRequest } from '../../request/apiClient';
import type {
  AccountCredits,
  AdjustRequest,
  AdjustRequestBody,
  AdjustRequestQuery,
  CreditAccount,
  CreditAccountQuery,
  CreditProduct,
  CreditProductBody,
  CreditStats,
  CreditTransaction,
  CreditTransactionQuery,
  Page,
} from './types';

export * from './types';

const enc = encodeURIComponent;

// ---- credit packs (SUBSCRIPTION:CONFIG) ----

/**
 * `GET /credit-products`: every pack, on sale or not, by sortOrder, store, productId. The answer is
 * `{ items }` only: no id, no total, not paged (backend reply 30).
 */
export const listCreditProducts = (): Promise<{ items: CreditProduct[] }> =>
  apiRequest({ method: 'GET', url: '/credit-products' });

/** Every pack: one request, there is no second page. */
export async function listAllCreditProducts(): Promise<CreditProduct[]> {
  return (await listCreditProducts()).items;
}

/** The row identity of a pack: the backend gives no id, so (store, productId). */
export const creditProductKey = (pack: Pick<CreditProduct, 'store' | 'productId'>): string =>
  JSON.stringify([pack.store, pack.productId]);

/** `POST /credit-products`: a new pack; the answer is `{ store, productId }`. */
export const createCreditProduct = (
  body: CreditProductBody,
): Promise<{ store: string; productId: string }> =>
  apiRequest({ method: 'POST', url: '/credit-products', body });

/**
 * `PUT /credit-products`: changes the pack named by `store` and `productId` in the body (there is no
 * id path). All six fields are required, `surfaces` too: left out it is refused, not kept. The
 * answer is `data: null`, so the list is read again.
 */
export const updateCreditProduct = (body: CreditProductBody): Promise<null> =>
  apiRequest({ method: 'PUT', url: '/credit-products', body });

// ---- adjustment requests (view SUBSCRIPTION:VIEW, create SUBSCRIPTION:GRANT, review CREDIT:REVIEW) ----

export const listAdjustRequests = (params: AdjustRequestQuery): Promise<Page<AdjustRequest>> =>
  apiRequest({ method: 'GET', url: '/credit-adjust-requests', params });

export const createAdjustRequest = (body: AdjustRequestBody): Promise<AdjustRequest> =>
  apiRequest({ method: 'POST', url: '/credit-adjust-requests', body });

/** The note is optional: an empty one is not sent. */
export const approveAdjustRequest = (id: string, note?: string): Promise<AdjustRequest> =>
  apiRequest({
    method: 'POST',
    url: `/credit-adjust-requests/${enc(id)}/approve`,
    body: note ? { note } : {},
  });

export const rejectAdjustRequest = (id: string, note: string): Promise<AdjustRequest> =>
  apiRequest({ method: 'POST', url: `/credit-adjust-requests/${enc(id)}/reject`, body: { note } });

// ---- accounts, transactions, statistics ----

export const listCreditAccounts = (params: CreditAccountQuery): Promise<Page<CreditAccount>> =>
  apiRequest({ method: 'GET', url: '/credits/accounts', params });

export const listCreditTransactions = (
  params: CreditTransactionQuery,
): Promise<Page<CreditTransaction>> =>
  apiRequest({ method: 'GET', url: '/credits/transactions', params });

/** `from` and `to` are UTC calendar days `YYYY-MM-DD`, both included. */
export const getCreditStats = (from: string, to: string): Promise<CreditStats> =>
  apiRequest({ method: 'GET', url: '/credits/stats', params: { from, to } });

/**
 * `GET /accounts/{id}/credits`: the balance, the two totals and one page of the ledger, newest first.
 * An account without a credit account is not a 404: three zeros and no lines.
 */
export const getAccountCredits = (
  accountId: string,
  params: { page: number; pageSize: number },
): Promise<AccountCredits> =>
  apiRequest({ method: 'GET', url: `/accounts/${enc(accountId)}/credits`, params });
