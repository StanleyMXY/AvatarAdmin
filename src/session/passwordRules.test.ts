import { describe, expect, it } from 'vitest';
import { checkPasswordChange } from './passwordRules';

const ok = {
  oldPassword: 'old-pass',
  newPassword: 'a-long-new-password',
  confirm: 'a-long-new-password',
  username: 'ploy',
  minLength: 12,
};

describe('checkPasswordChange', () => {
  it('accepts a good change', () => {
    expect(checkPasswordChange(ok)).toBeNull();
  });

  it('asks for each empty field, old first', () => {
    expect(checkPasswordChange({ ...ok, oldPassword: '' })?.problem.key).toBe(
      'auth.password.oldRequired',
    );
    expect(checkPasswordChange({ ...ok, newPassword: '', confirm: '' })?.problem.key).toBe(
      'auth.password.newRequired',
    );
    expect(checkPasswordChange({ ...ok, confirm: '' })?.problem.key).toBe(
      'auth.password.confirmRequired',
    );
  });

  it('refuses two different new passwords', () => {
    expect(checkPasswordChange({ ...ok, confirm: 'a-long-new-passwordX' })).toEqual({
      field: 'confirm',
      problem: { key: 'auth.password.mismatch' },
    });
  });

  it('refuses the user name as the new password, exactly', () => {
    expect(checkPasswordChange({ ...ok, username: 'a-long-new-password' })?.problem.key).toBe(
      'auth.password.sameAsUsername',
    );
    expect(checkPasswordChange({ ...ok, username: 'A-long-new-password' })).toBeNull();
  });

  it('checks the length by code points when the minimum is known', () => {
    const eleven = 'abcdefghijk';
    expect(checkPasswordChange({ ...ok, newPassword: eleven, confirm: eleven })?.problem).toEqual({
      key: 'auth.password.tooShort',
      values: { min: 12 },
    });
    const twelve = 'abcdefghijkl';
    expect(checkPasswordChange({ ...ok, newPassword: twelve, confirm: twelve })).toBeNull();
  });

  it('counts an emoji or a Thai mark as the code points it has, not as UTF-16 units', () => {
    // 6 emoji = 6 code points (12 UTF-16 units): too short for 12.
    const emoji = '😀'.repeat(6);
    expect(checkPasswordChange({ ...ok, newPassword: emoji, confirm: emoji })?.problem.key).toBe(
      'auth.password.tooShort',
    );
    // Thai with combining marks: counted per code point.
    const thai = 'ก็'.repeat(6);
    expect(checkPasswordChange({ ...ok, newPassword: thai, confirm: thai })).toBeNull();
  });

  it('does not check the length when the minimum is unknown (the server decides)', () => {
    expect(
      checkPasswordChange({ ...ok, newPassword: 'a', confirm: 'a', minLength: undefined }),
    ).toBeNull();
  });

  it('does not trim: a password of spaces or one with edge spaces is a password', () => {
    const spaces = ' '.repeat(12);
    expect(checkPasswordChange({ ...ok, newPassword: spaces, confirm: spaces })).toBeNull();
    expect(
      checkPasswordChange({ ...ok, newPassword: spaces, confirm: `${spaces} ` })?.problem.key,
    ).toBe('auth.password.mismatch');
  });

  it('works in the other scripts', () => {
    for (const word of [
      'รหัสผ่านใหม่ที่ยาวมาก',
      'كلمة مرور جديدة طويلة',
      'mật khẩu mới rất dài',
      'contraseña nueva larga',
      'kata sandi baru panjang',
      '一个很长很长的新密码呀呀',
    ]) {
      expect(checkPasswordChange({ ...ok, newPassword: word, confirm: word })).toBeNull();
    }
  });
});
