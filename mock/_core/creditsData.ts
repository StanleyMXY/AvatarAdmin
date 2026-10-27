// In-memory state of the credit endpoints of the mock backend: accounts, the ledger, purchases,
// adjustment requests and credit packs. It hangs on `globalThis` like the rest of the mock state
// (see store.ts), so saving a mock file does not lose it; `resetCreditsStore` puts the sample data
// back (the tests call it, a restart of the dev server does it too).
// Not a mock file itself: Umi's loader reads every file in mock/, and only files that export
// handlers belong there, so this one lives in _core/.
import { multilingualSamples } from './fixtures';

export const ACCOUNT = {
  /** Has credits, a long ledger, a pending grant and a pending adjustment against it. */
  active: '00000000-0000-4000-8000-0000000000a1',
  /** The balance is below zero (a purchase was refunded after the credits were spent). */
  negative: '00000000-0000-4000-8000-0000000000a2',
  /** Exists but has no credit account yet. */
  none: '00000000-0000-4000-8000-0000000000a3',
  pendingDeletion: '00000000-0000-4000-8000-0000000000a4',
  deleting: '00000000-0000-4000-8000-0000000000a5',
} as const;

export type MockAccount = { id: string; status: 'ACTIVE' | 'PENDING_DELETION' | 'DELETING' };

export type MockLedger = {
  id: string;
  accountId: string;
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

export type MockPurchase = {
  id: string;
  store: 'APPLE' | 'GOOGLE';
  productId: string;
  environment: 'PRODUCTION' | 'SANDBOX';
};

export type MockRequest = {
  id: string;
  accountId: string;
  kind: 'GRANT' | 'ADJUST';
  delta: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  applicantAdminId: string;
  reviewerAdminId: string | null;
  reviewNote: string | null;
  ledgerId: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type MockProduct = {
  id: string;
  store: 'APPLE' | 'GOOGLE';
  productId: string;
  credits: number;
  enabled: boolean;
  sortOrder: number;
  surfaces: { platform: 'ANDROID' | 'IOS'; channel: string | null }[];
};

export type CreditsState = {
  accounts: MockAccount[];
  ledger: MockLedger[];
  purchases: MockPurchase[];
  requests: MockRequest[];
  products: MockProduct[];
  next: { ledger: number; request: number; product: number };
};

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

type Draft = Omit<MockLedger, 'id'>;

const FEATURE_PRICES: Record<string, number> = { 'assets.avatar_max': 100, 'assets.voice_max': 80 };
const ITEM_PRICES: Record<string, number> = {
  outfit_red_dress: 150,
  bg_beach: 80,
  outfit_blue_suit: 120,
};
const LOOK_PRICE = 60;
const ITEMS = Object.keys(ITEM_PRICES);
const FEATURES = Object.keys(FEATURE_PRICES);

const { th, ar, id: idn, vi, es, en, zh } = multilingualSamples;

function seed(now: Date): CreditsState {
  const at = (daysAgo: number, hour = 12): string =>
    new Date(Math.floor(now.getTime() / DAY) * DAY + hour * HOUR - daysAgo * DAY).toISOString();

  const accounts: MockAccount[] = [
    { id: ACCOUNT.active, status: 'ACTIVE' },
    { id: ACCOUNT.negative, status: 'ACTIVE' },
    { id: ACCOUNT.none, status: 'ACTIVE' },
    { id: ACCOUNT.pendingDeletion, status: 'PENDING_DELETION' },
    { id: ACCOUNT.deleting, status: 'DELETING' },
  ];
  const bulk = (n: number) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`;
  for (let n = 1; n <= 25; n++) accounts.push({ id: bulk(n), status: 'ACTIVE' });

  const purchases: MockPurchase[] = [];
  const purchase = (
    store: MockPurchase['store'],
    productId: string,
    environment: MockPurchase['environment'] = 'PRODUCTION',
  ): string => {
    const purchaseId = `pur-${purchases.length + 1}`;
    purchases.push({ id: purchaseId, store, productId, environment });
    return purchaseId;
  };

  const drafts: Draft[] = [];
  const line = (accountId: string, daysAgo: number, hour: number, over: Partial<Draft>) =>
    drafts.push({
      accountId,
      delta: 0,
      reason: 'SPEND',
      purchaseId: null,
      eventKey: null,
      spendKind: null,
      featureKey: null,
      itemKey: null,
      quantity: null,
      note: null,
      createdAt: at(daysAgo, hour),
      ...over,
    });
  const buy = (
    accountId: string,
    daysAgo: number,
    hour: number,
    store: MockPurchase['store'],
    productId: string,
    credits: number,
    environment: MockPurchase['environment'] = 'PRODUCTION',
  ) => {
    const purchaseId = purchase(store, productId, environment);
    line(accountId, daysAgo, hour, {
      delta: credits,
      reason: 'PURCHASE',
      purchaseId,
      eventKey: `txn-${purchaseId}`,
    });
    return purchaseId;
  };
  const feature = (accountId: string, daysAgo: number, hour: number, key: string, quantity = 1) =>
    line(accountId, daysAgo, hour, {
      delta: -FEATURE_PRICES[key] * quantity,
      reason: 'SPEND',
      spendKind: 'FEATURE',
      featureKey: key,
      quantity,
    });
  const cosmetic = (accountId: string, daysAgo: number, hour: number, key: string) =>
    line(accountId, daysAgo, hour, {
      delta: -ITEM_PRICES[key],
      reason: 'SPEND',
      spendKind: 'COSMETIC',
      itemKey: key,
      quantity: 1,
    });
  const look = (accountId: string, daysAgo: number, hour: number, task: string) =>
    line(accountId, daysAgo, hour, {
      delta: -LOOK_PRICE,
      reason: 'SPEND',
      spendKind: 'LOOK',
      eventKey: task,
      quantity: 1,
    });
  const lookBack = (accountId: string, daysAgo: number, hour: number, task: string) =>
    line(accountId, daysAgo, hour, {
      delta: LOOK_PRICE,
      reason: 'SPEND_REVERSED',
      spendKind: 'LOOK',
      eventKey: task,
      quantity: null,
      note: en[0],
    });

  // The account with a long ledger: more than one page at 20 lines.
  const a = ACCOUNT.active;
  buy(a, 24, 9, 'APPLE', 'credits_500', 500);
  buy(a, 20, 10, 'GOOGLE', 'credits_1200', 1200, 'SANDBOX');
  buy(a, 3, 8, 'GOOGLE', 'credits_500', 500);
  for (let n = 0; n < 4; n++) {
    line(a, 23 - n * 5, 6, {
      delta: 100,
      reason: 'SUBSCRIPTION_GRANT',
      eventKey: `sub-${n + 1}`,
    });
  }
  line(a, 18, 7, { delta: 20, reason: 'INVITE_REWARD', eventKey: 'invite:1:INVITER' });
  line(a, 15, 7, { delta: 5, reason: 'CHECKIN_REWARD', eventKey: 'checkin:a1:1' });
  line(a, 14, 7, { delta: 5, reason: 'CHECKIN_REWARD', eventKey: 'checkin:a1:2' });
  line(a, 13, 7, { delta: 15, reason: 'TASK_REWARD', eventKey: 'task:1' });
  line(a, 12, 7, { delta: 10, reason: 'AD_REWARD', eventKey: 'imp-1' });
  line(a, 11, 7, { delta: 10, reason: 'AD_REWARD', eventKey: 'imp-2' });
  for (let n = 0; n < 6; n++) feature(a, 22 - n * 3, 14, FEATURES[n % 2], 1 + (n % 2));
  for (let n = 0; n < 5; n++) cosmetic(a, 19 - n * 3, 16, ITEMS[n % 3]);
  look(a, 16, 18, 'task-a1');
  look(a, 9, 18, 'task-a2');
  look(a, 4, 18, 'task-a3');
  lookBack(a, 3, 19, 'task-a3');
  line(a, 8, 11, {
    delta: 100,
    reason: 'ADMIN_GRANT',
    eventKey: '5003',
    note: es[1],
  });
  line(a, 2, 11, { delta: 25, reason: 'ADMIN_GRANT', eventKey: 'legacy-1', note: th[1] });

  // The account whose balance is below zero: spent, then the purchase was refunded.
  const b = ACCOUNT.negative;
  const refundedPurchase = buy(b, 5, 9, 'APPLE', 'credits_500', 500);
  cosmetic(b, 4, 10, 'outfit_red_dress');
  feature(b, 3, 10, 'assets.avatar_max', 2);
  look(b, 2, 12, 'task-b1');
  line(b, 1, 9, {
    delta: -500,
    reason: 'REFUND',
    purchaseId: refundedPurchase,
    eventKey: 'refund-b1',
    note: ar[1],
  });

  // Deleting accounts keep their lines until the deletion is done.
  buy(ACCOUNT.pendingDeletion, 6, 9, 'GOOGLE', 'credits_100', 100);
  buy(ACCOUNT.deleting, 7, 9, 'APPLE', 'credits_100', 100);

  // Many small accounts so that the lists have pages.
  for (let n = 1; n <= 25; n++) {
    const account = bulk(n);
    const spendDay = n % 6;
    if (n === 5) {
      buy(account, spendDay + 1, 9, 'APPLE', 'credits_100', 100);
      feature(account, spendDay, 10, 'assets.voice_max'); // 80
      line(account, spendDay, 11, {
        delta: -20,
        reason: 'ADMIN_ADJUST',
        eventKey: 'adj-5',
        note: vi[1],
      });
      continue;
    }
    buy(
      account,
      (n % 20) + 1,
      9,
      n % 2 ? 'APPLE' : 'GOOGLE',
      n % 3 ? 'credits_500' : 'credits_100',
      n % 3 ? 500 : 100,
    );
    if (n % 3) {
      if (n % 2) cosmetic(account, spendDay, 12, ITEMS[n % 3]);
      else feature(account, spendDay, 12, FEATURES[n % 2]);
    }
    if (n % 7 === 0) look(account, spendDay, 13, `task-b${n}`);
    if (n % 9 === 0) {
      line(account, spendDay, 14, {
        delta: 40,
        reason: 'INVITE_REWARD',
        eventKey: `invite:${n}:INVITEE`,
        note: [idn[1], zh[1], en[1]][n % 3],
      });
    }
  }
  // One refund inside the last week on a production purchase, for the statistics.
  const lateRefund = buy(bulk(2), 3, 9, 'GOOGLE', 'credits_500', 500);
  line(bulk(2), 2, 9, {
    delta: -500,
    reason: 'REFUND',
    purchaseId: lateRefund,
    eventKey: 'refund-b2',
  });
  line(bulk(2), 1, 9, {
    delta: 500,
    reason: 'REFUND_REVERSED',
    purchaseId: lateRefund,
    eventKey: 'refund-b2-reversed',
  });
  const lateRefund2 = buy(bulk(3), 3, 10, 'APPLE', 'credits_100', 100);
  line(bulk(3), 2, 10, {
    delta: -100,
    reason: 'REFUND',
    purchaseId: lateRefund2,
    eventKey: 'refund-b3',
  });

  drafts.sort((x, y) => (x.createdAt < y.createdAt ? -1 : x.createdAt > y.createdAt ? 1 : 0));
  const ledger: MockLedger[] = drafts.map((draft, index) => ({
    id: String(1001 + index),
    ...draft,
  }));
  const ledgerIdOf = (eventKey: string, reason: string): string | null =>
    ledger.find((l) => l.eventKey === eventKey && l.reason === reason)?.id ?? null;

  const requests: MockRequest[] = [
    {
      id: '5001',
      accountId: ACCOUNT.active,
      kind: 'GRANT',
      delta: 500,
      reason: th[0],
      status: 'PENDING',
      applicantAdminId: '1003',
      reviewerAdminId: null,
      reviewNote: null,
      ledgerId: null,
      createdAt: at(1, 10),
      reviewedAt: null,
    },
    {
      id: '5002',
      accountId: ACCOUNT.negative,
      kind: 'ADJUST',
      delta: -200,
      reason: ar[0],
      status: 'PENDING',
      applicantAdminId: '1001',
      reviewerAdminId: null,
      reviewNote: null,
      ledgerId: null,
      createdAt: at(2, 10),
      reviewedAt: null,
    },
    {
      id: '5003',
      accountId: ACCOUNT.active,
      kind: 'GRANT',
      delta: 100,
      reason: idn[0],
      status: 'APPROVED',
      applicantAdminId: '1003',
      reviewerAdminId: '1001',
      reviewNote: es[0],
      ledgerId: ledgerIdOf('5003', 'ADMIN_GRANT'),
      createdAt: at(9, 9),
      reviewedAt: at(8, 11),
    },
    {
      id: '5004',
      accountId: bulk(1),
      kind: 'ADJUST',
      delta: 1000,
      reason: vi[0],
      status: 'REJECTED',
      applicantAdminId: '1001',
      reviewerAdminId: '1003',
      reviewNote: vi[2],
      ledgerId: null,
      createdAt: at(6, 9),
      reviewedAt: at(5, 15),
    },
    {
      // Submitted by an administrator that has been deleted since: the user name is null.
      id: '5005',
      accountId: ACCOUNT.pendingDeletion,
      kind: 'ADJUST',
      delta: 50,
      reason: zh[0],
      status: 'PENDING',
      applicantAdminId: '9999',
      reviewerAdminId: null,
      reviewNote: null,
      ledgerId: null,
      createdAt: at(3, 10),
      reviewedAt: null,
    },
    {
      id: '5006',
      accountId: bulk(2),
      kind: 'GRANT',
      delta: 20,
      reason: multilingualSamples.longUnbroken,
      status: 'PENDING',
      applicantAdminId: '1001',
      reviewerAdminId: null,
      reviewNote: null,
      ledgerId: null,
      createdAt: at(0, 1),
      reviewedAt: null,
    },
  ];

  const pack = (
    n: number,
    store: MockProduct['store'],
    productId: string,
    credits: number,
    sortOrder: number,
    enabled = true,
  ): MockProduct => ({
    id: String(3000 + n),
    store,
    productId,
    credits,
    enabled,
    sortOrder,
    surfaces: [],
  });
  const products = [
    pack(1, 'APPLE', 'credits_100', 100, 1),
    pack(2, 'APPLE', 'credits_500', 500, 2),
    pack(3, 'APPLE', 'credits_1200', 1200, 3, false),
    pack(4, 'GOOGLE', 'credits_100', 100, 1),
    pack(5, 'GOOGLE', 'credits_500', 500, 2),
    pack(6, 'GOOGLE', 'credits_1200', 1200, 3),
  ];

  return {
    accounts,
    ledger,
    purchases,
    requests,
    products,
    next: { ledger: 1001 + ledger.length, request: 5007, product: 3007 },
  };
}

type Holder = { __avatarAdminMockCredits?: CreditsState };
const holder = globalThis as Holder;
holder.__avatarAdminMockCredits ??= seed(new Date());

/** The state itself: handlers and tests read and change it in place. */
export const creditsState: CreditsState = holder.__avatarAdminMockCredits;

/** Puts the sample data back (in place, so every importer keeps seeing the same object). */
export function resetCreditsStore(now: Date = new Date()): void {
  Object.assign(creditsState, seed(now));
}

export const findAccount = (accountId: string): MockAccount | undefined =>
  creditsState.accounts.find((account) => account.id === accountId);

/** What the credit account of `accountId` holds, or null when it has no line yet (no `CreditBalance` row). */
export function balanceOf(accountId: string): {
  accountId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  updatedAt: string;
} | null {
  let found = false;
  let totalEarned = 0;
  let totalSpent = 0;
  let updatedAt = '';
  for (const entry of creditsState.ledger) {
    if (entry.accountId !== accountId) continue;
    found = true;
    if (entry.delta > 0) totalEarned += entry.delta;
    else totalSpent -= entry.delta;
    if (entry.createdAt > updatedAt) updatedAt = entry.createdAt;
  }
  return found
    ? { accountId, balance: totalEarned - totalSpent, totalEarned, totalSpent, updatedAt }
    : null;
}

export const nextLedgerId = (): string => String(creditsState.next.ledger++);
export const nextRequestId = (): string => String(creditsState.next.request++);
export const nextProductId = (): string => String(creditsState.next.product++);
