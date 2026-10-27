import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT, creditsState } from '../../../mock/_core/creditsData';
import * as creditsMock from '../../../mock/credits.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import AccountsPage from './accounts';
import { expandSearch, signIn } from './testSetup';

beforeEach(() => signIn('finance'));
afterEach(() => vi.unstubAllGlobals());

const rowOf = async (accountId: string) => {
  const link = await screen.findByRole('link', { name: accountId });
  return link.closest('tr') as HTMLTableRowElement;
};

describe('the credit account page', { timeout: 30000 }, () => {
  it('lists the accounts with balance, earned, spent and update time, and links each account to the credit tab of its detail', async () => {
    useMockBackend(creditsMock);
    renderPage(<AccountsPage />);
    const row = await rowOf(ACCOUNT.active);
    expect(screen.getByRole('link', { name: ACCOUNT.active })).toHaveAttribute(
      'href',
      `/users/${ACCOUNT.active}?tab=credits`,
    );
    const earned = creditsState.ledger
      .filter((l) => l.accountId === ACCOUNT.active && l.delta > 0)
      .reduce((n, l) => n + l.delta, 0);
    expect(
      within(row).getByText(new Intl.NumberFormat('en-US').format(earned)),
    ).toBeInTheDocument();
    expect(within(row).getAllByTestId('balance')).toHaveLength(1);
  });

  it('shows a negative balance in the warning colour and a balance of zero or more plainly', async () => {
    useMockBackend(creditsMock);
    renderPage(<AccountsPage />);
    const negative = within(await rowOf(ACCOUNT.negative)).getByTestId('balance');
    expect(negative.getAttribute('data-negative')).toBe('true');
    expect(negative.className).toMatch(/danger/);
    const plain = within(await rowOf(ACCOUNT.active)).getByTestId('balance');
    expect(plain.getAttribute('data-negative')).toBe('false');
  });

  it('does not list an account that has no credit account', async () => {
    useMockBackend(creditsMock);
    renderPage(<AccountsPage />);
    await rowOf(ACCOUNT.active);
    expect(screen.queryByRole('link', { name: ACCOUNT.none })).toBeNull();
  });

  it('asks for the account id exactly as typed, whole and trimmed, and only that account is shown', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<AccountsPage />);
    await rowOf(ACCOUNT.active);
    await user.type(
      screen.getByRole('textbox', { name: 'Account ID' }),
      `  ${ACCOUNT.negative}  {Enter}`,
    );
    await waitFor(() => expect(calls.some((c) => c.url.includes('accountId='))).toBe(true));
    for (const call of calls.filter((c) => c.url.includes('accountId='))) {
      expect(new URL(call.url, 'http://x').searchParams.get('accountId')).toBe(ACCOUNT.negative);
    }
    await waitFor(() => expect(screen.queryByRole('link', { name: ACCOUNT.active })).toBeNull());
    expect(screen.getByRole('link', { name: ACCOUNT.negative })).toBeInTheDocument();
  });

  it('sends the lower and the upper balance, and keeps a bound of 0 or less', async () => {
    const calls = useMockBackend(creditsMock);
    const user = userEvent.setup();
    renderPage(<AccountsPage />);
    await rowOf(ACCOUNT.active);
    await expandSearch(user);
    await user.type(screen.getByRole('spinbutton', { name: 'Balance from' }), '-50');
    await user.type(screen.getByRole('spinbutton', { name: 'Balance to' }), '0{Enter}');
    await waitFor(() => expect(calls.some((c) => c.url.includes('balanceMax=0'))).toBe(true));
    const url = new URL(calls.filter((c) => c.url.includes('balanceMax'))[0].url, 'http://x');
    expect(url.searchParams.get('balanceMin')).toBe('-50');
    expect(url.searchParams.get('balanceMax')).toBe('0');
  });

  it('keeps long ids of any language inside the cell', async () => {
    const items = ['a'.repeat(5000), 'สวัสดี'.repeat(40), 'مرحبا'.repeat(40), '😀'.repeat(60)].map(
      (accountId) => ({
        accountId,
        balance: 5,
        totalEarned: 10,
        totalSpent: 5,
        updatedAt: '2026-10-01T00:00:00Z',
      }),
    );
    stubFetch(async () => jsonResponse(200, envelope('200', { items, total: items.length })));
    renderPage(<AccountsPage />);
    const link = await screen.findByRole('link', { name: 'a'.repeat(5000) });
    const style = getComputedStyle(link);
    expect(
      style.overflowWrap === 'anywhere' ||
        link.style.overflowWrap === 'anywhere' ||
        link.style.wordBreak === 'break-all',
    ).toBe(true);
  });

  it('shows the text of the refusal and not a crash when the administrator may not see the page', async () => {
    signIn('finance', { codes: ['FINANCE:VIEW'] });
    useMockBackend(creditsMock);
    renderPage(<AccountsPage />);
    expect(await screen.findByText(/You do not have permission/)).toBeInTheDocument();
  });
});
