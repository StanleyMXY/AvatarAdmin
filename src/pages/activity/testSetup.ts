// Shared by the page tests of this module: signs in as one of the preset administrators of the mock
// backend and tells the Umi stand-in who that is, so that buttons follow the administrator's codes.
import { within as scoped, screen, waitFor } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { expect, vi } from 'vitest';
import { activityState, resetActivityStore } from '../../../mock/_core/activityData';
import { resetStore } from '../../../mock/_core/store';
import { adminOf } from '../../../mock/_core/testing';
import { XLSX_TYPE } from '../../../tests/httpStubs';
import { signInAs } from '../../../tests/mockBackend';
import { resetUmiStub, setTestAccess, setTestInitialState } from '../../../tests/stubs/umi-max';
import access from '../../access';

export { activityState };

export function resetAll(): void {
  resetUmiStub();
  resetStore();
  resetActivityStore();
}

/** Signs in as `username`; `codes` replaces the preset's permissions; `meta` is what `GET /meta` gave (nothing by default). */
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
  setTestInitialState({ me, meta: options.meta ?? {} });
  return admin;
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

/** The calls that changed something. */
export const writesOf = <T extends { method: string; url: string }>(calls: T[]) =>
  calls.filter((c) => c.method !== 'GET');

/**
 * Makes every write of the page wait until `release()`, so that a second press can come while the
 * first request is still on its way. Call it after `useMockBackend`. `started()` counts the writes
 * that have been handed to the network so far. `only` picks the writes to hold (all by default).
 */
export function holdWrites(only: (init: RequestInit) => boolean = () => true) {
  const real = globalThis.fetch;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      if ((init.method ?? 'GET').toUpperCase() !== 'GET' && only(init)) {
        started += 1;
        await gate;
      }
      return real(input, init);
    }),
  );
  return { release, started: () => started };
}

/**
 * Puts a spreadsheet answer in front of whatever `fetch` is now: an export address gets the file and
 * is written to the list, every other address goes on to the old `fetch`. Also stands in for the
 * browser calls that save a file.
 */
export function withExportSheet(): { url: string }[] {
  const exports: { url: string }[] = [];
  const delegate = globalThis.fetch;
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:x');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/api/admin/stats/export/')) {
        exports.push({ url });
        return new Response(Uint8Array.from([80, 75, 3, 4]), {
          status: 200,
          headers: {
            'content-type': XLSX_TYPE,
            'content-disposition': 'attachment; filename="export.xlsx"',
          },
        });
      }
      return delegate(input, init);
    }),
  );
  return exports;
}

/** Opens the folded part of the search form of a table (the form starts folded when it has more than two boxes). */
export async function expandSearch(user: ReturnType<typeof userEvent.setup>) {
  const toggle = await screen.findByText(/展开|Expand/);
  await user.click(toggle);
}
