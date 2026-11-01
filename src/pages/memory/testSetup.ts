// Shared by the page tests of this module: signs in as one of the preset administrators of the mock
// backend and tells the Umi stand-in who that is, so that buttons follow the administrator's codes.
import { configure } from '@testing-library/react';
import { resetMemoryStore } from '../../../mock/_core/memoryData';
import { resetStore } from '../../../mock/_core/store';
import { signInAsAdmin } from '../../../tests/signInAsAdmin';
import { resetUmiStub } from '../../../tests/stubs/umi-max';

// The pages draw big tables and the machine may be busy with other work: wait longer than the default second for what a page shows.
configure({ asyncUtilTimeout: 8000 });

/** Signs in as `username`; `codes` replaces the preset's permissions. */
export function signIn(username: string, codes?: string[]) {
  resetUmiStub();
  resetStore();
  resetMemoryStore();
  return signInAsAdmin(username, { codes, meta: {} });
}
