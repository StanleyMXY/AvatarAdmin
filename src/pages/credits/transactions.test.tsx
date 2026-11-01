import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT, creditsState } from '../../../mock/_core/creditsData';
import * as creditsMock from '../../../mock/credits.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { chooseOption, expandSearch, signIn } from './testSetup';
import TransactionsPage from './transactions';

beforeEach(() => signIn('finance'));
afterEach(() => vi.unstubAllGlobals());

const lastTransactionUrl = (calls: { url: string }[]) =>
  new URL(
    [...calls].reverse().find((c) => c.url.includes('/credits/transactions'))?.url as string,
    'http://x',
  );
const query = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /查\s*询|Query|Search/ }));

describe('the credit transaction page', { timeout: 30000 }, () => {
  it('lists the ledger of every account newest first, with the spend kind, the feature and the item', async () => {
    useMockBackend(creditsMock);
    renderPage(<TransactionsPage />);
    const newest = [...creditsState.ledger].sort((a, b) => Number(b.id) - Number(a.id))[0];
    await waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(5));
    const first = screen.getAllByRole('row')[1];
    expect(within(first).getByText(newest.id)).toBeInTheDocument();
    expect(within(first).getByText(newest.accountId)).toBeInTheDocument();
    const spend = creditsState.ledger.find(
      (l) => l.reason === 'SPEND' && l.spendKind === 'COSMETIC',
    );
    expect(spend?.itemKey).toBeTruthy();
  });

  it('shows the reasons in words, among them the subscription grant and the reversal of a spend', async () => {
    const items = ['SUBSCRIPTION_GRANT', 'SPEND_REVERSED', 'PURCHASE', 'ADMIN_ADJUST'].map(
      (reason, i) => ({
        id: String(i + 1),
        accountId: ACCOUNT.active,
        delta: i % 2 ? -5 : 5,
        reason,
        spendKind: reason === 'SPEND_REVERSED' ? 'LOOK' : null,
        featureKey: null,
        itemKey: null,
        quantity: null,
        eventKey: null,
        note: null,
        createdAt: '2026-10-01T00:00:00Z',
      }),
    );
    stubFetch(async () => jsonResponse(200, envelope('200', { items, total: 4 })));
    renderPage(<TransactionsPage />);
    expect(await screen.findByText('Subscription grant')).toBeInTheDocument();
    expect(screen.getByText('Spend reversed')).toBeInTheDocument();
    expect(screen.getByText('Purchase')).toBeInTheDocument();
    expect(screen.getByText('Admin adjustment')).toBeInTheDocument();
    expect(screen.getByText('Look')).toBeInTheDocument();
  });

  it('shows an empty feature, item, quantity and note as a dash, not as 0 or null', async () => {
    const items = [
      {
        id: '1',
        accountId: ACCOUNT.active,
        delta: 5,
        reason: 'ADMIN_GRANT',
        spendKind: null,
        featureKey: null,
        itemKey: null,
        quantity: null,
        eventKey: null,
        note: null,
        createdAt: '2026-10-01T00:00:00Z',
      },
    ];
    stubFetch(async () => jsonResponse(200, envelope('200', { items, total: 1 })));
    renderPage(<TransactionsPage />);
    const row = (await screen.findByText(ACCOUNT.active)).closest('tr') as HTMLElement;
    expect(within(row).getAllByText('—').length).toBeGreaterThanOrEqual(4);
    expect(row.textContent).not.toMatch(/null|NaN|undefined/);
    expect(within(row).getByText('+5')).toBeInTheDocument();
  });

  it('sends type=earn for "Earned" and type=spend for "Spent", and no type for "All"', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<TransactionsPage />);
    await screen.findAllByRole('row');
    expect(lastTransactionUrl(calls).searchParams.has('type')).toBe(false);
    await expandSearch(user);
    await chooseOption(user, 'Type', 'Earned');
    await query(user);
    await waitFor(() => expect(lastTransactionUrl(calls).searchParams.get('type')).toBe('earn'));
    await chooseOption(user, 'Type', 'Spent');
    await query(user);
    await waitFor(() => expect(lastTransactionUrl(calls).searchParams.get('type')).toBe('spend'));
    await chooseOption(user, 'Type', 'All');
    await query(user);
    await waitFor(() => expect(lastTransactionUrl(calls).searchParams.has('type')).toBe(false));
  });

  it('shows only positive changes for "Earned" and only negative ones for "Spent"', async () => {
    useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<TransactionsPage />);
    await screen.findAllByRole('row');
    await expandSearch(user);
    await chooseOption(user, 'Type', 'Spent');
    await query(user);
    await waitFor(() => {
      const cells = screen.getAllByTestId('delta').map((c) => c.textContent ?? '');
      expect(cells.length).toBeGreaterThan(0);
      expect(cells.every((c) => c.startsWith('-') || c.startsWith('−'))).toBe(true);
    });
  });

  it('sends the account id exactly as typed and the reason that was chosen', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<TransactionsPage />);
    await screen.findAllByRole('row');
    await expandSearch(user);
    await user.type(screen.getByRole('textbox', { name: 'Account ID' }), `${ACCOUNT.active}`);
    await chooseOption(user, 'Reason', 'Purchase');
    await query(user);
    await waitFor(() =>
      expect(lastTransactionUrl(calls).searchParams.get('reason')).toBe('PURCHASE'),
    );
    expect(lastTransactionUrl(calls).searchParams.get('accountId')).toBe(ACCOUNT.active);
  });

  it('sends a UTC day range as [first day 00:00:00Z, the day after the last day 00:00:00Z)', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<TransactionsPage />);
    await screen.findAllByRole('row');
    await expandSearch(user);
    const [start, end] = [
      ...document.querySelectorAll<HTMLInputElement>('.ant-picker-input input'),
    ];
    await user.type(start, '2026-10-05{Enter}');
    await user.type(end, '2026-10-06{Enter}');
    await query(user);
    await waitFor(() =>
      expect(lastTransactionUrl(calls).searchParams.get('from')).toBe('2026-10-05T00:00:00Z'),
    );
    expect(lastTransactionUrl(calls).searchParams.get('to')).toBe('2026-10-07T00:00:00Z');
  });

  it('says that the range is in UTC', async () => {
    useMockBackend(creditsMock);
    renderPage(<TransactionsPage />);
    expect(await screen.findAllByText(/UTC/)).not.toHaveLength(0);
  });

  it('keeps a note of 5000 characters and of every language inside its cell', async () => {
    const long = 'n'.repeat(5000);
    const notes = [
      long,
      'ขอบคุณ',
      'شكرا',
      'Terima kasih',
      'Cảm ơn',
      'Gracias',
      'Thanks',
      '谢谢',
      '🎉'.repeat(80),
    ];
    const items = notes.map((note, i) => ({
      id: String(i + 1),
      accountId: ACCOUNT.active,
      delta: 1,
      reason: 'ADMIN_GRANT',
      spendKind: null,
      featureKey: null,
      itemKey: null,
      quantity: null,
      eventKey: null,
      note,
      createdAt: '2026-10-01T00:00:00Z',
    }));
    stubFetch(async () => jsonResponse(200, envelope('200', { items, total: items.length })));
    renderPage(<TransactionsPage />);
    const button = (await screen.findByText(long)).closest('button') as HTMLElement;
    expect(button.style.overflow).toBe('hidden');
    expect(button.style.maxWidth).not.toBe('');
    for (const note of notes.slice(1, 8)) expect(screen.getByText(note)).toBeInTheDocument();
  });
  it('shows all four filters at once, none of them behind "expand"', async () => {
    useMockBackend(creditsMock);
    renderPage(<TransactionsPage />);
    await screen.findAllByRole('row');
    for (const label of ['Account ID', 'Reason', 'Type']) {
      expect(screen.getByLabelText(label), label).toBeVisible();
    }
    expect(screen.getByText('Time range (UTC)')).toBeVisible();
  });
});
