// Shared by the page tests of this module: the permission helper of the Umi stand-in, a helper that
// picks an option of an Ant Design select, and the sign-in of the mock backend.
import { within as scoped, screen, waitFor } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { resetCostStore } from '../../../mock/_core/costData';
import { resetStore } from '../../../mock/_core/store';
import { adminOf } from '../../../mock/_core/testing';
import { signInAs } from '../../../tests/mockBackend';
import { resetUmiStub, setTestAccess, setTestInitialState } from '../../../tests/stubs/umi-max';
import access from '../../access';

/** The administrator holds exactly these codes (a super administrator holds all). */
export function holds(codes: string[], meta: Record<string, unknown> = {}, superAdmin = false) {
  const me = {
    id: '1001',
    username: 'tester',
    superAdmin,
    mustChangePassword: false,
    permissions: codes,
  };
  setTestAccess(
    access({ me: { superAdmin, permissions: codes } }) as unknown as Record<string, unknown>,
  );
  setTestInitialState({ me, meta });
}

/** Signs in to the mock backend as one of the preset administrators and sets the Umi stand-in to match. */
export function signIn(
  username: string,
  options: { codes?: string[]; meta?: Record<string, unknown> } = {},
) {
  resetUmiStub();
  resetStore();
  resetCostStore();
  // A preset that is not the super administrator, so that the codes given are the only ones it holds.
  const admin = adminOf(options.codes ? 'support' : username);
  if (options.codes) admin.permissions = options.codes as typeof admin.permissions;
  signInAs(admin.username);
  holds(admin.permissions, options.meta ?? { allowedCurrencies: ['USD'] }, admin.superAdmin);
  return admin;
}

/** Opens an Ant Design select by its accessible name and clicks the option with this text. */
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

/** The options an opened select offers (call after clicking the select). */
export const optionTexts = (): string[] =>
  [...document.querySelectorAll('.ant-select-item-option-content')].map((o) => o.textContent ?? '');

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
