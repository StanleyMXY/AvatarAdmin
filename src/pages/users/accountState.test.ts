import { describe, expect, it } from 'vitest';
import {
  canBan,
  canCancelDeletion,
  canStartDeletion,
  canUnban,
  grantBlocked,
  newRequestBlocked,
  revokeBlocked,
  waitsOrRuns,
} from './accountState';

// Contract 17.4, "账号状态与后台操作" (a row per operation, a column per state).
describe('the operation matrix of the account states', () => {
  const states = ['ACTIVE', 'BANNED', 'PENDING_DELETION', 'DELETING'] as const;
  const table = {
    ban: { fn: canBan, allowed: ['ACTIVE'] },
    unban: { fn: canUnban, allowed: ['BANNED'] },
    startDeletion: { fn: canStartDeletion, allowed: ['ACTIVE', 'BANNED'] },
    cancelDeletion: { fn: canCancelDeletion, allowed: ['PENDING_DELETION'] },
  };
  for (const [name, { fn, allowed }] of Object.entries(table)) {
    it.each(states)(`${name} in %s`, (state) => {
      expect(fn(state)).toBe(allowed.includes(state));
    });
  }

  it('refuses granting and new credit requests while the account waits for deletion or is being deleted', () => {
    expect(states.map(grantBlocked)).toEqual([false, false, true, true]);
    expect(states.map(newRequestBlocked)).toEqual([false, false, true, true]);
    expect(states.map(waitsOrRuns)).toEqual([false, false, true, true]);
  });

  it('refuses a revoke only while the account is being deleted', () => {
    expect(states.map(revokeBlocked)).toEqual([false, false, false, true]);
  });

  it('lets nothing through that it does not know: a new state of the backend disables the writes, and blocks nothing it does not need to', () => {
    expect(canBan('SUSPENDED')).toBe(false);
    expect(canUnban('SUSPENDED')).toBe(false);
    expect(canStartDeletion('SUSPENDED')).toBe(false);
    expect(canCancelDeletion('SUSPENDED')).toBe(false);
    expect(grantBlocked('SUSPENDED')).toBe(false);
    expect(canBan(undefined)).toBe(false);
  });
});
