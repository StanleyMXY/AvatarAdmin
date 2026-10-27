import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../../tests/httpStubs';
import { renderPage } from '../../../../tests/renderPage';
import {
  history,
  resetUmiStub,
  setTestInitialState,
  setTestLocation,
} from '../../../../tests/stubs/umi-max';
import { TABS_STORAGE_KEY } from '../../../components/layout/TabManager';
import { getToken, resetSessionState, setToken } from '../../../request/session';
import ChangePasswordPage from './index';

const me = (extra: Record<string, unknown> = {}) => ({
  id: '1',
  username: 'newhire',
  superAdmin: false,
  mustChangePassword: true,
  permissions: [],
  passwordMinLength: 12,
  ...extra,
});

beforeEach(() => {
  resetUmiStub();
  sessionStorage.clear();
  localStorage.clear();
  resetSessionState();
  setToken('tok');
  setTestInitialState({ me: me() });
  setTestLocation({ pathname: '/user/change-password', search: '' });
});
afterEach(() => vi.unstubAllGlobals());

async function fillAll(
  user: ReturnType<typeof userEvent.setup>,
  old: string,
  next: string,
  confirm: string,
) {
  await user.type(screen.getByLabelText('Old password'), old);
  await user.type(screen.getByLabelText('New password'), next);
  await user.type(screen.getByLabelText('Confirm new password'), confirm);
}

describe('the forced password change page', () => {
  it('tells the person why they are here and shows the length rule', () => {
    renderPage(<ChangePasswordPage />);
    expect(screen.getByText(/Change your password first/)).toBeInTheDocument();
    expect(
      screen.getByText('At least 12 characters, and not the same as the user name'),
    ).toBeInTheDocument();
  });

  it('changes the password, empties the account, forgets the tabs and token, and goes to sign-in', async () => {
    localStorage.setItem(TABS_STORAGE_KEY, '["/dashboard"]');
    const calls = stubFetch(() => jsonResponse(200, envelope('200', null)));
    const user = userEvent.setup();
    renderPage(<ChangePasswordPage />);
    await fillAll(user, 'old password!', 'a-new-password-1', 'a-new-password-1');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() => expect(history.replace).toHaveBeenCalledWith('/user/login'));
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      oldPassword: 'old password!',
      newPassword: 'a-new-password-1',
    });
    expect(calls[0].init.headers.Authorization).toBe('Bearer tok');
    expect(getToken()).toBeNull();
    expect(localStorage.getItem(TABS_STORAGE_KEY)).toBeNull();
  });

  it('has a sign out button, so a person who cannot change the password now is not stuck', async () => {
    localStorage.setItem(TABS_STORAGE_KEY, '["/dashboard"]');
    const calls = stubFetch(() => jsonResponse(200, envelope('200', null)));
    const user = userEvent.setup();
    renderPage(<ChangePasswordPage />);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(history.replace).toHaveBeenCalledWith('/user/login');
    expect(getToken()).toBeNull();
    expect(localStorage.getItem(TABS_STORAGE_KEY)).toBeNull();
    // nothing is sent: leaving does not ask the server for anything
    expect(calls).toHaveLength(0);
  });

  it('empties the account of the session when the person signs out', async () => {
    const user = userEvent.setup();
    renderPage(<ChangePasswordPage />);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    // the gate shows nothing to a session that has no account any more
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull());
    expect(screen.queryByLabelText('Old password')).toBeNull();
  });

  it('says sign out in Chinese too', () => {
    renderPage(<ChangePasswordPage />, 'zh-CN');
    expect(screen.getByRole('button', { name: '退出登录' })).toBeInTheDocument();
  });

  it.each([
    ['empty old password', ['', 'a-new-password-1', 'a-new-password-1'], 'Enter your old password'],
    ['empty new password', ['old', '', ''], 'Enter a new password'],
    ['empty confirmation', ['old', 'a-new-password-1', ''], 'Enter the new password again'],
    [
      'different confirmation',
      ['old', 'a-new-password-1', 'a-new-password-2'],
      'The two new passwords are not the same',
    ],
    [
      'the user name as password',
      ['old', 'newhire', 'newhire'],
      'The new password must differ from the user name',
    ],
    ['too short', ['old', 'short', 'short'], 'The new password needs at least 12 characters'],
  ])('refuses %s without asking the server', async (_label, [old, next, confirm], message) => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', null)));
    const user = userEvent.setup();
    renderPage(<ChangePasswordPage />);
    if (old) await user.type(screen.getByLabelText('Old password'), old);
    if (next) await user.type(screen.getByLabelText('New password'), next);
    if (confirm) await user.type(screen.getByLabelText('Confirm new password'), confirm);
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('counts the length in code points: 6 emoji are 6 characters, not 12', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', null)));
    const user = userEvent.setup();
    renderPage(<ChangePasswordPage />);
    await fillAll(user, 'old', '😀😀😀😀😀😀', '😀😀😀😀😀😀');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(
      await screen.findByText('The new password needs at least 12 characters'),
    ).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('leaves the length to the server and shows its sentence when the minimum is unknown', async () => {
    setTestInitialState({ me: me({ passwordMinLength: undefined }) });
    stubFetch(() =>
      jsonResponse(
        400,
        envelope(
          'INVALID_REQUEST',
          { details: [] },
          'newPassword must have at least 14 characters',
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage(<ChangePasswordPage />);
    expect(screen.queryByText(/At least \d+ characters/)).toBeNull();
    await fillAll(user, 'old', 'short-one', 'short-one');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(
      await screen.findByText(/newPassword must have at least 14 characters/),
    ).toBeInTheDocument();
    expect(getToken()).toBe('tok');
  });

  it('puts a wrong old password next to the old password field and keeps the person signed in', async () => {
    stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_CREDENTIALS')));
    const user = userEvent.setup();
    renderPage(<ChangePasswordPage />);
    await fillAll(user, 'wrong', 'a-new-password-1', 'a-new-password-1');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('The old password is wrong')).toBeInTheDocument();
    expect(getToken()).toBe('tok');
    expect(history.replace).not.toHaveBeenCalled();
  });

  it('puts a detail of the server about the new password next to that field', async () => {
    stubFetch(() =>
      jsonResponse(
        400,
        envelope('INVALID_REQUEST', { details: [{ ref: 'newPassword', reason: 'OUT_OF_RANGE' }] }),
      ),
    );
    const user = userEvent.setup();
    renderPage(<ChangePasswordPage />);
    await fillAll(user, 'old', 'a-new-password-1', 'a-new-password-1');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() =>
      expect(document.querySelector('.ant-form-item-explain-error')).not.toBeNull(),
    );
  });

  it('sends one request however often the button is pressed', async () => {
    let release: (r: Response) => void = () => {};
    const calls = stubFetch(
      () =>
        new Promise<Response>((r) => {
          release = r;
        }),
    );
    const user = userEvent.setup();
    renderPage(<ChangePasswordPage />);
    await fillAll(user, 'old', 'a-new-password-1', 'a-new-password-1');
    const button = screen.getByRole('button', { name: /Change password/ });
    await user.click(button);
    await user.click(button);
    expect(calls).toHaveLength(1);
    release(jsonResponse(200, envelope('200', null)));
    await waitFor(() => expect(history.replace).toHaveBeenCalledWith('/user/login'));
  });

  it('sends the passwords exactly as typed, spaces included, and works in other scripts', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', null)));
    const user = userEvent.setup();
    renderPage(<ChangePasswordPage />);
    await fillAll(user, ' เก่า ', ' รหัสผ่านใหม่ยาวมากๆๆ ', ' รหัสผ่านใหม่ยาวมากๆๆ ');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      oldPassword: ' เก่า ',
      newPassword: ' รหัสผ่านใหม่ยาวมากๆๆ ',
    });
  });

  it('sends someone who is not signed in to sign-in, and someone who need not change away to the overview', () => {
    setTestInitialState({});
    const { unmount } = renderPage(<ChangePasswordPage />);
    expect(history.replace).toHaveBeenCalledWith('/user/login');
    unmount();
    history.replace.mockClear();
    setTestInitialState({ me: me({ mustChangePassword: false }) });
    renderPage(<ChangePasswordPage />);
    expect(history.replace).toHaveBeenCalledWith('/dashboard');
  });
});
