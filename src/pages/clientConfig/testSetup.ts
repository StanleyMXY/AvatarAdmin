// Shared by the page tests of the client configuration page: signs in as one of the preset
// administrators of the mock backend and tells the Umi stand-in who that is, so that buttons follow
// the administrator's codes.
import { clientConfigState, resetClientConfigStore } from '../../../mock/_core/clientConfigData';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { META_DEFAULTS } from '../../../mock/_core/meta';
import { resetStore } from '../../../mock/_core/store';
import { signInAsAdmin } from '../../../tests/signInAsAdmin';
import { resetUmiStub } from '../../../tests/stubs/umi-max';

export { writesOf } from '../../../tests/pageHelpers';

export { clientConfigState };

export const META = { ...META_DEFAULTS, supportedLocales: ['en', 'th', 'ar'] };

/** Signs in as `username`; `codes` replaces the preset's permissions. */
export function signIn(username: string, options: { codes?: string[] } = {}) {
  resetUmiStub();
  resetStore();
  resetConfigStore();
  resetClientConfigStore();
  return signInAsAdmin(username, { codes: options.codes, meta: META });
}
