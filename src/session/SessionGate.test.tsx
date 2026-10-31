import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch, textResponse } from '../../tests/httpStubs';
import { renderPage } from '../../tests/renderPage';
import {
  history,
  resetUmiStub,
  setTestInitialState,
  setTestLocation,
  useModel,
} from '../../tests/stubs/umi-max';
import { TABS_STORAGE_KEY } from '../components/layout/TabManager';
import enUS from '../locales/en-US';
import { getToken, resetSessionState, setToken } from '../request/session';
import { SessionBridge } from './SessionBridge';
import { SessionGate } from './SessionGate';
import { useSession } from './useSession';

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
  setTestLocation({ pathname: '/users/42', search: '?tab=devices' });
});
afterEach(() => vi.unstubAllGlobals());

const page = () => <SessionGate>page content</SessionGate>;

describe('SessionGate', () => {
  it('shows the page to someone who is signed in', () => {
    setTestInitialState({ me });
    renderPage(page());
    expect(screen.getByText('page content')).toBeInTheDocument();
    expect(history.replace).not.toHaveBeenCalled();
  });

  it('shows the page, not the notice, to someone whose account is known even if the flag is still set', () => {
    setTestInitialState({ me, unavailable: true });
    renderPage(page());
    expect(screen.getByText('page content')).toBeInTheDocument();
    expect(screen.queryByText(enUS['error.GATEWAY_UNAVAILABLE'])).toBeNull();
  });

  it('sends someone who is not signed in to the sign-in page with the way back', () => {
    setTestInitialState({});
    renderPage(page());
    expect(screen.queryByText('page content')).toBeNull();
    expect(history.replace).toHaveBeenCalledWith(
      `/user/login?redirect=${encodeURIComponent('/users/42?tab=devices')}`,
    );
  });

  it('lets the person sign out from the unavailable notice, so a lasting error does not trap them: token gone, state cleared, tabs forgotten, sign-in page', async () => {
    setToken('tok');
    localStorage.setItem(TABS_STORAGE_KEY, '["/dashboard","/users/42"]');
    setTestInitialState({ unavailable: true });
    renderPage(page());
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(getToken()).toBeNull();
    expect(sessionStorage.getItem('avatar-admin.token')).toBeNull();
    expect(localStorage.getItem(TABS_STORAGE_KEY)).toBeNull();
    expect(history.replace).toHaveBeenCalledWith('/user/login');
    expect(screen.queryByText(enUS['error.GATEWAY_UNAVAILABLE'])).toBeNull();
  });

  it('keeps the token and the address, and shows the unavailable notice with a retry, when the account could not be read', () => {
    setToken('tok');
    setTestInitialState({ unavailable: true });
    renderPage(page());
    expect(screen.queryByText('page content')).toBeNull();
    expect(screen.getByText(enUS['error.GATEWAY_UNAVAILABLE'])).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(history.replace).not.toHaveBeenCalled();
    expect(history.push).not.toHaveBeenCalled();
    expect(getToken()).toBe('tok');
  });

  it('has the notice in Chinese too', () => {
    setToken('tok');
    setTestInitialState({ unavailable: true });
    renderPage(page(), 'zh-CN');
    expect(screen.getByText('服务暂时不可用，请稍后重试')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /重\s?试/ })).toBeInTheDocument();
  });

  it('retry reads the account again and, when it works, shows the page at the same address', async () => {
    setToken('tok');
    setTestInitialState({ unavailable: true });
    const calls = stubFetch((call) =>
      jsonResponse(
        200,
        call.url.endsWith('/me') ? meBody() : envelope('200', { maxRecipients: null }),
      ),
    );
    const user = userEvent.setup();
    renderPage(page());
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('page content')).toBeInTheDocument();
    expect(calls.filter((c) => c.url.endsWith('/me'))).toHaveLength(1);
    expect(history.replace).not.toHaveBeenCalled();
    expect(history.push).not.toHaveBeenCalled();
    expect(getToken()).toBe('tok');
  });

  it('retry that meets the gateway page again stays on the notice, keeps the token, and can be tried again', async () => {
    setToken('tok');
    setTestInitialState({ unavailable: true });
    const calls = stubFetch(() => textResponse(503, '<html>gateway</html>'));
    const user = userEvent.setup();
    renderPage(page());
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole('button', { name: /Retry/ })).toBeEnabled());
    expect(screen.getByText(enUS['error.GATEWAY_UNAVAILABLE'])).toBeInTheDocument();
    expect(history.replace).not.toHaveBeenCalled();
    expect(getToken()).toBe('tok');
    await user.click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(calls).toHaveLength(2));
  });

  it('retry that finds the token refused goes to sign-in with the way back, once', async () => {
    setToken('tok');
    setTestInitialState({ unavailable: true });
    stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')));
    const user = userEvent.setup();
    renderPage(page());
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(history.replace).toHaveBeenCalledWith(
        `/user/login?redirect=${encodeURIComponent('/users/42?tab=devices')}`,
      ),
    );
    expect(getToken()).toBeNull();
  });

  it('two quick clicks on retry read the account once', async () => {
    setToken('tok');
    setTestInitialState({ unavailable: true });
    let release: (r: Response) => void = () => {};
    const calls = stubFetch(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    renderPage(page());
    const button = screen.getByRole('button', { name: 'Retry' });
    // Both clicks land before the button has been redrawn as busy.
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(calls).toHaveLength(1);
    release(textResponse(503, '<html>gateway</html>'));
    await waitFor(() => expect(screen.getByRole('button', { name: /Retry/ })).toBeEnabled());
  });

  it('retry sends an account that must change its password to that page', async () => {
    setToken('tok');
    setTestInitialState({ unavailable: true });
    stubFetch(() => jsonResponse(200, meBody({ mustChangePassword: true })));
    const user = userEvent.setup();
    renderPage(page());
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(history.replace).toHaveBeenCalledWith('/user/change-password'));
  });

  it('sends the person to sign-in after signing out, even if the notice was showing before', async () => {
    setToken('tok');
    setTestInitialState({ unavailable: true });
    renderPage(page());
    expect(history.replace).not.toHaveBeenCalled();
    // Signing out leaves an empty state (see useSession.signOut): "not signed in", not "unavailable".
    act(() => setTestInitialState({}));
    await waitFor(() =>
      expect(history.replace).toHaveBeenCalledWith(
        `/user/login?redirect=${encodeURIComponent('/users/42?tab=devices')}`,
      ),
    );
    expect(screen.queryByText(enUS['error.GATEWAY_UNAVAILABLE'])).toBeNull();
  });
});

function Show() {
  const { initialState } = useModel('@@initialState') as {
    initialState?: { me?: { username: string }; meta?: object; unavailable?: boolean };
  };
  return (
    <div data-testid="state">
      {JSON.stringify({
        me: initialState?.me?.username ?? null,
        meta: initialState?.meta ?? null,
        unavailable: initialState?.unavailable ?? false,
      })}
    </div>
  );
}
const shown = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}');
const withBridge = () => (
  <SessionBridge>
    <SessionGate>page content</SessionGate>
    <Show />
  </SessionBridge>
);

/** /me of the first account hangs until the test releases it; any other token is answered at once. */
function holdFirstAccountRead() {
  const held: { release: (r: Response) => void; reject: () => void } = {
    release: () => {},
    reject: () => {},
  };
  const calls = stubFetch((call) => {
    const isMe = call.url.endsWith('/me');
    if (isMe && call.init.headers.Authorization === 'Bearer tokA')
      return new Promise<Response>((resolve, reject) => {
        held.release = resolve;
        held.reject = () => reject(new TypeError('offline'));
      });
    if (isMe) return Promise.resolve(jsonResponse(200, meBody({ username: 'bob' })));
    return Promise.resolve(jsonResponse(200, envelope('200', { maxRecipients: 1 })));
  });
  return { held, calls };
}

describe('a retry still on its way when the person signs out', () => {
  it('writes nothing when the old read comes back, asks nothing more, and does not say the session expired', async () => {
    setToken('tokA');
    setTestInitialState({ unavailable: true });
    let held: (r: Response) => void = () => {};
    const calls = stubFetch((call) =>
      call.url.endsWith('/me')
        ? new Promise<Response>((resolve) => {
            held = resolve;
          })
        : Promise.resolve(jsonResponse(401, envelope('ADMIN_INVALID_TOKEN'))),
    );
    renderPage(withBridge());
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    history.replace.mockClear();
    await act(async () => {
      held(jsonResponse(200, meBody()));
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(calls.map((c) => c.url)).toEqual(['/api/admin/me']);
    expect(shown()).toEqual({ me: null, meta: null, unavailable: false });
    expect(history.replace).not.toHaveBeenCalled();
    expect(screen.queryByText(enUS['error.ADMIN_INVALID_TOKEN'])).toBeNull();
    expect(getToken()).toBeNull();
  });

  it('does not put the old account over the one that signed in meanwhile', async () => {
    setToken('tokA');
    setTestInitialState({ unavailable: true });
    const { held } = holdFirstAccountRead();
    renderPage(withBridge());
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    const { result } = renderHook(() => useSession());
    await act(async () => {
      await result.current.establish('tokB');
    });
    expect(shown().me).toBe('bob');
    await act(async () => {
      held.release(jsonResponse(200, meBody({ username: 'ploy-OLD' })));
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(shown()).toEqual({ me: 'bob', meta: { maxRecipients: 1 }, unavailable: false });
    expect(getToken()).toBe('tokB');
  });

  it('does not bring the notice back over the account that signed in meanwhile when the old read fails', async () => {
    setToken('tokA');
    setTestInitialState({ unavailable: true });
    const { held } = holdFirstAccountRead();
    renderPage(withBridge());
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    const { result } = renderHook(() => useSession());
    await act(async () => {
      await result.current.establish('tokB');
    });
    await act(async () => {
      held.reject();
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(shown().me).toBe('bob');
    expect(shown().unavailable).toBe(false);
    expect(screen.queryByText(enUS['error.GATEWAY_UNAVAILABLE'])).toBeNull();
    expect(getToken()).toBe('tokB');
  });
});

describe('a retry that meets a refusal of /me itself', () => {
  it('shows no "no permission" notice and does not read /me a second time on its own', async () => {
    setToken('tok');
    setTestInitialState({ unavailable: true });
    let meCalls = 0;
    const calls = stubFetch((call) => {
      if (call.url.endsWith('/me')) {
        meCalls += 1;
        return Promise.resolve(
          meCalls === 1
            ? jsonResponse(403, envelope('ADMIN_FORBIDDEN'))
            : jsonResponse(200, meBody()),
        );
      }
      return Promise.resolve(jsonResponse(200, envelope('200', { maxRecipients: 1 })));
    });
    renderPage(withBridge());
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Retry/ })).toBeEnabled());
    await new Promise((r) => setTimeout(r, 60));
    expect(calls.filter((c) => c.url.endsWith('/me'))).toHaveLength(1);
    expect(screen.queryByText(enUS['error.ADMIN_FORBIDDEN'])).toBeNull();
    expect(shown().unavailable).toBe(true);
    expect(shown().me).toBeNull();
  });
});
