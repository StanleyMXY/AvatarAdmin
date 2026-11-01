import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import system from '../../../mock/system.mock';
import systemPermissions from '../../../mock/system.permissions.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { history } from '../../../tests/stubs/umi-max';
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

describe('paging', () => {
  it('asks for the page by number, and starts from page 1 again when the page size changes', async () => {
    for (let i = 0; i < 25; i += 1) {
      systemState.roles.set(`9${i}`, {
        id: `9${i}`,
        name: `Role ${String(i).padStart(2, '0')}`,
        remark: null,
        createdAt: `2026-10-01T00:${String(i).padStart(2, '0')}:00Z`,
        permissionCodes: [],
      });
    }
    const { user, calls } = await load();
    expect(tableRows()).toHaveLength(20);
    await user.click(screen.getByTitle('2'));
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/admin/roles?page=2&pageSize=20')).toBe(true),
    );
    await waitFor(() => expect(tableRows()).toHaveLength(12));
    expect(screen.queryByText('Search')).not.toBeInTheDocument();
  });

  it('goes back to the last page that has rows when the only row of the last page is deleted, not to "no data"', async () => {
    // 21 roles: page 1 has 20 and page 2 has the one that is deleted below.
    const extra = 21 - systemState.roles.size;
    for (let i = 0; i < extra; i += 1) {
      systemState.roles.set(`9${i}`, {
        id: `9${i}`,
        name: `Role ${String(i).padStart(2, '0')}`,
        remark: null,
        createdAt: `2026-10-01T00:${String(i).padStart(2, '0')}:00Z`,
        permissionCodes: [],
      });
    }
    expect(systemState.roles.size).toBe(21);
    // No administrator holds a role, so that any of them can be deleted.
    for (const extra of systemState.extras.values()) extra.roleIds = [];
    const { user, calls } = await load();
    await user.click(screen.getByTitle('2'));
    await waitFor(() => expect(tableRows()).toHaveLength(1));
    const lonely = tableRows()[0][0];
    await user.click(within(await rowOf(lonely)).getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(tableRows()).toHaveLength(20));
    expect(screen.queryByText('No data')).not.toBeInTheDocument();
    expect(calls.some((c) => c.url === '/api/admin/roles?page=1&pageSize=20')).toBe(true);
  });

  it('draws no search form: there is nothing to filter', async () => {
    await load();
    expect(document.querySelector('.ant-pro-table-search')).toBeNull();
    expect(screen.queryByRole('button', { name: /查\s*询|Query|Search/ })).not.toBeInTheDocument();
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

  it('keeps the parent in the value when one descendant is unchecked: a page with only a part of its functions', async () => {
    const { user, calls } = await load();
    const box = await openNew(user);
    await user.type(box.getByLabelText('Name'), 'Partial');
    await user.click(checkbox(box, 'USER:VIEW'));
    await user.click(checkbox(box, 'USER:BAN'));
    const parent = checkbox(box, 'USER:VIEW');
    expect(parent).toBeChecked();
    expect(parent.closest('.ant-checkbox')?.className).not.toContain('ant-checkbox-indeterminate');
    expect(checkbox(box, 'USER:BAN')).not.toBeChecked();
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { permissionCodes: string[] }).permissionCodes).toEqual([
      'USER:EMAIL_VIEW',
      'USER:EXPORT',
      'USER:PHONE_VIEW',
      'USER:VIEW',
    ]);
  });

  it('checks the page together with a function that is checked alone, and saves both', async () => {
    const { user, calls } = await load();
    const box = await openNew(user);
    await user.type(box.getByLabelText('Name'), 'Soporte ฝ่ายสนับสนุน');
    await user.click(checkbox(box, 'USER:BAN'));
    expect(checkbox(box, 'USER:BAN')).toBeChecked();
    expect(checkbox(box, 'USER:VIEW')).toBeChecked();
    expect(checkbox(box, 'USER:EXPORT')).not.toBeChecked();
    expect(box.getByText('2 codes chosen')).toBeInTheDocument();
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { permissionCodes: string[] }).permissionCodes).toEqual([
      'USER:BAN',
      'USER:VIEW',
    ]);
  });

  it('cannot give a role a custom node: the box is off and the node is not in the list that is saved', async () => {
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
    expect(checkbox(box, 'CUSTOM:GROUP')).toBeDisabled();
    fireEvent.click(checkbox(box, 'CUSTOM:GROUP'));
    expect(checkbox(box, 'CUSTOM:GROUP')).not.toBeChecked();
    expect(box.getByText('0 codes chosen')).toBeInTheDocument();
    await user.click(checkbox(box, 'AUDIT:VIEW'));
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { permissionCodes: string[] }).permissionCodes).toEqual([
      'AUDIT:VIEW',
    ]);
  });

  it('does not check a custom node below a parent that is checked', async () => {
    const { user, calls } = await load();
    systemState.nodes.set('CUSTOM:UNDER_USER', {
      code: 'CUSTOM:UNDER_USER',
      parent: 'USER:VIEW',
      type: 'FUNCTION',
      sortOrder: 900,
      nameZh: '自定义功能',
      nameEn: 'Custom function',
      builtin: false,
      createdByUsername: 'root',
    });
    const box = await openNew(user);
    await user.type(box.getByLabelText('Name'), 'Below');
    await user.click(checkbox(box, 'USER:VIEW'));
    expect(checkbox(box, 'CUSTOM:UNDER_USER')).not.toBeChecked();
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(
      (writesOf(calls)[0].body as { permissionCodes: string[] }).permissionCodes,
    ).not.toContain('CUSTOM:UNDER_USER');
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

  it('keeps the page code of a role with the page and one function when that function is unchecked', async () => {
    // "Soporte al cliente" holds USER:VIEW and USER:BAN among others
    const { user, calls } = await load();
    const box = await openEdit(user, 'Soporte al cliente');
    expect(checkbox(box, 'USER:VIEW')).toBeChecked();
    expect(checkbox(box, 'USER:BAN')).toBeChecked();
    await user.click(checkbox(box, 'USER:BAN'));
    expect(checkbox(box, 'USER:VIEW')).toBeChecked();
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const sent = (writesOf(calls)[0].body as { permissionCodes: string[] }).permissionCodes;
    expect(sent).toContain('USER:VIEW');
    expect(sent).not.toContain('USER:BAN');
    expect(sent).not.toContain('USER:EXPORT');
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
      box.getByText(/cannot be given to a role .*will be dropped when you save: GONE:CODE/),
    ).toBeInTheDocument();
    await user.click(checkbox(box, 'AUDIT:VIEW'));
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { permissionCodes: string[] }).permissionCodes).toEqual([
      'AUDIT:VIEW',
      'STATS:VIEW',
    ]);
  });

  it('says when a role has a function without the page it is on, saves it as it is, and stops saying it when the page is checked', async () => {
    systemState.roles.set('65', {
      id: '65',
      name: 'Functions only',
      remark: null,
      createdAt: '2026-10-05T00:00:00Z',
      permissionCodes: ['USER:BAN'],
    });
    const { user, calls } = await load();
    const box = await openEdit(user, 'Functions only');
    expect(await box.findByTestId('role-without-page')).toHaveTextContent(/USER:BAN/);
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { permissionCodes: string[] }).permissionCodes).toEqual([
      'USER:BAN',
    ]);
  });

  it('does not say it for a role that has the page with its function, or after the page is checked', async () => {
    systemState.roles.set('66', {
      id: '66',
      name: 'Functions only 2',
      remark: null,
      createdAt: '2026-10-05T00:00:00Z',
      permissionCodes: ['USER:BAN'],
    });
    const { user } = await load();
    const withPage = await openEdit(user, 'Soporte al cliente');
    expect(withPage.queryByTestId('role-without-page')).toBeNull();
    await user.click(withPage.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const box = await openEdit(user, 'Functions only 2');
    expect(await box.findByTestId('role-without-page')).toBeInTheDocument();
    await user.click(checkbox(box, 'USER:VIEW'));
    await waitFor(() => expect(box.queryByTestId('role-without-page')).toBeNull());
  });

  it('keeps a built-in node the application does not know yet when the role is saved, shown checked, and does not name it as dropped', async () => {
    systemState.nodes.set('NEWPAGE:VIEW', {
      code: 'NEWPAGE:VIEW',
      parent: null,
      type: 'MENU',
      sortOrder: 901,
      nameZh: '新页面',
      nameEn: 'New page',
      builtin: true,
      createdByUsername: null,
    });
    systemState.roles.set('64', {
      id: '64',
      name: 'Has the new page',
      remark: null,
      createdAt: '2026-10-05T00:00:00Z',
      permissionCodes: ['NEWPAGE:VIEW', 'STATS:VIEW'],
    });
    const { user, calls } = await load();
    const box = await openEdit(user, 'Has the new page');
    expect(checkbox(box, 'NEWPAGE:VIEW')).toBeChecked();
    expect(box.queryByText(/will be dropped when you save/)).toBeNull();
    // only the name of the role is changed
    const name = box.getByRole('textbox', { name: 'Name' });
    fireEvent.change(name, { target: { value: 'Has the new page 2' } });
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { permissionCodes: string[] }).permissionCodes).toEqual([
      'NEWPAGE:VIEW',
      'STATS:VIEW',
    ]);
  });

  it('names a custom node the role holds, and drops it when saving: custom nodes cannot be given to a role', async () => {
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
    systemState.roles.set('63', {
      id: '63',
      name: 'Had custom',
      remark: null,
      createdAt: '2026-10-05T00:00:00Z',
      permissionCodes: ['CUSTOM:GROUP', 'STATS:VIEW'],
    });
    const { user, calls } = await load();
    const box = await openEdit(user, 'Had custom');
    expect(box.getByText(/will be dropped when you save: CUSTOM:GROUP/)).toBeInTheDocument();
    expect(checkbox(box, 'CUSTOM:GROUP')).not.toBeChecked();
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { permissionCodes: string[] }).permissionCodes).toEqual([
      'STATS:VIEW',
    ]);
  });

  it('does not send a code that is not in the tree even when nothing was touched in the tree', async () => {
    systemState.roles.set('62', {
      id: '62',
      name: 'Untouched',
      remark: null,
      createdAt: '2026-10-05T00:00:00Z',
      permissionCodes: ['GONE:CODE', 'STATS:VIEW'],
    });
    const { user, calls } = await load();
    const box = await openEdit(user, 'Untouched');
    await user.type(box.getByLabelText('Remark'), 'only the remark');
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { permissionCodes: string[] }).permissionCodes).toEqual([
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

describe('an administrator who is not a super administrator hands out only what they hold', () => {
  const HELD = ['ROLE:MANAGE', 'USER:VIEW', 'USER:BAN', 'STATS:VIEW', 'AUDIT:VIEW'];
  const SCOPE_SENTENCE =
    /Administrators can only grant permissions they hold\. You cannot change a role you hold, and you can only change roles and administrators whose permissions you all hold\. Nothing was changed\./;
  beforeEach(() => {
    signIn('support', { codes: HELD });
  });

  it('shows the sentence of the rule for a 403 on save, never the words of the backend, and keeps the dialog and the page', async () => {
    // a role within what is held: the page lets it be saved, and the backend still has the last word
    systemState.roles.set('72', {
      id: '72',
      name: 'Within reach',
      remark: null,
      createdAt: '2026-10-08T00:00:00Z',
      permissionCodes: ['USER:VIEW', 'USER:BAN'],
    });
    const { user, calls } = await load();
    overrideFetch(({ url, method }) =>
      method === 'PUT' && url.pathname === '/api/admin/roles/72'
        ? jsonAnswer(
            403,
            'ADMIN_FORBIDDEN',
            null,
            'Administrators can only change roles whose permissions they hold',
          )
        : undefined,
    );
    const box = await openEdit(user, 'Within reach');
    await user.click(save(box));
    expect(await box.findByText(/You do not have permission to do this\./)).toBeInTheDocument();
    expect(box.getByText(SCOPE_SENTENCE)).toBeInTheDocument();
    expect(
      screen.queryByText('Administrators can only change roles whose permissions they hold'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    expect(history.replace).not.toHaveBeenCalled();
    expect(history.push).not.toHaveBeenCalled();
  });

  it('shows the same sentence when a role cannot be deleted for the same reason, and keeps the row', async () => {
    const { user } = await load();
    // role 3 holds moderation codes that the signed-in administrator does not hold
    await user.click(within(await rowOf('ผู้ตรวจสอบเนื้อหา')).getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(await screen.findByText(SCOPE_SENTENCE, { exact: false })).toBeInTheDocument();
    expect(tableRows().some((cells) => cells[0] === 'ผู้ตรวจสอบเนื้อหา')).toBe(true);
    expect(history.replace).not.toHaveBeenCalled();
  });

  it('switches off the boxes of the permissions the signed-in administrator does not hold, and leaves the held ones on', async () => {
    const { user } = await load();
    const box = await openNew(user);
    for (const code of ['USER:VIEW', 'USER:BAN', 'STATS:VIEW']) {
      expect(checkbox(box, code), code).toBeEnabled();
    }
    for (const code of ['COST:VIEW', 'USER:EXPORT', 'MODERATION:REVIEW']) {
      expect(checkbox(box, code), code).toBeDisabled();
    }
  });

  it('checks only the held nodes below a parent, and sends nothing the administrator does not hold', async () => {
    const { user, calls } = await load();
    const box = await openNew(user);
    await user.type(box.getByLabelText('Name'), 'Within my reach');
    await user.click(checkbox(box, 'USER:VIEW'));
    expect(checkbox(box, 'USER:BAN')).toBeChecked();
    expect(checkbox(box, 'USER:EXPORT')).not.toBeChecked();
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { permissionCodes: string[] }).permissionCodes).toEqual([
      'USER:BAN',
      'USER:VIEW',
    ]);
  });

  it('keeps a code the role has but the administrator does not hold: checked, off, and not removed by unchecking its parent', async () => {
    systemState.roles.set('70', {
      id: '70',
      name: 'Mixed',
      remark: null,
      createdAt: '2026-10-06T00:00:00Z',
      permissionCodes: ['USER:BAN', 'USER:EXPORT', 'USER:VIEW'],
    });
    const { user } = await load();
    const box = await openEdit(user, 'Mixed');
    // the role holds USER:EXPORT; the administrator does not
    expect(checkbox(box, 'USER:EXPORT')).toBeChecked();
    expect(checkbox(box, 'USER:EXPORT')).toBeDisabled();
    await user.click(checkbox(box, 'USER:VIEW'));
    expect(checkbox(box, 'USER:EXPORT')).toBeChecked();
    expect(checkbox(box, 'USER:BAN')).not.toBeChecked();
  });

  describe('a role with a permission that the administrator does not hold', () => {
    const NOTE_START = 'This role has permissions you do not hold: ';
    const STOP = 'You cannot save changes to it.';
    const noteOf = (box: ReturnType<typeof within>) =>
      box.queryByText((text: string) => text.startsWith(NOTE_START));

    it('says so when the dialog opens, lists the codes, and does not let the role be saved', async () => {
      systemState.roles.set('70', {
        id: '70',
        name: 'Mixed',
        remark: null,
        createdAt: '2026-10-06T00:00:00Z',
        permissionCodes: ['USER:BAN', 'USER:EXPORT', 'USER:VIEW', 'COST:VIEW'],
      });
      const { user, calls } = await load();
      const box = await openEdit(user, 'Mixed');
      const note = noteOf(box);
      expect(note).not.toBeNull();
      expect(note?.textContent).toBe(`${NOTE_START}COST:VIEW, USER:EXPORT. ${STOP}`);
      expect(save(box)).toBeDisabled();
      await user.type(box.getByLabelText('Name'), ' 2');
      await user.click(save(box));
      // nor does Enter in a box of the form save it
      await user.type(box.getByLabelText('Name'), '{Enter}');
      await settled();
      expect(writesOf(calls)).toHaveLength(0);
      // the tree is still there to look at
      expect(checkbox(box, 'USER:EXPORT')).toBeChecked();
    });

    it('lists at most 20 codes and then the number of all of them', async () => {
      const codes = PERMISSION_CODES.filter((code) => !HELD.includes(code)).sort();
      expect(codes.length).toBeGreaterThan(25);
      systemState.roles.set('71', {
        id: '71',
        name: 'Everything',
        remark: null,
        createdAt: '2026-10-07T00:00:00Z',
        permissionCodes: [...HELD, ...codes],
      });
      const { user } = await load();
      const box = await openEdit(user, 'Everything');
      expect(noteOf(box)?.textContent).toBe(
        `${NOTE_START}${codes.slice(0, 20).join(', ')} and others, ${codes.length} in total. ${STOP}`,
      );
      expect(save(box)).toBeDisabled();
    });

    it('lists exactly 20 codes without the number', async () => {
      const codes = PERMISSION_CODES.filter((code) => !HELD.includes(code))
        .sort()
        .slice(0, 20);
      systemState.roles.set('71', {
        id: '71',
        name: 'Twenty',
        remark: null,
        createdAt: '2026-10-07T00:00:00Z',
        permissionCodes: codes,
      });
      const { user } = await load();
      const box = await openEdit(user, 'Twenty');
      expect(noteOf(box)?.textContent).toBe(`${NOTE_START}${codes.join(', ')}. ${STOP}`);
    });

    it('shows every code as plain text, whatever it is: markup stays text, other languages and values that are not text show up written out, none is counted twice', async () => {
      systemState.roles.set('73', {
        id: '73',
        name: 'Odd codes',
        remark: null,
        createdAt: '2026-10-09T00:00:00Z',
        permissionCodes: [
          '<img src=x onerror=alert(1)>',
          'ผู้ใช้:ดู',
          'كود:قراءة',
          42,
          { a: 1 },
          null,
          'ผู้ใช้:ดู',
          'USER:VIEW',
        ] as unknown as string[],
      });
      const { user } = await load();
      const box = await openEdit(user, 'Odd codes');
      const shown = (noteOf(box)?.textContent ?? '').slice(NOTE_START.length, -(STOP.length + 2));
      expect(shown.split(', ').sort()).toEqual(
        ['42', '<img src=x onerror=alert(1)>', '{"a":1}', 'ผู้ใช้:ดู', 'كود:قراءة'].sort(),
      );
      expect(noteOf(box)?.textContent?.endsWith(`. ${STOP}`)).toBe(true);
      expect(document.querySelector('.ant-modal img')).toBeNull();
      expect(save(box)).toBeDisabled();
    });

    it('also counts a code that the tree does not know: the backend checks every code the role has', async () => {
      systemState.roles.set('74', {
        id: '74',
        name: 'Old code',
        remark: null,
        createdAt: '2026-10-09T00:00:00Z',
        permissionCodes: ['USER:VIEW', 'OLD:THING'],
      });
      const { user } = await load();
      const box = await openEdit(user, 'Old code');
      expect(noteOf(box)?.textContent).toBe(`${NOTE_START}OLD:THING. ${STOP}`);
      expect(save(box)).toBeDisabled();
    });

    it('says nothing and saves as before when the role has only codes that are held', async () => {
      systemState.roles.set('72', {
        id: '72',
        name: 'Within reach',
        remark: null,
        createdAt: '2026-10-08T00:00:00Z',
        permissionCodes: ['USER:VIEW', 'USER:BAN'],
      });
      const { user, calls } = await load();
      const box = await openEdit(user, 'Within reach');
      expect(noteOf(box)).toBeNull();
      expect(save(box)).toBeEnabled();
      await user.click(checkbox(box, 'USER:BAN'));
      await user.click(save(box));
      await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
      expect(writesOf(calls)[0]).toMatchObject({ method: 'PUT', url: '/api/admin/roles/72' });
    });

    it('says nothing for a role with no codes, and for a new role', async () => {
      systemState.roles.set('75', {
        id: '75',
        name: 'Empty',
        remark: null,
        createdAt: '2026-10-09T00:00:00Z',
        permissionCodes: [],
      });
      const { user } = await load();
      let box = await openEdit(user, 'Empty');
      expect(noteOf(box)).toBeNull();
      expect(save(box)).toBeEnabled();
      await user.click(box.getByRole('button', { name: 'Cancel' }));
      await dialogsClosed();
      box = await openNew(user);
      expect(noteOf(box)).toBeNull();
      expect(save(box)).toBeEnabled();
    });

    it('does not limit a super administrator, whatever the role has', async () => {
      signIn('root');
      systemState.roles.set('70', {
        id: '70',
        name: 'Mixed',
        remark: null,
        createdAt: '2026-10-06T00:00:00Z',
        permissionCodes: ['USER:BAN', 'USER:EXPORT', 'USER:VIEW', 'OLD:THING'],
      });
      const { user } = await load();
      const box = await openEdit(user, 'Mixed');
      expect(noteOf(box)).toBeNull();
      expect(save(box)).toBeEnabled();
    });

    it('does not limit a super administrator whose account lists no permission codes', async () => {
      signIn('root', { codes: [] });
      const { user } = await load();
      const box = await openEdit(user, 'Soporte al cliente');
      expect(noteOf(box)).toBeNull();
      expect(save(box)).toBeEnabled();
    });

    it('limits an administrator who holds nothing: any role with a code cannot be saved', async () => {
      signIn('support', { codes: ['ROLE:MANAGE'] });
      const { user } = await load();
      const box = await openEdit(user, 'Soporte al cliente');
      expect(noteOf(box)).not.toBeNull();
      expect(save(box)).toBeDisabled();
    });

    it.each([
      ['has no permissionCodes at all', undefined],
      ['has permissionCodes null', null],
      ['has permissionCodes that is not a list', 'USER:VIEW'],
    ])(
      'opens a role that %s for an administrator who is not a super administrator, with nothing checked and nothing to complain about',
      async (_name, bad) => {
        signIn('support', { codes: ['ROLE:MANAGE', 'USER:VIEW'] });
        // The fake backend cannot make such a row (it sorts the codes), so the answer is written here.
        backend();
        overrideFetch(({ url, method }) =>
          method === 'GET' && url.pathname === '/api/admin/roles'
            ? jsonAnswer(200, '200', {
                items: [
                  {
                    id: '72',
                    name: 'Sin permisos',
                    remark: null,
                    createdAt: '2026-10-08T00:00:00Z',
                    permissionCodes: bad,
                  },
                ],
                total: 1,
              })
            : undefined,
        );
        const user = userEvent.setup();
        renderPage(<RolesPage />);
        await waitForRows();
        const box = await openEdit(user, 'Sin permisos');
        expect(noteOf(box)).toBeNull();
        expect(box.getAllByRole('checkbox').some((c) => (c as HTMLInputElement).checked)).toBe(
          false,
        );
        expect(save(box)).toBeEnabled();
      },
    );

    it('is written in Chinese when the interface is Chinese', async () => {
      systemState.roles.set('70', {
        id: '70',
        name: 'Mixed',
        remark: null,
        createdAt: '2026-10-06T00:00:00Z',
        permissionCodes: ['USER:BAN', 'USER:EXPORT', 'USER:VIEW'],
      });
      const codes = PERMISSION_CODES.filter((code) => !HELD.includes(code)).sort();
      systemState.roles.set('71', {
        id: '71',
        name: 'Everything',
        remark: null,
        createdAt: '2026-10-07T00:00:00Z',
        permissionCodes: [...HELD, ...codes],
      });
      backend();
      const user = userEvent.setup();
      renderPage(<RolesPage />, 'zh-CN');
      await waitForRows();
      await user.click(within(await rowOf('Mixed')).getByRole('button', { name: '编辑' }));
      let box = within(await dialog());
      await waitFor(() => expect(box.getAllByRole('checkbox').length).toBeGreaterThan(0));
      expect(box.getByText(/^这个角色含有你没有的权限：/).textContent).toBe(
        '这个角色含有你没有的权限：USER:EXPORT，你不能保存对它的修改。',
      );
      expect(box.getByRole('button', { name: /保\s*存$/ })).toBeDisabled();
      await user.click(box.getByRole('button', { name: /取\s*消$/ }));
      await dialogsClosed();
      await user.click(within(await rowOf('Everything')).getByRole('button', { name: '编辑' }));
      const dialogs = await screen.findAllByRole('dialog');
      box = within(dialogs[dialogs.length - 1]);
      expect(box.getByText(/^这个角色含有你没有的权限：/).textContent).toBe(
        `这个角色含有你没有的权限：${codes.slice(0, 20).join(', ')} 等共 ${codes.length} 个，你不能保存对它的修改。`,
      );
    });
  });

  it('does not switch anything off for a super administrator', async () => {
    signIn('root');
    const { user } = await load();
    const box = await openNew(user);
    for (const code of ['COST:VIEW', 'USER:EXPORT', 'MODERATION:REVIEW']) {
      expect(checkbox(box, code), code).toBeEnabled();
    }
  });
});
