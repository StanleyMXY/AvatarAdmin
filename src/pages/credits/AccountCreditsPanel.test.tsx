import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT, creditsState } from '../../../mock/_core/creditsData';
import * as creditsMock from '../../../mock/credits.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { AccountCreditsPanel } from './AccountCreditsPanel';
import { signIn } from './testSetup';

beforeEach(() => signIn('finance'));
afterEach(() => vi.unstubAllGlobals());

const sum = (id: string, pick: (n: number) => boolean) =>
  creditsState.ledger
    .filter((l) => l.accountId === id && pick(l.delta))
    .reduce((n, l) => n + Math.abs(l.delta), 0);
const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);

describe('the credit tab of an account', { timeout: 30000 }, () => {
  it('shows the balance, the earned and the spent totals and the ledger', async () => {
    useMockBackend(creditsMock);
    renderPage(<AccountCreditsPanel accountId={ACCOUNT.active} />);
    const earned = sum(ACCOUNT.active, (n) => n > 0);
    const spent = sum(ACCOUNT.active, (n) => n < 0);
    await waitFor(() =>
      expect(within(screen.getByTestId('panel-earned')).getByText(fmt(earned))).toBeInTheDocument(),
    );
    expect(within(screen.getByTestId('panel-spent')).getByText(fmt(spent))).toBeInTheDocument();
    expect(screen.getByTestId('balance')).toHaveTextContent(fmt(earned - spent));
    expect(screen.getAllByRole('row').length).toBeGreaterThan(2);
    for (const title of [
      'Change',
      'Reason',
      'Purchase',
      'Spend kind',
      'Feature',
      'Item',
      'Quantity',
      'Note',
      'Time',
    ]) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    }
  });

  it('shows a negative balance in the warning colour with the sentence about what it means', async () => {
    useMockBackend(creditsMock);
    renderPage(<AccountCreditsPanel accountId={ACCOUNT.negative} />);
    await waitFor(() =>
      expect(screen.getByTestId('balance').getAttribute('data-negative')).toBe('true'),
    );
    expect(screen.getByTestId('balance').className).toMatch(/danger/);
    expect(
      screen.getByText(
        'A negative balance cannot be spent, and credits bought later are used to pay it off first.',
      ),
    ).toBeInTheDocument();
  });

  it('shows three zeros and an empty ledger, and no error, for an account that has no credit account', async () => {
    const calls = useMockBackend(creditsMock);
    renderPage(<AccountCreditsPanel accountId={ACCOUNT.none} />);
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes(`/accounts/${ACCOUNT.none}/credits`))).toBe(true),
    );
    await waitFor(() => expect(document.querySelector('.ant-empty')).not.toBeNull());
    expect(screen.getByTestId('balance')).toHaveTextContent('0');
    expect(within(screen.getByTestId('panel-earned')).getByText('0')).toBeInTheDocument();
    expect(within(screen.getByTestId('panel-spent')).getByText('0')).toBeInTheDocument();
    expect(screen.queryByText(/Failed to load/)).toBeNull();
    expect(screen.getByTestId('balance').getAttribute('data-negative')).toBe('false');
  });

  it('shows dashes, not zeros, until the first answer has arrived', async () => {
    stubFetch(() => new Promise(() => {}));
    renderPage(<AccountCreditsPanel accountId={ACCOUNT.none} />);
    expect(screen.getByTestId('balance')).toHaveTextContent('—');
    expect(within(screen.getByTestId('panel-earned')).getByText('—')).toBeInTheDocument();
  });

  it('asks for the next page of the ledger and keeps the totals', async () => {
    const calls = useMockBackend(creditsMock);
    renderPage(<AccountCreditsPanel accountId={ACCOUNT.active} />);
    await screen.findAllByRole('row');
    await waitFor(() => expect(document.querySelector('.ant-pagination-next')).not.toBeNull());
    fireEvent.click(document.querySelector('.ant-pagination-next') as HTMLElement);
    await waitFor(() => expect(calls.some((c) => c.url.includes('page=2'))).toBe(true));
    expect(calls.find((c) => c.url.includes('page=2'))?.url).toContain(
      `/accounts/${ACCOUNT.active}/credits`,
    );
    expect(screen.getByTestId('balance')).not.toHaveTextContent('—');
  });

  it('shows the error in words, not a crash, when the account does not exist', async () => {
    useMockBackend(creditsMock);
    renderPage(<AccountCreditsPanel accountId="no-such-account" />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(screen.getByText(/not found/)).toBeInTheDocument();
  });

  it('keeps notes of 5000 characters and of every language inside their cells', async () => {
    const long = 'q'.repeat(5000);
    const notes = [
      long,
      'ขอบคุณ',
      'شكرا لك',
      'Terima kasih',
      'Cảm ơn',
      'Gracias',
      'Thanks',
      '谢谢',
      '🎉'.repeat(80),
    ];
    const items = notes.map((note, i) => ({
      id: String(i + 1),
      delta: 1,
      reason: 'ADMIN_GRANT',
      purchaseId: null,
      eventKey: null,
      spendKind: null,
      featureKey: null,
      itemKey: null,
      quantity: null,
      note,
      createdAt: '2026-10-01T00:00:00Z',
    }));
    stubFetch(async () =>
      jsonResponse(
        200,
        envelope('200', { balance: 9, totalEarned: 9, totalSpent: 0, items, total: 9 }),
      ),
    );
    renderPage(<AccountCreditsPanel accountId={ACCOUNT.active} />);
    const button = (await screen.findByText(long)).closest('button') as HTMLElement;
    expect(button.style.overflow).toBe('hidden');
    for (const note of notes.slice(1, 8)) expect(screen.getByText(note)).toBeInTheDocument();
  });
});
