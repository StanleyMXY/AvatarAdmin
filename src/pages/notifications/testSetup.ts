// Shared by the page tests of the notification page: signs in as one of the preset administrators
// of the mock backend and tells the Umi stand-in who that is, so that buttons follow the
// administrator's codes and the values of `GET /meta`.
import { META_DEFAULTS } from '../../../mock/_core/meta';
import { notificationsState, resetNotificationsStore } from '../../../mock/_core/notificationsData';
import { resetStore } from '../../../mock/_core/store';
import { signInAsAdmin } from '../../../tests/signInAsAdmin';
import { resetUmiStub } from '../../../tests/stubs/umi-max';

export { chooseOption, writesOf } from '../../../tests/pageHelpers';

export { notificationsState };

/** The values of `GET /meta` with three supported languages. */
export const META = { ...META_DEFAULTS, supportedLocales: ['en', 'th', 'ar'] };

/** Signs in as `username`; `codes` replaces the preset's permissions; `meta` replaces the values of `GET /meta`. */
export function signIn(
  username: string,
  options: { codes?: string[]; meta?: Record<string, unknown> | null } = {},
) {
  resetUmiStub();
  resetStore();
  resetNotificationsStore();
  return signInAsAdmin(username, {
    codes: options.codes,
    meta: options.meta === null ? undefined : (options.meta ?? META),
  });
}
