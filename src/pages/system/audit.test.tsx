import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import system from '../../../mock/system.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
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
    .filter((c) => c.url.startsWith('/api/admin/audit-logs'))
    .map((c) => new URL(c.url, 'http://x'));
const lastAudit = (calls: { url: string }[]) => auditCalls(calls).at(-1) as URL;
const expand = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(await screen.findByText(/展开|Expand/));
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
  it('has an administrator, an action, an object type, an object ID and a time range (UTC)', async () => {
    const { user } = await load();
    await expand(user);
    expect(screen.getByRole('combobox', { name: 'Administrator' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Action' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Object type' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Object ID' })).toBeInTheDocument();
    expect(document.querySelector('.ant-picker-range')).not.toBeNull();
    expect(screen.getByText('Time range (UTC)')).toBeInTheDocument();
  });

  it('sends the action, the object type and the object id as typed, with the ends cleaned', async () => {
    const { calls, user } = await load();
    await expand(user);
    await user.type(screen.getByRole('textbox', { name: 'Action' }), '  USER_BAN ');
    await user.type(screen.getByRole('textbox', { name: 'Object type' }), 'USER');
    await user.type(screen.getByRole('textbox', { name: 'Object ID' }), '10000000001');
    await search(user);
    await waitFor(() => expect(lastAudit(calls).searchParams.get('targetId')).toBe('10000000001'));
    const q = lastAudit(calls).searchParams;
    expect(q.get('action')).toBe('USER_BAN');
    expect(q.get('targetType')).toBe('USER');
    await waitFor(() => expect(tableRows()).toHaveLength(1));
    expect(tableRows()[0][1]).toBe('USER_BAN');
  });

  it('filters by administrator: the choice lists the administrators by name and sends the id', async () => {
    const { calls, user } = await load();
    await expand(user);
    await user.click(await screen.findByRole('combobox', { name: 'Administrator' }));
    await user.click(
      (await screen.findAllByText('support', { selector: '.ant-select-item-option-content' }))[0],
    );
    await search(user);
    await waitFor(() => expect(lastAudit(calls).searchParams.get('adminId')).toBe('1002'));
    await waitFor(() =>
      expect(
        tableRows().every((cells) => cells[0] === 'support' || cells[0] === 'old-support'),
      ).toBe(true),
    );
  });

  it('does not even ask for the list of administrators without ADMIN:MANAGE', async () => {
    signIn('support', { codes: ['AUDIT:VIEW'] });
    const { calls } = await load();
    await settled();
    expect(calls.some((c) => c.url.startsWith('/api/admin/admins'))).toBe(false);
  });

  it('asks for the administrator id as a number to type when the administrators cannot be listed', async () => {
    signIn('support', { codes: ['AUDIT:VIEW'] });
    const { calls, user } = await load();
    await expand(user);
    expect(screen.queryByRole('combobox', { name: 'Administrator' })).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Administrator ID' }), ' 1003 ');
    await search(user);
    await waitFor(() => expect(lastAudit(calls).searchParams.get('adminId')).toBe('1003'));
    await waitFor(() => expect(tableRows()).toHaveLength(1));
  });

  it('sends a UTC day range as [first day 00:00:00Z, the day after the last day 00:00:00Z)', async () => {
    const { calls, user } = await load();
    await expand(user);
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
