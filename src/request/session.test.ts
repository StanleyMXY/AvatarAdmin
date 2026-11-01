import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearToken,
  getToken,
  handleForbidden,
  handleTokenExpired,
  resetSessionState,
  setSessionHandlers,
  setToken,
} from './session';

const KEY = 'avatar-admin.token';

beforeEach(() => {
  resetSessionState();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('token storage', () => {
  it('has no token at first', () => {
    expect(getToken()).toBeNull();
  });

  it('keeps the token in memory and in sessionStorage', () => {
    setToken('abc');
    expect(getToken()).toBe('abc');
    expect(sessionStorage.getItem(KEY)).toBe('abc');
  });

  it('never writes the token to localStorage', () => {
    const local = vi.spyOn(localStorage, 'setItem');
    setToken('abc');
    clearToken();
    setToken('def');
    expect(local).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(Object.keys(localStorage)).toEqual([]);
  });

  it('comes back after a page reload (memory empty, sessionStorage set)', () => {
    sessionStorage.setItem(KEY, 'from-before-reload');
    resetSessionState();
    expect(getToken()).toBe('from-before-reload');
  });

  it('clearToken removes it from memory and sessionStorage', () => {
    setToken('abc');
    clearToken();
    expect(getToken()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('works from memory when sessionStorage cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => setToken('abc')).not.toThrow();
    expect(getToken()).toBe('abc');
    expect(localStorage.length).toBe(0);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('works from memory when sessionStorage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    resetSessionState();
    expect(() => getToken()).not.toThrow();
    expect(getToken()).toBeNull();
    setToken('abc');
    expect(getToken()).toBe('abc');
  });

  it('a token cannot come back from sessionStorage after clearToken when removal failed', () => {
    setToken('abc');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(() => clearToken()).not.toThrow();
    expect(getToken()).toBeNull();
  });

  it('clearToken as the very first call of a page load: when storage refuses the removal, the token is not read back', () => {
    sessionStorage.setItem(KEY, 'left-over');
    resetSessionState();
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(() => clearToken()).not.toThrow();
    expect(getToken()).toBeNull();
  });

  it('signing out is clearToken: afterwards not even a fresh page load finds the token', () => {
    setToken('abc');
    clearToken();
    resetSessionState();
    expect(getToken()).toBeNull();
  });

  it('resetSessionState alone does not sign anyone out (the token is read back from sessionStorage)', () => {
    setToken('abc');
    resetSessionState();
    expect(getToken()).toBe('abc');
  });

  it('does not put the token anywhere but sessionStorage', () => {
    setToken('secret-token-value');
    const everything = JSON.stringify({ ...localStorage });
    expect(everything).not.toContain('secret-token-value');
  });
});

describe('session handlers', () => {
  it('calls onExpired once for the same token, however many requests report it', () => {
    const onExpired = vi.fn();
    setSessionHandlers({ onExpired, onForbidden: vi.fn() });
    setToken('abc');
    handleTokenExpired('abc');
    handleTokenExpired('abc');
    handleTokenExpired('abc');
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(getToken()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('ignores an expiry report that belongs to an older token than the current one', () => {
    const onExpired = vi.fn();
    setSessionHandlers({ onExpired, onForbidden: vi.fn() });
    setToken('old');
    setToken('new');
    handleTokenExpired('old');
    expect(onExpired).not.toHaveBeenCalled();
    expect(getToken()).toBe('new');
  });

  it('reports again after a new login', () => {
    const onExpired = vi.fn();
    setSessionHandlers({ onExpired, onForbidden: vi.fn() });
    setToken('a');
    handleTokenExpired('a');
    setToken('b');
    handleTokenExpired('b');
    expect(onExpired).toHaveBeenCalledTimes(2);
  });

  it('reports once when no token was sent at all (the login page asking for /me)', () => {
    const onExpired = vi.fn();
    setSessionHandlers({ onExpired, onForbidden: vi.fn() });
    handleTokenExpired(null);
    handleTokenExpired(null);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('calls onForbidden every time', () => {
    const onForbidden = vi.fn();
    setSessionHandlers({ onExpired: vi.fn(), onForbidden });
    handleForbidden();
    handleForbidden();
    expect(onForbidden).toHaveBeenCalledTimes(2);
  });

  it('does nothing and does not crash before handlers are set', () => {
    setToken('abc');
    expect(() => handleTokenExpired('abc')).not.toThrow();
    expect(() => handleForbidden()).not.toThrow();
    expect(getToken()).toBeNull();
  });

  it('a handler that throws does not leave the token in place, and its error does not reach the caller', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    setSessionHandlers({
      onExpired: () => {
        throw new Error('boom');
      },
      onForbidden: vi.fn(),
    });
    setToken('abc');
    expect(() => handleTokenExpired('abc')).not.toThrow();
    expect(getToken()).toBeNull();
    // The failure is not swallowed silently: it is logged once, with the project tag and no token.
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain('[avatar-admin]');
    expect(JSON.stringify(log.mock.calls)).not.toContain('abc');
  });

  it('a forbidden handler that throws does not reach the caller either', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    setSessionHandlers({
      onExpired: vi.fn(),
      onForbidden: () => {
        throw new Error('boom');
      },
    });
    expect(() => handleForbidden()).not.toThrow();
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain('[avatar-admin]');
  });

  it('a handler that throws does not stop the next expiry after a new login', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onExpired = vi.fn(() => {
      throw new Error('boom');
    });
    setSessionHandlers({ onExpired, onForbidden: vi.fn() });
    setToken('one');
    handleTokenExpired('one');
    setToken('two');
    handleTokenExpired('two');
    expect(onExpired).toHaveBeenCalledTimes(2);
  });
});
