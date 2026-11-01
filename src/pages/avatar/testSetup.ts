// Shared by the page tests of the avatar and complaint modules: signs in as one of the preset
// administrators of the mock backend, tells the Umi stand-in who that is, and lets the upload
// control reach the mock backend through `fetch` (the real upload uses XMLHttpRequest).
import { configure } from '@testing-library/react';
import { resetAvatarStore } from '../../../mock/_core/avatarData';
import { META_DEFAULTS } from '../../../mock/_core/meta';
import { resetStore } from '../../../mock/_core/store';
import { uploads } from '../../../tests/pageHelpers';
import { signInAsAdmin } from '../../../tests/signInAsAdmin';
import { resetUmiStub } from '../../../tests/stubs/umi-max';
import { resetChannelsCache } from '../../components/ChannelSelect';

export {
  chooseOption,
  dialogsClosed,
  expandSearch,
  stubObjectUrls,
  uploadModule,
  uploads,
  writesExceptUploads as writesOf,
} from '../../../tests/pageHelpers';

// These pages are big (a table, a drawer, dialogs); when many test files run at once a page can take
// longer than the one second a query waits by default, which failed a different test on each run.
configure({ asyncUtilTimeout: 8000 });

/** The shared values of `GET /meta` with a few supported languages. */
export const META = { ...META_DEFAULTS, supportedLocales: ['en', 'zh-Hans', 'th'] };

export function resetAll(): void {
  resetUmiStub();
  resetStore();
  resetAvatarStore();
  resetChannelsCache();
  uploads.length = 0;
}

/** Signs in as `username`; `codes` replaces the preset's permissions; `meta` replaces the values of `GET /meta`. */
export function signIn(
  username: string,
  options: { codes?: string[]; meta?: Record<string, unknown> } = {},
) {
  resetAll();
  return signInAsAdmin(username, { codes: options.codes, meta: options.meta ?? META });
}
