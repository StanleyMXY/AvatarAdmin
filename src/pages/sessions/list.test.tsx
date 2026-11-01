import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { META_DEFAULTS } from '../../../mock/_core/meta';
import {
  GUEST_DEVICE,
  resetSessionsStore,
  SESSION,
  sessionsState,
} from '../../../mock/_core/sessionsData';
import { resetStore } from '../../../mock/_core/store';
import * as sessionsMock from '../../../mock/sessions.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { signInAsAdmin } from '../../../tests/signInAsAdmin';
import { resetUmiStub } from '../../../tests/stubs/umi-max';
import enUS from '../../locales/en-US';
import SessionListPage from './list';

const signIn = (username = 'root', codes?: string[]) => {
  resetUmiStub();
  resetStore();
  resetSessionsStore();
  signInAsAdmin(username, { codes, meta: { ...META_DEFAULTS } });
};

beforeEach(() => signIn());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const idButton = (id: string) => screen.findByRole('button', { name: id });
const rowOf = async (id: string) => (await idButton(id)).closest('tr') as HTMLTableRowElement;
const cellsOf = (row: Element) => [...row.querySelectorAll('td')].map((td) => td.textContent ?? '');
const listCalls = (calls: { method: string; url: string }[]) =>
  calls.filter((c) => c.method === 'GET' && /^\/api\/admin\/sessions\?/.test(c.url));
const lastQuery = (calls: { method: string; url: string }[]) =>
  new URL(listCalls(calls).at(-1)?.url ?? '', 'http://x').searchParams;
const search = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /查\s*询|Query|Search/ }));
const expand = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(await screen.findByText(/展开|Expand/));
const choose = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  optionText: string,
) => {
  await user.click(screen.getByRole('combobox', { name: label }));
  const options = await screen.findAllByText(optionText, {
    selector: '.ant-select-item-option-content',
  });
  await user.click(options[options.length - 1]);
};

describe('the session list: rows', { timeout: 30000 }, () => {
  it('has the columns of the spec', async () => {
    useMockBackend(sessionsMock);
    renderPage(<SessionListPage />);
    await idButton(SESSION.registered);
    for (const key of [
      'sessions.list.col.id',
      'sessions.list.col.accountId',
      'sessions.list.col.device',
      'sessions.list.col.requestedAt',
      'sessions.list.col.startedAt',
      'sessions.list.col.endedAt',
      'sessions.list.col.duration',
      'sessions.list.col.modelTier',
      'sessions.list.col.language',
    ]) {
      expect(screen.getAllByRole('columnheader', { name: enUS[key] }).length, key).toBeGreaterThan(
        0,
      );
    }
    expect([...document.querySelectorAll('.ant-table-thead th')].map((h) => h.textContent)).toEqual(
      [
        'Session ID',
        'Account ID',
        'Device',
        'Requested at',
        'Started at',
        'Ended at',
        'Duration',
        'Model tier',
        'Language',
      ],
    );
  });

  it('links the account id of an account session to the user detail', async () => {
    useMockBackend(sessionsMock);
    renderPage(<SessionListPage />);
    const row = await rowOf(SESSION.registered);
    const link = within(row).getByRole('link', { name: SESSION.registeredAccount });
    expect(link).toHaveAttribute('href', `/users/${SESSION.registeredAccount}`);
    expect(within(row).queryByText('Guest')).toBeNull();
    // an account session has no device
    expect(cellsOf(row)[2]).toBe('—');
  });

  it('shows "Guest" without a link for a guest session, and only the first 8 characters of its device', async () => {
    useMockBackend(sessionsMock);
    renderPage(<SessionListPage />);
    const row = await rowOf(SESSION.guest);
    expect(within(row).getByText('Guest')).toBeInTheDocument();
    expect(within(row).queryByRole('link')).toBeNull();
    expect(cellsOf(row)[2]).toBe(GUEST_DEVICE.slice(0, 8));
    // the whole hash is nowhere: not in the text, not in a tooltip, not in an attribute
    expect(GUEST_DEVICE.length).toBeGreaterThan(8);
    expect(document.body.innerHTML).not.toContain(GUEST_DEVICE.slice(0, 9));
  });

  it('keeps a device that the backend already shortened as it is, and cuts a longer one by characters', async () => {
    const items = [
      { id: 'g1', accountId: null, deviceId: 'abcd1234', requestedAt: '2026-10-01T00:00:00Z' },
      { id: 'g2', accountId: '', deviceId: 'ab😀cd12345678', requestedAt: '2026-10-01T00:00:00Z' },
    ];
    stubFetch(async () => jsonResponse(200, envelope('200', { items, total: 2 })));
    renderPage(<SessionListPage />);
    expect(cellsOf(await rowOf('g1'))[2]).toBe('abcd1234');
    expect(cellsOf(await rowOf('g2'))[2]).toBe('ab😀cd123');
  });

  it('shows the duration as words, "In progress" for a call that has not ended, and a dash for nothing', async () => {
    useMockBackend(sessionsMock);
    renderPage(<SessionListPage />);
    const ended = cellsOf(await rowOf(SESSION.registered));
    expect(ended[6]).toBe('5 min 12 s');
    const going = cellsOf(await rowOf(SESSION.ongoing));
    expect(going[5]).toBe('—'); // endedAt
    expect(going[6]).toBe('In progress');
  });

  it('shows a dash for a time or a text that is null, and 0 seconds as 0 s', async () => {
    const items = [
      {
        id: 'n1',
        accountId: 'acc-1',
        deviceId: null,
        requestedAt: '2026-10-01T00:00:00Z',
        startedAt: null,
        endedAt: '2026-10-01T00:01:00Z',
        durationSeconds: 0,
        modelTier: null,
        language: null,
      },
      {
        id: 'n2',
        accountId: 'acc-1',
        deviceId: null,
        requestedAt: '2026-10-01T00:00:00Z',
        startedAt: '2026-10-01T00:00:05Z',
        endedAt: '2026-10-01T00:01:00Z',
        durationSeconds: null,
        modelTier: 'standard',
        language: 'th',
      },
    ];
    stubFetch(async () => jsonResponse(200, envelope('200', { items, total: 2 })));
    renderPage(<SessionListPage />);
    const first = cellsOf(await rowOf('n1'));
    expect(first[4]).toBe('—');
    expect(first[6]).toBe('0 s');
    expect(first[7]).toBe('—');
    expect(first[8]).toBe('—');
    // ended but no duration known: a dash, not "In progress"
    expect(cellsOf(await rowOf('n2'))[6]).toBe('—');
  });

  it('shows the times in the language and time zone of the browser', async () => {
    useMockBackend(sessionsMock);
    renderPage(<SessionListPage />);
    const row = await rowOf(SESSION.registered);
    expect(cellsOf(row)[3]).toMatch(/\d/);
    expect(cellsOf(row)[3]).not.toContain('T');
  });

  it('keeps names of every language and a 5000 character account id inside the table', async () => {
    const long = 'x'.repeat(5000);
    const texts = [
      long,
      'สวัสดีครับ'.repeat(30),
      'مرحبا بك'.repeat(30),
      '😀'.repeat(60),
      '你好'.repeat(30),
    ];
    const items = texts.map((text, i) => ({
      id: `h-${i}`,
      accountId: i === 0 ? long : `acc-${i}`,
      deviceId: null,
      requestedAt: '2026-10-01T00:00:00Z',
      startedAt: '2026-10-01T00:00:05Z',
      endedAt: '2026-10-01T00:05:00Z',
      durationSeconds: 295,
      modelTier: text,
      language: text,
    }));
    stubFetch(async () => jsonResponse(200, envelope('200', { items, total: items.length })));
    renderPage(<SessionListPage />);
    const row = await rowOf('h-0');
    const wrapped = (el: HTMLElement) =>
      el.style.overflowWrap === 'anywhere' ||
      getComputedStyle(el).overflowWrap === 'anywhere' ||
      el.closest('button')?.style.overflow === 'hidden';
    const account = within(row).getByRole('link');
    expect(wrapped(account)).toBe(true);
    for (const el of within(row).getAllByText(/x{50,}/)) expect(wrapped(el)).toBe(true);
    const arabic = await rowOf('h-2');
    for (const el of within(arabic).getAllByText(/مرحبا/)) expect(wrapped(el)).toBe(true);
  });

  it('does not crash on a field of another type', async () => {
    const items = [
      {
        id: 'w1',
        accountId: { nested: true },
        deviceId: 42,
        requestedAt: 5,
        startedAt: ['x'],
        endedAt: null,
        durationSeconds: 'soon',
        modelTier: { a: 1 },
        language: false,
      },
    ];
    stubFetch(async () => jsonResponse(200, envelope('200', { items, total: 1 })));
    renderPage(<SessionListPage />);
    expect(await idButton('w1')).toBeInTheDocument();
  });

  it('shows a refusal in the words of the code, never the backend words, with a retry', async () => {
    stubFetch(async () => jsonResponse(500, envelope('INTERNAL_ERROR', null, 'raw backend words')));
    renderPage(<SessionListPage />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toContain('raw backend words');
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('the session list in Chinese', { timeout: 30000 }, () => {
  it('has the headers, the guest label and the duration in Chinese', async () => {
    useMockBackend(sessionsMock);
    renderPage(<SessionListPage />, 'zh-CN');
    await idButton(SESSION.guest);
    expect([...document.querySelectorAll('.ant-table-thead th')].map((h) => h.textContent)).toEqual(
      [
        '会话 ID',
        '账号 ID',
        '设备',
        '请求时间',
        '开始时间',
        '结束时间',
        '时长',
        '模型档位',
        '语言',
      ],
    );
    const row = await rowOf(SESSION.guest);
    expect(within(row).getByText('游客')).toBeInTheDocument();
    expect(cellsOf(await rowOf(SESSION.registered))[6]).toBe('5 分 12 秒');
    expect(cellsOf(await rowOf(SESSION.ongoing))[6]).toBe('进行中');
  });
});

describe('the session list: filters', { timeout: 30000 }, () => {
  it('asks for page 1 of 20 with no filter at first', async () => {
    const calls = useMockBackend(sessionsMock);
    renderPage(<SessionListPage />);
    await idButton(SESSION.registered);
    const q = lastQuery(calls);
    expect(q.get('page')).toBe('1');
    expect(q.get('pageSize')).toBe('20');
    for (const name of ['accountId', 'guest', 'from', 'to', 'ongoing', 'endReason']) {
      expect(q.has(name), name).toBe(false);
    }
  });

  it('has the five filters of the spec', async () => {
    useMockBackend(sessionsMock);
    const user = userEvent.setup();
    renderPage(<SessionListPage />);
    await idButton(SESSION.registered);
    await expand(user);
    expect(screen.getByRole('textbox', { name: 'Account ID' })).toBeInTheDocument();
    for (const label of ['Guest session', 'In progress', 'Forced end at the deadline']) {
      expect(screen.getByRole('combobox', { name: label }), label).toBeInTheDocument();
    }
    expect(document.querySelector('.ant-picker-range')).not.toBeNull();
  });

  it('filters by account id, sent whole with only the ends cleaned', async () => {
    const calls = useMockBackend(sessionsMock);
    const user = userEvent.setup();
    renderPage(<SessionListPage />);
    await idButton(SESSION.registered);
    await expand(user);
    await user.type(
      screen.getByRole('textbox', { name: 'Account ID' }),
      `  ${SESSION.registeredAccount} {Enter}`,
    );
    await waitFor(() => expect(lastQuery(calls).get('accountId')).toBe(SESSION.registeredAccount));
    await waitFor(() => expect(screen.queryByRole('button', { name: SESSION.guest })).toBeNull());
    expect(await idButton(SESSION.registered)).toBeInTheDocument();
  });

  it('filters guest sessions: guest=true, and then guest=false', async () => {
    const calls = useMockBackend(sessionsMock);
    const user = userEvent.setup();
    renderPage(<SessionListPage />);
    await idButton(SESSION.registered);
    await expand(user);
    await choose(user, 'Guest session', 'Yes');
    await search(user);
    await waitFor(() => expect(lastQuery(calls).get('guest')).toBe('true'));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: SESSION.registered })).toBeNull(),
    );
    expect(await idButton(SESSION.guest)).toBeInTheDocument();
    await choose(user, 'Guest session', 'No');
    await search(user);
    await waitFor(() => expect(lastQuery(calls).get('guest')).toBe('false'));
    await waitFor(() => expect(screen.queryByRole('button', { name: SESSION.guest })).toBeNull());
  });

  it('filters the sessions still in progress', async () => {
    const calls = useMockBackend(sessionsMock);
    const user = userEvent.setup();
    renderPage(<SessionListPage />);
    await idButton(SESSION.registered);
    await expand(user);
    await choose(user, 'In progress', 'Yes');
    await search(user);
    await waitFor(() => expect(lastQuery(calls).get('ongoing')).toBe('true'));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: SESSION.registered })).toBeNull(),
    );
    expect(await idButton(SESSION.ongoing)).toBeInTheDocument();
  });

  it('filters the sessions the deadline ended by force with endReason=DEADLINE', async () => {
    const calls = useMockBackend(sessionsMock);
    const user = userEvent.setup();
    renderPage(<SessionListPage />);
    await idButton(SESSION.registered);
    await expand(user);
    await choose(user, 'Forced end at the deadline', 'Yes');
    await search(user);
    await waitFor(() => expect(lastQuery(calls).get('endReason')).toBe('DEADLINE'));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: SESSION.registered })).toBeNull(),
    );
    expect(await idButton(SESSION.deadline)).toBeInTheDocument();
  });

  it('sends a UTC day range as [first day 00:00:00Z, the day after the last day 00:00:00Z) and says it is UTC', async () => {
    const calls = useMockBackend(sessionsMock);
    const user = userEvent.setup();
    renderPage(<SessionListPage />);
    await idButton(SESSION.registered);
    await expand(user);
    const [start, end] = [
      ...document.querySelectorAll<HTMLInputElement>('.ant-picker-input input'),
    ];
    await user.type(start, '2026-10-05{Enter}');
    await user.type(end, '2026-10-06{Enter}');
    await search(user);
    await waitFor(() => expect(lastQuery(calls).get('from')).toBe('2026-10-05T00:00:00Z'));
    expect(lastQuery(calls).get('to')).toBe('2026-10-07T00:00:00Z');
    expect(screen.getAllByText(/UTC/).length).toBeGreaterThan(0);
  });

  it('goes back to page 1 and keeps the page size when a filter changes', async () => {
    const calls = useMockBackend(sessionsMock);
    const user = userEvent.setup();
    renderPage(<SessionListPage />);
    await idButton(SESSION.registered);
    await user.click(document.querySelector('.ant-pagination-item-2') as HTMLElement);
    await waitFor(() => expect(lastQuery(calls).get('page')).toBe('2'));
    await expand(user);
    await choose(user, 'Guest session', 'Yes');
    await search(user);
    await waitFor(() => expect(lastQuery(calls).get('guest')).toBe('true'));
    expect(lastQuery(calls).get('page')).toBe('1');
  });
});

describe('the session list: the details drawer', { timeout: 30000 }, () => {
  it('opens from the session id, reads that one session once, and is not a route', async () => {
    const calls = useMockBackend(sessionsMock);
    const user = userEvent.setup();
    renderPage(<SessionListPage />);
    await user.click(await idButton(SESSION.registered));
    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByText('User left')).toBeInTheDocument();
    expect(calls.filter((c) => c.url === `/api/admin/sessions/${SESSION.registered}`)).toHaveLength(
      1,
    );
    expect(calls.filter((c) => /\/sessions\/[^?]+$/.test(c.url))).toHaveLength(1);
  });

  it('shows the fields of the session in words', async () => {
    useMockBackend(sessionsMock);
    const user = userEvent.setup();
    renderPage(<SessionListPage />);
    await user.click(await idButton(SESSION.deadline));
    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByText('Reached the deadline')).toBeInTheDocument();
    for (const label of [
      'Session ID',
      'Account ID',
      'Requested at',
      'Started at',
      'Ended at',
      'Duration',
      'Model tier',
      'Language',
      'End reason',
      'Render mode',
      'Free tier',
      'Deadline',
      'Time zone',
    ]) {
      expect(within(drawer).getByText(label), label).toBeInTheDocument();
    }
    expect(within(drawer).getByRole('link', { name: SESSION.registeredAccount })).toHaveAttribute(
      'href',
      `/users/${SESSION.registeredAccount}`,
    );
  });

  it('shows the longest length the call had when it was made, in whole minutes, with the reason it is shown (en-US)', async () => {
    useMockBackend(sessionsMock);
    const user = userEvent.setup();
    renderPage(<SessionListPage />);
    const odd = sessionsState.sessions.find((s) => s.maxDurationMinutes === 10);
    await user.click(await idButton(odd?.id ?? 'ses-0008'));
    const drawer = await screen.findByRole('dialog');
    const label = await within(drawer).findByText('Max length when made');
    const row = label.closest('tr') as HTMLElement;
    expect(within(row).getByText('10 min')).toBeInTheDocument();
    expect(
      within(row).getByText(
        /Recorded when the call was made; changing the setting later does not change it/,
      ),
    ).toBeInTheDocument();
  });

  it('shows it in zh-CN, with 0 as 0 and a dash for what the backend did not send', async () => {
    const answers: Record<string, unknown> = {
      zero: { maxDurationMinutes: 0 },
      missing: {},
      broken: { maxDurationMinutes: 'abc' },
      fraction: { maxDurationMinutes: 1.5 },
      negative: { maxDurationMinutes: -3 },
    };
    stubFetch(async ({ url }) => {
      if (url.startsWith('/api/admin/sessions?'))
        return jsonResponse(
          200,
          envelope('200', {
            items: Object.keys(answers).map((id) => ({
              id,
              accountId: 'a',
              deviceId: null,
              requestedAt: '2026-10-01T00:00:00Z',
            })),
            total: 5,
          }),
        );
      const id = url.split('/').pop() as string;
      return jsonResponse(
        200,
        envelope('200', { id, accountId: 'a', deviceId: null, ...(answers[id] as object) }),
      );
    });
    const user = userEvent.setup();
    renderPage(<SessionListPage />, 'zh-CN');
    const maxLengthOf = async (id: string) => {
      await user.click(await idButton(id));
      const drawer = await screen.findByRole('dialog');
      const label = await within(drawer).findByText('发起时的最长时长');
      const text = (label.closest('tr') as HTMLElement).querySelector('td')?.textContent ?? '';
      await user.click(screen.getByRole('button', { name: /close|关闭/i }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      return text;
    };
    expect(await maxLengthOf('zero')).toContain('0 分钟');
    for (const id of ['missing', 'broken', 'fraction', 'negative']) {
      const text = await maxLengthOf(id);
      expect(text, id).toContain('—');
      expect(text, id).not.toMatch(/NaN|undefined|null/);
    }
  });

  it('shows the end reason of a call the ban ended, in words, in both languages', async () => {
    useMockBackend(sessionsMock);
    const user = userEvent.setup();
    const banned = sessionsState.sessions.find((s) => s.endReason === 'BANNED');
    expect(banned).toBeTruthy();
    const first = renderPage(<SessionListPage />);
    await user.click(await idButton(banned?.id ?? ''));
    expect(
      await within(await screen.findByRole('dialog')).findByText('Account banned'),
    ).toBeInTheDocument();
    first.unmount();
    renderPage(<SessionListPage />, 'zh-CN');
    await user.click(await idButton(banned?.id ?? ''));
    expect(
      await within(await screen.findByRole('dialog')).findByText('账号被封禁'),
    ).toBeInTheDocument();
  });

  it('shows a guest session as Guest with no link, and the device as 8 characters only', async () => {
    useMockBackend(sessionsMock);
    const user = userEvent.setup();
    renderPage(<SessionListPage />);
    await user.click(await idButton(SESSION.guest));
    const drawer = await screen.findByRole('dialog');
    await within(drawer).findByText('Render mode');
    expect(within(drawer).getByText('Guest')).toBeInTheDocument();
    expect(within(drawer).queryByRole('link')).toBeNull();
    expect(within(drawer).getByText(GUEST_DEVICE.slice(0, 8))).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(GUEST_DEVICE.slice(0, 9));
  });

  it('says in words that the session is gone when the backend answers 404, never the backend words', async () => {
    stubFetch(async ({ url }) => {
      if (url.startsWith('/api/admin/sessions?'))
        return jsonResponse(
          200,
          envelope('200', {
            items: [
              { id: 'gone', accountId: 'a', deviceId: null, requestedAt: '2026-10-01T00:00:00Z' },
            ],
            total: 1,
          }),
        );
      return jsonResponse(404, envelope('RESOURCE_NOT_FOUND', null, 'raw backend words'));
    });
    const user = userEvent.setup();
    renderPage(<SessionListPage />);
    await user.click(await idButton('gone'));
    const drawer = await screen.findByRole('dialog');
    const alert = await within(drawer).findByRole('alert');
    expect(alert.textContent).not.toContain('raw backend words');
    expect(alert.textContent).toContain(enUS['error.RESOURCE_NOT_FOUND']);
  });

  it('shows the session that was opened last when one is closed with its answer still on the way and another is opened', async () => {
    let releaseFirst: () => void = () => {};
    const slow = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const detail = (id: string, tier: string) => ({
      id,
      accountId: 'a',
      deviceId: null,
      requestedAt: '2026-10-01T00:00:00Z',
      modelTier: tier,
      endReason: null,
    });
    stubFetch(async ({ url }) => {
      if (url.startsWith('/api/admin/sessions?'))
        return jsonResponse(
          200,
          envelope('200', {
            items: [
              { id: 's-one', accountId: 'a', deviceId: null, requestedAt: '2026-10-01T00:00:00Z' },
              { id: 's-two', accountId: 'a', deviceId: null, requestedAt: '2026-10-01T00:00:00Z' },
            ],
            total: 2,
          }),
        );
      if (url.endsWith('/s-one')) {
        await slow;
        return jsonResponse(200, envelope('200', detail('s-one', 'tier-first')));
      }
      return jsonResponse(200, envelope('200', detail('s-two', 'tier-second')));
    });
    const user = userEvent.setup();
    renderPage(<SessionListPage />);
    await user.click(await idButton('s-one'));
    // close it, and open the other while the first answer is still on its way
    const close = await screen.findByRole('button', { name: /close/i });
    await user.click(close);
    await user.click(await idButton('s-two'));
    await screen.findByText('tier-second');
    releaseFirst();
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText('tier-first')).toBeNull();
    expect(screen.getByText('tier-second')).toBeInTheDocument();
  });

  it('reads the session again each time it is opened: a drawer closed and opened for the same session shows what the backend says now', async () => {
    let tier = 'tier-before';
    const reads: string[] = [];
    stubFetch(async ({ url }) => {
      if (url.startsWith('/api/admin/sessions?'))
        return jsonResponse(
          200,
          envelope('200', {
            items: [
              { id: 's-one', accountId: 'a', deviceId: null, requestedAt: '2026-10-01T00:00:00Z' },
            ],
            total: 1,
          }),
        );
      reads.push(url);
      return jsonResponse(
        200,
        envelope('200', {
          id: 's-one',
          accountId: 'a',
          deviceId: null,
          requestedAt: '2026-10-01T00:00:00Z',
          modelTier: tier,
        }),
      );
    });
    const user = userEvent.setup();
    renderPage(<SessionListPage />);
    await user.click(await idButton('s-one'));
    await screen.findByText('tier-before');
    await user.click(await screen.findByRole('button', { name: /close/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    tier = 'tier-after';
    await user.click(await idButton('s-one'));
    await screen.findByText('tier-after');
    expect(reads).toHaveLength(2);
    expect(screen.queryByText('tier-before')).toBeNull();
  });

  it('keeps a 5000 character text and every language inside the drawer', async () => {
    const long = 'z'.repeat(5000);
    stubFetch(async ({ url }) => {
      if (url.startsWith('/api/admin/sessions?'))
        return jsonResponse(
          200,
          envelope('200', {
            items: [
              { id: 'big', accountId: 'a', deviceId: null, requestedAt: '2026-10-01T00:00:00Z' },
            ],
            total: 1,
          }),
        );
      return jsonResponse(
        200,
        envelope('200', {
          id: 'big',
          accountId: long,
          deviceId: null,
          requestedAt: '2026-10-01T00:00:00Z',
          modelTier: 'สวัสดีครับ'.repeat(40),
          language: 'مرحبا بك'.repeat(40),
          timezone: '😀'.repeat(80),
          roomName: long,
        }),
      );
    });
    const user = userEvent.setup();
    renderPage(<SessionListPage />);
    await user.click(await idButton('big'));
    const drawer = await screen.findByRole('dialog');
    await within(drawer).findByText('Render mode');
    for (const el of within(drawer).getAllByText(/z{50,}/)) {
      expect(
        el.style.overflowWrap === 'anywhere' || getComputedStyle(el).overflowWrap === 'anywhere',
      ).toBe(true);
    }
  });

  it('is not opened by a second click that sends a second request for the same session', async () => {
    const calls = useMockBackend(sessionsMock);
    renderPage(<SessionListPage />);
    const button = await idButton(SESSION.registered);
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByRole('dialog');
    await waitFor(() =>
      expect(
        calls.filter((c) => c.url === `/api/admin/sessions/${SESSION.registered}`).length,
      ).toBeGreaterThan(0),
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(calls.filter((c) => c.url === `/api/admin/sessions/${SESSION.registered}`)).toHaveLength(
      1,
    );
  });
});
