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
import StatsPage from './stats';

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
      row({ productId: 'b', listPriceAmount: 149000, listPriceCurrency: 'IDR' }),
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
