import { type AdminUser, isOwnAccount } from '../../services/system';
import { countCodePoints } from '../../utils/codePoints';

/**
 * The enabled super administrator who is the only one: the backend refuses to disable or delete
 * them, or to clear their flag (contract 17.4). It needs the list of ALL administrators; without it
 * (`all` is null) nothing is said to be the last: the page does not block on a guess, the backend
 * decides and its answer is shown.
 */
export function isLastEnabledSuper(row: AdminUser, all: readonly AdminUser[] | null): boolean {
  if (all === null) return false;
  if (!(row.superAdmin === true && row.status === 'ACTIVE')) return false;
  const enabled = all.filter((a) => a.superAdmin === true && a.status === 'ACTIVE');
  return enabled.length === 1 && enabled[0].id === row.id;
}

export type RowProtection = { own: boolean; lastSuper: boolean };

/** What the rules of the account protect on a row, for the signed-in administrator `me`. */
export function rowProtection(
  row: AdminUser,
  me: { id?: string; username?: string } | undefined,
  all: readonly AdminUser[] | null,
): RowProtection {
  return { own: isOwnAccount(me, row), lastSuper: isLastEnabledSuper(row, all) };
}

export type PasswordProblem =
  | { key: 'auth.password.newRequired' }
  | { key: 'auth.password.confirmRequired' }
  | { key: 'auth.password.mismatch' }
  | { key: 'auth.password.sameAsUsername' }
  | { key: 'auth.password.tooShort'; values: { min: number } };

/**
 * The checks the browser makes on a password somebody else will sign in with (the backend decides in
 * the end): present, not the user name, at least `minLength` code points when the server said the
 * minimum (it does, in `GET /me`), repeated the same. The password is compared and counted exactly as
 * typed: no trimming, no case folding, no hashing.
 */
export function checkNewPassword(input: {
  password: string;
  confirm: string;
  username?: string;
  minLength?: number;
}): { field: 'password' | 'confirm'; problem: PasswordProblem } | null {
  if (input.password === '')
    return { field: 'password', problem: { key: 'auth.password.newRequired' } };
  if (input.username !== undefined && input.password === input.username)
    return { field: 'password', problem: { key: 'auth.password.sameAsUsername' } };
  if (input.minLength !== undefined && countCodePoints(input.password) < input.minLength) {
    return {
      field: 'password',
      problem: { key: 'auth.password.tooShort', values: { min: input.minLength } },
    };
  }
  if (input.confirm === '')
    return { field: 'confirm', problem: { key: 'auth.password.confirmRequired' } };
  if (input.confirm !== input.password)
    return { field: 'confirm', problem: { key: 'auth.password.mismatch' } };
  return null;
}
