import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FAKE_TOTP_CODE, issueToken, mockPassword, resetStore, store } from './store';
import { adminOf } from './testing';

beforeEach(() => resetStore());

describe('the store', () => {
  it('has the six preset administrators', () => {
    expect([...store.admins.values()].map((a) => a.username)).toEqual([
      'root',
      'support',
      'finance',
      'reviewer',
      'newhire',
      'fresh',
    ]);
    expect(adminOf('root').superAdmin).toBe(true);
    expect(adminOf('newhire').mustChangePassword).toBe(true);
    expect(adminOf('fresh').totpEnrolled).toBe(false);
    expect(adminOf('support').totpEnrolled).toBe(true);
  });

  it('uses fake passwords of the form mock-password-<name>, all at least 12 characters', () => {
    for (const admin of store.admins.values()) {
      expect(admin.password).toBe(mockPassword(admin.username));
      expect(admin.password.length).toBeGreaterThanOrEqual(12);
    }
    expect(FAKE_TOTP_CODE).toBe('000000');
  });

  it('resetStore puts everything back, also tokens', () => {
    const { token } = issueToken(adminOf('root'));
    adminOf('support').status = 'DISABLED';
    resetStore();
    expect(store.tokens.has(token)).toBe(false);
    expect(adminOf('support').status).toBe('ACTIVE');
  });

  it('survives the mock files being loaded again: a token issued before stays valid after a module reload', async () => {
    const { token } = issueToken(adminOf('root'));
    vi.resetModules();
    const reloaded = await import('./store');
    expect(reloaded.store).toBe(store);
    expect(reloaded.adminForToken(token)?.username).toBe('root');
  });

  it('does not seed again on a reload (changes made before it stay)', async () => {
    adminOf('support').mustChangePassword = true;
    vi.resetModules();
    const reloaded = await import('./store');
    expect(reloaded.findAdminByUsername('support')?.mustChangePassword).toBe(true);
  });
});
