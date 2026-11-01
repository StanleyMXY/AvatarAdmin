import { act, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from 'antd';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../tests/httpStubs';
import { renderPage } from '../../tests/renderPage';
import {
  history,
  resetUmiStub,
  setTestInitialState,
  setTestInitialStateDelay,
} from '../../tests/stubs/umi-max';
import { canAccess } from '../access/canAccess';
import { TABS_STORAGE_KEY } from '../components/layout/TabManager';
import enUS from '../locales/en-US';
import zhCN from '../locales/zh-CN';
import Enroll from '../pages/user/enroll';
import Login from '../pages/user/login';
import { apiRequest } from '../request/apiClient';
import { getToken, resetSessionState, setToken } from '../request/session';
import { getAdminMeta } from '../services/auth';
import { loadSession } from './loadSession';
import { clearPendingEnroll, getPendingEnroll, setPendingEnroll } from './pendingEnroll';
import { SessionBridge } from './SessionBridge';
import { useGoWhenSignedIn, useSession } from './useSession';
import { useSubmitOnce } from './useSubmitOnce';

const meBody = (extra: Record<string, unknown> = {}) =>
  envelope('200', {
    id: '1',
    username: 'ploy',
    superAdmin: false,
    mustChangePassword: false,
    permissions: ['USER:VIEW'],
    passwordMinLength: 12,
    ...extra,
  });

beforeEach(() => {
  resetUmiStub();
  sessionStorage.clear();
  localStorage.clear();
  resetSessionState();
  clearPendingEnroll();
  setTestInitialState({});
  window.history.pushState({}, '', '/user/enroll');
});
afterEach(() => vi.unstubAllGlobals());

describe('the authenticator setup does not end the session', () => {
  it('shows only the setup message when the enrollment token is void: one notice, tabs kept, no redirect parameter lost', async () => {
    localStorage.setItem(TABS_STORAGE_KEY, '["/dashboard","/users/42"]');
    setPendingEnroll({ enrollToken: 'e', otpauthUri: 'otpauth://x', redirect: '/users/42?tab=x' });
    stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')));
    const user = userEvent.setup();
    renderPage(
      <SessionBridge>
        <Enroll />
      </SessionBridge>,
    );
    await user.type(screen.getByLabelText('Verification code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Finish setup' }));
    await waitFor(() => expect(history.replace).toHaveBeenCalledTimes(1));
    expect(history.replace).toHaveBeenCalledWith(
      `/user/login?redirect=${encodeURIComponent('/users/42?tab=x')}`,
    );
    expect(await screen.findByText('The setup has expired. Sign in again.')).toBeInTheDocument();
    expect(screen.queryByText('Your session has expired. Please sign in again.')).toBeNull();
    expect(localStorage.getItem(TABS_STORAGE_KEY)).not.toBeNull();
  });

  it('a request that sent no token and was refused still ends the session (the shell asked for /me without one)', async () => {
    const onExpired = vi.fn();
    const { setSessionHandlers } = await import('../request/session');
    setSessionHandlers({ onExpired, onForbidden: vi.fn() });
    stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')));
    await apiRequest({ method: 'GET', url: '/me' }).catch(() => {});
    expect(onExpired).toHaveBeenCalledTimes(1);
    await apiRequest({ method: 'GET', url: '/me', anonymous: true }).catch(() => {});
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('the setup page goes back to plain sign-in when nothing was heading anywhere', async () => {
    setPendingEnroll({ enrollToken: 'e', otpauthUri: 'otpauth://x' });
    const user = userEvent.setup();
    renderPage(<Enroll />);
    await user.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(history.replace).toHaveBeenCalledWith('/user/login');
    expect(getPendingEnroll()).toBeUndefined();
  });

  it('tells how long to wait when the setup is locked, as the sign-in page does', async () => {
    setPendingEnroll({ enrollToken: 'e', otpauthUri: 'otpauth://x' });
    stubFetch(() => jsonResponse(429, envelope('RATE_LIMITED', { retryAfterSeconds: 60 })));
    const user = userEvent.setup();
    renderPage(<Enroll />);
    await user.type(screen.getByLabelText('Verification code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Finish setup' }));
    expect(
      await screen.findByText('Too many attempts. Try again in 1 minute.'),
    ).toBeInTheDocument();
  });
});

describe('the lock of the setup without a waiting time', () => {
  it('shows the text of the code, with no countdown, as the contract gives none for this lock', async () => {
    setPendingEnroll({ enrollToken: 'e', otpauthUri: 'otpauth://x' });
    stubFetch(() => jsonResponse(429, envelope('RATE_LIMITED')));
    const user = userEvent.setup();
    renderPage(<Enroll />);
    await user.type(screen.getByLabelText('Verification code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Finish setup' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Too many requests. Please try again later.');
    expect(alert.textContent).not.toMatch(/minute|NaN|undefined/);
  });
});

describe('a lost session while the account is being read', () => {
  it('gives no session, and forgets the tabs, when the token is refused between the account and the shared values', async () => {
    setToken('tok');
    localStorage.setItem(TABS_STORAGE_KEY, '["/dashboard"]');
    stubFetch((call) =>
      call.url.endsWith('/me')
        ? jsonResponse(200, meBody())
        : jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')),
    );
    expect(await loadSession()).toEqual({});
    expect(getToken()).toBeNull();
    expect(localStorage.getItem(TABS_STORAGE_KEY)).toBeNull();
  });

  it('forgets the tabs when the account is refused at the start', async () => {
    setToken('old');
    localStorage.setItem(TABS_STORAGE_KEY, '["/dashboard","/users/42"]');
    stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')));
    expect(await loadSession()).toEqual({});
    expect(localStorage.getItem(TABS_STORAGE_KEY)).toBeNull();
  });

  it('does not establish a session when the token is refused right after sign-in', async () => {
    stubFetch((call) =>
      call.url.endsWith('/me')
        ? jsonResponse(200, meBody())
        : jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')),
    );
    const { result } = renderHook(() => useSession());
    let target: string | undefined = 'unset';
    await act(async () => {
      target = await result.current.establish('tok');
    });
    expect(target).toBeUndefined();
    expect(getToken()).toBeNull();
  });
});

describe('refusals shown once', () => {
  it('shows one "no permission" notice for three refusals together', async () => {
    setToken('tok');
    setTestInitialState({ me: { permissions: [] } });
    stubFetch((call) =>
      call.url.endsWith('/me')
        ? jsonResponse(200, meBody())
        : jsonResponse(403, envelope('ADMIN_FORBIDDEN')),
    );
    renderPage(
      <SessionBridge>
        <div />
      </SessionBridge>,
    );
    await act(async () => {
      await Promise.all(
        [1, 2, 3].map(() => apiRequest({ method: 'GET', url: '/users' }).catch(() => {})),
      );
    });
    await waitFor(() =>
      expect(screen.getAllByText('You do not have permission to do this.').length).toBeGreaterThan(
        0,
      ),
    );
    expect(screen.getAllByText('You do not have permission to do this.')).toHaveLength(1);
  });
});

describe('messages follow the language', () => {
  it('writes the sign-in hint again in the new language', async () => {
    stubFetch(() => jsonResponse(401, envelope('ADMIN_TOTP_REQUIRED')));
    const user = userEvent.setup();
    const view = renderPage(<Login />);
    await user.type(screen.getByLabelText('User name'), 'ploy');
    await user.type(screen.getByLabelText('Password'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByText('Enter the code shown in your authenticator'),
    ).toBeInTheDocument();
    view.rerender(
      <IntlProvider locale="zh-CN" messages={zhCN} onError={() => {}}>
        <App>
          <Login />
        </App>
      </IntlProvider>,
    );
    expect(await screen.findByText(zhCN['auth.login.totpHint'])).toBeInTheDocument();
    expect(screen.queryByText(enUS['auth.login.totpHint'])).toBeNull();
  });

  it('says "1 minute" for a lock of one minute and "5 minutes" for five', async () => {
    const user = userEvent.setup();
    stubFetch(() => jsonResponse(429, envelope('RATE_LIMITED', { retryAfterSeconds: 1 })));
    renderPage(<Login />);
    await user.type(screen.getByLabelText('User name'), 'ploy');
    await user.type(screen.getByLabelText('Password'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByText('Too many attempts. Try again in 1 minute.'),
    ).toBeInTheDocument();
    vi.unstubAllGlobals();
    stubFetch(() => jsonResponse(429, envelope('RATE_LIMITED', { retryAfterSeconds: 300 })));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByText('Too many attempts. Try again in 5 minutes.'),
    ).toBeInTheDocument();
  });
});

describe('who may open pages of the shell', () => {
  it('nobody who must change the password first, whatever the permissions', () => {
    const me = { superAdmin: true, permissions: ['USER:VIEW'], mustChangePassword: true };
    expect(canAccess(me, undefined)).toBe(false);
    expect(canAccess(me, 'USER:VIEW')).toBe(false);
    expect(canAccess({ ...me, mustChangePassword: false }, 'USER:VIEW')).toBe(true);
    expect(canAccess({ superAdmin: false, permissions: [] }, undefined)).toBe(true);
  });
});

function Probe({ to }: { to: string }) {
  const go = useGoWhenSignedIn();
  return (
    <button type="button" onClick={() => go(to)}>
      go
    </button>
  );
}

describe('going on after sign-in when Umi commits the account a moment later', () => {
  it('does not navigate before the account is in the state', async () => {
    setTestInitialStateDelay(30);
    stubFetch(() => jsonResponse(200, meBody()));
    const user = userEvent.setup();
    const { result } = renderHook(() => useSession());
    renderPage(<Probe to="/dashboard" />);
    await user.click(screen.getByRole('button', { name: 'go' }));
    await act(async () => {
      await result.current.establish('tok').catch(() => {});
    });
    expect(history.replace).not.toHaveBeenCalled();
    await act(async () => {
      setTestInitialState({ me: { permissions: [] } });
    });
    await waitFor(() => expect(history.replace).toHaveBeenCalledWith('/dashboard'));
  });
});

describe('refreshPermissions', () => {
  it('reads the account again and puts it in the state', async () => {
    setToken('tok');
    setTestInitialState({ me: { permissions: ['USER:BAN'] } });
    const calls = stubFetch(() => jsonResponse(200, meBody({ permissions: ['USER:VIEW'] })));
    const { result } = renderHook(() => useSession());
    await act(async () => {
      await result.current.refreshPermissions();
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/admin/me');
    expect(result.current.me?.permissions).toEqual(['USER:VIEW']);
  });

  it('keeps what it has when the account cannot be read', async () => {
    setToken('tok');
    setTestInitialState({ me: { permissions: ['USER:BAN'] } });
    stubFetch(() => jsonResponse(500, envelope('INTERNAL_ERROR')));
    const { result } = renderHook(() => useSession());
    await act(async () => {
      await result.current.refreshPermissions();
    });
    expect(result.current.me?.permissions).toEqual(['USER:BAN']);
  });
});

describe('useSubmitOnce', () => {
  it('runs one task at a time, also when called twice in the same tick', async () => {
    let release: () => void = () => {};
    const task = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const { result } = renderHook(() => useSubmitOnce());
    act(() => {
      void result.current.run(task);
      void result.current.run(task);
    });
    expect(task).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe(true);
    await act(async () => release());
    expect(result.current.busy).toBe(false);
    await act(async () => {
      await result.current.run(async () => {});
    });
  });
});

describe('getAdminMeta', () => {
  it.each([[[1, 2]], ['text'], [null], [7]])(
    'gives an empty object for an answer that is %j',
    async (data) => {
      setToken('tok');
      stubFetch(() => jsonResponse(200, envelope('200', data)));
      expect(await getAdminMeta()).toEqual({});
    },
  );
});
