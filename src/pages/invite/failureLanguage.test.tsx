import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import * as inviteMock from '../../../mock/invite.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import StatsPage from './stats';
import { signIn } from './testSetup';

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

describe('the failures of the invite pages follow the language', { timeout: 30000 }, () => {
  it('the chain that could not be read', async () => {
    useMockBackend(inviteMock);
    failRequests(/GET .*invites\/chain/);
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<StatsPage />);
    await user.click(await screen.findByRole('tab', { name: 'Fission levels' }));
    const box = await screen.findByRole('textbox', { name: 'Account ID' });
    await user.type(box, 'acc-top-1');
    await user.click(screen.getByRole('button', { name: 'Load chain' }));
    await expectFailureFollowsLanguage(view);
  });
});
