import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStore } from '../../../mock/_core/store';
import * as subscriptionsMock from '../../../mock/subscriptions.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { signInAs, useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub, setTestAccess } from '../../../tests/stubs/umi-max';
import { withTimeZone } from '../../../tests/withTimeZone';
import access from '../../access';
import type { SubscriptionStatRow } from '../../services/subscriptions';
import StatsPage, { formatListPrice } from './stats';

beforeEach(() => {
  resetUmiStub();
  resetStore();
  // the clock is set first: the token is issued at the fake time, so it has not run out by then
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-26T20:00:00Z'));
  signInAs('root');
  setTestAccess(
    access({ me: { superAdmin: true, permissions: [] } }) as unknown as Record<string, unknown>,
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const row = (over: Partial<SubscriptionStatRow>): SubscriptionStatRow => ({
  statDate: '2026-10-26',
  store: 'APPLE',
  productId: 'avatar.premium.monthly',
  active: 10,
  new: 1,
  renewed: 2,
  canceled: 3,
  expired: 4,
  refunded: 5,
  listPriceAmount: '9.99',
  listPriceCurrency: 'USD',
  ...over,
});

const answering = (items: SubscriptionStatRow[]) =>
  stubFetch(async () => jsonResponse(200, envelope('200', { items })));

describe('the subscription statistics', { timeout: 30000 }, () => {
  it('says the amounts are list prices, not what was paid, and that sandbox subscriptions are not counted', async () => {
    useMockBackend(subscriptionsMock);
    renderPage(<StatsPage />);
    expect(
      await screen.findByText(
        'The amount is the list price, not what was paid. Sandbox subscriptions are not counted.',
      ),
    ).toBeInTheDocument();
  });

  it('has no refund action, only the count of refunds', async () => {
    useMockBackend(subscriptionsMock);
    renderPage(<StatsPage />);
    await screen.findByText(/list price, not what was paid/);
    await waitFor(() =>
      expect(document.querySelectorAll('tbody tr.ant-table-row').length).toBeGreaterThan(0),
    );
    expect(screen.queryByRole('button', { name: /refund/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /refund/i })).toBeNull();
    expect(screen.getAllByText('Refunds').length).toBeGreaterThan(0);
  });

  it('reads the last seven UTC days, today in UTC even where it is already tomorrow', async () => {
    await withTimeZone('Asia/Singapore', async () => {
      const calls = useMockBackend(subscriptionsMock);
      renderPage(<StatsPage />);
      await waitFor(() =>
        expect(calls.some((c) => c.url.startsWith('/api/admin/subscriptions/stats'))).toBe(true),
      );
      expect(calls.find((c) => c.url.startsWith('/api/admin/subscriptions/stats'))?.url).toBe(
        '/api/admin/subscriptions/stats?from=2026-10-20&to=2026-10-26',
      );
      expect(screen.getByText(/Statistics days are UTC days/)).toBeInTheDocument();
    });
  });

  it('shows one row for each day, store and product, 20 to a page, and the totals of what can be added up', async () => {
    answering([
      row({
        statDate: '2026-10-25',
        store: 'APPLE',
        productId: 'a',
        active: 10,
        new: 1,
        renewed: 2,
        canceled: 3,
        expired: 4,
        refunded: 5,
      }),
      row({
        statDate: '2026-10-26',
        store: 'APPLE',
        productId: 'a',
        active: 20,
        new: 10,
        renewed: 20,
        canceled: 30,
        expired: 40,
        refunded: 50,
      }),
      row({
        statDate: '2026-10-26',
        store: 'GOOGLE',
        productId: 'b',
        active: 30,
        new: 100,
        renewed: 200,
        canceled: 300,
        expired: 400,
        refunded: 500,
      }),
    ]);
    renderPage(<StatsPage />);
    await waitFor(() =>
      expect(document.querySelectorAll('tbody tr.ant-table-row')).toHaveLength(3),
    );
    expect(
      within(await screen.findByTestId('subscription-total-new')).getByText('111'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('subscription-total-renewed')).getByText('222'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('subscription-total-canceled')).getByText('333'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('subscription-total-expired')).getByText('444'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('subscription-total-refunded')).getByText('555'),
    ).toBeInTheDocument();
    // active is a snapshot of one day, so it is not added across days: the last day only (20 + 30)
    expect(
      within(screen.getByTestId('subscription-total-active')).getByText('50'),
    ).toBeInTheDocument();
  });

  it('names the day the active count was taken from', async () => {
    answering([
      row({ statDate: '2026-10-25', productId: 'a', active: 10 }),
      row({ statDate: '2026-10-26', productId: 'a', active: 20 }),
    ]);
    renderPage(<StatsPage />);
    const card = await screen.findByTestId('subscription-total-active');
    await waitFor(() => expect(within(card).getByText('20')).toBeInTheDocument());
    expect(
      within(card).getByText('Snapshot of 2026-10-26 (UTC), not added across days'),
    ).toBeInTheDocument();
  });

  it('takes the last day that has a snapshot when the last days of the range have none, and says which day', async () => {
    answering([
      row({ statDate: '2026-10-24', productId: 'a', active: 7 }),
      row({ statDate: '2026-10-24', productId: 'b', active: 8 }),
      row({ statDate: '2026-10-25', productId: 'a', active: 11 }),
      row({ statDate: '2026-10-25', productId: 'b', active: 12 }),
      row({ statDate: '2026-10-26', productId: 'a', active: null }),
      row({ statDate: '2026-10-26', productId: 'b', active: null }),
    ]);
    renderPage(<StatsPage />);
    const card = await screen.findByTestId('subscription-total-active');
    await waitFor(() => expect(within(card).getByText('23')).toBeInTheDocument());
    expect(
      within(card).getByText('Snapshot of 2026-10-25 (UTC), not added across days'),
    ).toBeInTheDocument();
  });

  it('does not count a day where only some products have a snapshot, it goes back to the last complete day', async () => {
    answering([
      row({ statDate: '2026-10-25', productId: 'a', active: 11 }),
      row({ statDate: '2026-10-25', productId: 'b', active: 12 }),
      row({ statDate: '2026-10-26', productId: 'a', active: 20 }),
      row({ statDate: '2026-10-26', productId: 'b', active: null }),
    ]);
    renderPage(<StatsPage />);
    const card = await screen.findByTestId('subscription-total-active');
    await waitFor(() => expect(within(card).getByText('23')).toBeInTheDocument());
    expect(
      within(card).getByText('Snapshot of 2026-10-25 (UTC), not added across days'),
    ).toBeInTheDocument();
  });

  it('shows a dash and says there is no snapshot when no day of the range has one', async () => {
    answering([
      row({ statDate: '2026-10-25', active: null }),
      row({ statDate: '2026-10-26', active: null }),
    ]);
    renderPage(<StatsPage />);
    const card = await screen.findByTestId('subscription-total-active');
    await waitFor(() => expect(within(card).getByText('—')).toBeInTheDocument());
    expect(
      within(card).getByText('No day in the selected range has a snapshot'),
    ).toBeInTheDocument();
    expect(within(card).queryByText(/Snapshot of/)).toBeNull();
  });

  it('shows a dash, never 0 or null, for a snapshot that is missing and a price that is missing', async () => {
    answering([row({ active: null, listPriceAmount: null, listPriceCurrency: null, new: 0 })]);
    renderPage(<StatsPage />);
    await waitFor(() =>
      expect(document.querySelectorAll('tbody tr.ant-table-row')).toHaveLength(1),
    );
    const cells = [...document.querySelectorAll('tbody tr.ant-table-row td')].map(
      (c) => c.textContent,
    );
    // date, store, product, active, new, renewed, canceled, expired, refunded, price
    expect(cells[3]).toBe('—');
    expect(cells[4]).toBe('0');
    expect(cells[9]).toBe('—');
    expect(document.body.textContent).not.toMatch(/null|NaN|undefined/);
    // no snapshot on the last day: the active card is a dash too
    expect(
      within(screen.getByTestId('subscription-total-active')).getByText('—'),
    ).toBeInTheDocument();
  });

  it('shows the active card as a dash when one product has no snapshot on the last day', async () => {
    answering([row({ productId: 'a', active: 20 }), row({ productId: 'b', active: null })]);
    renderPage(<StatsPage />);
    await waitFor(() =>
      expect(document.querySelectorAll('tbody tr.ant-table-row')).toHaveLength(2),
    );
    expect(
      within(screen.getByTestId('subscription-total-active')).getByText('—'),
    ).toBeInTheDocument();
  });

  it('writes the list price with its currency, whatever the currency', async () => {
    answering([
      row({ productId: 'a', listPriceAmount: '1290.00', listPriceCurrency: 'THB' }),
      row({ productId: 'b', listPriceAmount: '149000', listPriceCurrency: 'IDR' }),
      row({ productId: 'c', listPriceAmount: '9.99', listPriceCurrency: 'no-such-currency' }),
    ]);
    renderPage(<StatsPage />);
    await waitFor(() =>
      expect(document.querySelectorAll('tbody tr.ant-table-row')).toHaveLength(3),
    );
    const text = document.body.textContent as string;
    expect(text).toMatch(/THB\s?1,290\.00/);
    expect(text).toMatch(/IDR\s?149,000/);
    expect(text).toMatch(/9\.99/);
    expect(text).toContain('no-such-currency');
  });

  it('shows one row for each currency when a day, a store and a product come in two currencies, with no repeated key', async () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    answering([
      row({ productId: 'both', listPriceAmount: '9.99', listPriceCurrency: 'USD' }),
      row({ productId: 'both', listPriceAmount: '1290.00', listPriceCurrency: 'THB' }),
    ]);
    renderPage(<StatsPage />);
    await waitFor(() =>
      expect(document.querySelectorAll('tbody tr.ant-table-row')).toHaveLength(2),
    );
    const keys = [...document.querySelectorAll('tbody tr.ant-table-row')].map((r) =>
      r.getAttribute('data-row-key'),
    );
    expect(new Set(keys).size).toBe(2);
    const repeated = warn.mock.calls.filter((call) => /same key/.test(String(call[0])));
    expect(repeated).toHaveLength(0);
    warn.mockRestore();
  });

  it('writes a list price from its decimal string, never through a floating point number', async () => {
    answering([
      row({ productId: 'big', listPriceAmount: '9007199254740993.01', listPriceCurrency: 'USD' }),
      row({ productId: 'fine', listPriceAmount: '24.999', listPriceCurrency: 'USD' }),
      row({ productId: 'tail', listPriceAmount: '0.1234567', listPriceCurrency: 'EUR' }),
    ]);
    renderPage(<StatsPage />);
    await waitFor(() =>
      expect(document.querySelectorAll('tbody tr.ant-table-row')).toHaveLength(3),
    );
    const text = document.body.textContent as string;
    expect(text).toContain('$9,007,199,254,740,993.01');
    expect(text).not.toContain('9,007,199,254,740,994');
    expect(text).toContain('$24.999');
    expect(text).toContain('0.1234567');
  });

  it('writes a list price sent as a JSON number, and still writes a long string exactly', async () => {
    answering([
      row({ productId: 'num', listPriceAmount: 9.99, listPriceCurrency: 'USD' }),
      row({ productId: 'int', listPriceAmount: 149000, listPriceCurrency: 'IDR' }),
      row({ productId: 'bare', listPriceAmount: 12.5, listPriceCurrency: null }),
      row({ productId: 'big', listPriceAmount: '9007199254740993.01', listPriceCurrency: 'USD' }),
    ]);
    renderPage(<StatsPage />);
    await waitFor(() =>
      expect(document.querySelectorAll('tbody tr.ant-table-row')).toHaveLength(4),
    );
    const prices = [...document.querySelectorAll('tbody tr.ant-table-row')].map(
      (tr) => tr.querySelectorAll('td')[9].textContent,
    );
    expect(prices[0]).toBe('$9.99');
    expect(prices[1]).toMatch(/^IDR\s?149,000(\.00)?$/);
    expect(prices[2]).toBe('12.5');
    expect(prices[3]).toBe('$9,007,199,254,740,993.01');
  });

  it.each([
    ['a boolean', true],
    ['an object', { amount: 9.99 }],
    ['an array', [9.99]],
  ])('shows a dash for a price that is %s, never [object Object]', async (_name, amount) => {
    answering([
      row({ listPriceAmount: amount as unknown as string | null, listPriceCurrency: 'USD' }),
    ]);
    renderPage(<StatsPage />);
    await waitFor(() =>
      expect(document.querySelectorAll('tbody tr.ant-table-row')).toHaveLength(1),
    );
    const cells = [...document.querySelectorAll('tbody tr.ant-table-row td')].map(
      (c) => c.textContent,
    );
    expect(cells[9]).toBe('—');
    expect(document.body.textContent).not.toMatch(/NaN|Infinity|\[object|true/);
  });

  it('formats a number that is not finite as a dash, with or without a currency', () => {
    for (const amount of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(formatListPrice(amount, 'USD', 'en-US')).toBe('—');
      expect(formatListPrice(amount, null, 'en-US')).toBe('—');
    }
    expect(formatListPrice(-9.99, 'USD', 'en-US')).toBe('-$9.99');
    expect(formatListPrice(0, 'USD', 'en-US')).toBe('$0.00');
  });

  it('writes the list price in the number format of the language of the interface', async () => {
    answering([
      row({ productId: 'g', store: 'GOOGLE', listPriceAmount: '1290.5', listPriceCurrency: 'THB' }),
    ]);
    renderPage(<StatsPage />, 'zh-CN');
    await waitFor(() =>
      expect(document.querySelectorAll('tbody tr.ant-table-row')).toHaveLength(1),
    );
    expect(document.body.textContent).toMatch(/THB\s?1,290\.50/);
  });

  it.each([
    ['both missing', null, null],
    ['no amount', null, 'USD'],
    ['an empty amount', '', 'USD'],
    ['an amount that is not a number', 'abc', 'USD'],
    ['an amount in exponent form', '1e21', 'USD'],
  ])('shows a dash for a price with %s, never NaN or null', async (_name, amount, currency) => {
    answering([row({ listPriceAmount: amount as string | null, listPriceCurrency: currency })]);
    renderPage(<StatsPage />);
    await waitFor(() =>
      expect(document.querySelectorAll('tbody tr.ant-table-row')).toHaveLength(1),
    );
    const cells = [...document.querySelectorAll('tbody tr.ant-table-row td')].map(
      (c) => c.textContent,
    );
    expect(cells[9]).toBe('—');
    expect(document.body.textContent).not.toMatch(/NaN|null|undefined/);
  });

  it('writes an amount with no currency as a plain number', async () => {
    answering([row({ listPriceAmount: '12.50', listPriceCurrency: null })]);
    renderPage(<StatsPage />);
    await waitFor(() =>
      expect(document.querySelectorAll('tbody tr.ant-table-row')).toHaveLength(1),
    );
    const cells = [...document.querySelectorAll('tbody tr.ant-table-row td')].map(
      (c) => c.textContent,
    );
    expect(cells[9]).toBe('12.50');
  });

  it('has the list price column right after the refunds', async () => {
    useMockBackend(subscriptionsMock);
    renderPage(<StatsPage />);
    await waitFor(() =>
      expect(document.querySelectorAll('tbody tr.ant-table-row').length).toBeGreaterThan(0),
    );
    const heads = [...document.querySelectorAll('thead th')].map((c) => c.textContent);
    expect(heads.at(-1)).toBe('List price');
    expect(heads.at(-2)).toBe('Refunds');
  });

  it('pages the rows 20 to a page', async () => {
    answering(Array.from({ length: 45 }, (_, i) => row({ productId: `p${i}` })));
    renderPage(<StatsPage />);
    await waitFor(() =>
      expect(document.querySelectorAll('tbody tr.ant-table-row')).toHaveLength(20),
    );
    expect(document.querySelector('.ant-pagination')).not.toBeNull();
  });

  it('shows product ids of every script and a 5000 character one inside the table', async () => {
    answering([
      row({ productId: 'x'.repeat(5000) }),
      row({ productId: 'สินค้า_พรีเมียม' }),
      row({ productId: 'منتج_مميز' }),
      row({ productId: 'Gói cao cấp' }),
    ]);
    renderPage(<StatsPage />);
    await screen.findByText('สินค้า_พรีเมียม');
    expect(screen.getByText('منتج_مميز')).toBeInTheDocument();
    const clamps = [...document.querySelectorAll('tbody button[data-lines]')] as HTMLElement[];
    expect(clamps.length).toBeGreaterThan(0);
    for (const c of clamps) expect(c.style.overflowWrap).toBe('anywhere');
  });

  it('shows an empty range as an empty table and dashes in the cards, not zeros made up', async () => {
    answering([]);
    renderPage(<StatsPage />);
    await waitFor(() => expect(document.querySelector('.ant-empty')).not.toBeNull());
    expect(
      within(await screen.findByTestId('subscription-total-active')).getByText('—'),
    ).toBeInTheDocument();
  });

  it('shows the refusal of the backend with a retry (no FINANCE:VIEW is a 403)', async () => {
    stubFetch(async () => jsonResponse(403, envelope('ADMIN_FORBIDDEN')));
    renderPage(<StatsPage />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
