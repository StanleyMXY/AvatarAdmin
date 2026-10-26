import { describe, expect, it } from 'vitest';
import type { AdminUser } from '../../services/system';
import { checkNewPassword, isLastEnabledSuper, rowProtection } from './adminRules';

const admin = (id: string, over: Partial<AdminUser> = {}): AdminUser => ({
  id,
  username: `user${id}`,
  superAdmin: false,
  status: 'ACTIVE',
  mustChangePassword: false,
  totpEnrolledAt: null,
  lastLoginAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  roles: [],
  ...over,
});

describe('the last enabled super administrator', () => {
  const supers = [
    admin('1', { superAdmin: true }),
    admin('2'),
    admin('3', { superAdmin: true, status: 'DISABLED' }),
  ];

  it('is the one enabled super administrator when it is the only one', () => {
    expect(isLastEnabledSuper(supers[0], supers)).toBe(true);
    expect(isLastEnabledSuper(supers[1], supers)).toBe(false);
    // a disabled one is not an enabled one, so it is not protected as the last
    expect(isLastEnabledSuper(supers[2], supers)).toBe(false);
  });

  it('is nobody when there are two enabled super administrators', () => {
    const two = [...supers, admin('4', { superAdmin: true })];
    expect(isLastEnabledSuper(two[0], two)).toBe(false);
    expect(isLastEnabledSuper(two[3], two)).toBe(false);
  });

  it('is not known without the list of all administrators: nothing is blocked on a guess', () => {
    expect(isLastEnabledSuper(supers[0], null)).toBe(false);
  });
});

describe('what is protected on a row', () => {
  const all = [admin('1', { superAdmin: true }), admin('2')];
  it('protects the own row and the last super administrator, and nothing else', () => {
    expect(rowProtection(all[0], { id: '9' }, all)).toEqual({ own: false, lastSuper: true });
    expect(rowProtection(all[1], { id: '2' }, all)).toEqual({ own: true, lastSuper: false });
    expect(rowProtection(all[1], { id: '9' }, all)).toEqual({ own: false, lastSuper: false });
    expect(rowProtection(all[1], undefined, all)).toEqual({ own: true, lastSuper: false });
  });
});

describe('the rules for a new password', () => {
  const ok = {
    password: 'a-long-enough-pass-1',
    confirm: 'a-long-enough-pass-1',
    username: 'anna',
    minLength: 12,
  };

  it('accepts a password that is long enough, different from the user name and repeated', () => {
    expect(checkNewPassword(ok)).toBeNull();
  });

  it('asks for the password, then the rules, then the repetition, in that order', () => {
    expect(checkNewPassword({ ...ok, password: '' })?.problem.key).toBe(
      'auth.password.newRequired',
    );
    expect(
      checkNewPassword({ ...ok, password: 'anna', username: 'anna', minLength: undefined })?.problem
        .key,
    ).toBe('auth.password.sameAsUsername');
    expect(checkNewPassword({ ...ok, password: 'short', confirm: '' })?.problem).toEqual({
      key: 'auth.password.tooShort',
      values: { min: 12 },
    });
    expect(checkNewPassword({ ...ok, confirm: '' })?.problem.key).toBe(
      'auth.password.confirmRequired',
    );
    expect(checkNewPassword({ ...ok, confirm: 'other' })?.problem.key).toBe(
      'auth.password.mismatch',
    );
    expect(checkNewPassword({ ...ok, confirm: 'other' })?.field).toBe('confirm');
  });

  it('counts the length in code points (an emoji is one) and does not trim: spaces count and are kept', () => {
    const emoji = String.fromCodePoint(0x1f600);
    expect(
      checkNewPassword({ ...ok, password: emoji.repeat(12), confirm: emoji.repeat(12) }),
    ).toBeNull();
    expect(
      checkNewPassword({ ...ok, password: emoji.repeat(11), confirm: emoji.repeat(11) })?.problem
        .key,
    ).toBe('auth.password.tooShort');
    const spaces = ' '.repeat(12);
    expect(checkNewPassword({ ...ok, password: spaces, confirm: spaces })).toBeNull();
  });

  it('does not check the length when the server did not say the minimum', () => {
    expect(
      checkNewPassword({ ...ok, password: 'x', confirm: 'x', minLength: undefined }),
    ).toBeNull();
  });

  it('compares the user name exactly as typed, without regard to nothing else', () => {
    expect(
      checkNewPassword({
        ...ok,
        password: 'Anna',
        confirm: 'Anna',
        username: 'anna',
        minLength: undefined,
      }),
    ).toBeNull();
  });
});
