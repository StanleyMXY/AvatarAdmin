import { act, screen, waitFor } from '@testing-library/react';
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
import { getToken, resetSessionState } from '../../../request/session';
import { clearPendingEnroll, getPendingEnroll } from '../../../session/pendingEnroll';
import Login from './index';

const meOf = (extra: Record<string, unknown> = {}) =>
  envelope('200', {
    id: '1',
    username: 'ploy',
    superAdmin: false,
    mustChangePassword: false,
    permissions: ['USER:VIEW'],
    passwordMinLength: 12,
    ...extra,
  });

type Call = { url: string; body: Record<string, unknown> | null };
const bodyOf = (init: RequestInit) => (init.body ? JSON.parse(init.body as string) : null);

beforeEach(() => {
  resetUmiStub();
  sessionStorage.clear();
  localStorage.clear();
  resetSessionState();
  clearPendingEnroll();
  setTestInitialState({});
  setTestLocation({ pathname: '/user/login', search: '' });
});
afterEach(() => vi.unstubAllGlobals());

async function fill(user: ReturnType<typeof userEvent.setup>, username: string, password: string) {
  await user.type(screen.getByLabelText('User name'), username);
  await user.type(screen.getByLabelText('Password'), password);
}

describe('the sign-in page', () => {
  it('asks for the user name and the password, and not for a code at first', () => {
    renderPage(<Login />);
    expect(screen.getByLabelText('User name')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.queryByLabelText('Verification code')).toBeNull();
  });

  it('asks for the user name and the password before it sends anything', async () => {
    const calls = stubFetch(() => jsonResponse(200, meOf()));
    const user = userEvent.setup();
    renderPage(<Login />);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your user name')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('shows the code box after ADMIN_TOTP_REQUIRED and signs in again with the same name, password and the code', async () => {
    const calls: Call[] = [];
    stubFetch((call) => {
      calls.push({ url: call.url, body: bodyOf(call.init) });
      if (call.url.endsWith('/auth/login')) {
        const body = bodyOf(call.init);
        return body.totp
          ? jsonResponse(200, envelope('200', { token: 'tok-1', expiresAt: 'x' }))
          : jsonResponse(401, envelope('ADMIN_TOTP_REQUIRED'));
      }
      return jsonResponse(200, call.url.endsWith('/me') ? meOf() : envelope('200', {}));
    });
    const user = userEvent.setup();
    renderPage(<Login />);
    await fill(user, 'ploy', 'pass word ');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const code = await screen.findByLabelText('Verification code');
    await user.type(code, '000000');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(history.replace).toHaveBeenCalledWith('/dashboard'));
    const logins = calls.filter((c) => c.url.endsWith('/auth/login'));
    expect(logins[0].body).toEqual({ username: 'ploy', password: 'pass word ' });
    expect(logins[1].body).toEqual({ username: 'ploy', password: 'pass word ', totp: '000000' });
  });

  it('keeps the token in sessionStorage, not in localStorage, and reads the account after signing in', async () => {
    const calls: string[] = [];
    stubFetch((call) => {
      calls.push(call.url);
      return call.url.endsWith('/auth/login')
        ? jsonResponse(200, envelope('200', { token: 'tok-secret', expiresAt: 'x' }))
        : jsonResponse(
            200,
            call.url.endsWith('/me') ? meOf() : envelope('200', { maxRecipients: null }),
          );
    });
    const user = userEvent.setup();
    renderPage(<Login />);
    await fill(user, 'ploy', 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(history.replace).toHaveBeenCalled());
    expect(getToken()).toBe('tok-secret');
    expect(sessionStorage.getItem('avatar-admin.token')).toBe('tok-secret');
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain('tok-secret');
    expect(calls).toEqual(['/api/admin/auth/login', '/api/admin/me', '/api/admin/meta']);
  });

  it('goes to the page the person came from, when it is a page of this site', async () => {
    setTestLocation({ search: `?redirect=${encodeURIComponent('/users/42?tab=x')}` });
    stubFetch((call) =>
      call.url.endsWith('/auth/login')
        ? jsonResponse(200, envelope('200', { token: 't', expiresAt: 'x' }))
        : jsonResponse(200, call.url.endsWith('/me') ? meOf() : envelope('200', {})),
    );
    const user = userEvent.setup();
    renderPage(<Login />);
    await fill(user, 'ploy', 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(history.replace).toHaveBeenCalledWith('/users/42?tab=x'));
  });

  it.each(['//evil.example', 'https://evil.example', 'javascript:alert(1)', '/\\evil'])(
    'does not follow the address %s after signing in',
    async (bad) => {
      setTestLocation({ search: `?redirect=${encodeURIComponent(bad)}` });
      stubFetch((call) =>
        call.url.endsWith('/auth/login')
          ? jsonResponse(200, envelope('200', { token: 't', expiresAt: 'x' }))
          : jsonResponse(200, call.url.endsWith('/me') ? meOf() : envelope('200', {})),
      );
      const user = userEvent.setup();
      renderPage(<Login />);
      await fill(user, 'ploy', 'pw');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));
      await waitFor(() => expect(history.replace).toHaveBeenCalledWith('/dashboard'));
    },
  );

  it('sends an account that must change its password to that page, and does not read the shared values', async () => {
    const calls: string[] = [];
    stubFetch((call) => {
      calls.push(call.url);
      return call.url.endsWith('/auth/login')
        ? jsonResponse(200, envelope('200', { token: 't', expiresAt: 'x' }))
        : jsonResponse(200, meOf({ mustChangePassword: true }));
    });
    const user = userEvent.setup();
    renderPage(<Login />);
    await fill(user, 'newhire', 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(history.replace).toHaveBeenCalledWith('/user/change-password'));
    expect(calls).not.toContain('/api/admin/meta');
  });

  it('shows "user name or password wrong" for ADMIN_INVALID_CREDENTIALS and keeps what was typed', async () => {
    stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_CREDENTIALS')));
    const user = userEvent.setup();
    renderPage(<Login />);
    await fill(user, 'ploy', 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Incorrect username or password.')).toBeInTheDocument();
    expect(screen.getByLabelText('User name')).toHaveValue('ploy');
    expect(getToken()).toBeNull();
    expect(history.replace).not.toHaveBeenCalled();
  });

  it('says the code is wrong for ADMIN_TOTP_INVALID and empties the code box', async () => {
    stubFetch((call) => {
      const body = bodyOf(call.init);
      return body.totp
        ? jsonResponse(401, envelope('ADMIN_TOTP_INVALID'))
        : jsonResponse(401, envelope('ADMIN_TOTP_REQUIRED'));
    });
    const user = userEvent.setup();
    renderPage(<Login />);
    await fill(user, 'ploy', 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const code = await screen.findByLabelText('Verification code');
    await user.type(code, '111111');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByText('The verification code is wrong, already used, or expired.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Verification code')).toHaveValue('');
    expect(screen.getByLabelText('User name')).toHaveValue('ploy');
  });

  it('goes to the setup page for ENROLL_REQUIRED, with the token in memory and not in the address or any storage', async () => {
    stubFetch(() =>
      jsonResponse(
        200,
        envelope('200', {
          status: 'ENROLL_REQUIRED',
          enrollToken: 'enroll-secret-1',
          otpauthUri: 'otpauth://totp/x?secret=ABCDEF',
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage(<Login />);
    await fill(user, 'fresh', 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(history.replace).toHaveBeenCalledWith('/user/enroll'));
    expect(getPendingEnroll()?.enrollToken).toBe('enroll-secret-1');
    expect(JSON.stringify(history.replace.mock.calls)).not.toContain('enroll-secret-1');
    const stored = JSON.stringify([
      ...Object.entries(localStorage),
      ...Object.entries(sessionStorage),
    ]);
    expect(stored).not.toContain('enroll-secret-1');
    expect(getToken()).toBeNull();
  });

  it('tells how long to wait when the sign-in is locked, and generally when it does not say', async () => {
    stubFetch(() => jsonResponse(429, envelope('RATE_LIMITED', { retryAfterSeconds: 250 })));
    const user = userEvent.setup();
    renderPage(<Login />);
    await fill(user, 'ploy', 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByText('Too many attempts. Try again in 5 minutes.'),
    ).toBeInTheDocument();
    vi.unstubAllGlobals();
    stubFetch(() => jsonResponse(429, envelope('RATE_LIMITED')));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByText('Too many requests. Please try again later.'),
    ).toBeInTheDocument();
  });

  it('shows a network failure as such', async () => {
    stubFetch(() => {
      throw new TypeError('offline');
    });
    const user = userEvent.setup();
    renderPage(<Login />);
    await fill(user, 'ploy', 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByText('Network error. Check your connection and try again.'),
    ).toBeInTheDocument();
  });

  it('sends one request when the button is pressed many times, and Enter on top of it', async () => {
    let resolve: (r: Response) => void = () => {};
    const calls = stubFetch(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    const user = userEvent.setup();
    renderPage(<Login />);
    await fill(user, 'ploy', 'pw');
    const button = screen.getByRole('button', { name: /Sign in/ });
    await user.click(button);
    await user.click(button);
    await user.type(screen.getByLabelText('Password'), '{Enter}');
    expect(calls).toHaveLength(1);
    await act(async () => {
      resolve(jsonResponse(401, envelope('ADMIN_INVALID_CREDENTIALS')));
    });
    expect(await screen.findByText('Incorrect username or password.')).toBeInTheDocument();
  });

  it('sends the password as typed, without trimming or hashing, and trims only the user name', async () => {
    const calls = stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_CREDENTIALS')));
    const user = userEvent.setup();
    renderPage(<Login />);
    await user.type(screen.getByLabelText('User name'), '  ploy ');
    await user.type(screen.getByLabelText('Password'), ' pw Ü ');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('Incorrect username or password.');
    expect(bodyOf(calls[0].init)).toEqual({ username: 'ploy', password: ' pw Ü ' });
    expect(calls[0].init.headers.Authorization).toBeUndefined();
  });

  it('works with user names and passwords in Thai, Arabic, Vietnamese, Indonesian, Spanish and Chinese', {
    timeout: 30000,
  }, async () => {
    const calls = stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_CREDENTIALS')));
    const user = userEvent.setup();
    renderPage(<Login />);
    const names = ['สมชาย', 'أحمد', 'Nguyễn', 'Budi', 'José', '王小明'];
    for (const name of names) {
      await user.clear(screen.getByLabelText('User name'));
      await user.type(screen.getByLabelText('User name'), name);
      await user.clear(screen.getByLabelText('Password'));
      await user.type(screen.getByLabelText('Password'), `${name}-ผ่าน`);
      await user.click(screen.getByRole('button', { name: 'Sign in' }));
      await waitFor(() => expect(calls.length).toBeGreaterThan(names.indexOf(name)));
    }
    expect(calls.map((c) => bodyOf(c.init).username)).toEqual(names);
  });

  it('is written in Chinese when the language is Chinese', () => {
    renderPage(<Login />, 'zh-CN');
    expect(screen.getByLabelText('用户名')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
  });

  it('does not stay signed in when the account cannot be read after a token was given', async () => {
    stubFetch((call) =>
      call.url.endsWith('/auth/login')
        ? jsonResponse(200, envelope('200', { token: 'tok', expiresAt: 'x' }))
        : jsonResponse(500, envelope('INTERNAL_ERROR')),
    );
    const user = userEvent.setup();
    renderPage(<Login />);
    await fill(user, 'ploy', 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByText('Signed in, but your account could not be read. Try again.'),
    ).toBeInTheDocument();
    expect(getToken()).toBeNull();
    expect(history.replace).not.toHaveBeenCalled();
  });

  it('hands the page the person was going to on to the setup page', async () => {
    setTestLocation({ search: `?redirect=${encodeURIComponent('/users/42?tab=x')}` });
    stubFetch(() =>
      jsonResponse(
        200,
        envelope('200', { status: 'ENROLL_REQUIRED', enrollToken: 'e', otpauthUri: 'otpauth://x' }),
      ),
    );
    const user = userEvent.setup();
    renderPage(<Login />);
    await fill(user, 'fresh', 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(getPendingEnroll()?.redirect).toBe('/users/42?tab=x'));
  });
});
