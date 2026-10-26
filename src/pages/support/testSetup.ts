// Shared by the page tests of this module: signs in as one of the preset administrators of the mock
// backend and tells the Umi stand-in who that is, so that buttons follow the administrator's codes.

import { resetStore } from '../../../mock/_core/store';
import { resetSupportStore } from '../../../mock/_core/supportData';
import { adminOf } from '../../../mock/_core/testing';
import { signInAs } from '../../../tests/mockBackend';
import { resetUmiStub, setTestAccess, setTestInitialState } from '../../../tests/stubs/umi-max';
import access from '../../access';

/** Signs in as `username`; `codes` replaces the preset's permissions. */
export function signIn(username: string, codes?: string[]) {
  resetUmiStub();
  resetStore();
  resetSupportStore();
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
