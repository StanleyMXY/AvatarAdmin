import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import channelsMock from '../../../mock/channels.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import { signIn } from '../appVersions/testSetup';
import ChannelsPage from './channels';

beforeEach(() => signIn('root'));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the failures of the channel package pages follow the language', {
  timeout: 60000,
}, () => {
  it('the channel package that could not be saved', async () => {
    useMockBackend({ default: channelsMock });
    failRequests((path, method) => method === 'PUT' && path.includes('/channels'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<ChannelsPage />);
    await waitFor(() => expect(document.querySelector('tr[data-row-key="play"]')).not.toBeNull());
    const row = document.querySelector('tr[data-row-key="play"]') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), {
      target: { value: 'พันธมิตร Thai' },
    });
    await user.click(within(dialog).getByRole('button', { name: /^(loading )?Submit$/ }));
    await expectFailureFollowsLanguage(view);
  });
});
