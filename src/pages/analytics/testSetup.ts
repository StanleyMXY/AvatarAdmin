// Shared by the page tests of this module: signs in as one of the preset administrators of the mock
// backend and tells the Umi stand-in who that is, so that buttons follow the administrator's codes.
import { resetAnalyticsStore } from '../../../mock/_core/analyticsData';
import { resetStore } from '../../../mock/_core/store';
import { signInAsAdmin } from '../../../tests/signInAsAdmin';
import { resetUmiStub } from '../../../tests/stubs/umi-max';

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
  return signInAsAdmin(username, { codes: options.codes, meta: options.meta ?? {} });
}
