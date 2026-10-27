import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { USER, usersState } from '../../../mock/_core/usersData';
import * as usersMock from '../../../mock/users.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import enUS from '../../locales/en-US';
import { AccountActions } from './AccountActions';
import { StartDeletionModal } from './StartDeletionModal';
import { openDialog, signIn } from './testSetup';

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const button = (name: string) => screen.queryByRole('button', { name });
const posts = (calls: { method: string; url: string }[], suffix: string) =>
  calls.filter((c) => c.method === 'POST' && c.url.endsWith(suffix));

const states = ['ACTIVE', 'BANNED', 'PENDING_DELETION', 'DELETING'] as const;

function Flip() {
  const [status, setStatus] = useState('ACTIVE');
  return (
    <>
      <button type="button" data-testid="flip" onClick={() => setStatus('PENDING_DELETION')} />
      <AccountActions accountId={USER.negative} status={status} onChanged={() => {}} />
    </>
  );
}

describe('which buttons the account state allows (contract 17.4 state matrix)', {
  timeout: 30000,
}, () => {
  // [ban, unban, start deletion, cancel deletion] -> 'enabled' | 'disabled' | 'absent'
  const expected: Record<string, string[]> = {
    ACTIVE: ['enabled', 'absent', 'enabled', 'disabled'],
    BANNED: ['absent', 'enabled', 'enabled', 'disabled'],
    PENDING_DELETION: ['disabled', 'absent', 'disabled', 'enabled'],
    DELETING: ['disabled', 'absent', 'disabled', 'disabled'],
  };
  const names = ['Ban', 'Unban', 'Start deletion', 'Cancel deletion'];
  const stateOf = (name: string) => {
    const found = button(name);
    return found === null
      ? 'absent'
      : (found as HTMLButtonElement).disabled
        ? 'disabled'
        : 'enabled';
  };

  it.each(states)('with both codes, an account in the state %s', (status) => {
    renderPage(<AccountActions accountId={USER.negative} status={status} onChanged={() => {}} />);
    expect(names.map(stateOf)).toEqual(expected[status]);
  });

  it.each(states)('with USER:BAN alone draws no deletion button (%s)', (status) => {
    signIn('support', { codes: ['USER:VIEW', 'USER:BAN'] });
    renderPage(<AccountActions accountId={USER.negative} status={status} onChanged={() => {}} />);
    expect(names.map(stateOf)).toEqual([
      expected[status][0],
      expected[status][1],
      'absent',
      'absent',
    ]);
  });

  it.each(states)('with USER:DELETION alone draws no ban button (%s)', (status) => {
    signIn('support', { codes: ['USER:VIEW', 'USER:DELETION'] });
    renderPage(<AccountActions accountId={USER.negative} status={status} onChanged={() => {}} />);
    expect(names.map(stateOf)).toEqual([
      'absent',
      'absent',
      expected[status][2],
      expected[status][3],
    ]);
  });

  it('draws nothing for an administrator who has neither code', () => {
    signIn('support', { codes: ['USER:VIEW'] });
    renderPage(<AccountActions accountId={USER.negative} status="ACTIVE" onChanged={() => {}} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('follows the state when the page reads the account again', async () => {
    renderPage(<Flip />);
    expect(stateOf('Ban')).toBe('enabled');
    await userEvent.setup().click(screen.getByTestId('flip'));
    expect(stateOf('Ban')).toBe('disabled');
  });
});

describe('unban', { timeout: 30000 }, () => {
  it('asks inline first, sends one request for two clicks on confirm, and tells the page', async () => {
    const calls = useMockBackend(usersMock);
    const onChanged = vi.fn();
    const user = userEvent.setup();
    renderPage(<AccountActions accountId={USER.banned} status="BANNED" onChanged={onChanged} />);
    await user.click(screen.getByRole('button', { name: 'Unban' }));
    expect(await screen.findByText(enUS['users.unban.confirm'])).toBeInTheDocument();
    expect(posts(calls, '/unban')).toHaveLength(0);
    const ok = await screen.findByRole('button', { name: 'OK' });
    await user.dblClick(ok);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(posts(calls, '/unban')).toHaveLength(1);
    expect(usersState.users.find((u) => u.id === USER.banned)?.status).toBe('ACTIVE');
  });

  it('says the state in words when the account is not banned any more, and asks the page to read again', async () => {
    useMockBackend(usersMock);
    const account = usersState.users.find((u) => u.id === USER.banned);
    if (account) account.status = 'PENDING_DELETION';
    const onChanged = vi.fn();
    const user = userEvent.setup();
    renderPage(<AccountActions accountId={USER.banned} status="BANNED" onChanged={onChanged} />);
    await user.click(screen.getByRole('button', { name: 'Unban' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText(
        `${enUS['error.INVALID_STATE']} The account is now: Waiting for deletion (grace period).`,
      ),
    ).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });
});

describe('the deletion dialog', { timeout: 30000 }, () => {
  const openIt = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Start deletion' }));
    return openDialog();
  };

  it('says there is a grace period, that nothing is deleted at once, and that the reason is for the audit log', async () => {
    renderPage(<StartDeletionModal accountId={USER.negative} status="ACTIVE" onDone={() => {}} />);
    const dialog = await openIt(userEvent.setup());
    expect(within(dialog).getByText(enUS['users.deletion.hint'])).toBeInTheDocument();
    expect(within(dialog).getByText(enUS['users.deletion.reasonNote'])).toBeInTheDocument();
  });

  it('refuses an empty reason and one of 201 code points, takes 200, sends it once and tells the page', async () => {
    const calls = useMockBackend(usersMock);
    const onDone = vi.fn();
    const user = userEvent.setup();
    renderPage(<StartDeletionModal accountId={USER.negative} status="ACTIVE" onDone={onDone} />);
    const dialog = await openIt(user);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Enter a reason')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('textbox'));
    await user.paste('😀'.repeat(201));
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText('The reason needs 1 to 200 characters'),
    ).toBeInTheDocument();
    expect(posts(calls, '/deletion')).toHaveLength(0);
    await user.clear(within(dialog).getByRole('textbox'));
    await user.paste(` ${'あ'.repeat(200)} `);
    await user.dblClick(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(posts(calls, '/deletion')).toHaveLength(1);
    expect(calls.find((c) => c.url.endsWith('/deletion'))?.body).toEqual({
      reason: 'あ'.repeat(200),
    });
    expect(usersState.users.find((u) => u.id === USER.negative)?.status).toBe('PENDING_DELETION');
  });

  it('says the state in words when the account is already waiting for deletion', async () => {
    useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(
      <StartDeletionModal accountId={USER.pendingDeletion} status="ACTIVE" onDone={() => {}} />,
    );
    const dialog = await openIt(user);
    await user.click(within(dialog).getByRole('textbox'));
    await user.paste('Asked by the user through support');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText(
        `${enUS['error.INVALID_STATE']} The account is now: Waiting for deletion (grace period).`,
      ),
    ).toBeInTheDocument();
  });

  it('shows the translated text of a refusal and not the backend message', async () => {
    stubFetch(async () => jsonResponse(403, envelope('ADMIN_FORBIDDEN', null, 'raw backend text')));
    const user = userEvent.setup();
    renderPage(<StartDeletionModal accountId={USER.negative} status="ACTIVE" onDone={() => {}} />);
    const dialog = await openIt(user);
    await user.click(within(dialog).getByRole('textbox'));
    await user.paste('x');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText(enUS['error.ADMIN_FORBIDDEN'])).toBeInTheDocument();
    expect(within(dialog).queryByText(/raw backend text/)).toBeNull();
  });
});

describe('cancel deletion', { timeout: 30000 }, () => {
  it('asks inline first, sends one request for two clicks, and brings the earlier state back', async () => {
    const calls = useMockBackend(usersMock);
    const onChanged = vi.fn();
    const user = userEvent.setup();
    renderPage(
      <AccountActions
        accountId={USER.pendingDeletion}
        status="PENDING_DELETION"
        onChanged={onChanged}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel deletion' }));
    expect(await screen.findByText(enUS['users.deletion.cancelConfirm'])).toBeInTheDocument();
    expect(posts(calls, '/deletion/cancel')).toHaveLength(0);
    await user.dblClick(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(posts(calls, '/deletion/cancel')).toHaveLength(1);
    expect(usersState.users.find((u) => u.id === USER.pendingDeletion)?.status).toBe('ACTIVE');
  });

  it('says the state in words when the grace period is over, and asks the page to read again', async () => {
    useMockBackend(usersMock);
    const account = usersState.users.find((u) => u.id === USER.pendingDeletion);
    if (account) account.status = 'DELETING';
    const onChanged = vi.fn();
    const user = userEvent.setup();
    renderPage(
      <AccountActions
        accountId={USER.pendingDeletion}
        status="PENDING_DELETION"
        onChanged={onChanged}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel deletion' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText(`${enUS['error.INVALID_STATE']} The account is now: Being deleted.`),
    ).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });
});
