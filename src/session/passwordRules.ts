import { countCodePoints } from '../utils/codePoints';

export type PasswordProblem =
  | { key: 'auth.password.oldRequired' }
  | { key: 'auth.password.newRequired' }
  | { key: 'auth.password.confirmRequired' }
  | { key: 'auth.password.mismatch' }
  | { key: 'auth.password.sameAsUsername' }
  | { key: 'auth.password.tooShort'; values: { min: number } };

/**
 * The checks the browser makes before asking the server (the server decides in the end). Passwords
 * are compared exactly as typed: no trimming (a space can be part of a password), no case folding.
 * The length is in code points and is only checked when the server told us the minimum.
 */
export function checkPasswordChange(input: {
  oldPassword: string;
  newPassword: string;
  confirm: string;
  username?: string;
  minLength?: number;
}): { field: 'oldPassword' | 'newPassword' | 'confirm'; problem: PasswordProblem } | null {
  if (input.oldPassword === '')
    return { field: 'oldPassword', problem: { key: 'auth.password.oldRequired' } };
  if (input.newPassword === '')
    return { field: 'newPassword', problem: { key: 'auth.password.newRequired' } };
  if (input.username !== undefined && input.newPassword === input.username)
    return { field: 'newPassword', problem: { key: 'auth.password.sameAsUsername' } };
  if (input.minLength !== undefined && countCodePoints(input.newPassword) < input.minLength) {
    return {
      field: 'newPassword',
      problem: { key: 'auth.password.tooShort', values: { min: input.minLength } },
    };
  }
  if (input.confirm === '')
    return { field: 'confirm', problem: { key: 'auth.password.confirmRequired' } };
  if (input.confirm !== input.newPassword)
    return { field: 'confirm', problem: { key: 'auth.password.mismatch' } };
  return null;
}
