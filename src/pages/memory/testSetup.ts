// Shared by the page tests of this module: signs in as one of the preset administrators of the mock
// backend and tells the Umi stand-in who that is, so that buttons follow the administrator's codes.
import { resetMemoryStore } from '../../../mock/_core/memoryData';
import { resetStore } from '../../../mock/_core/store';
import { adminOf } from '../../../mock/_core/testing';
import { signInAs } from '../../../tests/mockBackend';
import { resetUmiStub, setTestAccess, setTestInitialState } from '../../../tests/stubs/umi-max';
import access from '../../access';

/** Signs in as `username`; `codes` replaces the preset's permissions. */
export function signIn(username: string, codes?: string[]) {
  resetUmiStub();
  resetStore();
  resetMemoryStore();
  const admin = adminOf(username);
  if (codes) admin.permissions = codes as typeof admin.permissions;
  signInAs(username);
  const me = {
    id: admin.id,
    username,
    superAdmin: admin.superAdmin,
    mustChangePassword: false,
    permissions: admin.permissions,
  };
  setTestAccess(access({ me }));
  setTestInitialState({ me, meta: {} });
  return admin;
}
