// Shared by the page tests of the push module: signs in as one of the preset administrators of the
// mock backend, tells the Umi stand-in who that is, and lets the upload control reach the mock
// backend (the real upload uses XMLHttpRequest, which a test does not have).
import { META_DEFAULTS } from '../../../mock/_core/meta';
import { pushState, resetPushStore } from '../../../mock/_core/pushData';
import { resetStore } from '../../../mock/_core/store';
import { uploads } from '../../../tests/pageHelpers';
import { signInAsAdmin } from '../../../tests/signInAsAdmin';
import { resetUmiStub } from '../../../tests/stubs/umi-max';

export {
  chooseOption,
  dialogsClosed,
  holdWrites,
  stubObjectUrls,
  uploadModule,
  uploads,
  writesExceptUploads as writesOf,
} from '../../../tests/pageHelpers';

/** The values of `GET /meta` with three supported languages. */
export const META = { ...META_DEFAULTS, supportedLocales: ['en', 'th', 'ar'] };

export function resetAll(): void {
  resetUmiStub();
  resetStore();
  resetPushStore();
  uploads.length = 0;
}

/**
 * Signs in as `username`; `codes` replaces the preset's permissions; `meta` replaces the values of
 * `GET /meta`. The mock backend is told the same supported languages as `meta`, so that what the
 * page warns about and what the backend refuses agree.
 */
export function signIn(
  username: string,
  options: { codes?: string[]; meta?: Record<string, unknown> } = {},
) {
  resetAll();
  const meta = options.meta ?? META;
  if (Array.isArray(meta.supportedLocales)) {
    pushState.supportedLocales = meta.supportedLocales as string[];
  }
  return signInAsAdmin(username, { codes: options.codes, meta });
}
