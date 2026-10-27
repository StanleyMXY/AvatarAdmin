// Shared by the page tests of the client configuration page: signs in as one of the preset
// administrators of the mock backend and tells the Umi stand-in who that is, so that buttons follow
// the administrator's codes.
import { clientConfigState, resetClientConfigStore } from '../../../mock/_core/clientConfigData';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { META_DEFAULTS } from '../../../mock/_core/meta';
import { resetStore } from '../../../mock/_core/store';
import { adminOf } from '../../../mock/_core/testing';
import { signInAs } from '../../../tests/mockBackend';
import { resetUmiStub, setTestAccess, setTestInitialState } from '../../../tests/stubs/umi-max';
import access from '../../access';

export { clientConfigState };

export const META = { ...META_DEFAULTS, supportedLocales: ['en', 'th', 'ar'] };

/** Signs in as `username`; `codes` replaces the preset's permissions. */
export function signIn(username: string, options: { codes?: string[] } = {}) {
  resetUmiStub();
  resetStore();
  resetConfigStore();
  resetClientConfigStore();
  const admin = adminOf(username);
  if (options.codes) admin.permissions = options.codes as typeof admin.permissions;
  signInAs(username);
  const me = {
    id: admin.id,
    username,
    superAdmin: admin.superAdmin,
    mustChangePassword: false,
    permissions: admin.permissions,
  };
  setTestAccess(access({ me }));
  setTestInitialState({ me, meta: META });
  return admin;
}

/** The calls that changed something. */
export const writesOf = <T extends { method: string }>(calls: T[]) =>
  calls.filter((c) => c.method !== 'GET');
