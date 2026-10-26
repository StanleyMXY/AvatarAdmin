import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import system from '../../../mock/system.mock';
import systemPermissions from '../../../mock/system.permissions.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { PERMISSION_CODES } from '../../access/permissionCodes';
import RolesPage from './roles';
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

const load = async () => {
  const calls = backend();
  const user = userEvent.setup();
  renderPage(<RolesPage />);
  await waitForRows();
  return { calls, user };
};
const dialog = () => screen.findByRole('dialog');
const openNew = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'New role' }));
  const box = within(await dialog());
  await waitFor(() => expect(box.getAllByRole('checkbox').length).toBeGreaterThan(0));
  return box;
};
const openEdit = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(within(await rowOf(name)).getByRole('button', { name: 'Edit' }));
  const box = within(await dialog());
  await waitFor(() => expect(box.getAllByRole('checkbox').length).toBeGreaterThan(0));
  return box;
};
const checkbox = (box: ReturnType<typeof within>, code: string) =>
  box.getByRole('checkbox', {
    name: new RegExp(`\\s${code.replace(':', ':')}$`),
  }) as HTMLInputElement;
const save = (box: ReturnType<typeof within>) => box.getByRole('button', { name: /Save$/ });

describe('the list of roles', () => {
  it('shows name, remark, number of permission codes and creation time', async () => {
    await load();
    const headers = [...document.querySelectorAll('.ant-table-thead th')].map(
      (th) => th.textContent,
    );
    expect(headers).toEqual(['Name', 'Remark', 'Permissions', 'Created', 'Actions']);
    const support = tableRows().find((cells) => cells[0] === 'Soporte al cliente') as string[];
    expect(support[2]).toBe('8 codes');
    const auditors = tableRows().find((cells) => cells[0] === 'المدققون') as string[];
    expect(auditors[1]).toBe('يقرأ سجل التدقيق فقط 🔍');
    expect(auditors[2]).toBe('1 code');
  });

  it('shows names in every language and a name of 5000 characters without a space without breaking the table', async () => {
    const long = 'q'.repeat(5000);
    systemState.roles.set('50', {
      id: '50',
      name: long,
      remark: 'ก'.repeat(400),
      createdAt: '2026-10-02T00:00:00Z',
      permissionCodes: [],
    });
    systemState.roles.set('51', {
      id: '51',
      name: 'Vai trò quản lý — 管理员 — Gestión 🎯',
      remark: null,
      createdAt: '2026-10-03T00:00:00Z',
      permissionCodes: [],
    });
    await load();
    await waitFor(() => expect(screen.getByText(long, { selector: 'button' })).toBeInTheDocument());
    expect(screen.getByText(long, { selector: 'button' }).style.overflowWrap).toBe('anywhere');
    expect(
      screen.getByText('Vai trò quản lý — 管理员 — Gestión 🎯', { selector: 'button' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Pengguna baru').length).toBeGreaterThan(0);
  });

  it('shows no write control to an administrator who can read the roles with ADMIN:MANAGE only', async () => {
    signIn('support', { codes: ['ADMIN:MANAGE'] });
    backend();
    renderPage(<RolesPage />);
    await waitForRows();
    expect(tableRows().length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'New role' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('shows the columns in Chinese', async () => {
    backend();
    renderPage(<RolesPage />, 'zh-CN');
    await waitForRows();
    const headers = [...document.querySelectorAll('.ant-table-thead th')].map(
      (th) => th.textContent,
    );
    expect(headers).toEqual(['名称', '备注', '权限', '创建时间', '操作']);
  });

  it('shows no write control without ROLE:MANAGE', async () => {
    signIn('support', { codes: ['AUDIT:VIEW'] });
    backend();
    renderPage(<RolesPage />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New role' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });
});

describe('making a role', () => {
  it('reads the permission tree with the read it needs and draws it as check boxes', async () => {
    const { user, calls } = await load();
    const box = await openNew(user);
    expect(calls.some((c) => c.url === '/api/admin/permissions')).toBe(true);
    expect(box.getAllByRole('checkbox')).toHaveLength(PERMISSION_CODES.length);
    expect(box.getByText('0 codes chosen')).toBeInTheDocument();
  });

  it('checks a parent with all its descendants, and saves the complete list sorted', async () => {
    const { user, calls } = await load();
    const box = await openNew(user);
    await user.type(box.getByLabelText('Name'), 'Auditors ผู้ตรวจสอบ');
    await user.type(box.getByLabelText('Remark'), '  read only  ');
    await user.click(checkbox(box, 'USER:VIEW'));
    const children = ['USER:BAN', 'USER:EMAIL_VIEW', 'USER:EXPORT', 'USER:PHONE_VIEW'];
    for (const code of children) expect(checkbox(box, code)).toBeChecked();
    expect(box.getByText('5 codes chosen')).toBeInTheDocument();
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toEqual({
      method: 'POST',
      url: '/api/admin/roles',
      body: {
        name: 'Auditors ผู้ตรวจสอบ',
        remark: 'read only',
        permissionCodes: [
          'USER:BAN',
          'USER:EMAIL_VIEW',
          'USER:EXPORT',
          'USER:PHONE_VIEW',
          'USER:VIEW',
        ],
      },
    });
    await dialogsClosed();
    await waitFor(() =>
      expect(tableRows().some((cells) => cells[0] === 'Auditors ผู้ตรวจสอบ')).toBe(true),
    );
  });

  it('takes the parent out of the value when one descendant is unchecked', async () => {
    const { user, calls } = await load();
    const box = await openNew(user);
    await user.type(box.getByLabelText('Name'), 'Partial');
    await user.click(checkbox(box, 'USER:VIEW'));
    await user.click(checkbox(box, 'USER:BAN'));
    const parent = checkbox(box, 'USER:VIEW');
    expect(parent).not.toBeChecked();
    expect(parent.closest('.ant-checkbox')?.className).toContain('ant-checkbox-indeterminate');
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { permissionCodes: string[] }).permissionCodes).toEqual([
      'USER:EMAIL_VIEW',
      'USER:EXPORT',
      'USER:PHONE_VIEW',
    ]);
  });

  it('can give a role a custom node, and the node is part of the list that is saved', async () => {
    const { user, calls } = await load();
    systemState.nodes.set('CUSTOM:GROUP', {
      code: 'CUSTOM:GROUP',
      parent: null,
      type: 'MENU',
      sortOrder: 900,
      nameZh: '自定义分组',
      nameEn: 'Custom group',
      builtin: false,
      createdByUsername: 'root',
    });
    const box = await openNew(user);
    await user.type(box.getByLabelText('Name'), 'With custom');
    await user.click(checkbox(box, 'CUSTOM:GROUP'));
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { permissionCodes: string[] }).permissionCodes).toEqual([
      'CUSTOM:GROUP',
    ]);
  });

  it('asks for a name, and does not send anything without one', async () => {
    const { user, calls } = await load();
    const box = await openNew(user);
    await user.click(save(box));
    expect(await box.findByText('Enter a name')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('puts a duplicate name under the name field as the text of the code', async () => {
    const { user } = await load();
    const box = await openNew(user);
    await user.type(box.getByLabelText('Name'), 'Pengguna baru');
    await user.click(save(box));
    const message = await box.findByText(/An item with the same unique value already exists/);
    expect(message.closest('.ant-form-item')?.textContent).toContain('Name');
  });

  it('keeps the dialog and shows the text of the code when the backend refuses a code', async () => {
    const { user } = await load();
    overrideFetch(({ url, method }) =>
      method === 'POST' && url.pathname === '/api/admin/roles'
        ? jsonAnswer(
            400,
            'INVALID_REQUEST',
            { details: [{ ref: 'permissionCodes', reason: 'OUT_OF_RANGE' }] },
            'internal words',
          )
        : undefined,
    );
    const box = await openNew(user);
    await user.type(box.getByLabelText('Name'), 'Whatever');
    await user.click(save(box));
    expect(await box.findByText(/Some input is not valid/)).toBeInTheDocument();
    expect(box.getByText('The value is outside the allowed range.')).toBeInTheDocument();
    expect(screen.queryByText(/internal words/)).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('sends once for two presses of Save', async () => {
    const { user } = await load();
    const box = await openNew(user);
    await user.type(box.getByLabelText('Name'), 'Twice');
    const held = holdWrites();
    fireEvent.click(save(box));
    fireEvent.click(save(box));
    await settled();
    expect(held.started()).toBe(1);
    held.release();
  });
});

describe('the permission tree cannot be read', () => {
  it('says why and offers a new read, and Save stays off until the tree is there', async () => {
    const { user } = await load();
    let refuse = true;
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/permissions' && refuse
        ? jsonAnswer(403, 'ADMIN_FORBIDDEN', null, 'no way')
        : undefined,
    );
    await user.click(screen.getByRole('button', { name: 'New role' }));
    const box = within(await dialog());
    expect(
      await box.findByText(
        /The permission tree could not be read: You do not have permission to do this/,
      ),
    ).toBeInTheDocument();
    expect(box.queryByText(/no way/)).not.toBeInTheDocument();
    expect(save(box)).toBeDisabled();
    refuse = false;
    await user.click(box.getByRole('button', { name: 'Read again' }));
    await waitFor(() => expect(box.getAllByRole('checkbox').length).toBeGreaterThan(0));
    expect(save(box)).toBeEnabled();
  });

  it('reads the tree with ROLE:MANAGE alone: the read asks for ROLE:MANAGE or PERMISSION:MANAGE', async () => {
    signIn('support', { codes: ['ROLE:MANAGE'] });
    const { user } = await load();
    const box = await openNew(user);
    expect(box.getAllByRole('checkbox').length).toBe(PERMISSION_CODES.length);
  });
});

describe('editing a role', () => {
  it('shows what the role holds, exactly: a parent alone is checked and its children are not', async () => {
    systemState.roles.set('60', {
      id: '60',
      name: 'Page only',
      remark: null,
      createdAt: '2026-10-05T00:00:00Z',
      permissionCodes: ['USER:VIEW'],
    });
    const { user } = await load();
    const box = await openEdit(user, 'Page only');
    expect(checkbox(box, 'USER:VIEW')).toBeChecked();
    expect(checkbox(box, 'USER:BAN')).not.toBeChecked();
    expect(box.getByText('1 code chosen')).toBeInTheDocument();
  });

  it('replaces the whole set of codes: the body holds every code that is checked', async () => {
    const { user, calls } = await load();
    const box = await openEdit(user, 'Pengguna baru');
    expect(checkbox(box, 'STATS:VIEW')).toBeChecked();
    await user.click(checkbox(box, 'STATS:VIEW'));
    await user.click(checkbox(box, 'AUDIT:VIEW'));
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toEqual({
      method: 'PUT',
      url: '/api/admin/roles/4',
      body: { name: 'Pengguna baru', remark: null, permissionCodes: ['AUDIT:VIEW', 'USER:VIEW'] },
    });
  });

  it('names the codes of the role that are not in the tree and drops them when saving', async () => {
    systemState.roles.set('61', {
      id: '61',
      name: 'Old codes',
      remark: null,
      createdAt: '2026-10-05T00:00:00Z',
      permissionCodes: ['GONE:CODE', 'STATS:VIEW'],
    });
    const { user, calls } = await load();
    const box = await openEdit(user, 'Old codes');
    expect(
      box.getByText(/not in the permission tree and will be dropped when you save: GONE:CODE/),
    ).toBeInTheDocument();
    await user.click(checkbox(box, 'AUDIT:VIEW'));
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { permissionCodes: string[] }).permissionCodes).toEqual([
      'AUDIT:VIEW',
      'STATS:VIEW',
    ]);
  });

  it('opens with the role that was clicked, not with the choices of the dialog before', async () => {
    const { user } = await load();
    let box = await openEdit(user, 'Pengguna baru');
    await user.click(checkbox(box, 'AUDIT:VIEW'));
    await user.type(box.getByLabelText('Remark'), 'draft remark');
    await user.click(box.getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    box = await openEdit(user, 'المدققون');
    expect(box.getByLabelText('Name')).toHaveValue('المدققون');
    expect(box.getByLabelText('Remark')).toHaveValue('يقرأ سجل التدقيق فقط 🔍');
    expect(checkbox(box, 'AUDIT:VIEW')).toBeChecked();
    expect(checkbox(box, 'USER:VIEW')).not.toBeChecked();
    expect(box.getByText('1 code chosen')).toBeInTheDocument();
  });
});

describe('deleting a role', () => {
  it('asks first, and deletes a role no administrator has', async () => {
    const { user, calls } = await load();
    await user.click(within(await rowOf('المدققون')).getByRole('button', { name: 'Delete' }));
    expect(
      await screen.findByText(
        /Delete the role المدققون\? Its permission grants are deleted with it/,
      ),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(tableRows().some((cells) => cells[0] === 'المدققون')).toBe(false));
    expect(writesOf(calls)[0]).toMatchObject({ method: 'DELETE', url: '/api/admin/roles/6' });
  });

  it('shows ROLE_IN_USE as its text, not the words of the backend, and keeps the row', async () => {
    const { user } = await load();
    await user.click(
      within(await rowOf('Soporte al cliente')).getByRole('button', { name: 'Delete' }),
    );
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText('This role is still assigned to admins and cannot be deleted.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/still given to administrators/)).not.toBeInTheDocument();
    expect(tableRows().some((cells) => cells[0] === 'Soporte al cliente')).toBe(true);
  });

  it('sends one delete for two presses of the confirmation', async () => {
    const { user } = await load();
    const held = holdWrites();
    await user.click(within(await rowOf('المدققون')).getByRole('button', { name: 'Delete' }));
    const ok = await screen.findByRole('button', { name: 'OK' });
    fireEvent.click(ok);
    fireEvent.click(ok);
    await settled();
    expect(held.started()).toBe(1);
    held.release();
  });
});
