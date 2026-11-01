import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import adsMock from '../../../mock/ads.mock';
import configMock from '../../../mock/config.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import CampaignsPage from './campaigns';
import CreativesPage from './creatives';
import PlacementsPage from './placements';
import { signIn } from './testSetup';
import UnitsPage from './units';

vi.mock('../../request/upload', async () => (await import('./testSetup')).uploadModule);

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const backend = () => useMockBackend({ default: adsMock }, { default: configMock });

/** Opens the editor of the row with this key, presses Submit while every write fails. */
async function editAndSubmit(
  page: ReactElement,
  rowKey: string,
  writes: RegExp,
  change?: (dialog: HTMLElement, user: ReturnType<typeof userEvent.setup>) => Promise<void>,
) {
  backend();
  failRequests((path, method) => method !== 'GET' && writes.test(path));
  const user = userEvent.setup();
  const view = renderWithLocaleSwitch(page);
  const rowOf = () =>
    document.querySelector<HTMLElement>(`tr[data-row-key="${rowKey}"]`) ??
    [...document.querySelectorAll<HTMLElement>('tbody tr.ant-table-row')].find((tr) =>
      tr.textContent?.includes(rowKey),
    ) ??
    null;
  await waitFor(() => expect(rowOf()).not.toBeNull());
  const row = rowOf() as HTMLElement;
  await user.click(within(row).getByRole('button', { name: 'Edit' }));
  const dialog = await screen.findByRole('dialog');
  await change?.(dialog, user);
  await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
  await expectFailureFollowsLanguage(view);
}

describe('the failures of the ad dialogs follow the language', { timeout: 60000 }, () => {
  it('the campaign that could not be saved', async () => {
    await editAndSubmit(<CampaignsPage />, '2', /ads\/campaigns/);
  });

  it('the placement that could not be saved', async () => {
    await editAndSubmit(<PlacementsPage />, 'app_open', /ads\/placements/, async (dialog, user) => {
      const cap = within(dialog).getByRole('spinbutton', { name: 'Frequency cap' });
      await user.clear(cap);
      await user.type(cap, '3');
    });
  });

  it('the unit that could not be saved', async () => {
    await editAndSubmit(<UnitsPage />, '1', /ads\/units/);
  });

  it('the creative that could not be saved', async () => {
    await editAndSubmit(<CreativesPage />, '3', /ads\/creatives/);
  });
});
