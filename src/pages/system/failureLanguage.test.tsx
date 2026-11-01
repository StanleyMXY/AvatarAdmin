import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import system from '../../../mock/system.mock';
import systemPermissions from '../../../mock/system.permissions.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import AdminsPage from './admins';
import PermissionsPage from './permissions';
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

describe('the failures of the system pages follow the language', { timeout: 60000 }, () => {
  it('the administrator that could not be made', async () => {
    const _calls = backend();
    failRequests((path, method) => method === 'POST' && path.endsWith('/admins'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<AdminsPage />);
    await waitForRows();
    await user.click(screen.getByRole('button', { name: 'New administrator' }));
    const box = within(await screen.findByRole('dialog'));
    await user.type(box.getByLabelText('User name'), 'anna');
    await user.type(box.getByLabelText('Initial password'), PASSWORD);
    await user.type(box.getByLabelText('Repeat the password'), PASSWORD);
    await user.click(box.getByRole('button', { name: /Save$/ }));
    await expectFailureFollowsLanguage(view);
  });

  it('the password that could not be reset', async () => {
    const _calls = backend();
    failRequests((path, method) => method === 'POST' && path.endsWith('/reset-password'));
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
    await expectFailureFollowsLanguage(view);
  });

  it('the role that could not be saved', async () => {
    const _calls = backend();
    failRequests((path, method) => method === 'PUT' && path.includes('/roles/'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<RolesPage />);
    await waitForRows();
    await user.click(
      within(await rowOf('Soporte al cliente')).getByRole('button', { name: 'Edit' }),
    );
    const box = within(await screen.findByRole('dialog'));
    await waitFor(() => expect(box.getAllByRole('checkbox').length).toBeGreaterThan(0));
    await user.click(box.getByRole('button', { name: /Save$/ }));
    await expectFailureFollowsLanguage(view);
  });

  it('the permission node that could not be saved', async () => {
    const _calls = backend();
    failRequests((path, method) => method === 'PUT' && path.includes('/permissions/'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<PermissionsPage />);
    await waitFor(() =>
      expect(document.querySelector('tr[data-row-key="USER:BAN"]')).not.toBeNull(),
    );
    const row = document.querySelector('tr[data-row-key="USER:BAN"]') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const box = within(await screen.findByRole('dialog'));
    fireEvent.change(box.getByLabelText('Name (English)'), { target: { value: 'Ban a user' } });
    await user.click(box.getByRole('button', { name: /Save$/ }));
    await expectFailureFollowsLanguage(view);
  });
});
