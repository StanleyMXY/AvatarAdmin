// Response types of the credit endpoints. Field names are the backend's: contract 15.9 and 17.4 (credit row)
// and reply 5 of the backend (`GET /accounts/{id}/credits`); the credit pack list is the one place that is
// not written anywhere (docs/contract-requests/2026-10-26-admin-frontend-credits.md, question 1).
import type { Page } from '../../request/errors';

export type { Page };

/** `{ platform, channel }` of contract 3.7: where a pack is offered; `channel: null` means every channel. */
export type Surface = { platform: 'ANDROID' | 'IOS'; channel: string | null };

/** The stores a pack can be created for now (contract 15.9: `APPLE`, `GOOGLE`; the list can grow). */
export const CREDIT_STORES = ['APPLE', 'GOOGLE'] as const;

export type CreditProduct = {
  id: string;
  store: string;
  productId: string;
  credits: number;
  enabled: boolean;
  sortOrder: number;
  surfaces?: Surface[];
};

export type CreditProductBody = {
  store: string;
  productId: string;
  credits: number;
  enabled: boolean;
  sortOrder: number;
};

export type CreditProductUpdate = {
  credits: number;
  enabled: boolean;
  sortOrder: number;
  surfaces?: Surface[];
};

export type AdjustKind = 'GRANT' | 'ADJUST';
export type AdjustStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** `CreditAdjustRequest` of contract 18 plus the two user names (backend reply 3: null when the administrator is gone). */
export type AdjustRequest = {
  id: string;
  accountId: string;
  kind: AdjustKind;
  delta: number;
  reason: string;
  status: AdjustStatus;
  applicantAdminId: string;
  applicantUsername: string | null;
  reviewerAdminId: string | null;
  reviewerUsername: string | null;
  reviewNote: string | null;
  ledgerId: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type AdjustRequestBody = {
  accountId: string;
  kind: AdjustKind;
  delta: number;
  reason: string;
};

export type AdjustRequestQuery = {
  page: number;
  pageSize: number;
  status?: AdjustStatus;
  accountId?: string;
};

/** The twelve reasons of a ledger line (contract 15.9). */
export const LEDGER_REASONS = [
  'PURCHASE',
  'REFUND',
  'REFUND_REVERSED',
  'SPEND',
  'ADMIN_GRANT',
  'ADMIN_ADJUST',
  'AD_REWARD',
  'INVITE_REWARD',
  'CHECKIN_REWARD',
  'TASK_REWARD',
  'SUBSCRIPTION_GRANT',
  'SPEND_REVERSED',
] as const;

export const SPEND_KINDS = ['FEATURE', 'COSMETIC', 'LOOK'] as const;

/** One line of an account's ledger (`CreditLedger` without `idempotencyKey`). */
export type LedgerRow = {
  id: string;
  delta: number;
  reason: string;
  purchaseId: string | null;
  eventKey: string | null;
  spendKind: string | null;
  featureKey: string | null;
  itemKey: string | null;
  quantity: number | null;
  note: string | null;
  createdAt: string;
};

export type AccountCredits = {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  items: LedgerRow[];
  total: number;
};

export type CreditAccount = {
  accountId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  updatedAt: string;
};

export type CreditAccountQuery = {
  page: number;
  pageSize: number;
  accountId?: string;
  balanceMin?: number;
  balanceMax?: number;
};

export type CreditTransaction = LedgerRow & { accountId: string };

export type CreditTransactionQuery = {
  page: number;
  pageSize: number;
  accountId?: string;
  reason?: string;
  /** `earn` (positive changes) or `spend` (negative ones); left out for both. */
  type?: 'earn' | 'spend';
  from?: string;
  to?: string;
};

export type CreditStats = {
  purchases: { store: string; productId: string; packs: number; credits: number }[];
  refunded: { store: string; productId: string; credits: number }[];
  spent: {
    spendKind: string;
    featureKey: string | null;
    itemKey: string | null;
    count: number;
    credits: number;
  }[];
};
