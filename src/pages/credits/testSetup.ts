// Shared by the page tests of this module: signs in as one of the preset administrators of the mock
// backend and tells the Umi stand-in who that is, so that buttons follow the administrator's codes.
import { screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { resetCreditsStore } from '../../../mock/_core/creditsData';
import { resetStore } from '../../../mock/_core/store';
import { signInAsAdmin } from '../../../tests/signInAsAdmin';
import { resetUmiStub } from '../../../tests/stubs/umi-max';

export { chooseOption, dialogsClosed } from '../../../tests/pageHelpers';

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
  return signInAsAdmin(username, {
    codes: options.codes,
    withId: options.withId,
    meta: options.meta ?? {},
  });
}

/** Opens the folded part of the search form of a table; a form that starts open is left as it is. */
export async function expandSearch(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText(/展开|Expand|收起|Collapse/);
  const toggle = screen.queryByText(/展开|Expand/);
  if (toggle) await user.click(toggle);
}
