import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import system from '../../../mock/system.mock';
import systemPermissions from '../../../mock/system.permissions.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { PERMISSION_CODES } from '../../access/permissionCodes';
import { PermissionNodeModal } from './PermissionNodeModal';
import PermissionsPage from './permissions';
import {
  dialogsClosed,
  holdWrites,
  jsonAnswer,
  overrideFetch,
  settled,
  signIn,
  systemState,
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

const custom = (code: string, parent: string | null, over: Record<string, unknown> = {}) =>
  systemState.nodes.set(code, {
    code,
    parent,
    type: parent === null ? 'MENU' : 'FUNCTION',
    sortOrder: 900,
    nameZh: `${code} 中文名`,
    nameEn: `${code} English`,
    builtin: false,
    createdByUsername: 'root',
    ...over,
  });
/** A chain A > B > C, a node D beside them and a lonely node E. */
const seedChain = () => {
  custom('CUSTOM:A', null, { sortOrder: 901 });
  custom('CUSTOM:B', 'CUSTOM:A', { sortOrder: 902 });
  custom('CUSTOM:C', 'CUSTOM:B', { sortOrder: 903 });
  custom('CUSTOM:D', null, { sortOrder: 904 });
  custom('CUSTOM:E', null, { sortOrder: 905 });
};

const load = async (locale: 'en-US' | 'zh-CN' = 'en-US') => {
  const calls = backend();
  const user = userEvent.setup();
  renderPage(<PermissionsPage />, locale);
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  return { calls, user };
};
const rows = () =>
  [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')] as HTMLTableRowElement[];
const rowOf = async (code: string) => {
  await waitFor(() =>
    expect(rows().some((tr) => tr.getAttribute('data-row-key') === code)).toBe(true),
  );
  return rows().find((tr) => tr.getAttribute('data-row-key') === code) as HTMLTableRowElement;
};
const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');
const dialog = () => screen.findByRole('dialog');
const save = (box: ReturnType<typeof within>) => box.getByRole('button', { name: /Save$/ });
const openEdit = async (user: ReturnType<typeof userEvent.setup>, code: string) => {
  await user.click(within(await rowOf(code)).getByRole('button', { name: 'Edit' }));
  return within(await dialog());
};
const openNew = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'New node' }));
  return within(await dialog());
};
const optionTexts = async () => {
  const options = await screen.findAllByRole('option');
  return options.map((o) => o.getAttribute('aria-label') ?? o.textContent ?? '');
};

describe('the page of the permission tree', () => {
  it('says at the top that custom nodes cannot be given to roles and have no effect on the existing endpoints', async () => {
    await load();
    expect(
      screen.getByText(
        /Custom nodes group permissions or keep a place for pages that come later\. They cannot be given to roles and have no effect on the existing endpoints/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /the endpoints and pages check only the built-in permission codes of the system/,
      ),
    ).toBeInTheDocument();
  });

  it('says the same sentence as the spec in Chinese', async () => {
    await load('zh-CN');
    expect(
      screen.getByText(
        '自定义节点用来给权限分组或为以后的页面预留，不能分配给角色，对现有接口没有效力；接口和页面只检查系统内置的权限码。',
      ),
    ).toBeInTheDocument();
    const headers = [...document.querySelectorAll('.ant-table-thead th')].map(
      (th) => th.textContent,
    );
    expect(headers).toEqual(['名称', '权限码', '类型', '排序', '来源', '操作']);
  });

  it('draws the whole built-in tree as a tree with the columns of the spec', async () => {
    await load();
    const headers = [...document.querySelectorAll('.ant-table-thead th')].map(
      (th) => th.textContent,
    );
    expect(headers).toEqual(['Name', 'Permission code', 'Type', 'Order', 'Source', 'Actions']);
    expect(rows()).toHaveLength(PERMISSION_CODES.length);
    const user = cellsOf(await rowOf('USER:VIEW'));
    expect(user[1]).toBe('USER:VIEW');
    expect(user[2]).toBe('Menu');
    expect(user[3]).toBe('1');
    expect(user[4]).toBe('Built-in');
    expect(cellsOf(await rowOf('USER:BAN'))[2]).toBe('Function');
    // a child is below its parent
    const keys = rows().map((tr) => tr.getAttribute('data-row-key'));
    expect(keys.indexOf('USER:BAN')).toBeGreaterThan(keys.indexOf('USER:VIEW'));
  });

  it('names the nodes by the interface language, then the other language, then the code', async () => {
    custom('CUSTOM:ZH_ONLY', null, { nameEn: null, nameZh: '只有中文' });
    custom('CUSTOM:EN_ONLY', null, { nameZh: '', nameEn: 'English only' });
    custom('CUSTOM:NONE', null, { nameZh: null, nameEn: '  ' });
    await load();
    expect(cellsOf(await rowOf('CUSTOM:ZH_ONLY'))[0]).toContain('只有中文');
    expect(cellsOf(await rowOf('CUSTOM:EN_ONLY'))[0]).toContain('English only');
    expect(cellsOf(await rowOf('CUSTOM:NONE'))[0]).toContain('CUSTOM:NONE');
    expect(cellsOf(await rowOf('USER:BAN'))[0]).toContain('Ban');
  });

  it('names the nodes in Chinese in the Chinese interface', async () => {
    await load('zh-CN');
    expect(cellsOf(await rowOf('USER:BAN'))[0]).toContain('封禁');
  });

  it('shows names in every language and one of 5000 characters without breaking the table', async () => {
    custom('CUSTOM:TH', null, { nameEn: 'กลุ่มรายงาน', nameZh: 'a' });
    custom('CUSTOM:AR', null, { nameEn: 'مجموعة التقارير', nameZh: 'a' });
    custom('CUSTOM:VI', null, { nameEn: 'Nhóm báo cáo', nameZh: 'a' });
    custom('CUSTOM:LONG', null, { nameEn: 'W'.repeat(5000), nameZh: 'a' });
    await load();
    expect(cellsOf(await rowOf('CUSTOM:TH'))[0]).toContain('กลุ่มรายงาน');
    expect(cellsOf(await rowOf('CUSTOM:AR'))[0]).toContain('مجموعة التقارير');
    expect(cellsOf(await rowOf('CUSTOM:VI'))[0]).toContain('Nhóm báo cáo');
    const long = within(await rowOf('CUSTOM:LONG')).getByText('W'.repeat(5000), {
      selector: 'button',
    });
    expect(long.style.overflowWrap).toBe('anywhere');
  });

  it('keeps a permission code of 5000 characters without a space inside its column', async () => {
    custom('K'.repeat(5000), null, { nameEn: 'Long code', nameZh: 'a' });
    await load();
    const long = screen.getByText('K'.repeat(5000), { selector: 'button' });
    expect(long.style.overflowWrap).toBe('anywhere');
  });

  it('reads the tree with ROLE:MANAGE alone, and shows no write control then', async () => {
    signIn('support', { codes: ['ROLE:MANAGE'] });
    await load();
    expect(rows()).toHaveLength(PERMISSION_CODES.length);
    expect(screen.queryByRole('button', { name: 'New node' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('says in words that the tree cannot be read without ROLE:MANAGE or PERMISSION:MANAGE', async () => {
    signIn('support', { codes: ['AUDIT:VIEW'] });
    backend();
    renderPage(<PermissionsPage />);
    expect(
      await screen.findByText(/Could not read: You do not have permission to do this/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New node' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('gives a node that is not marked custom the rules of a built-in node: no delete, no new parent', async () => {
    custom('CUSTOM:UNMARKED', null, { builtin: undefined });
    const { user } = await load();
    expect(
      within(await rowOf('CUSTOM:UNMARKED')).queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument();
    const box = await openEdit(user, 'CUSTOM:UNMARKED');
    expect(box.getByRole('combobox', { name: 'Parent node' })).toBeDisabled();
  });
});

describe('a built-in node', () => {
  it('has no delete', async () => {
    await load();
    expect(
      within(await rowOf('USER:BAN')).queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument();
    expect(
      within(await rowOf('USER:BAN')).getByRole('button', { name: 'Edit' }),
    ).toBeInTheDocument();
  });

  it('can change only its names and its order: code, type and parent are fixed, and the body says so', async () => {
    const { user, calls } = await load();
    const box = await openEdit(user, 'USER:BAN');
    expect(
      box.getByText(/A built-in node can change only its names and its order/),
    ).toBeInTheDocument();
    expect(box.getByLabelText('Permission code')).toBeDisabled();
    expect(box.getByLabelText('Permission code')).toHaveValue('USER:BAN');
    expect(box.getByRole('combobox', { name: 'Type' })).toBeDisabled();
    expect(box.getByRole('combobox', { name: 'Parent node' })).toBeDisabled();
    expect(box.getByLabelText('Name (English)')).toBeEnabled();
    expect(box.getByLabelText('Name (Chinese)')).toBeEnabled();
    expect(box.getByLabelText('Order')).toBeEnabled();
    await user.clear(box.getByLabelText('Name (English)'));
    await user.type(box.getByLabelText('Name (English)'), '  Ban a user  ');
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toEqual({
      method: 'PUT',
      url: '/api/admin/permissions/USER%3ABAN',
      body: { nameZh: '封禁与解封用户', nameEn: 'Ban a user', sortOrder: 2 },
    });
    await dialogsClosed();
    await waitFor(async () => expect(cellsOf(await rowOf('USER:BAN'))[0]).toContain('Ban a user'));
  });
});

describe('a custom node', () => {
  it('has a delete with a question first, and deletes a node without children', async () => {
    seedChain();
    const { user, calls } = await load();
    await user.click(within(await rowOf('CUSTOM:E')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Delete the node CUSTOM:E? Roles lose it.')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() =>
      expect(rows().some((tr) => tr.getAttribute('data-row-key') === 'CUSTOM:E')).toBe(false),
    );
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'DELETE',
      url: '/api/admin/permissions/CUSTOM%3AE',
    });
  });

  it('shows PERMISSION_HAS_CHILDREN as its text when the node has children, and keeps the node', async () => {
    seedChain();
    const { user } = await load();
    await user.click(within(await rowOf('CUSTOM:A')).getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText('This permission node still has children and cannot be deleted.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('The node has children')).not.toBeInTheDocument();
    expect(await rowOf('CUSTOM:A')).toBeInTheDocument();
  });

  it('sends one delete for two presses of the confirmation', async () => {
    seedChain();
    const { user } = await load();
    const held = holdWrites();
    await user.click(within(await rowOf('CUSTOM:E')).getByRole('button', { name: 'Delete' }));
    const ok = await screen.findByRole('button', { name: 'OK' });
    fireEvent.click(ok);
    fireEvent.click(ok);
    await settled();
    expect(held.started()).toBe(1);
    held.release();
  });

  it('can be edited: names, order and parent; the code and the type are shown and fixed', async () => {
    seedChain();
    const { user, calls } = await load();
    const box = await openEdit(user, 'CUSTOM:D');
    expect(box.getByLabelText('Permission code')).toBeDisabled();
    expect(box.getByRole('combobox', { name: 'Type' })).toBeDisabled();
    const parent = box.getByRole('combobox', { name: 'Parent node' });
    expect(parent).toBeEnabled();
    await user.click(parent);
    const option = await screen.findByTitle('CUSTOM:A English (CUSTOM:A)');
    await user.click(option);
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toEqual({
      method: 'PUT',
      url: '/api/admin/permissions/CUSTOM%3AD',
      body: {
        nameZh: 'CUSTOM:D 中文名',
        nameEn: 'CUSTOM:D English',
        sortOrder: 904,
        parent: 'CUSTOM:A',
      },
    });
    await dialogsClosed();
    expect(systemState.nodes.get('CUSTOM:D')?.parent).toBe('CUSTOM:A');
  });

  it('does not offer the node itself or any of its descendants as the new parent: no loop can be made', async () => {
    seedChain();
    const { user } = await load();
    const box = await openEdit(user, 'CUSTOM:A');
    await user.click(box.getByRole('combobox', { name: 'Parent node' }));
    const titles = (await screen.findAllByRole('option')).map((o) => o.getAttribute('title') ?? '');
    expect(titles.some((t) => t.includes('(CUSTOM:A)'))).toBe(false);
    expect(titles.some((t) => t.includes('(CUSTOM:B)'))).toBe(false);
    expect(titles.some((t) => t.includes('(CUSTOM:C)'))).toBe(false);
    // the others are offered: a sibling, a built-in node
    expect(titles.some((t) => t.includes('(CUSTOM:D)'))).toBe(true);
    expect(titles.some((t) => t.includes('(USER:VIEW)'))).toBe(true);
  });

  it('offers a node under a chain only the nodes that are not below it', async () => {
    seedChain();
    const { user } = await load();
    const box = await openEdit(user, 'CUSTOM:B');
    await user.click(box.getByRole('combobox', { name: 'Parent node' }));
    const titles = (await screen.findAllByRole('option')).map((o) => o.getAttribute('title') ?? '');
    expect(titles.some((t) => t.includes('(CUSTOM:B)'))).toBe(false);
    expect(titles.some((t) => t.includes('(CUSTOM:C)'))).toBe(false);
    expect(titles.some((t) => t.includes('(CUSTOM:A)'))).toBe(true);
  });

  it('can become a root: the parent is cleared and the body says null', async () => {
    seedChain();
    const { user, calls } = await load();
    const box = await openEdit(user, 'CUSTOM:B');
    const select = box.getByRole('combobox', { name: 'Parent node' });
    await user.click(select);
    await user.click(await screen.findByTitle('No parent (a root)'));
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { parent: string | null }).parent).toBeNull();
  });

  it('leaves the parent out of the body when it was not changed', async () => {
    seedChain();
    const { user, calls } = await load();
    const box = await openEdit(user, 'CUSTOM:B');
    await user.clear(box.getByLabelText('Order'));
    await user.type(box.getByLabelText('Order'), '77');
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toEqual({
      nameZh: 'CUSTOM:B 中文名',
      nameEn: 'CUSTOM:B English',
      sortOrder: 77,
    });
  });

  it('opens with the node that was clicked, not with the values of the dialog before', async () => {
    seedChain();
    const { user } = await load();
    let box = await openEdit(user, 'CUSTOM:D');
    await user.clear(box.getByLabelText('Name (English)'));
    await user.type(box.getByLabelText('Name (English)'), 'half typed');
    await user.click(box.getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    box = await openEdit(user, 'CUSTOM:E');
    expect(box.getByLabelText('Permission code')).toHaveValue('CUSTOM:E');
    expect(box.getByLabelText('Name (English)')).toHaveValue('CUSTOM:E English');
  });

  it('shows the refusal of a loop by the backend as the text of its code and keeps the dialog', async () => {
    seedChain();
    const { user } = await load();
    overrideFetch(({ url, method }) =>
      method === 'PUT' && url.pathname.startsWith('/api/admin/permissions/')
        ? jsonAnswer(
            400,
            'INVALID_REQUEST',
            { details: [{ ref: 'parent', reason: 'OUT_OF_RANGE' }] },
            'cycle words',
          )
        : undefined,
    );
    const box = await openEdit(user, 'CUSTOM:D');
    await user.click(box.getByRole('combobox', { name: 'Parent node' }));
    await user.click(await screen.findByTitle('CUSTOM:A English (CUSTOM:A)'));
    await user.click(save(box));
    expect(await box.findByText('The value is outside the allowed range.')).toBeInTheDocument();
    expect(screen.queryByText(/cycle words/)).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('a new node', () => {
  const fill = async (
    user: ReturnType<typeof userEvent.setup>,
    box: ReturnType<typeof within>,
    over: { code?: string; zh?: string; en?: string; order?: string } = {},
  ) => {
    await user.type(box.getByLabelText('Permission code'), over.code ?? 'CUSTOM:NEW');
    await user.type(box.getByLabelText('Name (Chinese)'), over.zh ?? '新节点');
    await user.type(box.getByLabelText('Name (English)'), over.en ?? 'New node');
    await user.clear(box.getByLabelText('Order'));
    await user.type(box.getByLabelText('Order'), over.order ?? '950');
  };

  it('has the fields of the spec: parent, type, code, Chinese and English names, order', async () => {
    const { user } = await load();
    const box = await openNew(user);
    expect(box.getByRole('combobox', { name: 'Parent node' })).toBeEnabled();
    expect(box.getByRole('combobox', { name: 'Type' })).toBeEnabled();
    expect(box.getByLabelText('Permission code')).toBeEnabled();
    expect(box.getByLabelText('Name (Chinese)')).toBeEnabled();
    expect(box.getByLabelText('Name (English)')).toBeEnabled();
    expect(box.getByLabelText('Order')).toBeEnabled();
  });

  it('offers the end of the siblings as the order: one more than the last node under the same parent', async () => {
    seedChain();
    const { user } = await load();
    const box = await openNew(user);
    // no parent: after the last root (CUSTOM:E has 905)
    expect(box.getByLabelText('Order')).toHaveValue('906');
    await user.click(box.getByRole('combobox', { name: 'Parent node' }));
    await user.click(await screen.findByTitle(/\(USER:VIEW\)/));
    // the last child of USER:VIEW is USER:PHONE_VIEW with 5
    await waitFor(() => expect(box.getByLabelText('Order')).toHaveValue('6'));
    await user.click(box.getByRole('combobox', { name: 'Parent node' }));
    await user.click(await screen.findByTitle('CUSTOM:A English (CUSTOM:A)'));
    await waitFor(() => expect(box.getByLabelText('Order')).toHaveValue('903'));
  });

  it('offers 1 as the order under a parent that has no child yet', async () => {
    const { user } = await load();
    const box = await openNew(user);
    await user.click(box.getByRole('combobox', { name: 'Parent node' }));
    await user.click(await screen.findByTitle(/\(AUDIT:VIEW\)/));
    await waitFor(() => expect(box.getByLabelText('Order')).toHaveValue('1'));
  });

  it('sends the offered order when the person does not touch it, and puts the node last among its siblings', async () => {
    seedChain();
    const { user, calls } = await load();
    const box = await openNew(user);
    await user.type(box.getByLabelText('Permission code'), 'CUSTOM:LAST');
    await user.type(box.getByLabelText('Name (Chinese)'), '最后');
    await user.type(box.getByLabelText('Name (English)'), 'Last');
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { sortOrder: number }).sortOrder).toBe(906);
    await dialogsClosed();
    // the node is drawn after the other roots
    const keys = rows().map((tr) => tr.getAttribute('data-row-key'));
    expect(keys.indexOf('CUSTOM:LAST')).toBeGreaterThan(keys.indexOf('CUSTOM:E'));
  });

  it('keeps an order the person typed when the parent is changed afterwards', async () => {
    const { user } = await load();
    const box = await openNew(user);
    await user.clear(box.getByLabelText('Order'));
    await user.type(box.getByLabelText('Order'), '7');
    await user.click(box.getByRole('combobox', { name: 'Parent node' }));
    await user.click(await screen.findByTitle(/\(USER:VIEW\)/));
    await settled();
    expect(box.getByLabelText('Order')).toHaveValue('7');
  });

  it('makes the node with the parent and type chosen, and it appears in the tree', async () => {
    const { user, calls } = await load();
    const box = await openNew(user);
    await fill(user, box, { code: '  CUSTOM:NEW  ' });
    await user.click(box.getByRole('combobox', { name: 'Parent node' }));
    await user.click(await screen.findByTitle(/\(AUDIT:VIEW\)/));
    await user.click(box.getByRole('combobox', { name: 'Type' }));
    await user.click(await screen.findByTitle('Function'));
    await user.click(save(box));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toEqual({
      method: 'POST',
      url: '/api/admin/permissions',
      body: {
        code: 'CUSTOM:NEW',
        parent: 'AUDIT:VIEW',
        type: 'FUNCTION',
        sortOrder: 950,
        nameZh: '新节点',
        nameEn: 'New node',
      },
    });
    await dialogsClosed();
    const row = await rowOf('CUSTOM:NEW');
    expect(cellsOf(row)[4]).toBe('Custom');
    expect(cellsOf(row)[2]).toBe('Function');
  });

  it('asks for the code, the names and the order, and sends nothing without them', async () => {
    const { user, calls } = await load();
    const box = await openNew(user);
    await user.clear(box.getByLabelText('Order'));
    await user.click(save(box));
    expect(await box.findByText('Enter a code')).toBeInTheDocument();
    expect(box.getAllByText('Enter a name')).toHaveLength(2);
    expect(box.getByText('Enter a whole number')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('refuses a code with a space or one that exists, before anything is sent', async () => {
    const { user, calls } = await load();
    const box = await openNew(user);
    await fill(user, box, { code: 'two words' });
    await user.click(save(box));
    expect(
      await box.findByText(
        'The code cannot contain spaces or control characters, and is at most 100 characters.',
      ),
    ).toBeInTheDocument();
    await user.clear(box.getByLabelText('Permission code'));
    await user.type(box.getByLabelText('Permission code'), 'USER:BAN');
    await user.click(save(box));
    expect(await box.findByText('A node with this code exists already.')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('puts the duplicate the backend finds under the code field, as the text of the code', async () => {
    const { user } = await load();
    overrideFetch(({ url, method }) =>
      method === 'POST' && url.pathname === '/api/admin/permissions'
        ? jsonAnswer(409, 'DUPLICATE_RESOURCE', { field: 'code' }, 'duplicate words')
        : undefined,
    );
    const box = await openNew(user);
    await fill(user, box);
    await user.click(save(box));
    const message = await box.findByText(/An item with the same unique value already exists/);
    expect(message.closest('.ant-form-item')?.textContent).toContain('Permission code');
    expect(screen.queryByText(/duplicate words/)).not.toBeInTheDocument();
  });

  it('sends once for two presses of Save', async () => {
    const { user } = await load();
    const box = await openNew(user);
    await fill(user, box);
    const held = holdWrites();
    fireEvent.click(save(box));
    fireEvent.click(save(box));
    await settled();
    expect(held.started()).toBe(1);
    held.release();
  });

  it('offers every node as a parent, including the custom ones', async () => {
    seedChain();
    const { user } = await load();
    const box = await openNew(user);
    await user.click(box.getByRole('combobox', { name: 'Parent node' }));
    const titles = await optionTexts();
    expect(titles.length).toBeGreaterThan(PERMISSION_CODES.length);
  });
});

type StaleNode = Parameters<typeof PermissionNodeModal>[0]['nodes'][number];
const staleNode = (code: string, parent: string | null): StaleNode => ({
  code,
  parent,
  type: 'MENU',
  sortOrder: 1,
  nameZh: code,
  nameEn: code,
  builtin: false,
});
const BEFORE = [staleNode('CUSTOM:A', null), staleNode('CUSTOM:D', null)];
let changeNodes: (nodes: StaleNode[]) => void = () => {};

function StaleHarness() {
  const [nodes, set] = useState(BEFORE);
  changeNodes = set;
  return (
    <PermissionNodeModal node={BEFORE[0]} nodes={nodes} onDone={() => {}} onClose={() => {}} />
  );
}

describe('a node that was moved by somebody else while the dialog was open', () => {
  it('is not sent under a node that is now below it: the request is refused before it goes out', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<StaleHarness />);
    const box = within(await dialog());
    await user.click(box.getByRole('combobox', { name: 'Parent node' }));
    await user.click(await screen.findByTitle('CUSTOM:D (CUSTOM:D)'));
    // meanwhile D became a child of A: moving A under D would make a loop
    await act(async () =>
      changeNodes([staleNode('CUSTOM:A', null), staleNode('CUSTOM:D', 'CUSTOM:A')]),
    );
    await user.click(save(box));
    expect(
      await box.findByText('A node cannot be put under itself or under its own descendant.'),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });
});
