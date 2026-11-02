import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockPassword, resetStore } from '../../../../mock/_core/store';
import auth from '../../../../mock/auth.mock';
import { envelope, jsonResponse, stubFetch } from '../../../../tests/httpStubs';
import { useMockBackend } from '../../../../tests/mockBackend';
import { renderPage } from '../../../../tests/renderPage';
import {
  history,
  resetUmiStub,
  setTestInitialState,
  setTestLocation,
} from '../../../../tests/stubs/umi-max';
import { clearToken, getToken, resetSessionState, setToken } from '../../../request/session';
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

const TOTP_INVALID_EN =
  'The verification code is wrong, already used or expired, or your authenticator cannot be checked. If it keeps failing, ask a super administrator to reset your two-factor authentication.';

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
    expect(await screen.findByText(TOTP_INVALID_EN)).toBeInTheDocument();
    expect(screen.getByLabelText('Verification code')).toHaveValue('');
    expect(screen.getByLabelText('User name')).toHaveValue('ploy');
  });

  // 401 ADMIN_TOTP_INVALID also means the stored secret cannot be decrypted (a changed key, a damaged
  // row): the same answer as a wrong code, counted the same, so the page needs no special case, but
  // its words must cover that and say who can fix it.
  it('names the unreadable secret and the way out in the text for ADMIN_TOTP_INVALID, in both languages', async () => {
    stubFetch((call) =>
      bodyOf(call.init)?.totp
        ? jsonResponse(401, envelope('ADMIN_TOTP_INVALID'))
        : jsonResponse(401, envelope('ADMIN_TOTP_REQUIRED')),
    );
    const user = userEvent.setup();
    renderPage(<Login />, 'zh-CN');
    await user.type(screen.getByLabelText('用户名'), 'ploy');
    await user.type(screen.getByLabelText('密码'), 'pw');
    await user.click(screen.getByRole('button', { name: /登\s?录/ }));
    await user.type(await screen.findByLabelText('验证码'), '111111');
    await user.click(screen.getByRole('button', { name: /登\s?录/ }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('无法校验');
    expect(alert.textContent).toContain('联系超级管理员重置你的二次验证');
  });

  it('keeps the same page and the same request for a secret that cannot be decrypted: the lock of 429 follows after the same wrong answers', async () => {
    let tries = 0;
    stubFetch((call) => {
      if (!bodyOf(call.init)?.totp) return jsonResponse(401, envelope('ADMIN_TOTP_REQUIRED'));
      tries += 1;
      return tries < 3
        ? jsonResponse(401, envelope('ADMIN_TOTP_INVALID'))
        : jsonResponse(429, envelope('RATE_LIMITED', { retryAfterSeconds: 250 }));
    });
    const user = userEvent.setup();
    renderPage(<Login />);
    await fill(user, 'ploy', 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const code = await screen.findByLabelText('Verification code');
    for (let i = 0; i < 3; i++) {
      await user.type(code, '000000');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));
      await waitFor(() => expect(tries).toBe(i + 1));
    }
    expect(await screen.findByText(/5 minutes/)).toBeInTheDocument();
    expect(history.replace).not.toHaveBeenCalled();
  });

  it('shows the text of the code for a 429 that gives no waiting time (the limit by address and user name, before the password is checked), with no countdown and no failure of its own', async () => {
    stubFetch((call) =>
      bodyOf(call.init)?.totp
        ? jsonResponse(429, envelope('RATE_LIMITED'))
        : jsonResponse(401, envelope('ADMIN_TOTP_REQUIRED')),
    );
    const user = userEvent.setup();
    renderPage(<Login />);
    await fill(user, 'ploy', 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await user.type(await screen.findByLabelText('Verification code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Too many requests. Please try again later.');
    expect(alert.textContent).not.toMatch(/minute|NaN|undefined/);
    expect(history.replace).not.toHaveBeenCalled();
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

describe('someone who is already signed in opens the sign-in page', () => {
  const signedIn = (extra: Record<string, unknown> = {}) => {
    setToken('tok-existing');
    setTestInitialState({
      me: {
        id: '1',
        username: 'ploy',
        superAdmin: false,
        mustChangePassword: false,
        permissions: ['USER:VIEW'],
        passwordMinLength: 12,
        ...extra,
      },
      meta: {},
    });
  };

  it('is sent to the page named in the address', async () => {
    signedIn();
    setTestLocation({ search: `?redirect=${encodeURIComponent('/users/42?tab=x')}` });
    renderPage(<Login />);
    await waitFor(() => expect(history.replace).toHaveBeenCalledWith('/users/42?tab=x'));
  });

  it('is sent to the overview when the address names none, or names an address outside this site', async () => {
    signedIn();
    setTestLocation({ search: `?redirect=${encodeURIComponent('//evil.example')}` });
    renderPage(<Login />);
    await waitFor(() => expect(history.replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('is sent to the password change when the password must be changed first', async () => {
    signedIn({ mustChangePassword: true });
    renderPage(<Login />);
    await waitFor(() => expect(history.replace).toHaveBeenCalledWith('/user/change-password'));
  });

  it('stays on the page when the token is gone, whatever the state still says (just signed out)', async () => {
    signedIn();
    clearToken();
    renderPage(<Login />);
    await act(async () => {});
    expect(history.replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText('User name')).toBeInTheDocument();
  });
});

describe('the lock of the verification code, against the fake backend (backend answer 10)', () => {
  const enterCode = async (user: ReturnType<typeof userEvent.setup>, code: string) => {
    const box = await screen.findByLabelText('Verification code');
    await user.clear(box);
    await user.type(box, code);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
  };

  const LAST_TRY_EN = 'Another wrong code will lock sign-in for a while.';

  it('shows the wrong-code text for each of the first four wrong codes, the same text with a warning for the fifth, and the waiting time only from the sixth attempt', async () => {
    resetStore();
    const calls = useMockBackend({ default: auth });
    const user = userEvent.setup();
    renderPage(<Login />);
    await fill(user, 'root', mockPassword('root'));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    for (let i = 1; i <= 5; i++) {
      await enterCode(user, '111111');
      await waitFor(() =>
        expect(calls.filter((c) => c.body && 'totp' in (c.body as object)).length).toBe(i),
      );
      const alert = await screen.findByRole('alert');
      await waitFor(() => expect(alert.textContent).toContain(TOTP_INVALID_EN));
      if (i < 5) expect(alert.textContent).not.toContain(LAST_TRY_EN);
      else expect(alert.textContent).toContain(LAST_TRY_EN);
      expect(screen.queryByText(/Try again in/)).toBeNull();
    }
    await enterCode(user, '111111');
    expect(
      await screen.findByText('Too many attempts. Try again in 5 minutes.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(LAST_TRY_EN))).toBeNull();
    expect(history.replace).not.toHaveBeenCalled();
  });

  it('counts the wrong codes of one user name: another user name starts again, and a right code does not leave a count behind', async () => {
    resetStore();
    useMockBackend({ default: auth });
    const user = userEvent.setup();
    renderPage(<Login />);
    await fill(user, 'root', mockPassword('root'));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    for (let i = 0; i < 4; i++) {
      await enterCode(user, '111111');
      await waitFor(() =>
        expect(screen.queryByRole('alert')?.textContent).toContain(TOTP_INVALID_EN),
      );
    }
    // another user name: the fifth wrong code of the page is the first one of this name
    await user.clear(screen.getByLabelText('User name'));
    await user.type(screen.getByLabelText('User name'), 'support');
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), mockPassword('support'));
    await enterCode(user, '111111');
    await waitFor(() =>
      expect(screen.queryByRole('alert')?.textContent).toContain(TOTP_INVALID_EN),
    );
    expect(screen.getByRole('alert').textContent).not.toContain(LAST_TRY_EN);
  });

  it('says the warning in Chinese too', async () => {
    resetStore();
    const calls = useMockBackend({ default: auth });
    const user = userEvent.setup();
    renderPage(<Login />, 'zh-CN');
    await user.type(screen.getByLabelText('用户名'), 'root');
    await user.type(screen.getByLabelText('密码'), mockPassword('root'));
    await user.click(screen.getByRole('button', { name: /登\s?录/ }));
    for (let i = 0; i < 5; i++) {
      const box = await screen.findByLabelText('验证码');
      await user.clear(box);
      await user.type(box, '111111');
      await user.click(screen.getByRole('button', { name: /登\s?录/ }));
      await waitFor(() =>
        expect(calls.filter((c) => c.body && 'totp' in (c.body as object)).length).toBe(i + 1),
      );
      await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('无法校验'));
    }
    expect(screen.getByRole('alert').textContent).toContain('再输错一次将被暂时锁定');
  });

  it('shows the wrong-password text, not a lock, for a wrong password while the user name is locked', async () => {
    resetStore();
    useMockBackend({ default: auth });
    const { adminOf } = await import('../../../../mock/_core/testing');
    adminOf('root').lockedUntil = Date.now() + 120_000;
    const user = userEvent.setup();
    renderPage(<Login />);
    await fill(user, 'root', 'not-the-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Incorrect username or password.')).toBeInTheDocument();
    expect(screen.queryByText(/Try again in/)).toBeNull();
  });

  it('shows the minutes of the lock for the right password while it holds,', async () => {
    resetStore();
    useMockBackend({ default: auth });
    const { adminOf } = await import('../../../../mock/_core/testing');
    adminOf('root').lockedUntil = Date.now() + 120_000;
    const user = userEvent.setup();
    renderPage(<Login />);
    await fill(user, 'root', mockPassword('root'));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByText('Too many attempts. Try again in 2 minutes.'),
    ).toBeInTheDocument();
  });
});
