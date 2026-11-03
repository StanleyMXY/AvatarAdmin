import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import system from '../../../mock/system.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { AuditAdminFilter } from './AuditAdminFilter';
import AuditPage from './audit';
import { HIDDEN } from './auditDetail';
import {
  jsonAnswer,
  overrideFetch,
  settled,
  signIn,
  systemState,
  tableRows,
  waitForRows,
} from './testSetup';

vi.setConfig({ testTimeout: 30000 });

const backend = () => useMockBackend({ default: system });

beforeEach(() => {
  signIn('root');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const load = async (locale: 'en-US' | 'zh-CN' = 'en-US') => {
  const calls = backend();
  const user = userEvent.setup();
  renderPage(<AuditPage />, locale);
  await waitForRows();
  return { calls, user };
};
const auditCalls = (calls: { url: string }[]) =>
  calls
    .filter((c) => new URL(c.url, 'http://x').pathname === '/api/admin/audit-logs')
    .map((c) => new URL(c.url, 'http://x'));
const lastAudit = (calls: { url: string }[]) => auditCalls(calls).at(-1) as URL;
const search = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /查\s*询|Query|Search/ }));
const cellsOfRow = (action: string, targetId: string) =>
  tableRows().find((cells) => cells[1] === action && cells[3] === targetId) as string[];

const row = (over: Record<string, unknown>) => {
  systemState.audit.unshift({
    id: String(9000 + systemState.audit.length),
    adminId: '1001',
    adminUsername: 'root',
    action: 'SOME_ACTION',
    targetType: 'THING',
    targetId: '1',
    detail: null,
    createdAt: '2026-10-26T09:00:00Z',
    ...over,
  } as never);
};

describe('the audit log list', () => {
  it('shows the six columns of the spec and no column to change anything', async () => {
    await load();
    const headers = [...document.querySelectorAll('.ant-table-thead th')].map(
      (th) => th.textContent,
    );
    expect(headers).toEqual([
      'Administrator',
      'Action',
      'Object type',
      'Object ID',
      'Detail',
      'Time',
    ]);
  });

  it('shows all five filters at once, without a button to expand the search form', async () => {
    await load();
    expect(screen.queryByText(/展开|Expand/)).toBeNull();
    for (const label of ['Administrator', 'Action', 'Object type', 'Object ID']) {
      expect(document.querySelector('.ant-pro-table-search')?.textContent).toContain(label);
    }
    expect(document.querySelector('.ant-pro-table-search')?.textContent).toMatch(/Time|Date/);
  });

  it('has nothing to edit or delete: no such button, link, menu or check box anywhere', async () => {
    await load();
    // the buttons of the cells hold the text of the rows (a detail can say "removed"); the controls are the rest
    const labels = [...document.querySelectorAll('button, a, [role="menuitem"]')]
      .filter((el) => !el.closest('.ant-table-tbody'))
      .map((el) => (el.textContent ?? '').trim().toLowerCase())
      .join('|');
    for (const word of ['edit', 'delete', 'remove', 'new ', 'save', 'clear log', 'purge']) {
      expect(labels, word).not.toContain(word);
    }
    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  });

  it('shows the name written with the row: a renamed administrator stays under the old name', async () => {
    await load();
    // the administrator 1002 was "old-support" then and is called "support" now
    const renamed = tableRows().find((cells) => cells[1] === 'USER_UNBAN') as string[];
    expect(renamed[0]).toBe('old-support');
    expect(renamed[0]).not.toBe('support');
  });

  it('shows the name of an administrator who is gone, and the first eight characters of the id when there is no name', async () => {
    row({ adminId: 'abcdef1234567890', adminUsername: null, action: 'NO_NAME', targetId: '2' });
    await load();
    expect(tableRows().some((cells) => cells[0] === 'gone-admin')).toBe(true);
    expect(cellsOfRow('NO_NAME', '2')[0]).toBe('abcdef12');
    expect(tableRows().some((cells) => cells[0] === '1003')).toBe(true);
  });

  it('shows a dash for an object that has no id, and a time in the interface language', async () => {
    await load();
    const noId = tableRows().find((cells) => cells[1] === 'NOTIFICATION_SEND') as string[];
    expect(noId[3]).toBe('—');
    expect(noId[5]).toMatch(/2026/);
  });

  it('writes a detail of any type as text: text, an object, a list, a number, nothing', async () => {
    await load();
    const text = tableRows().find((cells) => cells[1] === 'USER_UNBAN') as string[];
    expect(text[4]).toBe('ยกเลิกการระงับบัญชี');
    const object = tableRows().find(
      (cells) => cells[1] === 'USER_BAN' && cells[3] === '10000000001',
    ) as string[];
    expect(object[4]).toBe('{"reason":"Spam","status":"BANNED"}');
    const list = tableRows().find((cells) => cells[1] === 'NOTIFICATION_SEND') as string[];
    expect(list[4]).toBe('["Gracias","Cảm ơn","Terima kasih","谢谢"]');
    const number = tableRows().find((cells) => cells[1] === 'PUSH_TASK_CREATE') as string[];
    expect(number[4]).toBe('42');
    const none = tableRows().find((cells) => cells[1] === 'USER_VIEW_AVATAR') as string[];
    expect(none[4]).toBe('—');
  });

  it('keeps odd values inside the cell: 5000 characters without a space, Arabic, Thai, emoji, a value of the wrong type', async () => {
    const long = 'k'.repeat(5000);
    row({ action: 'LONG', targetId: '3', detail: long });
    row({
      action: 'MIXED',
      targetId: '4',
      detail: {
        th: 'ภาษาไทยไม่มีช่องว่าง',
        ar: 'مرحبا بالعالم',
        e: String.fromCodePoint(0x1f600, 0x1f468, 0x200d, 0x1f469),
      },
    });
    row({
      action: 'WRONG_TYPE',
      targetId: '5',
      targetType: 7,
      action2: 1,
      adminUsername: { name: 'obj' },
    });
    row({ action: 'BOOL', targetId: '6', detail: true });
    await load();
    const button = screen.getByText(long, { selector: 'button' });
    expect(button.style.overflowWrap).toBe('anywhere');
    expect(button.getAttribute('dir')).toBe('auto');
    expect(cellsOfRow('MIXED', '4')[4]).toContain('ภาษาไทยไม่มีช่องว่าง');
    expect(cellsOfRow('MIXED', '4')[4]).toContain('مرحبا بالعالم');
    // a type the contract does not promise: it is shown as text and the page stays
    expect(cellsOfRow('WRONG_TYPE', '5')[0]).toBe('{"name":"obj"}');
    expect(cellsOfRow('WRONG_TYPE', '5')[2]).toBe('7');
    expect(cellsOfRow('BOOL', '6')[4]).toBe('true');
  });

  it('never shows a value that belongs to a credential, and writes nothing to the console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m),
    );
    row({ action: 'WITH_SECRET', targetId: '7', detail: 'reset password=hunter2-text for anna' });
    await load();
    const cell = tableRows().find((cells) => cells[1] === 'CAMPAIGN_UPDATE') as string[];
    expect(cell[4]).toContain(HIDDEN);
    expect(document.body.innerHTML).not.toContain('EAAB-secret-token-value');
    expect(document.body.innerHTML).not.toContain('hunter2');
    expect(cellsOfRow('WITH_SECRET', '7')[4]).toBe(`reset password=${HIDDEN} for anna`);
    for (const spy of spies) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain('hunter2');
        expect(JSON.stringify(call)).not.toContain('EAAB-secret-token-value');
      }
    }
    // not in the browser's storage either
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('hunter2');
  });

  it('keeps an action, an object type and an object id of 5000 characters without a space inside their columns', async () => {
    row({
      action: 'A'.repeat(5000),
      targetType: 'T'.repeat(5000),
      targetId: 'I'.repeat(5000),
      detail: 'd',
    });
    await load();
    for (const letter of ['A', 'T', 'I']) {
      const long = screen.getByText(letter.repeat(5000), { selector: 'button' });
      expect(long.style.overflowWrap).toBe('anywhere');
    }
  });

  it('opens the whole detail in a popover with a copy button when the text is long', async () => {
    const user = userEvent.setup();
    row({ action: 'LONGISH', targetId: '8', detail: 'y'.repeat(900) });
    backend();
    renderPage(<AuditPage />);
    await waitForRows();
    await user.click(screen.getByText('y'.repeat(900), { selector: 'button' }));
    expect(await screen.findByTestId('full-text')).toHaveTextContent('y'.repeat(900));
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('shows the columns in Chinese', async () => {
    await load('zh-CN');
    const headers = [...document.querySelectorAll('.ant-table-thead th')].map(
      (th) => th.textContent,
    );
    expect(headers).toEqual(['管理员', '动作', '对象类型', '对象 ID', '详情', '时间']);
  });

  it('says in words that the list cannot be read without AUDIT:VIEW', async () => {
    signIn('support', { codes: ['STATS:VIEW'] });
    backend();
    renderPage(<AuditPage />);
    expect(
      await screen.findByText(/Failed to load: You do not have permission to do this/),
    ).toBeInTheDocument();
  });

  it('shows the failure as the text of its code and not the words of the backend', async () => {
    backend();
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/audit-logs'
        ? jsonAnswer(500, 'INTERNAL_ERROR', null, 'stack trace secret')
        : undefined,
    );
    renderPage(<AuditPage />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(screen.queryByText(/stack trace secret/)).not.toBeInTheDocument();
  });

  it('says the administrator column is the name at the time of writing, and that the filter days are UTC', async () => {
    await load();
    expect(
      screen.getByText(/it does not change when the administrator is renamed or deleted/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Times in the filter are UTC days/)).toBeInTheDocument();
  });

  it('pages: the first page is 20 rows and the next page is asked for by number', async () => {
    const { calls, user } = await load();
    expect(tableRows()).toHaveLength(20);
    await user.click(screen.getByTitle('2'));
    await waitFor(() => expect(lastAudit(calls).searchParams.get('page')).toBe('2'));
    expect(lastAudit(calls).searchParams.get('pageSize')).toBe('20');
  });
});

describe('the filters', () => {
  const choose = async (
    user: ReturnType<typeof userEvent.setup>,
    name: string,
    option: string | RegExp,
  ) => {
    await user.click(await screen.findByRole('combobox', { name }));
    // The list is long and drawn in part: type to find the option, as a person does.
    await user.keyboard(typeof option === 'string' ? option : option.source.replace(/[\^$]/g, ''));
    const options = await screen.findAllByText(option, {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
  };

  it('has an administrator, an action and an object type to choose from, an object ID to type, and a time range (UTC)', async () => {
    await load();
    expect(await screen.findByRole('combobox', { name: 'Administrator' })).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: 'Action' })).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: 'Object type' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Object ID' })).toBeInTheDocument();
    expect(document.querySelector('.ant-picker-range')).not.toBeNull();
    expect(screen.getByText('Time range (UTC)')).toBeInTheDocument();
  });

  it('reads the choices of the action and the object type once, from GET /audit-logs/meta, and nothing of the administrators from GET /admins', async () => {
    const { calls } = await load();
    await screen.findByRole('combobox', { name: 'Action' });
    await settled();
    const meta = calls.filter((c) => c.url === '/api/admin/audit-logs/meta');
    expect(meta).toHaveLength(1);
    expect(calls.filter((c) => c.url === '/api/admin/audit-logs/admins')).toHaveLength(1);
    expect(calls.some((c) => c.url.startsWith('/api/admin/admins'))).toBe(false);
  });

  it('lists the actions of the backend as they are, in its order, and finds one by typing part of it', async () => {
    const { user } = await load();
    await user.click(await screen.findByRole('combobox', { name: 'Action' }));
    const shown = async () =>
      (await screen.findAllByText(/.+/, { selector: '.ant-select-item-option-content' })).map(
        (o) => o.textContent,
      );
    // the list is drawn in part (the first ten): they are the first of the backend's table, in its order
    await waitFor(async () => expect((await shown()).length).toBeGreaterThan(5));
    const first = await shown();
    expect(first.slice(0, 3)).toEqual(['ADMIN_CREATE', 'ADMIN_DELETE', 'ADMIN_RESET_PASSWORD']);
    expect(first).toEqual([...first].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    // the values at the end of the table (a small letter sorts after every capital) are found by typing
    await user.keyboard('ñandú');
    await waitFor(async () => expect(await shown()).toEqual(['ñandú_legacy_action']));
    await user.clear(screen.getByRole('combobox', { name: 'Action' }));
    await user.keyboard('unban');
    await waitFor(async () => expect(await shown()).toEqual(['USER_UNBAN']));
  });

  it('sends the action and the object type that were chosen, exactly as the list has them (a capital word and a camel-case one)', async () => {
    const { calls, user } = await load();
    await choose(user, 'Action', 'USER_BAN');
    await choose(user, 'Object type', 'USER');
    await user.type(screen.getByRole('textbox', { name: 'Object ID' }), '10000000001');
    await search(user);
    await waitFor(() => expect(lastAudit(calls).searchParams.get('targetId')).toBe('10000000001'));
    const q = lastAudit(calls).searchParams;
    expect(q.get('action')).toBe('USER_BAN');
    expect(q.get('targetType')).toBe('USER');
    await waitFor(() => expect(tableRows()).toHaveLength(1));
    expect(tableRows()[0][1]).toBe('USER_BAN');
  });

  it('keeps the case of an object type: the capitals of NOTIFICATION and the camel case of CosmeticItem go out unchanged, and User is not USER', async () => {
    const { calls, user } = await load();
    for (const type of ['NOTIFICATION', 'CosmeticItem', 'User']) {
      await choose(user, 'Object type', new RegExp(`^${type}$`));
      await search(user);
      await waitFor(() => expect(lastAudit(calls).searchParams.get('targetType')).toBe(type));
    }
  });

  it('lets the filter be cleared, and sends nothing for a cleared choice', async () => {
    const { calls, user } = await load();
    await choose(user, 'Action', 'USER_BAN');
    await search(user);
    await waitFor(() => expect(lastAudit(calls).searchParams.get('action')).toBe('USER_BAN'));
    const box = (await screen.findByRole('combobox', { name: 'Action' })).closest('.ant-select');
    await user.hover(box as Element);
    await user.click(box?.querySelector('.ant-select-clear') as Element);
    await search(user);
    await waitFor(() => expect(lastAudit(calls).searchParams.has('action')).toBe(false));
  });

  it('keeps a way to type a value that is not in the list: "Other" opens a box of 64 characters, for an action or a type the backend dropped', async () => {
    const { calls, user } = await load();
    await choose(user, 'Action', 'Other (type it)');
    const typed = await screen.findByRole('textbox', { name: 'Action (typed)' });
    expect(typed).toHaveAttribute('maxlength', '64');
    await user.type(typed, '  OLD_ACTION_NAME ');
    await choose(user, 'Object type', 'Other (type it)');
    const typedType = await screen.findByRole('textbox', { name: 'Object type (typed)' });
    expect(typedType).toHaveAttribute('maxlength', '64');
    await user.type(typedType, 'OldThing');
    await search(user);
    await waitFor(() => expect(lastAudit(calls).searchParams.get('targetType')).toBe('OldThing'));
    expect(lastAudit(calls).searchParams.get('action')).toBe('OLD_ACTION_NAME');
    // a value of other scripts is cut by the limit, not refused. Pasted, not typed: it is the same limit.
    await user.clear(typed);
    await user.click(typed);
    await user.paste('ก'.repeat(70));
    expect((typed as HTMLInputElement).value).toHaveLength(64);
  });

  it('falls back to boxes to type in when the choices cannot be read, as the page did before, with the same limits', async () => {
    backend();
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/audit-logs/meta' ? jsonAnswer(500, 'INTERNAL_ERROR') : undefined,
    );
    renderPage(<AuditPage />);
    await waitForRows();
    const action = await screen.findByRole('textbox', { name: 'Action' });
    expect(action).toHaveAttribute('maxlength', '64');
    expect(screen.getByRole('textbox', { name: 'Object type' })).toHaveAttribute('maxlength', '64');
    expect(screen.queryByRole('combobox', { name: 'Action' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Object ID' })).toHaveAttribute('maxlength', '255');
  });

  it('writes the filters in Chinese', async () => {
    await load('zh-CN');
    expect(await screen.findByRole('combobox', { name: '管理员' })).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: '动作' })).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: '对象类型' })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: '动作' }));
    await user.keyboard('其他');
    expect(
      (
        await screen.findAllByText('其他（手动输入）', {
          selector: '.ant-select-item-option-content',
        })
      ).length,
    ).toBeGreaterThan(0);
  });

  it('filters by administrator: the choice lists the administrators by name and sends the id', async () => {
    const { calls, user } = await load();
    await choose(user, 'Administrator', 'support');
    await search(user);
    await waitFor(() => expect(lastAudit(calls).searchParams.get('adminId')).toBe('1002'));
    await waitFor(() =>
      expect(
        tableRows().every((cells) => cells[0] === 'support' || cells[0] === 'old-support'),
      ).toBe(true),
    );
  });

  it('lists the administrators by name in the order of the backend, from GET /audit-logs/admins', async () => {
    const { user } = await load();
    await user.click(await screen.findByRole('combobox', { name: 'Administrator' }));
    const names = (
      await screen.findAllByText(/.+/, { selector: '.ant-select-item-option-content' })
    )
      .map((o) => o.textContent)
      .filter((text) => text !== 'Other (enter an ID)');
    // the first ones that are drawn, by user name; 'root' and 'support' follow
    expect(names.slice(0, 4)).toEqual(['finance', 'fresh', 'newhire', 'reviewer']);
    await user.keyboard('supp');
    expect(
      await screen.findByText('support', { selector: '.ant-select-item-option-content' }),
    ).toBeInTheDocument();
  });

  it('shows the administrator choice to anyone who may read the log, AUDIT:VIEW alone included, without asking for GET /admins', async () => {
    signIn('support', { codes: ['AUDIT:VIEW'] });
    const { calls } = await load();
    expect(await screen.findByRole('combobox', { name: 'Administrator' })).toBeInTheDocument();
    await settled();
    expect(calls.some((c) => c.url.startsWith('/api/admin/admins'))).toBe(false);
    expect(calls.some((c) => c.url === '/api/admin/audit-logs/admins')).toBe(true);
    expect(document.querySelector('.ant-pro-table-search')?.textContent).toContain('Administrator');
  });

  it('still filters by the id of an administrator who is gone: "Other" opens a box for the id', async () => {
    const { calls, user } = await load();
    await choose(user, 'Administrator', 'Other (enter an ID)');
    await user.type(await screen.findByRole('textbox', { name: 'Administrator ID' }), ' 9999 ');
    await search(user);
    await waitFor(() => expect(lastAudit(calls).searchParams.get('adminId')).toBe('9999'));
    await waitFor(() => expect(tableRows().some((cells) => cells[0] === 'gone-admin')).toBe(true));
  });

  it('keeps a box for the id when the list of administrators cannot be read', async () => {
    backend();
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/audit-logs/admins'
        ? jsonAnswer(500, 'INTERNAL_ERROR')
        : undefined,
    );
    renderPage(<AuditPage />);
    await waitForRows();
    expect(await screen.findByRole('textbox', { name: 'Administrator ID' })).toBeInTheDocument();
  });

  it('shows a value that came with the page (a kept search) as typed when the list does not have it', async () => {
    backend();
    const { container } = renderPage(<AuditAdminFilter value="9999" onChange={() => {}} />);
    await waitFor(() =>
      expect(container.querySelector('input[aria-label="Administrator ID"]')).toHaveValue('9999'),
    );
  });

  it('shows a value that came with the page as a choice when the list has it, with no box to type in', async () => {
    backend();
    const { container } = renderPage(<AuditAdminFilter value="1002" onChange={() => {}} />);
    await waitFor(() => expect(container.textContent).toContain('support'));
    await settled();
    expect(container.querySelector('input[aria-label="Administrator ID"]')).toBeNull();
  });

  it('sends a UTC day range as [first day 00:00:00Z, the day after the last day 00:00:00Z)', async () => {
    const { calls, user } = await load();
    const [start, end] = [
      ...document.querySelectorAll<HTMLInputElement>('.ant-picker-input input'),
    ];
    await user.type(start, '2026-10-25{Enter}');
    await user.type(end, '2026-10-25{Enter}');
    await search(user);
    await waitFor(() =>
      expect(lastAudit(calls).searchParams.get('from')).toBe('2026-10-25T00:00:00Z'),
    );
    expect(lastAudit(calls).searchParams.get('to')).toBe('2026-10-26T00:00:00Z');
    await waitFor(() => expect(tableRows()).toHaveLength(1));
    expect(tableRows()[0][1]).toBe('USER_BAN');
  });

  it('sends no filter at all when none is filled in', async () => {
    const { calls } = await load();
    const q = auditCalls(calls)[0].searchParams;
    expect([...q.keys()].sort()).toEqual(['page', 'pageSize']);
  });
});
