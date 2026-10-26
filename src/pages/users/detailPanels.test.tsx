import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT } from '../../../mock/_core/creditsData';
import { MEMORY_ACCOUNT_IDS } from '../../../mock/_core/memoryData';
import { ACCOUNT_IDS } from '../../../mock/_core/subscriptionsData';
import { USER, usersState } from '../../../mock/_core/usersData';
import * as creditsMock from '../../../mock/credits.mock';
import * as memoryMock from '../../../mock/memory.mock';
import * as subscriptionsMock from '../../../mock/subscriptions.mock';
import * as usersMock from '../../../mock/users.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { setTestLocation } from '../../../tests/stubs/umi-max';
import enUS from '../../locales/en-US';
import UserDetailPage from './detail';
import { signIn } from './testSetup';

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const backend = () => useMockBackend(usersMock, creditsMock, subscriptionsMock, memoryMock);

const open = async (id: string, tab: string, language: 'en-US' | 'zh-CN' = 'en-US') => {
  setTestLocation({ pathname: `/users/${encodeURIComponent(id)}`, search: `?tab=${tab}` });
  const view = renderPage(<UserDetailPage />, language);
  await screen.findByText(language === 'en-US' ? `User ${id}` : `用户 ${id}`);
  return view;
};
const setStatus = (id: string, status: 'PENDING_DELETION' | 'DELETING') => {
  const account = usersState.users.find((u) => u.id === id);
  if (account) account.status = status;
};
const SUBSCRIBER = ACCOUNT_IDS[0];

describe('the subscription and entitlements tab', { timeout: 30000 }, () => {
  it('shows the entitlements of the account, the grant button, the revoke button of an active grant, and says the store subscription is not touched', async () => {
    backend();
    await open(SUBSCRIBER, 'entitlements');
    expect(await screen.findByRole('button', { name: 'Grant entitlement' })).toBeEnabled();
    expect(await screen.findByRole('button', { name: 'Revoke' })).toBeEnabled();
    expect(screen.getByText(enUS['users.entitlements.storeNote'])).toBeInTheDocument();
  });

  it('says the store note in the words of the spec in Chinese', async () => {
    backend();
    await open(SUBSCRIBER, 'entitlements', 'zh-CN');
    expect(await screen.findByText('发放限时权益不影响商店里的订阅。')).toBeInTheDocument();
  });

  it('draws no grant and no revoke button for an administrator without SUBSCRIPTION:GRANT', async () => {
    signIn('support', { codes: ['USER:VIEW', 'SUBSCRIPTION:VIEW'] });
    backend();
    await open(SUBSCRIBER, 'entitlements');
    await screen.findByTestId('effective-table');
    expect(screen.queryByRole('button', { name: 'Grant entitlement' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Revoke' })).toBeNull();
  });

  it('disables the grant but not the revoke while the account waits for deletion, and says why', async () => {
    setStatus(SUBSCRIBER, 'PENDING_DELETION');
    backend();
    await open(SUBSCRIBER, 'entitlements');
    expect(await screen.findByRole('button', { name: 'Grant entitlement' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeEnabled();
    expect(screen.getByText(enUS['users.banner.PENDING_DELETION'])).toBeInTheDocument();
  });

  it('disables the grant and the revoke while the account is being deleted', async () => {
    setStatus(SUBSCRIBER, 'DELETING');
    backend();
    await open(SUBSCRIBER, 'entitlements');
    expect(await screen.findByRole('button', { name: 'Grant entitlement' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeDisabled();
  });
});

describe('the credits tab', { timeout: 30000 }, () => {
  it('shows the balance and the ledger of the account and the new-request button', async () => {
    backend();
    await open(ACCOUNT.active, 'credits');
    expect(await screen.findByTestId('panel-balance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: enUS['users.credits.newRequest'] })).toBeEnabled();
  });

  it('opens the request dialog with this account fixed in it', async () => {
    backend();
    const user = userEvent.setup();
    await open(ACCOUNT.active, 'credits');
    await user.click(await screen.findByRole('button', { name: enUS['users.credits.newRequest'] }));
    const dialog = (await screen.findAllByRole('dialog')).at(-1) as HTMLElement;
    const box = within(dialog).getByRole('textbox', { name: 'Account ID' });
    expect(box).toHaveValue(ACCOUNT.active);
    expect(box).toBeDisabled();
  });

  it('draws no new-request button without SUBSCRIPTION:GRANT', async () => {
    signIn('support', { codes: ['USER:VIEW', 'SUBSCRIPTION:VIEW'] });
    backend();
    await open(ACCOUNT.active, 'credits');
    await screen.findByTestId('panel-balance');
    expect(screen.queryByRole('button', { name: enUS['users.credits.newRequest'] })).toBeNull();
  });

  it.each<[string, string]>([
    [USER.pendingDeletion, 'a pending deletion'],
    [USER.deleting, 'a deletion under way'],
  ])('disables the new-request button for %s (%s) and says why', async (id) => {
    backend();
    await open(id, 'credits');
    expect(
      await screen.findByRole('button', { name: enUS['users.credits.newRequest'] }),
    ).toBeDisabled();
    expect(screen.getByText(enUS['users.credits.blocked'])).toBeInTheDocument();
  });

  it('shows the ledger of the account that was opened, not of the one before it', async () => {
    backend();
    await open(ACCOUNT.active, 'credits');
    await screen.findByTestId('panel-balance');
    const first = screen.getByTestId('panel-balance').textContent;
    setTestLocation({ pathname: `/users/${ACCOUNT.negative}`, search: '?tab=credits' });
    await screen.findByText(`User ${ACCOUNT.negative}`);
    await waitFor(() => expect(screen.getByTestId('panel-balance').textContent).not.toBe(first));
  });
});

describe('the memory tab', { timeout: 30000 }, () => {
  it('shows the tier and the model history of the account', async () => {
    backend();
    await open(MEMORY_ACCOUNT_IDS.active, 'memory');
    expect(await screen.findByText('Current tier')).toBeInTheDocument();
    expect(screen.getByTestId('assignment-history')).toBeInTheDocument();
  });

  it.each([[MEMORY_ACCOUNT_IDS.pendingDeletion], [MEMORY_ACCOUNT_IDS.deleting]])(
    'disables the model choice of the account %s that is going away',
    async (id) => {
      backend();
      await open(id, 'memory');
      expect(await screen.findByText(enUS['memory.account.blocked'])).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Assign model' })).toBeDisabled();
    },
  );

  it('leaves the model choice usable for an active account', async () => {
    backend();
    await open(MEMORY_ACCOUNT_IDS.active, 'memory');
    await screen.findByText('Current tier');
    expect(screen.queryByText(enUS['memory.account.blocked'])).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Choose a model' })).toBeEnabled();
  });
});
