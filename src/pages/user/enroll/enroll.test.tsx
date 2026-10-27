import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch } from '../../../../tests/httpStubs';
import { renderPage } from '../../../../tests/renderPage';
import { history, resetUmiStub, setTestInitialState } from '../../../../tests/stubs/umi-max';
import { getToken, resetSessionState } from '../../../request/session';
import {
  clearPendingEnroll,
  getPendingEnroll,
  setPendingEnroll,
} from '../../../session/pendingEnroll';
import Enroll from './index';

const OTPAUTH = 'otpauth://totp/Admin:ploy?secret=JBSWY3DPEHPK3PXP&issuer=Admin';

const meAnswer = envelope('200', {
  id: '1',
  username: 'fresh',
  superAdmin: false,
  mustChangePassword: false,
  permissions: ['STATS:VIEW'],
  passwordMinLength: 12,
});

beforeEach(() => {
  resetUmiStub();
  sessionStorage.clear();
  localStorage.clear();
  resetSessionState();
  setTestInitialState({});
  setPendingEnroll({ enrollToken: 'enroll-secret', otpauthUri: OTPAUTH });
});
afterEach(() => {
  vi.unstubAllGlobals();
  clearPendingEnroll();
});

describe('the authenticator setup page', () => {
  it('draws the QR code itself: an svg, no image address, no request to any other site', () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', {})));
    const { container } = renderPage(<Enroll />);
    const qr = screen.getByRole('img', { name: 'Authenticator QR code' });
    expect(qr.querySelector('svg')).not.toBeNull();
    const withAddress = [...container.querySelectorAll('img, image, [src], [href]')].filter((el) =>
      /^https?:/i.test(el.getAttribute('src') ?? el.getAttribute('href') ?? ''),
    );
    // (the logo is a path of this site, never an address of another site)
    expect(withAddress).toEqual([]);
    expect(calls).toHaveLength(0);
    expect(container.innerHTML).not.toContain('JBSWY3DPEHPK3PXP'); // the secret is only inside the drawing, not as text
  });

  it('sends the token and the code, then signs in and goes on', async () => {
    const calls = stubFetch((call) =>
      call.url.endsWith('/totp/enroll')
        ? jsonResponse(200, envelope('200', { token: 'tok-new', expiresAt: 'x' }))
        : jsonResponse(200, call.url.endsWith('/me') ? meAnswer : envelope('200', {})),
    );
    const user = userEvent.setup();
    renderPage(<Enroll />);
    await user.type(screen.getByLabelText('Verification code'), ' 000000 ');
    await user.click(screen.getByRole('button', { name: 'Finish setup' }));
    await waitFor(() => expect(history.replace).toHaveBeenCalledWith('/dashboard'));
    await new Promise((r) => setTimeout(r, 50));
    expect(history.replace).toHaveBeenCalledTimes(1); // and not back to sign-in
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      enrollToken: 'enroll-secret',
      totp: '000000',
    });
    expect(getToken()).toBe('tok-new');
    expect(getPendingEnroll()).toBeUndefined();
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain('tok-new');
  });

  it('goes to the page the sign-in was heading for', async () => {
    setPendingEnroll({ enrollToken: 'e', otpauthUri: OTPAUTH, redirect: '/users/list?x=1' });
    stubFetch((call) =>
      call.url.endsWith('/totp/enroll')
        ? jsonResponse(200, envelope('200', { token: 't', expiresAt: 'x' }))
        : jsonResponse(200, call.url.endsWith('/me') ? meAnswer : envelope('200', {})),
    );
    const user = userEvent.setup();
    renderPage(<Enroll />);
    await user.type(screen.getByLabelText('Verification code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Finish setup' }));
    await waitFor(() => expect(history.replace).toHaveBeenCalledWith('/users/list?x=1'));
  });

  it('keeps the token and empties the box when the code is wrong', async () => {
    stubFetch(() => jsonResponse(401, envelope('ADMIN_TOTP_INVALID')));
    const user = userEvent.setup();
    renderPage(<Enroll />);
    await user.type(screen.getByLabelText('Verification code'), '111111');
    await user.click(screen.getByRole('button', { name: 'Finish setup' }));
    expect(
      await screen.findByText('The verification code is wrong, already used, or expired.'),
    ).toBeInTheDocument();
    expect(getPendingEnroll()?.enrollToken).toBe('enroll-secret');
    expect(screen.getByLabelText('Verification code')).toHaveValue('');
    expect(history.replace).not.toHaveBeenCalled();
  });

  it('goes back to sign-in, forgetting the token, when the enrollment token has expired', async () => {
    stubFetch(() => jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')));
    const user = userEvent.setup();
    renderPage(<Enroll />);
    await user.type(screen.getByLabelText('Verification code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Finish setup' }));
    await waitFor(() => expect(history.replace).toHaveBeenCalledWith('/user/login'));
    expect(getPendingEnroll()).toBeUndefined();
  });

  it('shows the lock when there were too many wrong codes', async () => {
    stubFetch(() => jsonResponse(429, envelope('RATE_LIMITED')));
    const user = userEvent.setup();
    renderPage(<Enroll />);
    await user.type(screen.getByLabelText('Verification code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Finish setup' }));
    expect(
      await screen.findByText('Too many requests. Please try again later.'),
    ).toBeInTheDocument();
  });

  it('goes to sign-in at once when there is nothing to set up (opened directly, or after a reload)', async () => {
    clearPendingEnroll();
    const { container } = renderPage(<Enroll />);
    await waitFor(() => expect(history.replace).toHaveBeenCalledWith('/user/login'));
    expect(container.querySelector('svg')).toBeNull();
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
    renderPage(<Enroll />);
    await user.type(screen.getByLabelText('Verification code'), '000000');
    const button = screen.getByRole('button', { name: /Finish setup/ });
    await user.click(button);
    await user.click(button);
    expect(calls).toHaveLength(1);
    release(jsonResponse(401, envelope('ADMIN_TOTP_INVALID')));
    await screen.findByText('The verification code is wrong, already used, or expired.');
  });

  it('asks for a code before it sends anything', async () => {
    const calls = stubFetch(() => jsonResponse(200, envelope('200', {})));
    const user = userEvent.setup();
    renderPage(<Enroll />);
    await user.click(screen.getByRole('button', { name: 'Finish setup' }));
    expect(await screen.findByText('Enter the verification code')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});
