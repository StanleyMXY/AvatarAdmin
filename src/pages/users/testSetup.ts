// Shared by the page tests of the user module: signs in as one of the preset administrators of the
// mock backend and tells the Umi stand-in who that is, so that buttons follow the administrator's codes.
import { configure, within as scoped, screen, waitFor } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { resetAvatarStore } from '../../../mock/_core/avatarData';
import { resetCreditsStore } from '../../../mock/_core/creditsData';
import { resetMemoryStore } from '../../../mock/_core/memoryData';
import { META_DEFAULTS } from '../../../mock/_core/meta';
import { resetStore } from '../../../mock/_core/store';
import { resetSubscriptionsStore } from '../../../mock/_core/subscriptionsData';
import { adminOf } from '../../../mock/_core/testing';
import { resetUsersStore } from '../../../mock/_core/usersData';
import { signInAs } from '../../../tests/mockBackend';
import { resetUmiStub, setTestAccess, setTestInitialState } from '../../../tests/stubs/umi-max';
import access from '../../access';

// The pages draw big tables and the machine may be busy with other work: wait longer than the default second.
configure({ asyncUtilTimeout: 8000 });

export function resetAll(): void {
  resetUmiStub();
  resetStore();
  resetUsersStore();
  resetCreditsStore();
  resetMemoryStore();
  resetSubscriptionsStore();
  resetAvatarStore();
}

/** Signs in as `username`; `codes` replaces the preset's permissions; `meta` replaces the values of `GET /meta`. */
export function signIn(
  username: string,
  options: { codes?: string[]; meta?: Record<string, unknown> } = {},
) {
  resetAll();
  const admin = adminOf(username);
  if (options.codes) admin.permissions = options.codes as typeof admin.permissions;
  signInAs(username);
  const me = {
    id: admin.id,
    username,
    superAdmin: admin.superAdmin,
    mustChangePassword: false,
    permissions: admin.permissions,
  };
  setTestAccess(access({ me }));
  setTestInitialState({ me, meta: options.meta ?? { ...META_DEFAULTS } });
  return admin;
}

/** Resolves once every dialog has started to close or is gone (happy-dom never removes a closed Ant Design dialog). */
export const dialogsClosed = () =>
  waitFor(() => {
    for (const dialog of document.querySelectorAll('.ant-modal')) {
      expect(dialog.className, 'a dialog is still open').toMatch(/-leave|-hidden/);
    }
  });

/** Opens the folded part of the search form of a table (the form starts folded). */
export async function expandSearch(user: ReturnType<typeof userEvent.setup>) {
  const toggle = await screen.findByText(/展开|Expand/);
  await user.click(toggle);
}

/** The dialog that is open now. */
export const openDialog = async (): Promise<HTMLElement> => {
  const dialogs = await screen.findAllByRole('dialog');
  return dialogs[dialogs.length - 1];
};

export { scoped };

/** Opens an Ant Design select by its label and clicks the option with this text. */
export async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string | RegExp,
  optionText: string | RegExp,
) {
  await user.click(screen.getByRole('combobox', { name: label }));
  const options = await screen.findAllByText(optionText, {
    selector: '.ant-select-item-option-content',
  });
  await user.click(options[options.length - 1]);
}
