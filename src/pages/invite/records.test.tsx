import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inviteData } from '../../../mock/_core/inviteData';
import * as inviteMock from '../../../mock/invite.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import RecordsPage from './records';
import { clickExport, signIn, withExportSheet } from './testSetup';

beforeEach(() => signIn('root'));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const record = (over: Record<string, unknown> = {}) => ({
  id: '1',
  inviterAccountId: 'inviter-full-id-0001',
  inviteeAccountId: 'invitee-full-id-0001',
  inviterLabel: 'a***@d***.com',
  inviteeLabel: 'b***@e***.com',
  redeemedAt: '2026-10-20T10:00:00Z',
  rewardStatus: 'PENDING',
  rewardReason: null,
  inviterCreditsGranted: 0,
  inviteeCreditsGranted: 0,
  rewardedAt: null,
  ...over,
});
const answer = (items: unknown[]) =>
  stubFetch(async () => jsonResponse(200, envelope('200', { items, total: items.length })));
const rowOf = (text: string) => screen.getByText(text).closest('tr') as HTMLElement;

describe('the invite record page', { timeout: 30000 }, () => {
  it('lists the newest redemption first with the masked identifiers and never a whole account id', async () => {
    const calls = useMockBackend(inviteMock);
    renderPage(<RecordsPage />);
    const shown = inviteData().records.slice(0, 20);
    await screen.findAllByText(shown[0].inviteeLabel);
    const body = document.body.textContent ?? '';
    for (const r of shown) {
      expect(body, r.id).not.toContain(r.inviterAccountId);
      expect(body, r.id).not.toContain(r.inviteeAccountId);
    }
    const first = screen.getAllByRole('row')[1];
    expect(within(first).getByText(shown[0].inviterLabel)).toBeInTheDocument();
    expect(within(first).getByText(shown[0].inviteeLabel)).toBeInTheDocument();
    expect(calls.find((c) => c.url.includes('/invites/records'))?.url).toBe(
      '/api/admin/invites/records?page=1&pageSize=20',
    );
    for (const head of [
      'Inviter',
      'Invitee',
      'Redeemed at',
      'Reward status',
      'Reason not eligible',
      'Credits paid to inviter',
      'Credits paid to invitee',
    ]) {
      expect(screen.getAllByText(head).length, head).toBeGreaterThan(0);
    }
  });

  it('shows the three states and the six reasons in words', async () => {
    answer([
      record({ id: '1', inviterLabel: 'p***@x.com', rewardStatus: 'PENDING' }),
      record({
        id: '2',
        inviterLabel: 'r***@x.com',
        rewardStatus: 'REWARDED',
        inviterCreditsGranted: 10,
        inviteeCreditsGranted: 5,
      }),
      ...[
        ['DISABLED', 'Rewards were switched off'],
        ['OUT_OF_WINDOW', 'Outside the reward period'],
        ['ACCOUNT_STATE', 'An account was banned or being deleted'],
        ['LIMIT_REACHED', 'The inviter reached the reward limit'],
        ['SAME_DEVICE', 'Both accounts were registered on the same device'],
        ['PRIOR_ACCOUNT', 'The invitee had been rewarded on an earlier account'],
      ].map(([reason], i) =>
        record({
          id: `n${i}`,
          inviterLabel: `n${i}***@x.com`,
          rewardStatus: 'NOT_ELIGIBLE',
          rewardReason: reason,
        }),
      ),
    ]);
    renderPage(<RecordsPage />);
    await screen.findByText('p***@x.com');
    expect(within(rowOf('p***@x.com')).getByText('Waiting for the condition')).toBeInTheDocument();
    expect(within(rowOf('r***@x.com')).getByText('Rewarded')).toBeInTheDocument();
    const reasons = [
      'Rewards were switched off',
      'Outside the reward period',
      'An account was banned or being deleted',
      'The inviter reached the reward limit',
      'Both accounts were registered on the same device',
      'The invitee had been rewarded on an earlier account',
    ];
    reasons.forEach((text, i) => {
      const row = rowOf(`n${i}***@x.com`);
      expect(within(row).getByText('Not eligible')).toBeInTheDocument();
      expect(within(row).getByText(text)).toBeInTheDocument();
    });
  });

  it('shows a state or a reason it does not know as it was sent, and a missing reason as a dash', async () => {
    answer([
      record({
        id: '1',
        inviterLabel: 'u***@x.com',
        rewardStatus: 'MANUAL_REVIEW',
        rewardReason: 'NEW_RULE_X',
      }),
      record({ id: '2', inviterLabel: 'v***@x.com', rewardStatus: 'PENDING', rewardReason: null }),
    ]);
    renderPage(<RecordsPage />);
    await screen.findByText('u***@x.com');
    const odd = rowOf('u***@x.com');
    expect(within(odd).getByText('MANUAL_REVIEW')).toBeInTheDocument();
    expect(within(odd).getByText('NEW_RULE_X')).toBeInTheDocument();
    expect(within(rowOf('v***@x.com')).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows what was paid to each side: a zero as 0, a missing number as a dash, never null or NaN', async () => {
    answer([
      record({
        id: '1',
        inviterLabel: 'a1***@x.com',
        rewardStatus: 'REWARDED',
        inviterCreditsGranted: 10,
        inviteeCreditsGranted: 0,
      }),
      record({
        id: '2',
        inviterLabel: 'a2***@x.com',
        rewardStatus: 'PENDING',
        inviterCreditsGranted: null,
        inviteeCreditsGranted: null,
      }),
      record({
        id: '3',
        inviterLabel: 'a3***@x.com',
        rewardStatus: 'REWARDED',
        inviterCreditsGranted: 'ten',
        inviteeCreditsGranted: -5,
      }),
    ]);
    renderPage(<RecordsPage />);
    await screen.findByText('a1***@x.com');
    const paid = (text: string) => {
      const cells = within(rowOf(text)).getAllByRole('cell');
      return [cells[cells.length - 2].textContent, cells[cells.length - 1].textContent];
    };
    expect(paid('a1***@x.com')).toEqual(['10', '0']);
    expect(paid('a2***@x.com')).toEqual(['—', '—']);
    expect(paid('a3***@x.com')).toEqual(['—', '—']);
    expect(document.body.textContent).not.toMatch(/null|NaN|undefined/);
  });

  it('keeps a long label, a label in Thai and Arabic and a label that is not text inside the table', async () => {
    answer([
      record({ id: '1', inviterLabel: 'ก็'.repeat(160), inviteeLabel: 'م***@y***.com' }),
      record({ id: '2', inviterLabel: 'ส***@h***.co.th', inviteeLabel: 42 }),
      record({ id: '3', inviterLabel: { a: 1 }, inviteeLabel: null, rewardStatus: 'REWARDED' }),
    ]);
    renderPage(<RecordsPage />);
    expect(await screen.findByText('م***@y***.com')).toBeInTheDocument();
    expect(screen.getByText('ส***@h***.co.th')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(document.querySelectorAll('button[data-lines]').length).toBeGreaterThanOrEqual(3);
    expect(document.body.textContent).not.toMatch(/\[object|undefined|NaN/);
  });

  it('lays an identifier that starts with an Arabic letter out from the left, so the domain is not read first', async () => {
    answer([record({ id: '1', inviterLabel: 'ส***@h***.co.th', inviteeLabel: 'م***@y***.com' })]);
    renderPage(<RecordsPage />);
    const arabic = await screen.findByText('م***@y***.com');
    expect(arabic.closest('button')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText('ส***@h***.co.th').closest('button')).toHaveAttribute('dir', 'ltr');
  });

  it('filters by the reward status and sends nothing for "all"', async () => {
    const calls = useMockBackend(inviteMock);
    const user = userEvent.setup();
    renderPage(<RecordsPage />);
    await screen.findAllByText(inviteData().records[0].inviteeLabel);
    await user.click(screen.getByRole('combobox', { name: 'Reward status' }));
    const options = await screen.findAllByText('Not eligible', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    await user.click(screen.getByRole('button', { name: /查\s*询|Query|Search/ }));
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.url === '/api/admin/invites/records?page=1&pageSize=20&rewardStatus=NOT_ELIGIBLE',
        ),
      ).toBe(true),
    );
    const eligible = inviteData().records.filter((r) => r.rewardStatus === 'NOT_ELIGIBLE');
    await waitFor(() =>
      expect(screen.getAllByRole('row')).toHaveLength(Math.min(20, eligible.length) + 1),
    );
  });

  it('exports as invite-records with the status that was searched, not the one being edited', async () => {
    const calls = useMockBackend(inviteMock);
    const exports = withExportSheet();
    const user = userEvent.setup();
    renderPage(<RecordsPage />);
    await screen.findAllByText(inviteData().records[0].inviteeLabel);
    await clickExport(user);
    await waitFor(() => expect(exports).toHaveLength(1));
    expect(exports[0].url).toBe('/api/admin/stats/export/invite-records');
    // chosen in the form but not searched yet: the export still asks for what is on the screen
    await user.click(screen.getByRole('combobox', { name: 'Reward status' }));
    const options = await screen.findAllByText('Rewarded', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    await clickExport(user);
    await waitFor(() => expect(exports).toHaveLength(2));
    expect(exports[1].url).toBe('/api/admin/stats/export/invite-records');
    await user.click(screen.getByRole('button', { name: /查\s*询|Query|Search/ }));
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes('rewardStatus=REWARDED'))).toBe(true),
    );
    await waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(1));
    await clickExport(user);
    await waitFor(() => expect(exports).toHaveLength(3));
    expect(exports[2].url).toBe('/api/admin/stats/export/invite-records?rewardStatus=REWARDED');
  });

  it('shows no export button without STATS:EXPORT', async () => {
    signIn('support', { codes: ['INVITE:VIEW'] });
    useMockBackend(inviteMock);
    renderPage(<RecordsPage />);
    await screen.findAllByText(inviteData().records[0].inviteeLabel);
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
  });

  it('shows only the words of a known error code', async () => {
    stubFetch(async () =>
      jsonResponse(403, envelope('ADMIN_FORBIDDEN', null, 'raw backend words')),
    );
    renderPage(<RecordsPage />);
    expect(await screen.findByText(/permission to do this/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw backend words');
  });
});
