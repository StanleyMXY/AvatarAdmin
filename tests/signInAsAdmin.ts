// The part of "sign in as a preset administrator" that every module's `signIn` has in common: the
// module puts its own sample data back first (its `resetAll`), then calls this.
import { adminOf } from '../mock/_core/testing';
import access from '../src/access';
import { signInAs } from './mockBackend';
import { setTestAccess, setTestInitialState } from './stubs/umi-max';

type Options = {
  /** Replaces the permissions of the preset. */
  codes?: string[];
  /** Replaces the super administrator flag of the preset. */
  superAdmin?: boolean;
  /** What `GET /meta` gave; undefined for a page that has not read it. */
  meta?: Record<string, unknown>;
  /** `GET /me` without the id of the administrator, as an older answer was. */
  withId?: boolean;
  /** More fields of `GET /me`. */
  meExtra?: Record<string, unknown>;
};

/**
 * Signs in to the mock backend as the preset `username`, and tells the Umi stand-in who that is, so
 * that buttons follow the administrator's codes. Returns the preset.
 */
export function signInAsAdmin(username: string, options: Options = {}) {
  const admin = adminOf(username);
  if (options.codes) admin.permissions = options.codes as typeof admin.permissions;
  if (options.superAdmin !== undefined) admin.superAdmin = options.superAdmin;
  signInAs(username);

  const me = {
    ...(options.withId === false ? {} : { id: admin.id }),
    username,
    superAdmin: admin.superAdmin,
    mustChangePassword: false,
    permissions: admin.permissions,
    ...options.meExtra,
  };
  setTestAccess(access({ me }));
  setTestInitialState({ me, meta: options.meta });
  return admin;
}
