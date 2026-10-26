import { beforeEach, describe, expect, it } from 'vitest';
import { clearPendingEnroll, getPendingEnroll, setPendingEnroll } from './pendingEnroll';
import { DEFAULT_RETURN, gateFor, loginUrl, normalizePath, safeReturnUrl } from './returnUrl';

describe('safeReturnUrl', () => {
  it('keeps a path of this site, with its query', () => {
    expect(safeReturnUrl('/users/42?tab=x')).toBe('/users/42?tab=x');
    expect(safeReturnUrl('/users/list?name=%E0%B8%AA')).toBe('/users/list?name=%E0%B8%AA');
    expect(safeReturnUrl('/dashboard')).toBe('/dashboard');
  });

  it.each([
    '//evil.example',
    '//evil.example/path',
    'https://evil.example',
    'http://evil.example/x',
    'javascript:alert(1)',
    '/\\evil',
    '/\\\\evil.example',
    '\\\\evil.example',
    '/%5Cevil',
    'evil.example',
    '',
    '   ',
    'data:text/html,x',
    '/\tevil',
    '/\n/evil.example',
    '/ /evil',
    '///evil.example',
  ])('turns %j into the overview', (raw) => {
    expect(safeReturnUrl(raw)).toBe(DEFAULT_RETURN);
  });

  it('turns a missing or non-text value into the overview', () => {
    expect(safeReturnUrl(null)).toBe(DEFAULT_RETURN);
    expect(safeReturnUrl(undefined)).toBe(DEFAULT_RETURN);
    expect(safeReturnUrl(['/a'] as unknown as string)).toBe(DEFAULT_RETURN);
  });

  it('does not send a person back to the sign-in pages', () => {
    expect(safeReturnUrl('/user/login?redirect=%2Fusers')).toBe(DEFAULT_RETURN);
    expect(safeReturnUrl('/user/enroll')).toBe(DEFAULT_RETURN);
    expect(safeReturnUrl('/user/change-password')).toBe(DEFAULT_RETURN);
  });

  it('keeps Thai, Arabic and other scripts in the path', () => {
    expect(safeReturnUrl('/users/สมชาย')).toBe('/users/สมชาย');
    expect(safeReturnUrl('/users/أحمد?q=ñ')).toBe('/users/أحمد?q=ñ');
  });
});

describe('loginUrl', () => {
  it('puts the page the person was on in the address, encoded', () => {
    expect(loginUrl('/users/42', '?tab=x&y=1')).toBe(
      `/user/login?redirect=${encodeURIComponent('/users/42?tab=x&y=1')}`,
    );
  });

  it('reads back to the same path', () => {
    const url = loginUrl('/users/list', '?q=สม ชาย&a=b');
    const redirect = new URL(url, 'http://localhost').searchParams.get('redirect');
    expect(safeReturnUrl(redirect)).toBe('/users/list?q=สม ชาย&a=b');
  });

  it('has no redirect for the overview or for a sign-in page', () => {
    expect(loginUrl('/dashboard', '')).toBe('/user/login');
    expect(loginUrl('/', '')).toBe('/user/login');
    expect(loginUrl('/user/login', '?redirect=x')).toBe('/user/login');
    expect(loginUrl('/user/enroll', '')).toBe('/user/login');
  });
});

describe('gateFor: where a person who is not allowed on this page goes', () => {
  const at = (pathname: string, search = '') => ({ pathname, search });

  it('sends someone who is not signed in to the sign-in page, back to here afterwards', () => {
    expect(gateFor(at('/users/42', '?tab=x'), { me: undefined })).toBe(
      loginUrl('/users/42', '?tab=x'),
    );
  });

  it('lets a signed-in person stay', () => {
    expect(gateFor(at('/users/42'), { me: { mustChangePassword: false } })).toBeNull();
  });

  it('keeps someone who must change the password on the change-password page, from every other page', () => {
    for (const path of ['/dashboard', '/users/42', '/', '/nowhere']) {
      expect(gateFor(at(path), { me: { mustChangePassword: true } })).toBe('/user/change-password');
    }
    expect(gateFor(at('/user/change-password'), { me: { mustChangePassword: true } })).toBeNull();
  });

  it('sends someone who need not change the password away from the forced change page', () => {
    expect(gateFor(at('/user/change-password'), { me: { mustChangePassword: false } })).toBe(
      DEFAULT_RETURN,
    );
  });
});

describe('pending enrollment', () => {
  beforeEach(() => clearPendingEnroll());

  it('is kept in memory, not in a storage and not in the address', () => {
    setPendingEnroll({ enrollToken: 'secret-enroll', otpauthUri: 'otpauth://totp/x?secret=ABC' });
    expect(getPendingEnroll()?.enrollToken).toBe('secret-enroll');
    for (const storage of [localStorage, sessionStorage]) {
      const dump = JSON.stringify(Object.entries(storage));
      expect(dump).not.toContain('secret-enroll');
      expect(dump).not.toContain('ABC');
    }
    expect(window.location.href).not.toContain('secret-enroll');
  });

  it('is gone once cleared', () => {
    setPendingEnroll({ enrollToken: 'e', otpauthUri: 'u' });
    clearPendingEnroll();
    expect(getPendingEnroll()).toBeUndefined();
  });
});

describe('normalizePath', () => {
  it('reads a path the way the router does', () => {
    expect(normalizePath('/USER/Login')).toBe('/user/login');
    expect(normalizePath('/user/login/')).toBe('/user/login');
    expect(normalizePath('/user//login')).toBe('/user/login');
    expect(normalizePath('/user/./login')).toBe('/user/login');
    expect(normalizePath('/user/login?a=1')).toBe('/user/login');
    expect(normalizePath('/user/login#x')).toBe('/user/login');
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('')).toBe('/');
  });

  it('keeps a person away from the sign-in pages however the address is written', () => {
    for (const raw of [
      '/USER/login',
      '/user/login#x',
      '/user//login',
      '/user/./login',
      '/user/login/',
      '/User/Change-Password',
    ]) {
      expect(safeReturnUrl(raw), raw).toBe(DEFAULT_RETURN);
    }
  });

  it('treats the change-password page the same way for the guard', () => {
    expect(
      gateFor(
        { pathname: '/USER/CHANGE-PASSWORD/', search: '' },
        { me: { mustChangePassword: true } },
      ),
    ).toBeNull();
    expect(
      gateFor(
        { pathname: '/user/change-password/', search: '' },
        { me: { mustChangePassword: false } },
      ),
    ).toBe(DEFAULT_RETURN);
  });
});
