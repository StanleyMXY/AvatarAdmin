// Shared by the page tests of the avatar and complaint modules: signs in as one of the preset
// administrators of the mock backend, tells the Umi stand-in who that is, and lets the upload
// control reach the mock backend through `fetch` (the real upload uses XMLHttpRequest).
import { within as scoped, screen, waitFor } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { resetAvatarStore } from '../../../mock/_core/avatarData';
import { META_DEFAULTS } from '../../../mock/_core/meta';
import { resetStore } from '../../../mock/_core/store';
import { adminOf } from '../../../mock/_core/testing';
import { signInAs } from '../../../tests/mockBackend';
import { resetUmiStub, setTestAccess, setTestInitialState } from '../../../tests/stubs/umi-max';
import access from '../../access';
import { resetChannelsCache } from '../../components/ChannelSelect';
import { apiRequest } from '../../request/apiClient';

/** The shared values of `GET /meta` with a few supported languages. */
export const META = { ...META_DEFAULTS, supportedLocales: ['en', 'zh-Hans', 'th'] };

export const uploads: { url: string; name: string; size: number }[] = [];

/** What `vi.mock('../../request/upload', ...)` returns: the upload goes to the mock backend and hands back its record id. */
export const uploadModule = {
  uploadFile: async (options: { url: string; file: File }) => {
    uploads.push({ url: options.url, name: options.file.name, size: options.file.size });
    return apiRequest({ method: 'POST', url: options.url });
  },
};

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
  setTestInitialState({ me, meta: options.meta ?? META });
  return admin;
}

/** Object URLs for the preview of a chosen picture (happy-dom has none). */
export function stubObjectUrls(): void {
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:preview');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
}

/** Opens an Ant Design select by its label and clicks the option with this text. */
export async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string | RegExp,
  optionText: string | RegExp,
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

/** The calls that changed something, not counting the uploads of files (they only hand out an id). */
export const writesOf = <T extends { method: string; url: string }>(calls: T[]) =>
  calls.filter((c) => c.method !== 'GET' && !c.url.startsWith('/api/admin/uploads/'));

/** Opens the folded part of the search form of a table (the form starts folded). */
export async function expandSearch(user: ReturnType<typeof userEvent.setup>) {
  const toggle = await screen.findByText(/展开|Expand/);
  await user.click(toggle);
}
