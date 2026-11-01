import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import channelsMock from '../../../mock/channels.mock';
import {
  expectFieldReasonsFollowLanguage,
  refuseRequests,
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

describe('the reasons under the fields of the channel package dialog follow the language', {
  timeout: 60000,
}, () => {
  it('the name and the package name that the backend refused', async () => {
    useMockBackend({ default: channelsMock });
    refuseRequests(
      (path, method) => method === 'PUT' && path.includes('/channels'),
      [
        { ref: 'name', reason: 'TOO_LONG' },
        { ref: 'packageName', reason: 'TOO_LONG' },
      ],
    );
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
    await expectFieldReasonsFollowLanguage(view, { fields: 2 });
  });
});
