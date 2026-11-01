import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { creditsState } from '../../../mock/_core/creditsData';
import * as creditsMock from '../../../mock/credits.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { withTimeZone } from '../../../tests/withTimeZone';
import { renderWithLocaleSwitch } from './localeHost';
import StatsPage from './stats';
import { signIn } from './testSetup';

beforeEach(() => signIn('finance'));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const statsUrl = (calls: { url: string }[]) =>
  new URL(calls.filter((c) => c.url.includes('/credits/stats')).at(-1)?.url as string, 'http://x');

describe('the credit statistics page', { timeout: 30000 }, () => {
  it('asks for the last 7 UTC days, including today, and says the days are UTC', async () => {
    const calls = useMockBackend(creditsMock);
    renderPage(<StatsPage />);
    await screen.findByTestId('credits-spent');
    const url = statsUrl(calls);
    const today = new Date().toISOString().slice(0, 10);
    expect(url.searchParams.get('to')).toBe(today);
    expect(
      Date.parse(`${today}T00:00:00Z`) - Date.parse(`${url.searchParams.get('from')}T00:00:00Z`),
    ).toBe(6 * 86400000);
    expect(screen.getByText(/UTC days/)).toBeInTheDocument();
  });

  it('does not ask for the figures again when the language of the page is switched, and writes them in the new language', async () => {
    const calls = useMockBackend(creditsMock);
    const view = renderWithLocaleSwitch(<StatsPage />);
    await screen.findByTestId('credits-spent');
    const before = calls.filter((c) => c.url.includes('/credits/stats')).length;
    await view.switchTo('zh-CN');
    await screen.findByText('沙盒里的购买不计入。', { exact: false });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(calls.filter((c) => c.url.includes('/credits/stats')).length).toBe(before);
    expect(screen.getByTestId('credits-spent')).toBeInTheDocument();
  });

  it('uses the UTC date, not the local one, in Singapore between 00:00 and 08:00', async () => {
    await withTimeZone('Asia/Singapore', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-26T17:30:00Z')); // 27 October 01:30 in Singapore
      const calls = useMockBackend(creditsMock);
      renderPage(<StatsPage />);
      await waitFor(() => expect(calls.some((c) => c.url.includes('/credits/stats'))).toBe(true));
      expect(statsUrl(calls).searchParams.get('to')).toBe('2026-10-26');
      expect(statsUrl(calls).searchParams.get('from')).toBe('2026-10-20');
    });
  });

  it('says that sandbox purchases are not counted', async () => {
    useMockBackend(creditsMock);
    renderPage(<StatsPage />);
    expect(
      await screen.findByText('Purchases made in the sandbox are not counted.'),
    ).toBeInTheDocument();
  });

  it('shows the spending by spend kind, the features by feature key and the clothes by item key', async () => {
    useMockBackend(creditsMock);
    renderPage(<StatsPage />);
    const table = await screen.findByTestId('credits-spent');
    await waitFor(() => expect(within(table).getByText('Feature')).toBeInTheDocument());
    expect(within(table).getByText('Cosmetic')).toBeInTheDocument();
    expect(within(table).getByText('Look')).toBeInTheDocument();
    const feature = creditsState.ledger.find(
      (l) => l.reason === 'SPEND' && l.spendKind === 'FEATURE',
    )?.featureKey as string;
    const item = creditsState.ledger.find((l) => l.reason === 'SPEND' && l.spendKind === 'COSMETIC')
      ?.itemKey as string;
    expect(within(table).getByText(feature)).toBeInTheDocument();
    expect(within(table).getByText(item)).toBeInTheDocument();
  });

  it('shows the packs sold and the credits refunded by store and product', async () => {
    useMockBackend(creditsMock);
    renderPage(<StatsPage />);
    const purchases = await screen.findByTestId('credits-purchases');
    const refunded = await screen.findByTestId('credits-refunded');
    await waitFor(() => expect(within(purchases).getAllByRole('row').length).toBeGreaterThan(1));
    expect(within(purchases).getAllByText(/APPLE|GOOGLE/).length).toBeGreaterThan(0);
    await waitFor(() => expect(within(refunded).getAllByRole('row').length).toBeGreaterThan(1));
  });

  it('shows empty tables and zero totals for a range with nothing in it', async () => {
    stubFetch(async () =>
      jsonResponse(200, envelope('200', { purchases: [], refunded: [], spent: [] })),
    );
    renderPage(<StatsPage />);
    await waitFor(() => expect(screen.getByTestId('credits-total-packs')).toHaveTextContent('0'));
    expect(screen.getByTestId('credits-total-spent')).toHaveTextContent('0');
    expect(document.querySelectorAll('.ant-empty').length).toBeGreaterThanOrEqual(3);
  });

  it('shows the refusal of the backend instead of breaking', async () => {
    stubFetch(async () =>
      jsonResponse(
        400,
        envelope('INVALID_REQUEST', { details: [{ ref: 'to', reason: 'OUT_OF_RANGE' }] }),
      ),
    );
    renderPage(<StatsPage />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
  });

  it('shows the refusal for an administrator without FINANCE:VIEW', async () => {
    signIn('finance', { codes: ['SUBSCRIPTION:VIEW'] });
    useMockBackend(creditsMock);
    renderPage(<StatsPage />);
    expect(await screen.findByText(/You do not have permission/)).toBeInTheDocument();
  });

  it('keeps feature keys and item keys of every language and of 5000 characters inside their cells', async () => {
    const long = 'k'.repeat(5000);
    const keys = [long, 'สวัสดี', 'مرحبا', 'Halo', 'Xin chào', 'Hola', 'Hello', '你好'];
    stubFetch(async () =>
      jsonResponse(
        200,
        envelope('200', {
          purchases: [],
          refunded: [],
          spent: keys.map((k) => ({
            spendKind: 'COSMETIC',
            featureKey: null,
            itemKey: k,
            count: 1,
            credits: 5,
          })),
        }),
      ),
    );
    renderPage(<StatsPage />);
    const table = await screen.findByTestId('credits-spent');
    const cell = await within(table).findByText(long);
    expect((cell.closest('button') ?? cell).getAttribute('style') ?? '').toMatch(
      /overflow|word-break|overflow-wrap/,
    );
    for (const key of keys.slice(1)) expect(within(table).getByText(key)).toBeInTheDocument();
  });
});
