import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import appVersionsMock from '../../../mock/appVersions.mock';
import channelsMock from '../../../mock/channels.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import enUS from '../../locales/en-US';
import { appVersionsState, signIn } from './testSetup';
import AppVersionsPage from './versions';

vi.mock('../../request/upload', async () => {
  const base = (await import('./testSetup')).uploadModule;
  return { uploadFile: async (options: { url: string; file: File }) => base.uploadFile(options) };
});

beforeEach(() => signIn('root'));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const backend = () => useMockBackend({ default: appVersionsMock }, { default: channelsMock });
const draft = () => {
  const found = [...appVersionsState.versions.values()].find(
    (v) => v.channelCode === 'play' && v.versionCode === 120,
  );
  if (!found) throw new Error('no draft');
  return found;
};
const rowOf = async (id: string) => {
  await waitFor(() => expect(document.querySelector(`tr[data-row-key="${id}"]`)).not.toBeNull());
  return document.querySelector(`tr[data-row-key="${id}"]`) as HTMLTableRowElement;
};

describe('the failures of the app version pages follow the language', { timeout: 60000 }, () => {
  it('the activation that was refused', async () => {
    const _calls = backend();
    failRequests((path, method) => method === 'PUT' && path.endsWith('/status'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<AppVersionsPage />);
    await user.click(within(await rowOf(draft().id)).getByRole('button', { name: 'Activate' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('checkbox', { name: enUS['appVersions.activate.confirmLive'] }),
    );
    await user.click(within(dialog).getByRole('button', { name: /^(loading )?Activate$/ }));
    await expectFailureFollowsLanguage(view);
  });

  it('the version that could not be saved', async () => {
    const _calls = backend();
    failRequests((path, method) => method === 'PUT' && path.includes('/app-versions/'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<AppVersionsPage />);
    await user.click(within(await rowOf(draft().id)).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Version name' }), {
      target: { value: '1.2.1' },
    });
    await user.click(within(dialog).getByRole('button', { name: /^(loading )?Submit$/ }));
    await expectFailureFollowsLanguage(view);
  });
});
