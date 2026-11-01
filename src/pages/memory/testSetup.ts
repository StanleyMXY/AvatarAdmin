// Shared by the page tests of this module: signs in as one of the preset administrators of the mock
// backend and tells the Umi stand-in who that is, so that buttons follow the administrator's codes.
import { resetMemoryStore } from '../../../mock/_core/memoryData';
import { resetStore } from '../../../mock/_core/store';
import { signInAsAdmin } from '../../../tests/signInAsAdmin';
import { resetUmiStub } from '../../../tests/stubs/umi-max';

/** Signs in as `username`; `codes` replaces the preset's permissions. */
export function signIn(username: string, codes?: string[]) {
  resetUmiStub();
  resetStore();
  resetMemoryStore();
  return signInAsAdmin(username, { codes, meta: {} });
}
