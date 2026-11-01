import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import clientConfigMock from '../../../mock/clientConfig.mock';
import configMock from '../../../mock/config.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import ClientConfigPage from './list';
import { signIn } from './testSetup';

vi.setConfig({ testTimeout: 30000 });

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const backend = () => useMockBackend({ default: clientConfigMock }, { default: configMock });

describe('the failures of the client configuration follow the language', () => {
  it('the list that could not be read', async () => {
    const _calls = backend();
    failRequests(/GET .*client-config/);
    const view = renderWithLocaleSwitch(<ClientConfigPage />);
    await expectFailureFollowsLanguage(view);
  });

  it('the editor whose save could not read the key again', async () => {
    const _calls = backend();
    let broken = false;
    failRequests((path, method) => broken && method === 'GET' && path.includes('client-config'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<ClientConfigPage />);
    const row = await screen.findByText('privacyPolicyUrl');
    const tr = row.closest('tr') as HTMLElement;
    await user.click(within(tr).getByRole('button', { name: /Edit|View/ }));
    const drawer = await screen.findByRole('dialog');
    fireEvent.change(within(drawer).getByRole('textbox', { name: 'Value (Default)' }), {
      target: { value: 'https://example.com/other' },
    });
    broken = true;
    await user.click(within(drawer).getByRole('button', { name: /Save$/ }));
    await waitFor(() => within(drawer).getByRole('alert'));
    await expectFailureFollowsLanguage(view, {});
  });
});
