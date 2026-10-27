import { act, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../tests/httpStubs';
import { history, resetUmiStub, setTestInitialState, useModel } from '../../tests/stubs/umi-max';
import { TABS_STORAGE_KEY } from '../components/layout/TabManager';
import { apiRequest } from '../request/apiClient';
import { getToken, resetSessionState, setToken } from '../request/session';
import { getPendingEnroll, setPendingEnroll } from './pendingEnroll';
import { loginUrl } from './returnUrl';
import { SessionBridge } from './SessionBridge';

const messages = {
  'error.ADMIN_INVALID_TOKEN': 'Session expired',
  'error.ADMIN_FORBIDDEN': 'No permission',
};

const meAnswer = (permissions: string[]) =>
  envelope('200', {
    id: '1',
    username: 'ploy',
    superAdmin: false,
    mustChangePassword: false,
    permissions,
    passwordMinLength: 12,
  });

function Show() {
  const { initialState } = useModel('@@initialState') as {
    initialState?: { me?: { permissions: string[] } };
  };
  return <div data-testid="perms">{(initialState?.me?.permissions ?? []).join(',')}</div>;
}

const mount = () =>
  render(
    <IntlProvider locale="en-US" messages={messages} onError={() => {}}>
      <App>
        <SessionBridge>
          <Show />
        </SessionBridge>
      </App>
    </IntlProvider>,
  );

beforeEach(() => {
  resetUmiStub();
  sessionStorage.clear();
  localStorage.clear();
  resetSessionState();
  window.history.pushState({}, '', '/users/42?tab=x');
  setTestInitialState({ me: { permissions: ['USER:VIEW', 'USER:BAN'] } });
});
afterEach(() => vi.unstubAllGlobals());

describe('a lost token (401 ADMIN_INVALID_TOKEN)', () => {
  it('clears the token and the account, forgets the tabs, and goes to sign-in with the page it was on', async () => {
    setToken('old');
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(['/dashboard', '/users/42']));
    setPendingEnroll({ enrollToken: 'e', otpauthUri: 'u' });
    stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')));
    mount();
    await act(async () => {
      await apiRequest({ method: 'GET', url: '/users' }).catch(() => {});
    });
    expect(getToken()).toBeNull();
    expect(sessionStorage.getItem('avatar-admin.token')).toBeNull();
    expect(localStorage.getItem(TABS_STORAGE_KEY)).toBeNull();
    expect(getPendingEnroll()).toBeUndefined();
    expect(history.replace).toHaveBeenCalledTimes(1);
    expect(history.replace).toHaveBeenCalledWith(loginUrl('/users/42', '?tab=x'));
    expect(screen.getByTestId('perms').textContent).toBe('');
    expect(await screen.findByText('Session expired')).toBeInTheDocument();
  });

  it('goes once however many requests report it', async () => {
    setToken('old');
    stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')));
    mount();
    await act(async () => {
      await Promise.all(
        [1, 2, 3].map(() => apiRequest({ method: 'GET', url: '/users' }).catch(() => {})),
      );
    });
    expect(history.replace).toHaveBeenCalledTimes(1);
  });

  it('does not send a write again after the token was lost: one request, then the sign-in page', async () => {
    setToken('old');
    const calls = stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')));
    mount();
    await act(async () => {
      await apiRequest({
        method: 'POST',
        url: '/users/1/ban',
        body: { reason: 'spam' },
      }).catch(() => {});
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(calls).toHaveLength(1);
    expect(history.replace).toHaveBeenCalledTimes(1);
  });

  it('brings the person back to the page afterwards: the address holds the page, readable again', () => {
    const url = loginUrl('/users/42', '?tab=x');
    const redirect = new URL(url, 'http://localhost').searchParams.get('redirect');
    expect(redirect).toBe('/users/42?tab=x');
  });
});

describe('a refusal (403 ADMIN_FORBIDDEN)', () => {
  const forbidden = () => jsonResponse(403, envelope('ADMIN_FORBIDDEN'));

  it('says so, stays where it is, and reads the permissions again once', async () => {
    setToken('tok');
    const calls = stubFetch((call) =>
      call.url.endsWith('/me') ? jsonResponse(200, meAnswer(['USER:VIEW'])) : forbidden(),
    );
    mount();
    expect(screen.getByTestId('perms').textContent).toBe('USER:VIEW,USER:BAN');
    await act(async () => {
      await apiRequest({ method: 'POST', url: '/users/1/ban', body: {} }).catch(() => {});
    });
    await waitFor(() => expect(screen.getByTestId('perms').textContent).toBe('USER:VIEW'));
    expect(history.replace).not.toHaveBeenCalled();
    expect(history.push).not.toHaveBeenCalled();
    expect(getToken()).toBe('tok');
    expect(calls.filter((c) => c.url.endsWith('/me'))).toHaveLength(1);
    expect(await screen.findByText('No permission')).toBeInTheDocument();
  });

  it('reads the permissions only once when several refusals arrive together, and does not poll', async () => {
    setToken('tok');
    const calls = stubFetch((call) =>
      call.url.endsWith('/me') ? jsonResponse(200, meAnswer(['USER:VIEW'])) : forbidden(),
    );
    mount();
    await act(async () => {
      await Promise.all(
        [1, 2, 3].map(() => apiRequest({ method: 'GET', url: '/users' }).catch(() => {})),
      );
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(calls.filter((c) => c.url.endsWith('/me'))).toHaveLength(1);
  });

  it('keeps the permissions it has when they cannot be read again', async () => {
    setToken('tok');
    stubFetch((call) =>
      call.url.endsWith('/me') ? jsonResponse(500, envelope('INTERNAL_ERROR')) : forbidden(),
    );
    mount();
    await act(async () => {
      await apiRequest({ method: 'GET', url: '/users' }).catch(() => {});
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByTestId('perms').textContent).toBe('USER:VIEW,USER:BAN');
  });
});
