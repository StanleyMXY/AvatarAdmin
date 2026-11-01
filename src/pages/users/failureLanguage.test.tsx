import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { USER } from '../../../mock/_core/usersData';
import * as usersMock from '../../../mock/users.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import { BanUserModal } from './BanUserModal';
import { StartDeletionModal } from './StartDeletionModal';
import { openDialog, signIn } from './testSetup';

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

describe('the failures of the account dialogs follow the language', { timeout: 30000 }, () => {
  it('the ban that failed', async () => {
    useMockBackend(usersMock);
    failRequests((path, method) => method === 'POST' && path.endsWith('/ban'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(
      <BanUserModal accountId={USER.negative} status="ACTIVE" onDone={() => {}} />,
    );
    await user.click(screen.getByRole('button', { name: 'Ban' }));
    const dialog = await openDialog();
    await user.click(within(dialog).getByRole('textbox'));
    await user.paste('ขอบคุณ spam');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await expectFailureFollowsLanguage(view);
  });

  it('the deletion that could not be started', async () => {
    useMockBackend(usersMock);
    failRequests((path, method) => method === 'POST' && path.endsWith('/deletion'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(
      <StartDeletionModal accountId={USER.negative} status="ACTIVE" onDone={() => {}} />,
    );
    await user.click(screen.getByRole('button', { name: 'Start deletion' }));
    const dialog = await openDialog();
    await user.click(within(dialog).getByRole('textbox'));
    await user.paste('the owner asked');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await expectFailureFollowsLanguage(view);
  });
});
