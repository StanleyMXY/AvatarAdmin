// Shared by the page tests of the app version and channel package pages: signs in as one of the preset administrators of
// the mock backend, tells the Umi stand-in who that is, and puts the sample data of the mock
// backend back.
import { appVersionsState, resetAppVersionsStore } from '../../../mock/_core/appVersionsData';
import { channelsState, resetChannelsStore } from '../../../mock/_core/channelsData';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { META_DEFAULTS } from '../../../mock/_core/meta';
import { resetStore } from '../../../mock/_core/store';
import { uploads } from '../../../tests/pageHelpers';
import { signInAsAdmin } from '../../../tests/signInAsAdmin';
import { resetUmiStub } from '../../../tests/stubs/umi-max';

export {
  chooseOption,
  dialogsClosed,
  holdWrites,
  jsonAnswer,
  overrideFetch,
  settled,
  uploadModule,
  uploads,
  writesOf,
} from '../../../tests/pageHelpers';

/** The values of `GET /meta`. */
export const META = { ...META_DEFAULTS };

export const NOW = new Date('2026-10-26T10:00:00Z');

export function resetAll(): void {
  resetUmiStub();
  resetStore();
  resetConfigStore();
  resetChannelsStore();
  resetAppVersionsStore(NOW);
  localStorage.clear();
  uploads.length = 0;
}

/**
 * Signs in as `username`; `codes` replaces the preset's permissions; `meta` replaces the values of
 * `GET /meta`.
 */
export function signIn(
  username: string,
  options: { codes?: string[]; meta?: Record<string, unknown> } = {},
) {
  resetAll();
  return signInAsAdmin(username, { codes: options.codes, meta: options.meta ?? META });
}

export { appVersionsState, channelsState };
