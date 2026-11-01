// Shared by the page tests of this module: signs in as one of the preset administrators of the mock
// backend and tells the Umi stand-in who that is and where the page is, so that buttons follow the
// administrator's codes and the detail page finds its record.
import { vi } from 'vitest';
import { resetConfigStore } from '../../../mock/_core/configStore';
import { resetModerationStore } from '../../../mock/_core/moderationData';
import { resetStore } from '../../../mock/_core/store';
import { signInAsAdmin } from '../../../tests/signInAsAdmin';
import { resetUmiStub, setTestLocation } from '../../../tests/stubs/umi-max';

export { chooseOption, dialogsClosed, expandSearch } from '../../../tests/pageHelpers';

export function resetAll(): void {
  resetUmiStub();
  resetStore();
  resetConfigStore();
  resetModerationStore();
}

/** Signs in as `username`; `codes` replaces the preset's permissions. */
export function signIn(username: string, options: { codes?: string[] } = {}) {
  resetAll();
  return signInAsAdmin(username, { codes: options.codes, meta: {} });
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
