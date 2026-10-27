// Shared by the page tests of this module: signs in as one of the preset administrators of the mock
// backend and tells the Umi stand-in who that is and where the page is, so that buttons follow the
// administrator's codes and the detail page finds its record.
import { screen, waitFor } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { expect, vi } from 'vitest';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { resetModerationStore } from '../../../mock/_core/moderationData';
import { resetStore } from '../../../mock/_core/store';
import { adminOf } from '../../../mock/_core/testing';
import { signInAs } from '../../../tests/mockBackend';
import {
  resetUmiStub,
  setTestAccess,
  setTestInitialState,
  setTestLocation,
} from '../../../tests/stubs/umi-max';
import access from '../../access';

export function resetAll(): void {
  resetUmiStub();
  resetStore();
  resetConfigStore();
  resetModerationStore();
}

/** Signs in as `username`; `codes` replaces the preset's permissions. */
export function signIn(username: string, options: { codes?: string[] } = {}) {
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
  setTestInitialState({ me, meta: {} });
  return admin;
}

/** The page of one record, as the router would give it to the detail page. */
export const openRecord = (id: string) => setTestLocation({ pathname: `/moderation/${id}` });

/**
 * Lets a test answer some requests itself and leave the rest to the mock backend that is already
 * behind `fetch`. `rule` returns a response to answer, or undefined to pass the request on.
 */
export function interceptFetch(
  rule: (url: string, init: RequestInit) => Response | Promise<Response | undefined> | undefined,
): void {
  const original = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      return (await rule(String(input), init)) ?? original(input, init);
    }),
  );
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

/** Opens an Ant Design select by its label and clicks the option with this text. */
export async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string | RegExp,
  optionText: string,
) {
  await user.click(screen.getByRole('combobox', { name: label }));
  const options = await screen.findAllByText(optionText, {
    selector: '.ant-select-item-option-content',
  });
  await user.click(options[options.length - 1]);
}

/** Opens the folded part of the search form of a table (the form starts folded). */
export async function expandSearch(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByText(/Expand|展开/));
}
