// Shared by the page tests of this module: signs in as one of the preset administrators of the mock
// backend and tells the Umi stand-in who that is, so that buttons follow the administrator's codes.
import { within as scoped, screen, waitFor } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { resetCreditsStore } from '../../../mock/_core/creditsData';
import { resetStore } from '../../../mock/_core/store';
import { adminOf } from '../../../mock/_core/testing';
import { signInAs } from '../../../tests/mockBackend';
import { resetUmiStub, setTestAccess, setTestInitialState } from '../../../tests/stubs/umi-max';
import access from '../../access';

export function resetAll(): void {
  resetUmiStub();
  resetStore();
  resetCreditsStore();
}

/** Signs in as `username`; `codes` replaces the preset's permissions; `withId: false` leaves `id` out of `GET /me`. */
export function signIn(
  username: string,
  options: { codes?: string[]; withId?: boolean; meta?: Record<string, unknown> } = {},
) {
  resetAll();
  const admin = adminOf(username);
  if (options.codes) admin.permissions = options.codes as typeof admin.permissions;
  signInAs(username);
  const me = {
    ...(options.withId === false ? {} : { id: admin.id }),
    username,
    superAdmin: admin.superAdmin,
    mustChangePassword: false,
    permissions: admin.permissions,
  };
  setTestAccess(access({ me }));
  setTestInitialState({ me, meta: options.meta ?? {} });
  return admin;
}

/** Opens an Ant Design select by its label and clicks the option with this text. */
export async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string | RegExp,
  optionText: string,
  within: HTMLElement | Document = document,
) {
  const box = within === document ? screen : scoped(within as HTMLElement);
  await user.click(box.getByRole('combobox', { name: label }));
  const options = await screen.findAllByText(optionText, {
    selector: '.ant-select-item-option-content',
  });
  await user.click(options[options.length - 1]);
}

/**
 * Resolves once every dialog has started to close or is gone. happy-dom never fires the animation
 * events that remove a closed Ant Design dialog, so a dialog that is closing keeps its role for good.
 */
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
