// Shared by the page tests of this module: signs in as one of the preset administrators of the mock
// backend and tells the Umi stand-in who that is, so that buttons follow the administrator's codes.
import { resetAnalyticsStore } from '../../../mock/_core/analyticsData';
import { resetStore } from '../../../mock/_core/store';
import { adminOf } from '../../../mock/_core/testing';
import { signInAs } from '../../../tests/mockBackend';
import { resetUmiStub, setTestAccess, setTestInitialState } from '../../../tests/stubs/umi-max';
import access from '../../access';

export const VIEW = ['ANALYTICS:VIEW'];
export const MANAGE = ['ANALYTICS:VIEW', 'ANALYTICS:FUNNEL_MANAGE'];

/**
 * Signs in as `username`; `codes` replaces the preset's permissions; `meta` is what
 * `GET /meta` gave (nothing by default, as when the value is not known).
 */
export function signIn(
  username: string,
  options: { codes?: string[]; meta?: Record<string, unknown> } = {},
) {
  resetUmiStub();
  resetStore();
  resetAnalyticsStore();
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
  setTestInitialState({ me, meta: options.meta ?? {} });
  return admin;
}
