import { beforeEach, describe, expect, it } from 'vitest';
import { ACCOUNT, creditsState, resetCreditsStore } from './_core/creditsData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import credits from './credits.mock';

beforeEach(() => {
  resetStore();
  resetCreditsStore();
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (credits as unknown as Record<string, H>)[name];
const token = (user: string) => bearer(issueToken(adminOf(user)).token).authorization;

const get = (name: string, user: string, query: Record<string, unknown> = {}, params = {}) =>
  call(h(name), { headers: { authorization: token(user) }, query, params });
const send = (name: string, user: string, body: unknown, params = {}) =>
  call(h(name), { headers: { authorization: token(user) }, body, params });

const REQUESTS = 'GET /api/admin/credit-adjust-requests';
const CREATE = 'POST /api/admin/credit-adjust-requests';
const APPROVE = 'POST /api/admin/credit-adjust-requests/:id/approve';
const REJECT = 'POST /api/admin/credit-adjust-requests/:id/reject';
const ACCOUNTS = 'GET /api/admin/credits/accounts';
const TRANSACTIONS = 'GET /api/admin/credits/transactions';
const STATS = 'GET /api/admin/credits/stats';
const ACCOUNT_CREDITS = 'GET /api/admin/accounts/:id/credits';
const PRODUCTS = 'GET /api/admin/credit-products';

const pendingOf = (applicant: string) =>
  creditsState.requests.find((r) => r.status === 'PENDING' && r.applicantAdminId === applicant);

describe('permissions (contract 17.4, credit row)', () => {
  const cases: [string, string, string][] = [
    [REQUESTS, 'reviewer', 'SUBSCRIPTION:VIEW'],
    [ACCOUNTS, 'reviewer', 'SUBSCRIPTION:VIEW'],
    [TRANSACTIONS, 'reviewer', 'SUBSCRIPTION:VIEW'],
    [ACCOUNT_CREDITS, 'reviewer', 'SUBSCRIPTION:VIEW'],
    [STATS, 'support', 'FINANCE:VIEW'],
    [PRODUCTS, 'support', 'SUBSCRIPTION:CONFIG'],
  ];
  it.each(cases)('%s answers 403 ADMIN_FORBIDDEN for %s, who lacks %s', async (name, user) => {
    const { status, body } = await get(name, user, {}, { id: ACCOUNT.active });
    expect(status).toBe(403);
    expect(body.code).toBe('ADMIN_FORBIDDEN');
  });

  it('answers 401 without a token on every endpoint', async () => {
    for (const name of Object.keys(credits)) {
      const { status } = await call(h(name), { params: { id: '1' } });
      expect(status, name).toBe(401);
    }
  });

  it('lets only SUBSCRIPTION:GRANT create a request and only CREDIT:REVIEW approve or reject', async () => {
    const body = { accountId: ACCOUNT.active, kind: 'GRANT', delta: 5, reason: 'x' };
    expect((await send(CREATE, 'reviewer', body)).status).toBe(403);
    expect((await send(CREATE, 'finance', body)).status).toBe(200);
    const pending = pendingOf('1001') as { id: string };
    expect((await send(APPROVE, 'support', {}, { id: pending.id })).status).toBe(403);
    expect((await send(REJECT, 'support', { note: 'n' }, { id: pending.id })).status).toBe(403);
  });
});

describe('GET /credit-adjust-requests', () => {
  it('lists newest first with the usernames, and null for an administrator that no longer exists', async () => {
    const { status, body } = await get(REQUESTS, 'finance');
    expect(status).toBe(200);
    const rows = body.data.items;
    expect(body.data.total).toBe(rows.length);
    const times = rows.map((r: { createdAt: string }) => r.createdAt);
    expect(times).toEqual([...times].sort().reverse());
    expect(rows[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        accountId: expect.any(String),
        kind: expect.stringMatching(/^(GRANT|ADJUST)$/),
        delta: expect.any(Number),
        reason: expect.any(String),
        status: expect.any(String),
        applicantAdminId: expect.any(String),
        applicantUsername: expect.anything(),
      }),
    );
    expect(rows.some((r: { applicantUsername: unknown }) => r.applicantUsername === null)).toBe(
      true,
    );
    const done = rows.find((r: { status: string }) => r.status === 'APPROVED');
    expect(done.reviewerUsername).toBe('root');
    expect(done.ledgerId).toEqual(expect.any(String));
    const waiting = rows.find((r: { status: string }) => r.status === 'PENDING');
    expect(waiting).toMatchObject({
      reviewerAdminId: null,
      reviewerUsername: null,
      reviewNote: null,
      ledgerId: null,
      reviewedAt: null,
    });
  });

  it('filters by status and by the exact account id, not by part of it', async () => {
    const pending = (await get(REQUESTS, 'finance', { status: 'PENDING' })).body.data.items;
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((r: { status: string }) => r.status === 'PENDING')).toBe(true);
    const exact = (await get(REQUESTS, 'finance', { accountId: ACCOUNT.negative })).body.data.items;
    expect(exact.length).toBeGreaterThan(0);
    expect(exact.every((r: { accountId: string }) => r.accountId === ACCOUNT.negative)).toBe(true);
    const part = ACCOUNT.negative.slice(0, 20);
    expect((await get(REQUESTS, 'finance', { accountId: part })).body.data.items).toEqual([]);
  });

  it('refuses a status that does not exist and paging outside the limits', async () => {
    const bad = await get(REQUESTS, 'finance', { status: 'DONE' });
    expect(bad.status).toBe(400);
    expect(bad.body.data.details).toEqual([{ ref: 'status', reason: 'OUT_OF_RANGE' }]);
    const paging = await get(REQUESTS, 'finance', { page: '0', pageSize: '500' });
    expect(paging.body.data.details.map((d: { ref: string }) => d.ref)).toEqual([
      'page',
      'pageSize',
    ]);
  });
});

describe('POST /credit-adjust-requests', () => {
  const create = (over: Record<string, unknown> = {}) =>
    send(CREATE, 'finance', {
      accountId: ACCOUNT.active,
      kind: 'GRANT',
      delta: 100,
      reason: 'Compensation',
      ...over,
    });

  it('creates a pending request that shows up in the list, with the applicant, and answers only { id }', async () => {
    const { status, body } = await create();
    expect(status).toBe(200);
    expect(body.data).toEqual({ id: expect.any(String) });
    const list = (await get(REQUESTS, 'finance', { accountId: ACCOUNT.active })).body.data.items;
    expect(list[0].id).toBe(body.data.id);
    expect(list[0]).toMatchObject({
      status: 'PENDING',
      kind: 'GRANT',
      delta: 100,
      applicantAdminId: '1003',
      applicantUsername: 'finance',
    });
  });

  it('needs a positive delta for GRANT, any whole number but zero for ADJUST', async () => {
    for (const delta of [0, -5, 1.5, '7']) {
      const { status, body } = await create({ delta });
      expect(status, String(delta)).toBe(400);
      expect(body.data.details[0].ref).toBe('delta');
    }
    expect((await create({ kind: 'ADJUST', delta: -30 })).status).toBe(200);
    expect((await create({ kind: 'ADJUST', delta: 30 })).status).toBe(200);
    expect((await create({ kind: 'ADJUST', delta: 0 })).status).toBe(400);
  });

  it('keeps the size of delta within 1,000,000,000 in either direction (OUT_OF_RANGE on delta), and takes the limit itself', async () => {
    for (const [kind, delta] of [
      ['GRANT', 1_000_000_001],
      ['ADJUST', 1_000_000_001],
      ['ADJUST', -1_000_000_001],
      ['GRANT', 1e15],
    ] as const) {
      const { status, body } = await create({ kind, delta });
      expect(status, `${kind} ${delta}`).toBe(400);
      expect(body.data.details, `${kind} ${delta}`).toEqual([
        { ref: 'delta', reason: 'OUT_OF_RANGE' },
      ]);
    }
    expect((await create({ kind: 'GRANT', delta: 1_000_000_000 })).status).toBe(200);
    expect((await create({ kind: 'ADJUST', delta: -1_000_000_000 })).status).toBe(200);
  });

  it('wants kind, and a note only for a rejection: an approval takes none, a rejection needs one of 1 to 500 code points', async () => {
    const mine = pendingOf('1003') as { id: string };
    const long = 'x'.repeat(501);
    expect(
      (await send(APPROVE, 'root', { note: long }, { id: mine.id })).body.data.details[0],
    ).toEqual({ ref: 'note', reason: 'TOO_LONG' });
    const missing = await send(REJECT, 'root', {}, { id: mine.id });
    expect(missing.status).toBe(400);
    expect(missing.body.data.details[0]).toEqual({ ref: 'note', reason: 'EMPTY_NOT_ALLOWED' });
    expect(
      (await send(REJECT, 'root', { note: long }, { id: mine.id })).body.data.details[0],
    ).toEqual({ ref: 'note', reason: 'TOO_LONG' });
    expect((await send(APPROVE, 'root', {}, { id: mine.id })).status).toBe(200);
  });

  it('needs a kind, an account id and a reason (trimmed, 1 to 500 code points)', async () => {
    const refs = async (over: Record<string, unknown>) =>
      (await create(over)).body.data.details.map((d: { ref: string }) => d.ref);
    expect(await refs({ kind: 'GIFT' })).toEqual(['kind']);
    expect(await refs({ reason: '   ' })).toEqual(['reason']);
    expect(await refs({ reason: 'a'.repeat(501) })).toEqual(['reason']);
    expect(await refs({ accountId: '' })).toEqual(['accountId']);
    expect((await create({ reason: '\u{1F600}'.repeat(500) })).status).toBe(200);
  });

  it('answers 404 for an account that does not exist, 403 for one that is being deleted', async () => {
    expect((await create({ accountId: 'no-such-account' })).body.code).toBe('RESOURCE_NOT_FOUND');
    const scheduled = await create({ accountId: ACCOUNT.pendingDeletion });
    expect(scheduled.status).toBe(403);
    expect(scheduled.body.code).toBe('ACCOUNT_DELETION_SCHEDULED');
    expect((await create({ accountId: ACCOUNT.deleting })).body.code).toBe('ACCOUNT_DELETING');
  });
});

describe('approve and reject', () => {
  it('approves: one ledger line with the request id as event key, the balance moves, the request is linked to it', async () => {
    const before = (await get(ACCOUNT_CREDITS, 'finance', {}, { id: ACCOUNT.active })).body.data;
    const request = pendingOf('1003') as { id: string; accountId: string; delta: number };
    expect(request.accountId).toBe(ACCOUNT.active);
    const { status, body } = await send(APPROVE, 'root', { note: 'Checked' }, { id: request.id });
    expect(status).toBe(200);
    expect(body.data).toMatchObject({
      status: 'APPROVED',
      reviewerAdminId: '1001',
      reviewerUsername: 'root',
      reviewNote: 'Checked',
      ledgerId: expect.any(String),
    });
    const after = (await get(ACCOUNT_CREDITS, 'finance', {}, { id: ACCOUNT.active })).body.data;
    expect(after.balance).toBe(before.balance + request.delta);
    expect(after.totalEarned).toBe(before.totalEarned + request.delta);
    expect(after.items[0]).toMatchObject({
      id: body.data.ledgerId,
      delta: request.delta,
      reason: 'ADMIN_GRANT',
      eventKey: request.id,
    });
  });

  it('writes ADMIN_ADJUST for an adjustment and lets a negative delta take the balance below zero', async () => {
    const request = pendingOf('1001') as { id: string; accountId: string; delta: number };
    expect(request.delta).toBeLessThan(0);
    const before = (await get(ACCOUNT_CREDITS, 'finance', {}, { id: request.accountId })).body.data;
    await send(APPROVE, 'finance', {}, { id: request.id });
    const after = (await get(ACCOUNT_CREDITS, 'finance', {}, { id: request.accountId })).body.data;
    expect(after.items[0].reason).toBe('ADMIN_ADJUST');
    expect(after.balance).toBe(before.balance + request.delta);
    expect(after.balance).toBeLessThan(0);
    expect(after.totalSpent).toBe(before.totalSpent - request.delta);
  });

  it('refuses the applicant reviewing their own request with 403 SELF_REVIEW_FORBIDDEN, for approve and reject', async () => {
    const request = pendingOf('1003') as { id: string };
    const approve = await send(APPROVE, 'finance', {}, { id: request.id });
    expect(approve.status).toBe(403);
    expect(approve.body.code).toBe('SELF_REVIEW_FORBIDDEN');
    const reject = await send(REJECT, 'finance', { note: 'no' }, { id: request.id });
    expect(reject.body.code).toBe('SELF_REVIEW_FORBIDDEN');
    expect(creditsState.requests.find((r) => r.id === request.id)?.status).toBe('PENDING');
  });

  it('answers 409 INVALID_STATE with the current status for a second review, and writes no second ledger line', async () => {
    const request = pendingOf('1003') as { id: string; accountId: string };
    await send(APPROVE, 'root', {}, { id: request.id });
    const lines = creditsState.ledger.length;
    const again = await send(APPROVE, 'root', {}, { id: request.id });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('INVALID_STATE');
    expect(again.body.data).toMatchObject({ status: 'APPROVED' });
    expect((await send(REJECT, 'root', { note: 'late' }, { id: request.id })).status).toBe(409);
    expect(creditsState.ledger).toHaveLength(lines);
  });

  it('answers 404 for a request that does not exist', async () => {
    expect((await send(APPROVE, 'root', {}, { id: 'nope' })).body.code).toBe('RESOURCE_NOT_FOUND');
    expect((await send(REJECT, 'root', { note: 'x' }, { id: 'nope' })).status).toBe(404);
  });

  it('refuses to approve for an account that is being deleted, and the request stays pending', async () => {
    const request = creditsState.requests.find(
      (r) => r.status === 'PENDING' && r.accountId === ACCOUNT.pendingDeletion,
    ) as { id: string };
    const { status, body } = await send(APPROVE, 'root', {}, { id: request.id });
    expect(status).toBe(403);
    expect(body.code).toBe('ACCOUNT_DELETION_SCHEDULED');
    expect(creditsState.requests.find((r) => r.id === request.id)?.status).toBe('PENDING');
  });

  it('rejects with a note that is required (trimmed, at least one code point) and writes no ledger line', async () => {
    const request = pendingOf('1003') as { id: string };
    const lines = creditsState.ledger.length;
    for (const note of [undefined, '', `  ${String.fromCharCode(0x3000)} `]) {
      const { status, body } = await send(REJECT, 'root', { note }, { id: request.id });
      expect(status).toBe(400);
      expect(body.data.details).toEqual([{ ref: 'note', reason: 'EMPTY_NOT_ALLOWED' }]);
    }
    const done = await send(REJECT, 'root', { note: ' Not needed ' }, { id: request.id });
    expect(done.body.data).toMatchObject({
      status: 'REJECTED',
      reviewNote: 'Not needed',
      ledgerId: null,
    });
    expect(creditsState.ledger).toHaveLength(lines);
  });

  it('takes an approval note that is optional, and keeps it null when it is empty', async () => {
    const request = pendingOf('1003') as { id: string };
    const { body } = await send(APPROVE, 'root', { note: '  ' }, { id: request.id });
    expect(body.data.reviewNote).toBeNull();
  });
});

describe('GET /credits/accounts', () => {
  it('lists the accounts that have a credit account, newest update first, with the three totals that add up', async () => {
    const { body } = await get(ACCOUNTS, 'finance', { pageSize: '200' });
    const rows = body.data.items as {
      accountId: string;
      balance: number;
      totalEarned: number;
      totalSpent: number;
      updatedAt: string;
    }[];
    expect(rows.length).toBe(body.data.total);
    for (const row of rows) expect(row.balance).toBe(row.totalEarned - row.totalSpent);
    const times = rows.map((r) => r.updatedAt);
    expect(times).toEqual([...times].sort().reverse());
    expect(rows.map((r) => r.accountId)).not.toContain(ACCOUNT.none);
    expect(rows.find((r) => r.accountId === ACCOUNT.negative)?.balance).toBeLessThan(0);
  });

  it('matches the account id exactly and filters by balance from one end or both', async () => {
    const one = (await get(ACCOUNTS, 'finance', { accountId: ACCOUNT.active })).body.data;
    expect(one.items.map((r: { accountId: string }) => r.accountId)).toEqual([ACCOUNT.active]);
    expect(
      (await get(ACCOUNTS, 'finance', { accountId: ACCOUNT.active.slice(0, 30) })).body.data.items,
    ).toEqual([]);
    const negative = (await get(ACCOUNTS, 'finance', { balanceMax: '-1' })).body.data.items;
    expect(negative.map((r: { accountId: string }) => r.accountId)).toEqual([ACCOUNT.negative]);
    const middle = (await get(ACCOUNTS, 'finance', { balanceMin: '0', balanceMax: '0' })).body.data;
    expect(middle.items.every((r: { balance: number }) => r.balance === 0)).toBe(true);
    const bad = await get(ACCOUNTS, 'finance', { balanceMin: 'abc' });
    expect(bad.body.data.details).toEqual([{ ref: 'balanceMin', reason: 'NOT_AN_INTEGER' }]);
  });
});

describe('GET /credits/transactions', () => {
  const rowsOf = async (query: Record<string, unknown>) =>
    (await get(TRANSACTIONS, 'finance', { pageSize: '200', ...query })).body.data.items as {
      id: string;
      accountId: string;
      delta: number;
      reason: string;
      spendKind: string | null;
      createdAt: string;
    }[];

  it('lists every account, newest id first, with the columns of the contract', async () => {
    const rows = await rowsOf({});
    const ids = rows.map((r) => Number(r.id));
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
    expect(Object.keys(rows[0]).sort()).toEqual(
      [
        'id',
        'accountId',
        'delta',
        'reason',
        'spendKind',
        'featureKey',
        'itemKey',
        'quantity',
        'eventKey',
        'note',
        'createdAt',
      ].sort(),
    );
    expect(new Set(rows.map((r) => r.reason)).size).toBeGreaterThanOrEqual(8);
  });

  it('type=earn gives only positive changes and type=spend only negative ones', async () => {
    const earn = await rowsOf({ type: 'earn' });
    const spend = await rowsOf({ type: 'spend' });
    expect(earn.length).toBeGreaterThan(0);
    expect(spend.length).toBeGreaterThan(0);
    expect(earn.every((r) => r.delta > 0)).toBe(true);
    expect(spend.every((r) => r.delta < 0)).toBe(true);
    expect((await get(TRANSACTIONS, 'finance', { type: 'all' })).status).toBe(400);
  });

  it('filters by exact account id, by reason, and by time as [from, to)', async () => {
    const mine = await rowsOf({ accountId: ACCOUNT.active });
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((r) => r.accountId === ACCOUNT.active)).toBe(true);
    expect(await rowsOf({ accountId: ACCOUNT.active.slice(0, 30) })).toEqual([]);
    const purchases = await rowsOf({ reason: 'PURCHASE' });
    expect(purchases.length).toBeGreaterThan(0);
    expect(purchases.every((r) => r.reason === 'PURCHASE')).toBe(true);
    const all = await rowsOf({});
    const at = all[Math.floor(all.length / 2)].createdAt;
    expect((await rowsOf({ from: at })).every((r) => r.createdAt >= at)).toBe(true);
    const before = await rowsOf({ to: at });
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((r) => r.createdAt < at)).toBe(true);
    expect((await get(TRANSACTIONS, 'finance', { reason: 'GIFT' })).status).toBe(400);
    expect((await get(TRANSACTIONS, 'finance', { from: 'yesterday' })).status).toBe(400);
  });
});

describe('GET /accounts/:id/credits', () => {
  it('gives the balance, the two totals and one page of the ledger, newest id first, without the idempotency key', async () => {
    const { status, body } = await get(
      ACCOUNT_CREDITS,
      'finance',
      { page: '1', pageSize: '3' },
      { id: ACCOUNT.active },
    );
    expect(status).toBe(200);
    const data = body.data;
    expect(data.balance).toBe(data.totalEarned - data.totalSpent);
    expect(data.items).toHaveLength(3);
    expect(data.total).toBeGreaterThan(3);
    const ids = data.items.map((r: { id: string }) => Number(r.id));
    expect(ids).toEqual([...ids].sort((a: number, b: number) => b - a));
    expect(Object.keys(data.items[0]).sort()).toEqual(
      [
        'id',
        'delta',
        'reason',
        'purchaseId',
        'eventKey',
        'spendKind',
        'featureKey',
        'itemKey',
        'quantity',
        'note',
        'createdAt',
      ].sort(),
    );
    const second = (
      await get(ACCOUNT_CREDITS, 'finance', { page: '2', pageSize: '3' }, { id: ACCOUNT.active })
    ).body.data;
    expect(second.items[0].id).not.toBe(data.items[0].id);
  });

  it('gives zeros and an empty ledger, not a 404, for an account that has no credit account', async () => {
    const { status, body } = await get(ACCOUNT_CREDITS, 'finance', {}, { id: ACCOUNT.none });
    expect(status).toBe(200);
    expect(body.data).toEqual({ balance: 0, totalEarned: 0, totalSpent: 0, items: [], total: 0 });
  });

  it('answers 404 for an account that does not exist', async () => {
    expect((await get(ACCOUNT_CREDITS, 'finance', {}, { id: 'nope' })).body.code).toBe(
      'RESOURCE_NOT_FOUND',
    );
  });
});

describe('GET /credits/stats', () => {
  const stats = async (query: Record<string, unknown> = {}) =>
    (await get(STATS, 'finance', query)).body.data as {
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

  // The sample data reaches back about 25 days; the longest range the backend accepts is 366 days.
  const wide = () => {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 300 * 86400000).toISOString().slice(0, 10);
    return { from, to };
  };

  it('splits spending by spend kind, features by feature key and cosmetics by item key', async () => {
    const data = await stats(wide());
    const kinds = new Set(data.spent.map((r) => r.spendKind));
    expect(kinds).toEqual(new Set(['FEATURE', 'COSMETIC', 'LOOK']));
    for (const row of data.spent) {
      if (row.spendKind === 'FEATURE') expect(row.featureKey).toEqual(expect.any(String));
      if (row.spendKind === 'COSMETIC') expect(row.itemKey).toEqual(expect.any(String));
      if (row.spendKind === 'LOOK') expect([row.featureKey, row.itemKey]).toEqual([null, null]);
    }
  });

  it('counts the spending as the spent lines minus the reversals, and leaves out sandbox purchases', async () => {
    const data = await stats(wide());
    const look = data.spent.find((r) => r.spendKind === 'LOOK');
    const lines = creditsState.ledger.filter((l) => l.spendKind === 'LOOK');
    const spent = lines.filter((l) => l.reason === 'SPEND');
    const reversed = lines.filter((l) => l.reason === 'SPEND_REVERSED');
    expect(reversed.length).toBeGreaterThan(0);
    expect(look?.count).toBe(spent.length - reversed.length);
    expect(look?.credits).toBe(
      spent.reduce((n, l) => n - l.delta, 0) - reversed.reduce((n, l) => n + l.delta, 0),
    );
    const sandbox = creditsState.purchases.filter((p) => p.environment === 'SANDBOX');
    expect(sandbox.length).toBeGreaterThan(0);
    const production = creditsState.ledger.filter(
      (l) =>
        l.reason === 'PURCHASE' &&
        creditsState.purchases.find((p) => p.id === l.purchaseId)?.environment === 'PRODUCTION',
    );
    expect(data.purchases.reduce((n, r) => n + r.packs, 0)).toBe(production.length);
    expect(data.purchases.reduce((n, r) => n + r.credits, 0)).toBe(
      production.reduce((n, l) => n + l.delta, 0),
    );
    expect(data.refunded.every((r) => r.credits > 0)).toBe(true);
  });

  it('counts a UTC day from its first to its last instant, and answers 400 for a wrong range', async () => {
    const none = await stats({ from: '2000-01-01', to: '2000-01-02' });
    expect(none).toEqual({ purchases: [], refunded: [], spent: [] });
    const reversed = await get(STATS, 'finance', { from: '2026-02-02', to: '2026-02-01' });
    expect(reversed.status).toBe(400);
    expect(reversed.body.data.details[0].ref).toBe('from');
  });
});

describe('credit packs (backend reply 30)', () => {
  const PRODUCT_LIST = 'GET /api/admin/credit-products';
  const PRODUCT_CREATE = 'POST /api/admin/credit-products';
  const PRODUCT_UPDATE = 'PUT /api/admin/credit-products';
  const full = (over: Record<string, unknown> = {}) => ({
    store: 'GOOGLE',
    productId: 'credits_3000',
    credits: 3000,
    enabled: true,
    sortOrder: 9,
    surfaces: [],
    ...over,
  });

  it('has no PUT with an id in the path', () => {
    expect(Object.keys(credits)).not.toContain('PUT /api/admin/credit-products/:id');
  });

  it('lists the six columns and no id, no total, on sale or not, by sortOrder, store, productId', async () => {
    const { body } = await get(PRODUCT_LIST, 'finance');
    const rows = body.data.items;
    expect(Object.keys(body.data)).toEqual(['items']);
    expect(Object.keys(rows[0]).sort()).toEqual([
      'credits',
      'enabled',
      'productId',
      'sortOrder',
      'store',
      'surfaces',
    ]);
    expect(new Set(rows.map((r: { store: string }) => r.store))).toEqual(
      new Set(['APPLE', 'GOOGLE']),
    );
    expect(rows.some((r: { enabled: boolean }) => !r.enabled)).toBe(true);
    const keys = rows.map(
      (r: { sortOrder: number; store: string; productId: string }) =>
        `${String(r.sortOrder).padStart(6, '0')}|${r.store}|${r.productId}`,
    );
    expect(keys).toEqual([...keys].sort());
  });

  it('creates a pack and answers { store, productId }; the same store and product again is 409 DUPLICATE_RESOURCE with field productId', async () => {
    const first = await send(PRODUCT_CREATE, 'finance', full());
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({ store: 'GOOGLE', productId: 'credits_3000' });
    const listed = (await get(PRODUCT_LIST, 'finance')).body.data.items;
    expect(listed.find((r: { productId: string }) => r.productId === 'credits_3000')).toEqual(
      full(),
    );
    const again = await send(PRODUCT_CREATE, 'finance', full());
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('DUPLICATE_RESOURCE');
    expect(again.body.data).toEqual({ field: 'productId' });
    expect((await send(PRODUCT_CREATE, 'finance', full({ store: 'APPLE' }))).status).toBe(200);
  });

  it('checks the fields: store [A-Z][A-Z0-9_]{1,31}, productId 1 to 255 code points, credits 1 to 1000000000, surfaces required', async () => {
    const refs = async (over: Record<string, unknown>) =>
      (await send(PRODUCT_CREATE, 'finance', full(over))).body.data.details.map(
        (d: { ref: string }) => d.ref,
      );
    expect(await refs({ store: 'apple' })).toEqual(['store']);
    expect(await refs({ store: 'A' })).toEqual(['store']);
    expect(await refs({ productId: '  ' })).toEqual(['productId']);
    expect(await refs({ productId: 'p'.repeat(256) })).toEqual(['productId']);
    expect(await refs({ credits: 0 })).toEqual(['credits']);
    expect(await refs({ credits: 1_000_000_001 })).toEqual(['credits']);
    expect(await refs({ credits: 1.5 })).toEqual(['credits']);
    expect(await refs({ sortOrder: 'a' })).toEqual(['sortOrder']);
    expect(await refs({ enabled: 'yes' })).toEqual(['enabled']);
    expect(await refs({ surfaces: null })).toEqual(['surfaces']);
    const none = full();
    delete (none as Partial<typeof none>).surfaces;
    const missing = await send(PRODUCT_CREATE, 'finance', none);
    expect(missing.body.data.details).toEqual([{ ref: 'surfaces', reason: 'EMPTY_NOT_ALLOWED' }]);
    // a store other than the two of today is fine
    expect((await send(PRODUCT_CREATE, 'finance', full({ store: 'HUAWEI_2' }))).status).toBe(200);
  });

  it('updates by (store, productId) from the body and answers data null; 404 for a pack that does not exist', async () => {
    const row = (await get(PRODUCT_LIST, 'finance')).body.data.items[0];
    const surfaces = [{ platform: 'IOS', channel: null }];
    const { status, body } = await send(PRODUCT_UPDATE, 'finance', {
      ...row,
      credits: 777,
      enabled: !row.enabled,
      sortOrder: 42,
      surfaces,
    });
    expect(status).toBe(200);
    expect(body.data).toBeNull();
    const after = (await get(PRODUCT_LIST, 'finance')).body.data.items.find(
      (r: { store: string; productId: string }) =>
        r.store === row.store && r.productId === row.productId,
    );
    expect(after).toEqual({
      store: row.store,
      productId: row.productId,
      credits: 777,
      enabled: !row.enabled,
      sortOrder: 42,
      surfaces,
    });
    const gone = await send(PRODUCT_UPDATE, 'finance', full({ productId: 'nope' }));
    expect(gone.status).toBe(404);
    expect(gone.body.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('does not keep or clear the surfaces when they are left out of an update: it is 400, nothing changes', async () => {
    const row = (await get(PRODUCT_LIST, 'finance')).body.data.items[0];
    await send(PRODUCT_UPDATE, 'finance', {
      ...row,
      surfaces: [{ platform: 'IOS', channel: null }],
    });
    const { surfaces: _drop, ...without } = row;
    const refused = await send(PRODUCT_UPDATE, 'finance', { ...without, credits: 5 });
    expect(refused.status).toBe(400);
    expect(refused.body.data.details).toEqual([{ ref: 'surfaces', reason: 'EMPTY_NOT_ALLOWED' }]);
    const after = (await get(PRODUCT_LIST, 'finance')).body.data.items.find(
      (r: { store: string; productId: string }) =>
        r.store === row.store && r.productId === row.productId,
    );
    expect(after.credits).toBe(row.credits);
    expect(after.surfaces).toEqual([{ platform: 'IOS', channel: null }]);
  });
});

describe('the sample data', () => {
  it('holds all seven languages in the notes and reasons, and a long string without spaces', () => {
    const text = [
      ...creditsState.ledger.map((l) => l.note ?? ''),
      ...creditsState.requests.map((r) => `${r.reason} ${r.reviewNote ?? ''}`),
    ].join('\n');
    expect(text).toMatch(/\p{Script=Thai}/u); // Thai
    expect(text).toMatch(/\p{Script=Arabic}/u); // Arabic
    expect(text).toMatch(/Terima kasih|Halo/); // Indonesian
    expect(text).toMatch(/[ạảãấầẩẫậắằ]|Cảm ơn/); // Vietnamese
    expect(text).toMatch(/Muchas gracias|¿/); // Spanish
    expect(text).toMatch(/Thank you|Hello/); // English
    expect(text).toMatch(/\p{Script=Han}/u); // Chinese
    expect(text).toMatch(/A{200,}/);
  });

  it('keeps the balance equal to the sum of the ledger for every account', () => {
    const sums = new Map<string, number>();
    for (const line of creditsState.ledger)
      sums.set(line.accountId, (sums.get(line.accountId) ?? 0) + line.delta);
    expect(sums.size).toBeGreaterThan(20);
    expect(sums.has(ACCOUNT.none)).toBe(false);
  });
});
