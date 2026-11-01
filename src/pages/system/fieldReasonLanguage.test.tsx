import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import system from '../../../mock/system.mock';
import systemPermissions from '../../../mock/system.permissions.mock';
import {
  expectFieldReasonsFollowLanguage,
  refuseRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import AdminsPage from './admins';
import RolesPage from './roles';
import { rowOf, signIn, waitForRows } from './testSetup';

vi.setConfig({ testTimeout: 30000 });

beforeEach(() => signIn('root'));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const PASSWORD = 'correct horse battery 1';
const backend = () => useMockBackend({ default: system }, { default: systemPermissions });

describe('the reasons under the fields of the system dialogs follow the language', {
  timeout: 60000,
}, () => {
  it('the administrator whose user name the backend refused', async () => {
    backend();
    refuseRequests(
      (path, method) => method === 'POST' && path.endsWith('/admins'),
      [{ ref: 'username', reason: 'TOO_LONG' }],
    );
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<AdminsPage />);
    await waitForRows();
    await user.click(screen.getByRole('button', { name: 'New administrator' }));
    const box = within(await screen.findByRole('dialog'));
    await user.type(box.getByLabelText('User name'), 'anna');
    await user.type(box.getByLabelText('Initial password'), PASSWORD);
    await user.type(box.getByLabelText('Repeat the password'), PASSWORD);
    await user.click(box.getByRole('button', { name: /Save$/ }));
    await expectFieldReasonsFollowLanguage(view, { fields: 1 });
  });

  it('the new password that the backend refused', async () => {
    backend();
    refuseRequests(
      (path, method) => method === 'POST' && path.endsWith('/reset-password'),
      [{ ref: 'newPassword', reason: 'TOO_LONG' }],
    );
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<AdminsPage />);
    await waitForRows();
    await user.click(within(await rowOf('reviewer')).getByRole('button', { name: 'More' }));
    const items = await screen.findAllByRole('menuitem', { name: 'Reset password' });
    await user.click(items[items.length - 1]);
    const box = within(await screen.findByRole('dialog'));
    await user.type(box.getByLabelText('New password'), PASSWORD);
    await user.type(box.getByLabelText('Repeat the password'), PASSWORD);
    await user.click(box.getByRole('button', { name: /Reset password$/ }));
    await expectFieldReasonsFollowLanguage(view, { fields: 1 });
  });

  it('the role whose name the backend refused', async () => {
    backend();
    refuseRequests(
      (path, method) => method === 'PUT' && path.includes('/roles/'),
      [{ ref: 'name', reason: 'TOO_LONG' }],
    );
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<RolesPage />);
    await waitForRows();
    await user.click(
      within(await rowOf('Soporte al cliente')).getByRole('button', { name: 'Edit' }),
    );
    const box = within(await screen.findByRole('dialog'));
    await waitFor(() => expect(box.getAllByRole('checkbox').length).toBeGreaterThan(0));
    await user.click(box.getByRole('button', { name: /Save$/ }));
    await expectFieldReasonsFollowLanguage(view, { fields: 1 });
  });
});
