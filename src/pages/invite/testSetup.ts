// Shared by the page tests of this module: signs in as one of the preset administrators of the mock
// backend and tells the Umi stand-in who that is, so that buttons follow the administrator's codes.
import { screen, waitFor } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { expect } from 'vitest';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { resetInviteStore } from '../../../mock/_core/inviteData';
import { resetStore } from '../../../mock/_core/store';
import { signInAsAdmin } from '../../../tests/signInAsAdmin';
import { resetUmiStub } from '../../../tests/stubs/umi-max';

export { withExportSheet } from '../../../tests/pageHelpers';

/** Signs in as `username`; `codes` replaces the preset's permissions; `meta` is what `GET /meta` gave (nothing by default). */
export function signIn(
  username: string,
  options: { codes?: string[]; meta?: Record<string, unknown> } = {},
) {
  resetUmiStub();
  resetStore();
  resetConfigStore();
  resetInviteStore();
  return signInAsAdmin(username, { codes: options.codes, meta: options.meta ?? {} });
}

/** Presses the export button once it is ready (its label is "Export" again and it is not busy). */
export async function clickExport(user: ReturnType<typeof userEvent.setup>) {
  const button = await screen.findByRole('button', { name: /Export/ });
  await waitFor(() => expect(button).not.toBeDisabled());
  await user.click(button);
}
