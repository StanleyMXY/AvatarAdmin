import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import adsMock from '../../../mock/ads.mock';
import configMock from '../../../mock/config.mock';
import {
  expectFieldReasonsFollowLanguage,
  refuseRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import CreativesPage from './creatives';
import PlacementsPage from './placements';
import { signIn } from './testSetup';
import UnitsPage from './units';

vi.mock('../../request/upload', async () => (await import('./testSetup')).uploadModule);

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const backend = () => useMockBackend({ default: adsMock }, { default: configMock });

/** Opens the editor of the row with this key and presses Submit while the backend refuses the fields. */
async function editAndSubmit(
  page: ReactElement,
  rowKey: string,
  writes: RegExp,
  refs: string[],
  change?: (dialog: HTMLElement, user: ReturnType<typeof userEvent.setup>) => Promise<void>,
) {
  backend();
  refuseRequests(
    (path, method) => method !== 'GET' && writes.test(path),
    refs.map((ref) => ({ ref, reason: 'TOO_LONG' })),
  );
  const user = userEvent.setup();
  const view = renderWithLocaleSwitch(page);
  const rowOf = () =>
    document.querySelector<HTMLElement>(`tr[data-row-key="${rowKey}"]`) ??
    [...document.querySelectorAll<HTMLElement>('tbody tr.ant-table-row')].find((tr) =>
      tr.textContent?.includes(rowKey),
    ) ??
    null;
  await waitFor(() => expect(rowOf()).not.toBeNull());
  await user.click(within(rowOf() as HTMLElement).getByRole('button', { name: 'Edit' }));
  const dialog = await screen.findByRole('dialog');
  await change?.(dialog, user);
  await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
  await expectFieldReasonsFollowLanguage(view, { fields: refs.length });
}

describe('the reasons under the fields of the ad dialogs follow the language', {
  timeout: 60000,
}, () => {
  it('the placement (the shared way of placing a refusal)', async () => {
    await editAndSubmit(
      <PlacementsPage />,
      'app_open',
      /ads\/placements/,
      ['frequencyCap', 'cooldownMinutes'],
      async (dialog, user) => {
        const cap = within(dialog).getByRole('spinbutton', { name: 'Frequency cap' });
        await user.clear(cap);
        await user.type(cap, '3');
      },
    );
  });

  it('the unit (its own sorting of a refusal)', async () => {
    await editAndSubmit(<UnitsPage />, '1', /ads\/units/, ['name', 'weight']);
  });

  it('the creative (its own sorting of a refusal)', async () => {
    await editAndSubmit(<CreativesPage />, '3', /ads\/creatives/, ['weight']);
  });
});
