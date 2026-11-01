// Shared by the page tests of this module: signs in as one of the preset administrators of the mock
// backend and tells the Umi stand-in who that is, so that buttons follow the administrator's codes.
import { activityState, resetActivityStore } from '../../../mock/_core/activityData';
import { resetStore } from '../../../mock/_core/store';
import { signInAsAdmin } from '../../../tests/signInAsAdmin';
import { resetUmiStub } from '../../../tests/stubs/umi-max';

export {
  chooseOption,
  dialogsClosed,
  expandSearch,
  holdWrites,
  withExportSheet,
  writesOf,
} from '../../../tests/pageHelpers';

export { activityState };

export function resetAll(): void {
  resetUmiStub();
  resetStore();
  resetActivityStore();
}

/** Signs in as `username`; `codes` replaces the preset's permissions; `meta` is what `GET /meta` gave (nothing by default). */
export function signIn(
  username: string,
  options: { codes?: string[]; meta?: Record<string, unknown> } = {},
) {
  resetAll();
  return signInAsAdmin(username, { codes: options.codes, meta: options.meta ?? {} });
}
