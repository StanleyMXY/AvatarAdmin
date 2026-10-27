// Shared by the page tests of this module: signs in as one of the preset administrators of the mock
// backend and tells the Umi stand-in who that is, so that buttons follow the administrator's codes.
import { screen, waitFor } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { expect, vi } from 'vitest';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { resetInviteStore } from '../../../mock/_core/inviteData';
import { resetStore } from '../../../mock/_core/store';
import { adminOf } from '../../../mock/_core/testing';
import { XLSX_TYPE } from '../../../tests/httpStubs';
import { signInAs } from '../../../tests/mockBackend';
import { resetUmiStub, setTestAccess, setTestInitialState } from '../../../tests/stubs/umi-max';
import access from '../../access';

/** Signs in as `username`; `codes` replaces the preset's permissions; `meta` is what `GET /meta` gave (nothing by default). */
export function signIn(
  username: string,
  options: { codes?: string[]; meta?: Record<string, unknown> } = {},
) {
  resetUmiStub();
  resetStore();
  resetConfigStore();
  resetInviteStore();
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

/**
 * Puts a spreadsheet answer in front of whatever `fetch` is now (the mock backend or a stub): an
 * export address gets the file and is written to `exports`, every other address goes on to the old
 * `fetch`. Also stands in for the browser calls that save a file.
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

/** Presses the export button once it is ready (its label is "Export" again and it is not busy). */
export async function clickExport(user: ReturnType<typeof userEvent.setup>) {
  const button = await screen.findByRole('button', { name: /Export/ });
  await waitFor(() => expect(button).not.toBeDisabled());
  await user.click(button);
}
