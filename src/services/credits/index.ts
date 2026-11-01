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
  CreditProductUpdate,
  CreditStats,
  CreditTransaction,
  CreditTransactionQuery,
  Page,
} from './types';

export * from './types';

const enc = encodeURIComponent;

// ---- credit packs (SUBSCRIPTION:CONFIG) ----

/** `GET /credit-products`: the packs, on sale or not. Whether the backend pages it is not settled (see the contract request, question 1). */
export const listCreditProducts = (params?: {
  page: number;
  pageSize: number;
}): Promise<{ items: CreditProduct[]; total?: number }> =>
  apiRequest({ method: 'GET', url: '/credit-products', params });

const ALL_PAGE_SIZE = 200;

/**
 * Every pack, whether the backend pages the list (contract 17.4: `page`, `pageSize` up to 200,
 * `total`) or sends it whole. With a numeric `total` it reads pages until it has that many; without
 * one it stops at a page shorter than the page size. It stops too at a page that brings nothing new,
 * so a backend that ignores the page cannot make it loop. Each pack is kept once.
 */
export async function listAllCreditProducts(): Promise<CreditProduct[]> {
  const packs: CreditProduct[] = [];
  const seen = new Set<string>();
  for (let page = 1; ; page += 1) {
    const answer = await listCreditProducts({ page, pageSize: ALL_PAGE_SIZE });
    const fresh = answer.items.filter((pack) => !seen.has(String(pack.id)));
    for (const pack of fresh) seen.add(String(pack.id));
    packs.push(...fresh);
    if (answer.items.length === 0 || fresh.length === 0) return packs;
    if (typeof answer.total === 'number') {
      if (packs.length >= answer.total) return packs;
    } else if (answer.items.length < ALL_PAGE_SIZE) {
      return packs;
    }
  }
}

export const createCreditProduct = (body: CreditProductBody): Promise<CreditProduct> =>
  apiRequest({ method: 'POST', url: '/credit-products', body });

export const updateCreditProduct = (
  id: string,
  body: CreditProductUpdate,
): Promise<CreditProduct> =>
  apiRequest({ method: 'PUT', url: `/credit-products/${enc(id)}`, body });

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
