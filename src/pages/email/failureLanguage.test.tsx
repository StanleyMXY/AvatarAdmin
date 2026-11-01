import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import emailMock from '../../../mock/email.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import EmailTemplatesPage from './templates';
import { signIn } from './testSetup';

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

describe('the failures of the email template pages follow the language', { timeout: 60000 }, () => {
  it('the template that could not be saved', async () => {
    useMockBackend({ default: emailMock });
    failRequests((path, method) => method === 'PUT' && path.includes('/email'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<EmailTemplatesPage />);
    const cell = await screen.findByText(/^REGISTER_CODE/);
    const row = cell.closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => within(dialog).getByRole('textbox', { name: 'Subject' }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Subject' }), {
      target: { value: 'Mine' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await expectFailureFollowsLanguage(view);
  });
});
