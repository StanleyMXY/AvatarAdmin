import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { renderPage } from '../../../tests/renderPage';
import { history, resetUmiStub, setTestInitialState } from '../../../tests/stubs/umi-max';
import { getToken, resetSessionState, setToken } from '../../request/session';
import {
  clearPendingEnroll,
  getPendingEnroll,
  setPendingEnroll,
} from '../../session/pendingEnroll';
import { AccountMenu } from './AccountMenu';
import { TABS_STORAGE_KEY } from './TabManager';

const me = {
  id: '1',
  username: 'ploy',
  superAdmin: false,
  mustChangePassword: false,
  permissions: ['USER:VIEW'],
  passwordMinLength: 12,
};

beforeEach(() => {
  resetUmiStub();
  sessionStorage.clear();
  localStorage.clear();
  resetSessionState();
  clearPendingEnroll();
  setToken('tok');
  setTestInitialState({ me });
});
afterEach(() => vi.unstubAllGlobals());

describe('the account menu in the header', () => {
  it('shows nothing when nobody is signed in', () => {
    setTestInitialState({});
    const { container } = renderPage(<AccountMenu />);
    expect(container.textContent).toBe('');
  });

  it('opens the change-password dialog with the old, new and confirm fields', async () => {
    const user = userEvent.setup();
    renderPage(<AccountMenu />);
    await user.click(screen.getByRole('button', { name: /ploy/ }));
    fireEvent.click(within(await screen.findByRole('menu')).getByText('Change password'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Old password')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('New password')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Confirm new password')).toBeInTheDocument();
  });

  it('after a change the person is signed out and sent to sign-in', async () => {
    localStorage.setItem(TABS_STORAGE_KEY, '["/dashboard"]');
    stubFetch(() => jsonResponse(200, envelope('200', null)));
    const user = userEvent.setup();
    renderPage(<AccountMenu />);
    await user.click(screen.getByRole('button', { name: /ploy/ }));
    fireEvent.click(within(await screen.findByRole('menu')).getByText('Change password'));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Old password'), 'old');
    await user.type(within(dialog).getByLabelText('New password'), 'a-new-password-1');
    await user.type(within(dialog).getByLabelText('Confirm new password'), 'a-new-password-1');
    await user.click(within(dialog).getByRole('button', { name: 'Change password' }));
    await waitFor(() => expect(history.replace).toHaveBeenCalledWith('/user/login'));
    expect(getToken()).toBeNull();
    expect(localStorage.getItem(TABS_STORAGE_KEY)).toBeNull();
  });

  it('refuses the user name as the new password using the name of the signed-in account', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', null)));
    const user = userEvent.setup();
    renderPage(<AccountMenu />);
    await user.click(screen.getByRole('button', { name: /ploy/ }));
    fireEvent.click(within(await screen.findByRole('menu')).getByText('Change password'));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Old password'), 'old');
    await user.type(within(dialog).getByLabelText('New password'), 'ploy');
    await user.type(within(dialog).getByLabelText('Confirm new password'), 'ploy');
    await user.click(within(dialog).getByRole('button', { name: 'Change password' }));
    expect(
      await within(dialog).findByText('The new password must differ from the user name'),
    ).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('signs out: token, remembered tabs, the account in memory and a pending setup are all forgotten', async () => {
    localStorage.setItem(TABS_STORAGE_KEY, '["/dashboard","/users/42"]');
    setPendingEnroll({ enrollToken: 'e', otpauthUri: 'u' });
    const user = userEvent.setup();
    renderPage(<AccountMenu />);
    await user.click(screen.getByRole('button', { name: /ploy/ }));
    fireEvent.click(within(await screen.findByRole('menu')).getByText('Sign out'));
    expect(getToken()).toBeNull();
    expect(sessionStorage.getItem('avatar-admin.token')).toBeNull();
    expect(localStorage.getItem(TABS_STORAGE_KEY)).toBeNull();
    expect(getPendingEnroll()).toBeUndefined();
    expect(history.replace).toHaveBeenCalledWith('/user/login');
    await waitFor(() => expect(screen.queryByRole('button', { name: /ploy/ })).toBeNull());
  });

  it('still offers the menu when the server sent no user name', async () => {
    setTestInitialState({ me: { ...me, username: undefined } });
    const user = userEvent.setup();
    renderPage(<AccountMenu />);
    await user.click(screen.getByRole('button', { name: /./ }));
    expect(await screen.findByRole('menu')).toBeInTheDocument();
  });
});
