import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '../../../mock/_core/store';
import { adminOf } from '../../../mock/_core/testing';
import system from '../../../mock/system.mock';
import systemPermissions from '../../../mock/system.permissions.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { setTestInitialState } from '../../../tests/stubs/umi-max';
import { AdminFormModal } from './AdminFormModal';
import AdminsPage from './admins';
import {
  dialogsClosed,
  holdWrites,
  jsonAnswer,
  overrideFetch,
  rowOf,
  settled,
  signIn,
  systemState,
  tableRows,
  waitForRows,
  writesOf,
} from './testSetup';

vi.setConfig({ testTimeout: 30000 });

const backend = () => useMockBackend({ default: system }, { default: systemPermissions });

beforeEach(() => {
  signIn('root');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const PASSWORD = 'correct horse battery 1';

const load = async () => {
  const calls = backend();
  const user = userEvent.setup();
  renderPage(<AdminsPage />);
  await waitForRows();
  return { calls, user };
};
const dialog = () => screen.findByRole('dialog');
const rowButton = async (row: string, name: string | RegExp) =>
  within(await rowOf(row)).getByRole('button', { name });
/** An action that sits under "More" in the row. */
const moreItem = async (user: ReturnType<typeof userEvent.setup>, row: string, name: string) => {
  await user.click(within(await rowOf(row)).getByRole('button', { name: 'More' }));
  const items = await screen.findAllByRole('menuitem', { name });
  return items[items.length - 1];
};
const chooseRole = async (
  user: ReturnType<typeof userEvent.setup>,
  box: HTMLElement,
  name: string,
) => {
  await user.click(box);
  const options = await screen.findAllByText(name, { selector: '.ant-select-item-option-content' });
  await user.click(options[options.length - 1]);
};
const rolesBox = (scope: ReturnType<typeof within>) =>
  scope.getByRole('combobox', { name: 'Roles' });

describe('the list of administrators', () => {
  it('shows the columns of the spec: user name, super administrator, status, must change password, roles, last sign-in, created', async () => {
    await load();
    const headers = [...document.querySelectorAll('.ant-table-thead th')].map(
      (th) => th.textContent,
    );
    expect(headers).toEqual([
      'User name',
      'Super administrator',
      'Status',
      'Must change password',
      'Roles',
      'Last sign-in',
      'Created',
      'Actions',
    ]);
    const support = tableRows().find((cells) => cells[0].startsWith('support')) as string[];
    expect(support.slice(0, 5)).toEqual(['support', '—', 'Enabled', 'No', 'Soporte al cliente']);
    const newhire = tableRows().find((cells) => cells[0].startsWith('newhire')) as string[];
    expect(newhire[3]).toBe('Yes');
    const root = tableRows().find((cells) => cells[0].startsWith('root')) as string[];
    expect(root[0]).toBe('rootYou');
    expect(root[1]).toBe('Super administrator');
    expect(root[4]).toBe('No roles');
  });

  it('shows the note about the protections of the account', async () => {
    await load();
    expect(
      screen.getByText(/cannot change your own roles, super administrator flag or status/),
    ).toBeInTheDocument();
  });

  it('shows user names in every language, and one of 5000 characters without a space, without breaking the table', async () => {
    const names = [
      'สมชาย_ใจดี',
      'مدير_النظام',
      'budi_santoso',
      'nguyen_van_a',
      'josé_núñez',
      'admin_john',
      '管理员小王',
    ];
    names.forEach((username, i) => {
      store.admins.set(`70${i}`, {
        ...adminOf('support'),
        id: `70${i}`,
        username,
        permissions: [],
      });
      systemState.extras.set(`70${i}`, {
        roleIds: ['3'],
        createdAt: `2026-10-0${i + 1}T00:00:00Z`,
        lastLoginAt: null,
      });
    });
    const long = 'z'.repeat(5000);
    store.admins.set('799', { ...adminOf('support'), id: '799', username: long, permissions: [] });
    systemState.extras.set('799', {
      roleIds: [],
      createdAt: '2026-10-09T00:00:00Z',
      lastLoginAt: null,
    });
    await load();
    await waitFor(() => expect(screen.getByText(long, { selector: 'button' })).toBeInTheDocument());
    for (const name of names) expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    expect(screen.getByText(long, { selector: 'button' }).style.overflowWrap).toBe('anywhere');
    // a role name in Thai is a tag
    expect(screen.getAllByText('ผู้ตรวจสอบเนื้อหา').length).toBeGreaterThan(0);
  });

  it('shows a failure in words, with a retry, when the list cannot be read', async () => {
    backend();
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/admins'
        ? jsonAnswer(500, 'INTERNAL_ERROR', null, 'boom-secret')
        : undefined,
    );
    renderPage(<AdminsPage />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(screen.queryByText(/boom-secret/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('draws no row action and no new button for an administrator without ADMIN:MANAGE even when rows arrive', async () => {
    signIn('support', { codes: ['AUDIT:VIEW'] });
    backend();
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/admins'
        ? jsonAnswer(200, '200', {
            items: [
              {
                id: '77',
                username: 'someone',
                superAdmin: false,
                status: 'ACTIVE',
                mustChangePassword: false,
                totpEnrolledAt: null,
                lastLoginAt: null,
                createdAt: '2026-10-01T00:00:00Z',
                roles: [],
              },
            ],
            total: 1,
          })
        : undefined,
    );
    renderPage(<AdminsPage />);
    await waitForRows(1);
    expect(screen.queryByRole('button', { name: 'New administrator' })).not.toBeInTheDocument();
    for (const name of ['Edit', 'Disable', 'More']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(
      [...document.querySelectorAll('.ant-table-thead th')].map((th) => th.textContent),
    ).not.toContain('Actions');
  });

  it('shows no write control to an administrator without ADMIN:MANAGE (the list is refused anyway)', async () => {
    signIn('support', { codes: ['AUDIT:VIEW'] });
    backend();
    renderPage(<AdminsPage />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New administrator' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });
});

describe('the protections of the own account and of the last super administrator', () => {
  it('disables disable and delete on the own row, and leaves them on the others', async () => {
    const { user } = await load();
    expect(await rowButton('root', 'Disable')).toBeDisabled();
    expect(await rowButton('reviewer', 'Disable')).toBeEnabled();
    await user.click(within(await rowOf('root')).getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: 'Delete' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.keyboard('{Escape}');
    await user.click(within(await rowOf('reviewer')).getByRole('button', { name: 'More' }));
    const items = await screen.findAllByRole('menuitem', { name: 'Delete' });
    expect(items.some((item) => item.getAttribute('aria-disabled') !== 'true')).toBe(true);
  });

  it('shows no action at all on the last enabled super administrator to an administrator who is not one: the whole row is closed to them', async () => {
    signIn('support', { codes: ['ADMIN:MANAGE'] });
    await load();
    const root = within(await rowOf('root'));
    expect(root.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument();
    expect(root.queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
    expect(root.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('disables disable and delete on the own row of a super administrator who is not the last one', async () => {
    // root and support are both enabled super administrators: the own row is protected as the own row alone
    signIn('support', { codes: ['ADMIN:MANAGE'], superAdmin: true });
    const { user } = await load();
    await waitFor(async () => expect(await rowButton('root', 'Disable')).toBeEnabled());
    expect(await rowButton('support', 'Disable')).toBeDisabled();
    await user.click(within(await rowOf('support')).getByRole('button', { name: 'More' }));
    const items = await screen.findAllByRole('menuitem', { name: 'Delete' });
    expect(items[items.length - 1]).toHaveAttribute('aria-disabled', 'true');
  });

  it('reads all administrators again after a change: the row shows its new state', async () => {
    signIn('support', { codes: ['ADMIN:MANAGE'], superAdmin: true });
    adminOf('finance').superAdmin = true;
    const { user } = await load();
    await waitFor(async () => expect(await rowButton('finance', 'Disable')).toBeEnabled());
    await user.click(await rowButton('finance', 'Disable'));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(async () => expect(await rowButton('finance', 'Enable')).toBeEnabled());
  });

  it('allows both on another super administrator to a super administrator', async () => {
    signIn('support', { codes: ['ADMIN:MANAGE'], superAdmin: true });
    adminOf('finance').superAdmin = true;
    await load();
    await waitFor(async () => expect(await rowButton('root', 'Disable')).toBeEnabled());
    await waitFor(async () => expect(await rowButton('finance', 'Disable')).toBeEnabled());
  });

  it('keeps the last-super rule for a list that is out of date: a disable of the last one is refused by the backend and shown as the text of its code', async () => {
    // The page sees two enabled super administrators; before the click the other one is disabled.
    signIn('support', { codes: ['ADMIN:MANAGE'], superAdmin: true });
    adminOf('finance').superAdmin = true;
    const { user } = await load();
    await waitFor(async () => expect(await rowButton('finance', 'Disable')).toBeEnabled());
    overrideFetch(({ url, method }) =>
      method === 'POST' && url.pathname.endsWith('/status')
        ? jsonAnswer(
            409,
            'INVALID_STATE',
            { status: 'ACTIVE' },
            'The last enabled super administrator',
          )
        : undefined,
    );
    await user.click(await rowButton('finance', 'Disable'));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText(/The current state of the item does not allow this action/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /refuses this for your own account and for the last enabled super administrator/,
      ),
    ).toBeInTheDocument();
    // never the backend's own words
    expect(screen.queryByText(/The last enabled super administrator$/)).not.toBeInTheDocument();
  });

  it('shows 403 for the own account as the text of its code too, when the request does go out', async () => {
    const { user } = await load();
    const taken = overrideFetch(({ url, method }) =>
      method === 'POST' && url.pathname.endsWith('/status')
        ? jsonAnswer(403, 'ADMIN_FORBIDDEN', null, 'An administrator cannot disable themselves')
        : undefined,
    );
    await user.click(await rowButton('reviewer', 'Disable'));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(await screen.findByText(/You do not have permission to do this/)).toBeInTheDocument();
    expect(screen.queryByText(/cannot disable themselves/)).not.toBeInTheDocument();
    expect(taken).toHaveLength(1);
  });
});

describe('the row of a super administrator is closed to an administrator who is not one', () => {
  const asNonSuper = () => signIn('support', { codes: ['ADMIN:MANAGE'], superAdmin: false });
  const PRIVILEGED = ['Disable', 'Reset password', 'Reset two-factor', 'Delete'];
  const EVERY = ['Edit', 'Enable', ...PRIVILEGED, 'More'];

  it('draws no edit, reset password, reset two-factor, disable or delete on the row of a super administrator: the cell has no button', async () => {
    asNonSuper();
    await load();
    const row = await rowOf('root');
    for (const name of EVERY) {
      expect(within(row).queryByRole('button', { name }), name).not.toBeInTheDocument();
    }
    const cell = row.querySelector('td:last-child') as HTMLElement;
    expect(within(cell).queryAllByRole('button')).toHaveLength(0);
  });

  it('draws no Edit and no Enable on the row of a disabled super administrator either', async () => {
    asNonSuper();
    adminOf('finance').superAdmin = true;
    adminOf('finance').status = 'DISABLED';
    await load();
    const finance = within(await rowOf('finance'));
    for (const name of EVERY) {
      expect(finance.queryByRole('button', { name }), name).not.toBeInTheDocument();
    }
  });

  it('leaves Edit and Enable on the row of a disabled super administrator to a super administrator', async () => {
    signIn('support', { codes: ['ADMIN:MANAGE'], superAdmin: true });
    adminOf('finance').superAdmin = true;
    adminOf('finance').status = 'DISABLED';
    await load();
    const finance = within(await rowOf('finance'));
    expect(finance.getByRole('button', { name: 'Edit' })).toBeEnabled();
    expect(finance.getByRole('button', { name: 'Enable' })).toBeEnabled();
  });

  it('draws none of the four under More either', async () => {
    asNonSuper();
    adminOf('finance').superAdmin = true;
    adminOf('finance').status = 'DISABLED';
    const { user } = await load();
    // nothing is left on the row of a super administrator: no menu either
    const finance = within(await rowOf('finance'));
    expect(finance.queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
    for (const name of EVERY) {
      expect(finance.queryByRole('button', { name }), name).not.toBeInTheDocument();
    }
    // and the menu of an ordinary row still has them
    await user.click(within(await rowOf('reviewer')).getByRole('button', { name: 'More' }));
    for (const name of PRIVILEGED.slice(1)) {
      expect((await screen.findAllByRole('menuitem', { name })).length).toBeGreaterThan(0);
    }
  });

  it('leaves all five actions on an ordinary row', async () => {
    asNonSuper();
    await load();
    const reviewer = within(await rowOf('reviewer'));
    expect(reviewer.getByRole('button', { name: 'Edit' })).toBeEnabled();
    expect(reviewer.getByRole('button', { name: 'Disable' })).toBeEnabled();
    expect(reviewer.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('sends nothing to the account of a super administrator', async () => {
    asNonSuper();
    const { calls } = await load();
    await rowOf('root');
    await settled();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('leaves all of them to a super administrator, on the row of another super administrator', async () => {
    signIn('support', { codes: ['ADMIN:MANAGE'], superAdmin: true });
    const { user } = await load();
    await waitFor(async () => expect(await rowButton('root', 'Disable')).toBeEnabled());
    await user.click(within(await rowOf('root')).getByRole('button', { name: 'More' }));
    for (const name of ['Reset password', 'Reset two-factor', 'Delete']) {
      const items = await screen.findAllByRole('menuitem', { name });
      expect(items[items.length - 1]).not.toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('closes the row also when /me did not say whether the administrator is a super one', async () => {
    asNonSuper();
    setTestInitialState({
      me: {
        id: '1002',
        username: 'support',
        mustChangePassword: false,
        permissions: ['ADMIN:MANAGE'],
      },
      meta: {},
    });
    await load();
    const root = within(await rowOf('root'));
    for (const name of EVERY) expect(root.queryByRole('button', { name })).not.toBeInTheDocument();
  });
});

describe('the own account cannot reset its own password or second factor', () => {
  it('disables reset password and reset two-factor on the own row, and leaves them on the others', async () => {
    const { user } = await load();
    await user.click(within(await rowOf('root')).getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: 'Reset password' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('menuitem', { name: 'Reset two-factor' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.keyboard('{Escape}');
    await user.click(within(await rowOf('reviewer')).getByRole('button', { name: 'More' }));
    const passwords = await screen.findAllByRole('menuitem', { name: 'Reset password' });
    expect(passwords.some((item) => item.getAttribute('aria-disabled') !== 'true')).toBe(true);
  });

  it('opens no dialog and sends nothing when the disabled item is pressed', async () => {
    const { user, calls } = await load();
    await user.click(within(await rowOf('root')).getByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Reset password' }));
    await user.click(screen.getByRole('menuitem', { name: 'Reset two-factor' }));
    await settled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('does the same for an administrator who is not a super one, whose own row is found by name', async () => {
    signIn('support', { codes: ['ADMIN:MANAGE'], superAdmin: false });
    const { user } = await load();
    await user.click(within(await rowOf('support')).getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: 'Reset password' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('menuitem', { name: 'Reset two-factor' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

describe('the reasons of the buttons that are off are written in the row', () => {
  const REASONS = [
    /You cannot disable or delete your own account\./,
    /You cannot reset your own password here\. To change your own password, use Change password in the account menu\./,
    /You cannot reset your own two-factor authentication\. Ask another administrator to do it\./,
    /This is your own account: you cannot change your own roles or super administrator flag\./,
  ];
  const cellOf = async (row: string) =>
    (await rowOf(row)).querySelector('td:last-child') as HTMLElement;

  it('shows every reason of the own row as small text in the row, with nothing pressed or hovered', async () => {
    await load();
    const cell = within(await cellOf('root'));
    for (const reason of REASONS) expect(cell.getByText(reason)).toBeVisible();
    // not a hover tip: no tip is open or needed
    expect(document.querySelector('.ant-tooltip')).toBeNull();
  });

  it('shows no reason on a row where nothing is off', async () => {
    await load();
    const cell = within(await cellOf('reviewer'));
    for (const reason of REASONS) expect(cell.queryByText(reason)).not.toBeInTheDocument();
    expect(cell.queryByText(/last enabled super administrator/)).not.toBeInTheDocument();
  });

  it('shows the reasons of the own row of an administrator who is not a super one, found by name', async () => {
    signIn('support', { codes: ['ADMIN:MANAGE'], superAdmin: false });
    await load();
    const cell = within(await cellOf('support'));
    for (const reason of REASONS) expect(cell.getByText(reason)).toBeInTheDocument();
    // the reason of the last super administrator is for the last one only
    expect(cell.queryByText(/last enabled super administrator/)).not.toBeInTheDocument();
  });

  it('says why the last enabled super administrator cannot be disabled or deleted, also on a row that is not the own one', async () => {
    // the session says super administrator; the list has one enabled super administrator, root
    signIn('support', { codes: ['ADMIN:MANAGE'], superAdmin: true });
    adminOf('support').superAdmin = false;
    const { user } = await load();
    const cell = within(await cellOf('root'));
    expect(
      await cell.findByText(/last enabled super administrator: it cannot be disabled or deleted/),
    ).toBeVisible();
    expect(cell.queryByText(REASONS[0])).not.toBeInTheDocument();
    expect(await rowButton('root', 'Disable')).toBeDisabled();
    await user.click(within(await rowOf('root')).getByRole('button', { name: 'More' }));
    const items = await screen.findAllByRole('menuitem', { name: 'Delete' });
    expect(items[items.length - 1]).toHaveAttribute('aria-disabled', 'true');
  });

  it('gives the own row both reasons when it is also the last enabled super administrator', async () => {
    await load();
    const cell = within(await cellOf('root'));
    expect(
      await cell.findByText(/last enabled super administrator: it cannot be disabled or deleted/),
    ).toBeInTheDocument();
    expect(cell.getByText(REASONS[0])).toBeInTheDocument();
  });

  it('keeps the reasons when the menu is open and when it is closed again', async () => {
    const { user } = await load();
    await user.click(within(await rowOf('root')).getByRole('button', { name: 'More' }));
    await screen.findByRole('menuitem', { name: 'Reset password' });
    await user.keyboard('{Escape}');
    const cell = within(await cellOf('root'));
    for (const reason of REASONS) expect(cell.getByText(reason)).toBeInTheDocument();
  });

  it('gives the reasons in Chinese', async () => {
    backend();
    renderPage(<AdminsPage />, 'zh-CN');
    await waitForRows();
    const cell = within(await cellOf('root'));
    expect(cell.getByText('不能停用或删除自己的账号。')).toBeInTheDocument();
    expect(cell.getByText(/不能在这里重置自己的密码.*修改密码/)).toBeInTheDocument();
    expect(cell.getByText(/不能重置自己的二次验证/)).toBeInTheDocument();
    expect(cell.getByText(/这是你自己的账号/)).toBeInTheDocument();
    expect(cell.getByText(/最后一个启用的超级管理员：不能停用或删除/)).toBeInTheDocument();
  });
});

describe('disable, enable, reset two-factor, delete', () => {
  it('asks what disabling does, then disables and shows the new state; enabling needs no question', async () => {
    const { user, calls } = await load();
    await user.click(await rowButton('reviewer', 'Disable'));
    expect(
      await screen.findByText(/Disable reviewer\? Their sessions end now/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(async () =>
      expect(within(await rowOf('reviewer')).getByText('Disabled')).toBeInTheDocument(),
    );
    const posts = writesOf(calls);
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      method: 'POST',
      url: '/api/admin/admins/1004/status',
      body: { status: 'DISABLED' },
    });
    await user.click(await rowButton('reviewer', 'Enable'));
    await waitFor(async () =>
      expect(within(await rowOf('reviewer')).getByText('Enabled')).toBeInTheDocument(),
    );
    expect(writesOf(calls)[1].body).toEqual({ status: 'ACTIVE' });
  });

  it('asks before resetting two-factor and says what happens, then sends the reset', async () => {
    const { user, calls } = await load();
    await user.click(await moreItem(user, 'reviewer', 'Reset two-factor'));
    expect(
      (await screen.findAllByText(/Their authenticator is removed and their sessions end now/))
        .length,
    ).toBeGreaterThan(0);
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'POST',
      url: '/api/admin/admins/1004/reset-totp',
    });
    expect(adminOf('reviewer').totpEnrolled).toBe(false);
  });

  it('asks before deleting, deletes, and the row goes', async () => {
    const { user, calls } = await load();
    await user.click(await moreItem(user, 'reviewer', 'Delete'));
    expect(
      (await screen.findAllByText(/Delete reviewer\? This cannot be undone/)).length,
    ).toBeGreaterThan(0);
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() =>
      expect(tableRows().some((cells) => cells[0].startsWith('reviewer'))).toBe(false),
    );
    expect(writesOf(calls)[0]).toMatchObject({ method: 'DELETE', url: '/api/admin/admins/1004' });
  });

  it('does not send the same disable twice when the confirmation is pressed twice', async () => {
    const { user } = await load();
    const held = holdWrites();
    await user.click(await rowButton('reviewer', 'Disable'));
    const ok = await screen.findByRole('button', { name: 'OK' });
    fireEvent.click(ok);
    fireEvent.click(ok);
    await settled();
    expect(held.started()).toBe(1);
    held.release();
  });
});

describe('reset password', () => {
  const open = async (user: ReturnType<typeof userEvent.setup>, row = 'reviewer') => {
    await user.click(await moreItem(user, row, 'Reset password'));
    return within(await dialog());
  };

  it('says what will happen and asks for the new password twice', async () => {
    const { user } = await load();
    const box = await open(user);
    expect(
      box.getByText(/They must change it at the next sign-in and every session of theirs ends now/),
    ).toBeInTheDocument();
    expect(box.getByText(/it is not shown again/)).toBeInTheDocument();
    expect(box.getByLabelText('New password')).toHaveAttribute('type', 'password');
    expect(box.getByLabelText('Repeat the password')).toHaveAttribute('type', 'password');
    expect(box.getByLabelText('New password')).toHaveAttribute('autocomplete', 'new-password');
  });

  it('applies the rules of the server: the minimum length, not the user name, repeated the same', async () => {
    const { user, calls } = await load();
    const box = await open(user);
    await user.type(box.getByLabelText('New password'), 'short');
    await user.type(box.getByLabelText('Repeat the password'), 'short');
    await user.click(box.getByRole('button', { name: /Reset password$/ }));
    expect(
      await box.findByText('The new password needs at least 12 characters'),
    ).toBeInTheDocument();
    await user.clear(box.getByLabelText('New password'));
    await user.type(box.getByLabelText('New password'), PASSWORD);
    await user.clear(box.getByLabelText('Repeat the password'));
    await user.type(box.getByLabelText('Repeat the password'), `${PASSWORD}x`);
    await user.click(box.getByRole('button', { name: /Reset password$/ }));
    expect(await box.findByText('The two new passwords are not the same')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('sends the password as typed, spaces included, with nothing else, and never shows it again', async () => {
    const { user, calls } = await load();
    const typed = `  ${PASSWORD}  `;
    const box = await open(user);
    await user.type(box.getByLabelText('New password'), typed);
    await user.type(box.getByLabelText('Repeat the password'), typed);
    await user.click(box.getByRole('button', { name: /Reset password$/ }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toEqual({
      method: 'POST',
      url: '/api/admin/admins/1004/reset-password',
      body: { newPassword: typed },
    });
    await dialogsClosed();
    expect(
      await screen.findByText(/The password was reset. reviewer must change it/),
    ).toBeInTheDocument();
    // not in the address, not in the page, not in the browser's storage
    expect(JSON.stringify(calls.map((c) => c.url))).not.toContain('correct');
    expect(document.body.innerHTML).not.toContain(PASSWORD);
    expect(JSON.stringify({ ...localStorage })).not.toContain(PASSWORD);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(PASSWORD);
    expect(adminOf('reviewer').password).toBe(typed);
  });

  it('opens empty again for the next administrator (the dialog is not kept between uses)', async () => {
    const { user } = await load();
    let box = await open(user, 'reviewer');
    await user.type(box.getByLabelText('New password'), PASSWORD);
    await user.click(box.getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    box = await open(user, 'finance');
    expect(box.getByLabelText('New password')).toHaveValue('');
    expect(box.getByText(/Reset password: finance/)).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(PASSWORD);
  });

  it('keeps the dialog open and says why when the server refuses, and sends once for two presses', async () => {
    const { user, calls } = await load();
    overrideFetch(({ url }) =>
      url.pathname.endsWith('/reset-password')
        ? jsonAnswer(
            400,
            'INVALID_REQUEST',
            { details: [{ ref: 'newPassword', reason: 'OUT_OF_RANGE' }] },
            'internal-detail',
          )
        : undefined,
    );
    const box = await open(user);
    await user.type(box.getByLabelText('New password'), PASSWORD);
    await user.type(box.getByLabelText('Repeat the password'), PASSWORD);
    const press = box.getByRole('button', { name: /Reset password$/ });
    fireEvent.click(press);
    fireEvent.click(press);
    expect(await box.findByText('The value is outside the allowed range.')).toBeInTheDocument();
    expect(screen.queryByText(/internal-detail/)).not.toBeInTheDocument();
    expect(writesOf(calls).filter((c) => c.url.endsWith('reset-password'))).toHaveLength(0);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('sends one request for two presses', async () => {
    const { user } = await load();
    const box = await open(user);
    await user.type(box.getByLabelText('New password'), PASSWORD);
    await user.type(box.getByLabelText('Repeat the password'), PASSWORD);
    const held = holdWrites();
    const press = box.getByRole('button', { name: /Reset password$/ });
    fireEvent.click(press);
    fireEvent.click(press);
    await settled();
    expect(held.started()).toBe(1);
    held.release();
  });
});

describe('a new administrator', () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'New administrator' }));
    return within(await dialog());
  };
  const fill = async (
    user: ReturnType<typeof userEvent.setup>,
    box: ReturnType<typeof within>,
    over: { username?: string; password?: string; confirm?: string } = {},
  ) => {
    await user.type(box.getByLabelText('User name'), over.username ?? 'anna');
    await user.type(box.getByLabelText('Initial password'), over.password ?? PASSWORD);
    await user.type(
      box.getByLabelText('Repeat the password'),
      over.confirm ?? over.password ?? PASSWORD,
    );
  };

  it('has the fields of the spec: user name, initial password, roles (several), super administrator', async () => {
    const { user } = await load();
    const box = await open(user);
    expect(box.getByLabelText('User name')).toBeEnabled();
    expect(box.getByLabelText('Initial password')).toHaveAttribute('type', 'password');
    expect(
      box.getByText(/At least 12 characters, not the same as the user name/),
    ).toBeInTheDocument();
    expect(rolesBox(box)).toBeEnabled();
    expect(box.getByRole('switch', { name: 'Super administrator' })).toBeEnabled();
  });

  it('takes the minimum length from the answer of /me and checks it in code points', async () => {
    signIn('root', { minLength: 20 });
    const { user, calls } = await load();
    const box = await open(user);
    expect(box.getByText(/At least 20 characters/)).toBeInTheDocument();
    await fill(user, box, { password: 'only-seventeen-c' });
    await user.click(box.getByRole('button', { name: /Save$/ }));
    expect(
      await box.findByText('The new password needs at least 20 characters'),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('does not check the length when /me did not say the minimum', async () => {
    signIn('root', { minLength: null });
    const { user } = await load();
    const box = await open(user);
    expect(box.getByText(/^Not the same as the user name/)).toBeInTheDocument();
  });

  it('asks for a user name, a password that is not the user name, and the same password twice', async () => {
    const { user, calls } = await load();
    const box = await open(user);
    await user.click(box.getByRole('button', { name: /Save$/ }));
    expect(await box.findByText('Enter a user name')).toBeInTheDocument();
    await user.type(box.getByLabelText('User name'), 'a-user-name-12');
    await user.type(box.getByLabelText('Initial password'), 'a-user-name-12');
    await user.type(box.getByLabelText('Repeat the password'), 'a-user-name-12');
    await user.click(box.getByRole('button', { name: /Save$/ }));
    expect(
      await box.findByText('The new password must differ from the user name'),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('reads the role options from GET /roles with pageSize=200 and offers them by name', async () => {
    const { user, calls } = await load();
    const box = await open(user);
    await waitFor(() => expect(calls.some((c) => c.url.startsWith('/api/admin/roles'))).toBe(true));
    expect(calls.find((c) => c.url.startsWith('/api/admin/roles'))?.url).toBe(
      '/api/admin/roles?page=1&pageSize=200',
    );
    await user.click(rolesBox(box));
    for (const name of ['Soporte al cliente', '财务审核', 'ผู้ตรวจสอบเนื้อหา', 'المدققون']) {
      expect(
        (await screen.findAllByText(name, { selector: '.ant-select-item-option-content' })).length,
      ).toBeGreaterThan(0);
    }
  });

  it('creates the administrator with several roles: the body has the password as typed and nothing else', async () => {
    const { user, calls } = await load();
    const box = await open(user);
    await fill(user, box);
    await waitFor(() => expect(rolesBox(box)).toBeEnabled());
    await chooseRole(user, rolesBox(box), 'Soporte al cliente');
    await chooseRole(user, rolesBox(box), '财务审核');
    await user.click(box.getByRole('button', { name: /Save$/ }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toEqual({
      method: 'POST',
      url: '/api/admin/admins',
      body: { username: 'anna', password: PASSWORD, roleIds: ['1', '2'], superAdmin: false },
    });
    await dialogsClosed();
    await waitFor(() =>
      expect(tableRows().some((cells) => cells[0].startsWith('anna'))).toBe(true),
    );
    const row = tableRows().find((cells) => cells[0].startsWith('anna')) as string[];
    expect(row[3]).toBe('Yes');
    expect(row[4]).toContain('Soporte al cliente');
    expect(row[4]).toContain('财务审核');
    expect(document.body.innerHTML).not.toContain(PASSWORD);
  });

  it('sends the user name without the white space around it', async () => {
    const { user, calls } = await load();
    const box = await open(user);
    await fill(user, box, { username: `  anna${String.fromCharCode(0x3000)}` });
    await user.click(box.getByRole('button', { name: /Save$/ }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { username: string }).username).toBe('anna');
  });

  it('says the input is not valid, in the words of the language file, when the reason of a detail is not known', async () => {
    const { user } = await load();
    overrideFetch(({ url, method }) =>
      method === 'POST' && url.pathname === '/api/admin/admins'
        ? jsonAnswer(
            400,
            'INVALID_REQUEST',
            { details: [{ ref: 'username', reason: 'WEIRD_REASON' }] },
            'backend words here',
          )
        : undefined,
    );
    const box = await open(user);
    await fill(user, box);
    await user.click(box.getByRole('button', { name: /Save$/ }));
    const message = await box.findAllByText(/Some input is not valid/);
    expect(message.length).toBeGreaterThan(1);
    expect(screen.queryByText(/backend words here/)).not.toBeInTheDocument();
  });

  it('shows nothing the backend sends back about a password, whatever it is called', async () => {
    const { user } = await load();
    overrideFetch(({ url, method }) =>
      method === 'POST' && url.pathname === '/api/admin/admins'
        ? jsonAnswer(200, '200', {
            id: '2999',
            username: 'anna',
            password: 'echo-password-1',
            temporaryPassword: 'tmp-password-2',
            initialPassword: 'init-password-3',
            roles: [],
          })
        : undefined,
    );
    const box = await open(user);
    await fill(user, box);
    await user.click(box.getByRole('button', { name: /Save$/ }));
    await dialogsClosed();
    for (const secret of ['echo-password-1', 'tmp-password-2', 'init-password-3', PASSWORD]) {
      expect(document.body.innerHTML).not.toContain(secret);
      expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain(secret);
    }
  });

  it('puts a duplicate user name under the user name field, as the text of the code', async () => {
    const { user } = await load();
    const box = await open(user);
    await fill(user, box, { username: 'Support' });
    await user.click(box.getByRole('button', { name: /Save$/ }));
    const message = await box.findByText(/An item with the same unique value already exists/);
    expect(message.closest('.ant-form-item')?.textContent).toContain('User name');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('puts the details of a refused password under the password field', async () => {
    const { user } = await load();
    overrideFetch(({ url, method }) =>
      method === 'POST' && url.pathname === '/api/admin/admins'
        ? jsonAnswer(
            400,
            'INVALID_REQUEST',
            { details: [{ ref: 'password', reason: 'OUT_OF_RANGE' }] },
            'the backend words',
          )
        : undefined,
    );
    const box = await open(user);
    await fill(user, box);
    await user.click(box.getByRole('button', { name: /Save$/ }));
    const message = await box.findByText('The value is outside the allowed range.');
    expect(message.closest('.ant-form-item')?.textContent).toContain('Initial password');
    expect(screen.queryByText(/the backend words/)).not.toBeInTheDocument();
  });

  it('sends once for two presses of Save', async () => {
    const { user } = await load();
    const box = await open(user);
    await fill(user, box);
    const held = holdWrites();
    const press = box.getByRole('button', { name: /Save$/ });
    fireEvent.click(press);
    fireEvent.click(press);
    await settled();
    expect(held.started()).toBe(1);
    held.release();
  });

  it('lets only a super administrator use the super administrator switch', async () => {
    signIn('support', { codes: ['ADMIN:MANAGE', 'ROLE:MANAGE'] });
    const { user, calls } = await load();
    const box = await open(user);
    const flag = box.getByRole('switch', { name: 'Super administrator' });
    expect(flag).toBeDisabled();
    expect(box.getByText('Only a super administrator can change this.')).toBeInTheDocument();
    await fill(user, box);
    await user.click(box.getByRole('button', { name: /Save$/ }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { superAdmin: boolean }).superAdmin).toBe(false);
  });

  it('lets a super administrator make a super administrator', async () => {
    const { user, calls } = await load();
    const box = await open(user);
    await fill(user, box);
    await user.click(box.getByRole('switch', { name: 'Super administrator' }));
    await user.click(box.getByRole('button', { name: /Save$/ }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { superAdmin: boolean }).superAdmin).toBe(true);
  });

  it('disables the role choice and names the missing permission when GET /roles is refused with 403', async () => {
    signIn('support', { codes: ['ADMIN:MANAGE'] });
    const { user, calls } = await load();
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/roles'
        ? jsonAnswer(403, 'ADMIN_FORBIDDEN', null, 'no')
        : undefined,
    );
    const box = await open(user);
    expect(
      await box.findByText(/needs the permission Manage roles \(ROLE:MANAGE\)/),
    ).toBeInTheDocument();
    expect(rolesBox(box)).toBeDisabled();
    await fill(user, box);
    await user.click(box.getByRole('button', { name: /Save$/ }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toMatchObject({ roleIds: [] });
  });

  it('says so and offers a new read when the roles cannot be read for another reason', async () => {
    const { user } = await load();
    let refuse = true;
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/roles' && refuse
        ? jsonAnswer(500, 'INTERNAL_ERROR', null, 'oops')
        : undefined,
    );
    const box = await open(user);
    expect(await box.findByText(/The roles could not be read/)).toBeInTheDocument();
    expect(rolesBox(box)).toBeDisabled();
    refuse = false;
    await user.click(box.getByRole('button', { name: 'Read again' }));
    await waitFor(() => expect(rolesBox(box)).toBeEnabled());
  });
});

describe('editing an administrator', () => {
  const edit = async (user: ReturnType<typeof userEvent.setup>, row: string) => {
    await user.click(await rowButton(row, 'Edit'));
    return within(await dialog());
  };

  it('shows the user name read only, and changes the roles with the body of the roles only', async () => {
    const { user, calls } = await load();
    const box = await edit(user, 'reviewer');
    expect(box.getByText('Edit administrator: reviewer')).toBeInTheDocument();
    expect(box.getByLabelText('User name')).toHaveValue('reviewer');
    expect(box.getByLabelText('User name')).toBeDisabled();
    expect(box.queryByLabelText('Initial password')).not.toBeInTheDocument();
    await waitFor(() => expect(rolesBox(box)).toBeEnabled());
    await chooseRole(user, rolesBox(box), '财务审核');
    await user.click(box.getByRole('button', { name: /Save$/ }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toEqual({
      method: 'PUT',
      url: '/api/admin/admins/1004',
      body: { roleIds: ['3', '2'] },
    });
    await dialogsClosed();
    await waitFor(() => {
      const row = tableRows().find((cells) => cells[0].startsWith('reviewer')) as string[];
      expect(row[4]).toContain('财务审核');
    });
  });

  it('on the own row of a super administrator who is not the last one: Edit is disabled, and the dialog would still lock the roles and the flag', async () => {
    signIn('support', { codes: ['ADMIN:MANAGE'], superAdmin: true });
    const { user } = await load();
    await waitFor(async () => expect(await rowButton('root', 'Disable')).toBeEnabled());
    expect(await rowButton('support', 'Edit')).toBeDisabled();
    await user.click(await rowButton('support', 'Edit'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // the dialog itself, told it is the own row
    const me = {
      id: '1002',
      username: 'support',
      superAdmin: true,
      mustChangePassword: false,
      permissions: [],
      passwordMinLength: 12,
    };
    const own = [...store.admins.values()].find((a) => a.username === 'support');
    renderPage(
      <AdminFormModal
        admin={{
          id: String(own?.id),
          username: 'support',
          superAdmin: true,
          status: 'ACTIVE',
          mustChangePassword: false,
          totpEnrolledAt: null,
          lastLoginAt: null,
          createdAt: '2026-08-01T00:00:00Z',
          roles: [],
        }}
        me={me}
        protection={{ own: true, lastSuper: false }}
        onDone={() => {}}
        onClose={() => {}}
      />,
    );
    const box = within(await dialog());
    expect(rolesBox(box)).toBeDisabled();
    expect(box.getByRole('switch', { name: 'Super administrator' })).toBeDisabled();
    expect(box.getByRole('button', { name: /Save$/ })).toBeDisabled();
  });

  it('keeps Save off until something is changed', async () => {
    const { user } = await load();
    const box = await edit(user, 'reviewer');
    await waitFor(() => expect(rolesBox(box)).toBeEnabled());
    expect(box.getByRole('button', { name: /Save$/ })).toBeDisabled();
  });

  it('on the own row: Edit is disabled with the reason, and no dialog opens and no request goes out', async () => {
    const { user, calls } = await load();
    const edit = await rowButton('root', 'Edit');
    expect(edit).toBeDisabled();
    await user.click(edit);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // the reason is written in the row, not shown on hover
    expect(
      within(await rowOf('root')).getByText(
        /This is your own account: you cannot change your own roles or super administrator flag/,
      ),
    ).toBeVisible();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('the dialog of the own row locks the roles and the flag and says why, when it is opened for it anyway', async () => {
    backend();
    const root = [...store.admins.values()].find((a) => a.username === 'root');
    renderPage(
      <AdminFormModal
        admin={{
          id: String(root?.id),
          username: 'root',
          superAdmin: true,
          status: 'ACTIVE',
          mustChangePassword: false,
          totpEnrolledAt: null,
          lastLoginAt: null,
          createdAt: '2026-08-01T00:00:00Z',
          roles: [],
        }}
        me={{
          id: root?.id,
          username: 'root',
          superAdmin: true,
          mustChangePassword: false,
          permissions: [],
          passwordMinLength: 12,
        }}
        protection={{ own: true, lastSuper: false }}
        onDone={() => {}}
        onClose={() => {}}
      />,
    );
    const box = within(await dialog());
    expect(rolesBox(box)).toBeDisabled();
    expect(box.getByRole('switch', { name: 'Super administrator' })).toBeDisabled();
    expect(box.getByRole('button', { name: /Save$/ })).toBeDisabled();
    expect(
      box.getByText(/you cannot change your own roles or super administrator flag/),
    ).toBeInTheDocument();
    expect(box.getByLabelText('User name')).toBeDisabled();
  });

  it('finds the own row by the user name when /me has no id: Edit is disabled there too', async () => {
    signIn('support', { codes: ['ADMIN:MANAGE', 'ROLE:MANAGE'], superAdmin: false });
    // /me without an id
    setTestInitialState({
      me: {
        username: 'support',
        superAdmin: false,
        mustChangePassword: false,
        permissions: ['ADMIN:MANAGE', 'ROLE:MANAGE'],
        passwordMinLength: 12,
      },
      meta: {},
    });
    const { calls } = await load();
    expect(await rowButton('support', 'Edit')).toBeDisabled();
    expect(await rowButton('reviewer', 'Edit')).toBeEnabled();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('keeps the flag switch off for a non-super administrator: only the roles can change', async () => {
    signIn('support', { codes: ['ADMIN:MANAGE', 'ROLE:MANAGE'] });
    const { user, calls } = await load();
    const box = await edit(user, 'reviewer');
    expect(box.getByRole('switch', { name: 'Super administrator' })).toBeDisabled();
    await waitFor(() => expect(rolesBox(box)).toBeEnabled());
    await chooseRole(user, rolesBox(box), 'Pengguna baru');
    await user.click(box.getByRole('button', { name: /Save$/ }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(Object.keys(writesOf(calls)[0].body as object)).toEqual(['roleIds']);
  });

  it('lets a super administrator set the flag: the body holds the flag only when only the flag changed', async () => {
    const { user, calls } = await load();
    const box = await edit(user, 'reviewer');
    await waitFor(() => expect(rolesBox(box)).toBeEnabled());
    await user.click(box.getByRole('switch', { name: 'Super administrator' }));
    await user.click(box.getByRole('button', { name: /Save$/ }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toEqual({ superAdmin: true });
  });

  it('does not send the roles when they could not be read: the list would take every role away', async () => {
    const { user, calls } = await load();
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/roles' ? jsonAnswer(403, 'ADMIN_FORBIDDEN') : undefined,
    );
    const box = await edit(user, 'reviewer');
    expect(
      await box.findByText(/needs the permission Manage roles \(ROLE:MANAGE\)/),
    ).toBeInTheDocument();
    expect(rolesBox(box)).toBeDisabled();
    // the roles of the administrator are still shown, as text
    expect(box.getByText(/Current roles: ผู้ตรวจสอบเนื้อหา/)).toBeInTheDocument();
    await user.click(box.getByRole('switch', { name: 'Super administrator' }));
    await user.click(box.getByRole('button', { name: /Save$/ }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toEqual({ superAdmin: true });
  });

  it('opens with the values of the administrator clicked, not the ones of the last dialog', async () => {
    const { user } = await load();
    let box = await edit(user, 'reviewer');
    await waitFor(() => expect(rolesBox(box)).toBeEnabled());
    await chooseRole(user, rolesBox(box), 'Pengguna baru');
    await user.click(box.getByRole('switch', { name: 'Super administrator' }));
    await user.click(box.getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    box = await edit(user, 'finance');
    expect(box.getByLabelText('User name')).toHaveValue('finance');
    expect(box.getByRole('switch', { name: 'Super administrator' })).not.toBeChecked();
    expect(box.getByText('财务审核')).toBeInTheDocument();
    expect(box.queryByText('Pengguna baru')).not.toBeInTheDocument();
  });

  it('shows the refusal of the backend as the text of its code and keeps the dialog open', async () => {
    const { user } = await load();
    overrideFetch(({ url, method }) =>
      method === 'PUT' && url.pathname.startsWith('/api/admin/admins/')
        ? jsonAnswer(403, 'ADMIN_FORBIDDEN', null, 'An administrator cannot change their own roles')
        : undefined,
    );
    const box = await edit(user, 'reviewer');
    await waitFor(() => expect(rolesBox(box)).toBeEnabled());
    await user.click(box.getByRole('switch', { name: 'Super administrator' }));
    await user.click(box.getByRole('button', { name: /Save$/ }));
    expect(await box.findByText(/You do not have permission to do this/)).toBeInTheDocument();
    expect(screen.queryByText(/cannot change their own roles$/)).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('the own account, if the controls were not disabled', () => {
  // The dialog is told the row is not the own one (as if the check of the page failed); the request
  // still leaves the roles and the flag out, because the service knows who is signed in.
  it('does not send the roles or the flag of the own account when the dialog lets them be changed', async () => {
    const calls = backend();
    const user = userEvent.setup();
    const root = [...store.admins.values()].find((a) => a.username === 'root');
    const me = {
      id: root?.id,
      username: 'root',
      superAdmin: true,
      mustChangePassword: false,
      permissions: [],
      passwordMinLength: 12,
    };
    renderPage(
      <AdminFormModal
        admin={{
          id: String(root?.id),
          username: 'root',
          superAdmin: true,
          status: 'ACTIVE',
          mustChangePassword: false,
          totpEnrolledAt: null,
          lastLoginAt: null,
          createdAt: '2026-08-01T00:00:00Z',
          roles: [],
        }}
        me={me}
        protection={{ own: false, lastSuper: false }}
        onDone={() => {}}
        onClose={() => {}}
      />,
    );
    const box = within(await dialog());
    await waitFor(() => expect(rolesBox(box)).toBeEnabled());
    await chooseRole(user, rolesBox(box), 'Pengguna baru');
    await user.click(box.getByRole('switch', { name: 'Super administrator' }));
    await user.click(box.getByRole('button', { name: /Save$/ }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].method).toBe('PUT');
    expect(writesOf(calls)[0].body).toEqual({});
  });
});

describe('the flag of the last enabled super administrator', () => {
  it('is disabled with the reason when the dialog is told it is the last one', async () => {
    signIn('support', { codes: ['ADMIN:MANAGE'], superAdmin: true });
    backend();
    renderPage(
      <AdminFormModal
        admin={{
          id: '1001',
          username: 'root',
          superAdmin: true,
          status: 'ACTIVE',
          mustChangePassword: false,
          totpEnrolledAt: null,
          lastLoginAt: null,
          createdAt: '2026-08-01T00:00:00Z',
          roles: [],
        }}
        me={{
          id: '1002',
          username: 'support',
          superAdmin: true,
          mustChangePassword: false,
          permissions: [],
          passwordMinLength: 12,
        }}
        protection={{ own: false, lastSuper: true }}
        onDone={() => {}}
        onClose={() => {}}
      />,
    );
    const box = within(await dialog());
    expect(box.getByRole('switch', { name: 'Super administrator' })).toBeDisabled();
    expect(
      box.getByText(/the last enabled super administrator: the flag cannot be cleared/),
    ).toBeInTheDocument();
  });
});

describe('in Chinese', () => {
  it('shows the columns and the note in Chinese', async () => {
    backend();
    renderPage(<AdminsPage />, 'zh-CN');
    await waitForRows();
    const headers = [...document.querySelectorAll('.ant-table-thead th')].map(
      (th) => th.textContent,
    );
    expect(headers).toEqual([
      '用户名',
      '超级管理员',
      '状态',
      '必须改密码',
      '角色',
      '最近登录',
      '创建时间',
      '操作',
    ]);
    expect(screen.getByText(/不能修改自己的角色、超级管理员标志和状态/)).toBeInTheDocument();
    expect(
      within(await rowOf('support')).getByRole('button', { name: '编辑' }),
    ).toBeInTheDocument();
  });
});
