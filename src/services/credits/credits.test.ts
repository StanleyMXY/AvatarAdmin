import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { resetSessionState, setToken } from '../../request/session';
import {
  approveAdjustRequest,
  createAdjustRequest,
  createCreditProduct,
  getAccountCredits,
  getCreditStats,
  listAdjustRequests,
  listAllCreditProducts,
  listCreditAccounts,
  listCreditProducts,
  listCreditTransactions,
  rejectAdjustRequest,
  updateCreditProduct,
} from './index';

beforeEach(() => {
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
});
afterEach(() => vi.unstubAllGlobals());

const answer = (data: unknown) => stubFetch(() => jsonResponse(200, envelope('200', data)));
const body = (call: { init: RequestInit }) => JSON.parse(call.init.body as string);

describe('credit adjustment requests', () => {
  it('lists with the paging and the two filters, and leaves empty filters out', async () => {
    const calls = answer({ items: [], total: 0 });
    await listAdjustRequests({ page: 2, pageSize: 50, status: 'PENDING', accountId: 'abc' });
    expect(calls[0].url).toBe(
      '/api/admin/credit-adjust-requests?page=2&pageSize=50&status=PENDING&accountId=abc',
    );
    await listAdjustRequests({ page: 1, pageSize: 20 });
    expect(calls[1].url).toBe('/api/admin/credit-adjust-requests?page=1&pageSize=20');
  });

  it('creates with exactly the four fields of the contract', async () => {
    const calls = answer({ id: '1' });
    await createAdjustRequest({ accountId: 'a1', kind: 'ADJUST', delta: -30, reason: 'Fix' });
    expect(calls[0].url).toBe('/api/admin/credit-adjust-requests');
    expect(calls[0].init.method).toBe('POST');
    expect(body(calls[0])).toEqual({ accountId: 'a1', kind: 'ADJUST', delta: -30, reason: 'Fix' });
  });

  it('approves with the note when there is one and without a body field when there is none', async () => {
    const calls = answer({ id: '9' });
    await approveAdjustRequest('9', 'Checked');
    expect(calls[0].url).toBe('/api/admin/credit-adjust-requests/9/approve');
    expect(body(calls[0])).toEqual({ note: 'Checked' });
    await approveAdjustRequest('9');
    expect(body(calls[1])).toEqual({});
    await approveAdjustRequest('9', '');
    expect(body(calls[2])).toEqual({});
  });

  it('rejects with the note, and writes the id into the path safely', async () => {
    const calls = answer({ id: '9' });
    await rejectAdjustRequest('a/b', 'Not needed');
    expect(calls[0].url).toBe('/api/admin/credit-adjust-requests/a%2Fb/reject');
    expect(body(calls[0])).toEqual({ note: 'Not needed' });
  });

  it('lets a refusal of the backend through with its code and data', async () => {
    stubFetch(() => jsonResponse(403, envelope('SELF_REVIEW_FORBIDDEN')));
    await expect(approveAdjustRequest('9')).rejects.toMatchObject({
      code: 'SELF_REVIEW_FORBIDDEN',
      httpStatus: 403,
    });
  });
});

describe('credit accounts, transactions and statistics', () => {
  it('lists accounts with the account id as typed and the balance range', async () => {
    const calls = answer({ items: [], total: 0 });
    await listCreditAccounts({
      page: 1,
      pageSize: 20,
      accountId: ' ab c ',
      balanceMin: -5,
      balanceMax: 0,
    });
    expect(calls[0].url).toBe(
      '/api/admin/credits/accounts?page=1&pageSize=20&accountId=+ab+c+&balanceMin=-5&balanceMax=0',
    );
  });

  it('keeps a balance bound of 0, which is a real bound', async () => {
    const calls = answer({ items: [], total: 0 });
    await listCreditAccounts({ page: 1, pageSize: 20, balanceMin: 0 });
    expect(calls[0].url).toContain('balanceMin=0');
    expect(calls[0].url).not.toContain('balanceMax');
  });

  it('lists transactions with type, reason and time as given', async () => {
    const calls = answer({ items: [], total: 0 });
    await listCreditTransactions({
      page: 3,
      pageSize: 10,
      accountId: 'a1',
      reason: 'PURCHASE',
      type: 'earn',
      from: '2026-10-01T00:00:00Z',
      to: '2026-10-08T00:00:00Z',
    });
    const url = new URL(calls[0].url, 'http://x');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '3',
      pageSize: '10',
      accountId: 'a1',
      reason: 'PURCHASE',
      type: 'earn',
      from: '2026-10-01T00:00:00Z',
      to: '2026-10-08T00:00:00Z',
    });
  });

  it('asks for the statistics of a UTC day range', async () => {
    const calls = answer({ purchases: [], refunded: [], spent: [] });
    const result = await getCreditStats('2026-10-01', '2026-10-07');
    expect(calls[0].url).toBe('/api/admin/credits/stats?from=2026-10-01&to=2026-10-07');
    expect(result).toEqual({ purchases: [], refunded: [], spent: [] });
  });

  it('reads the credit account of one account with the paging', async () => {
    const calls = answer({ balance: 0, totalEarned: 0, totalSpent: 0, items: [], total: 0 });
    const result = await getAccountCredits('acc/1', { page: 2, pageSize: 20 });
    expect(calls[0].url).toBe('/api/admin/accounts/acc%2F1/credits?page=2&pageSize=20');
    expect(result).toEqual({ balance: 0, totalEarned: 0, totalSpent: 0, items: [], total: 0 });
  });
});

describe('credit packs', () => {
  it('lists, creates and updates', async () => {
    const calls = answer({ items: [] });
    await listCreditProducts();
    expect(calls[0].url).toBe('/api/admin/credit-products');
    await createCreditProduct({
      store: 'GOOGLE',
      productId: 'p1',
      credits: 100,
      enabled: false,
      sortOrder: 3,
    });
    expect(calls[1].init.method).toBe('POST');
    expect(body(calls[1])).toEqual({
      store: 'GOOGLE',
      productId: 'p1',
      credits: 100,
      enabled: false,
      sortOrder: 3,
    });
    await updateCreditProduct('7', { credits: 200, enabled: true, sortOrder: 1 });
    expect(calls[2].url).toBe('/api/admin/credit-products/7');
    expect(calls[2].init.method).toBe('PUT');
    expect(body(calls[2])).toEqual({ credits: 200, enabled: true, sortOrder: 1 });
  });

  it('reads every page when the backend pages the list, 200 a page, until it has the total', async () => {
    const rows = Array.from({ length: 450 }, (_, n) => ({ id: String(n) }));
    const calls = stubFetch(({ url }) => {
      const page = Number(new URL(url, 'http://x').searchParams.get('page') ?? '1');
      return jsonResponse(
        200,
        envelope('200', { items: rows.slice((page - 1) * 200, page * 200), total: 450 }),
      );
    });
    expect(await listAllCreditProducts()).toHaveLength(450);
    expect(calls.map((c) => c.url)).toEqual([
      '/api/admin/credit-products?page=1&pageSize=200',
      '/api/admin/credit-products?page=2&pageSize=200',
      '/api/admin/credit-products?page=3&pageSize=200',
    ]);
  });

  it('stops after one page when the answer has no total and fewer rows than a page (a list that is not paged)', async () => {
    const calls = answer({ items: [{ id: '1' }, { id: '2' }] });
    expect(await listAllCreditProducts()).toEqual([{ id: '1' }, { id: '2' }]);
    expect(calls).toHaveLength(1);
  });

  it('keeps each pack once and stops when a page brings nothing new, so a backend that ignores the page cannot make it loop', async () => {
    const full = Array.from({ length: 200 }, (_, n) => ({ id: String(n) }));
    const calls = stubFetch(() => jsonResponse(200, envelope('200', { items: full })));
    expect(await listAllCreditProducts()).toHaveLength(200);
    expect(calls).toHaveLength(2);
  });

  it('sends the surfaces of the row back unchanged when it has some', async () => {
    const calls = answer({});
    const surfaces = [{ platform: 'ANDROID' as const, channel: null }];
    await updateCreditProduct('7', { credits: 200, enabled: true, sortOrder: 1, surfaces });
    expect(body(calls[0]).surfaces).toEqual(surfaces);
  });
});
