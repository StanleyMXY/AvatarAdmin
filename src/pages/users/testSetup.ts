// Shared by the page tests of the user module: signs in as one of the preset administrators of the
// mock backend and tells the Umi stand-in who that is, so that buttons follow the administrator's codes.
import { within as scoped, screen } from '@testing-library/react';
import { resetAvatarStore } from '../../../mock/_core/avatarData';
import { resetCreditsStore } from '../../../mock/_core/creditsData';
import { resetMemoryStore } from '../../../mock/_core/memoryData';
import { META_DEFAULTS } from '../../../mock/_core/meta';
import { resetStore } from '../../../mock/_core/store';
import { resetSubscriptionsStore } from '../../../mock/_core/subscriptionsData';
import { resetUsersStore } from '../../../mock/_core/usersData';
import { signInAsAdmin } from '../../../tests/signInAsAdmin';
import { resetUmiStub } from '../../../tests/stubs/umi-max';

export { chooseOption, dialogsClosed, expandSearch } from '../../../tests/pageHelpers';

export function resetAll(): void {
  resetUmiStub();
  resetStore();
  resetUsersStore();
  resetCreditsStore();
  resetMemoryStore();
  resetSubscriptionsStore();
  resetAvatarStore();
}

/** The dialog that is open now. */
export const openDialog = async (): Promise<HTMLElement> => {
  const dialogs = await screen.findAllByRole('dialog');
  return dialogs[dialogs.length - 1];
};

export { scoped };

/** Signs in as `username`; `codes` replaces the preset's permissions; `meta` replaces the values of `GET /meta`. */
export function signIn(
  username: string,
  options: { codes?: string[]; meta?: Record<string, unknown> } = {},
) {
  resetAll();
  return signInAsAdmin(username, {
    codes: options.codes,
    meta: options.meta ?? { ...META_DEFAULTS },
  });
}
