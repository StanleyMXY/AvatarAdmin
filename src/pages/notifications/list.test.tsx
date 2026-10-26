import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import notificationsMock from '../../../mock/notifications.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import type { NotificationDetail, NotificationRow } from '../../services/notifications';
import NotificationsPage from './list';
import { chooseOption, notificationsState, signIn } from './testSetup';

vi.setConfig({ testTimeout: 30000 });

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const row = (over: Partial<NotificationRow> = {}): NotificationRow => ({
  id: 'n-9001',
  accountId: 'acc-9001',
  category: 'ADMIN',
  title: 'Hello there',
  isRead: false,
  linkType: 'NONE',
  linkTarget: null,
  sentBy: '1001',
  sentByUsername: 'root',
  createdAt: '2026-10-20T08:30:00.000Z',
  ...over,
});
const detail = (over: Partial<NotificationDetail> = {}): NotificationDetail => ({
  id: 'n-9001',
  accountId: 'acc-9001',
  category: 'ADMIN',
  titleI18n: { en: 'Hello there', th: 'สวัสดี' },
  bodyI18n: { en: 'Body text', th: 'ข้อความ' },
  templateKey: null,
  templateParams: null,
  linkType: 'NONE',
  linkTarget: null,
  isRead: false,
  sentBy: '1001',
  sentByUsername: 'root',
  createdAt: '2026-10-20T08:30:00.000Z',
  ...over,
});
/** The list answers `rows`; `GET /notifications/{id}` answers the detail given for that id. */
const fixed = (rows: unknown[], details: Record<string, unknown> = {}) =>
  stubFetch(async ({ url }) => {
    const path = new URL(url, 'http://x').pathname;
    const id = path.split('/').pop() as string;
    if (path !== '/api/admin/notifications' && id in details) {
      return jsonResponse(200, envelope('200', details[id]));
    }
    return jsonResponse(200, envelope('200', { items: rows, total: rows.length }));
  });

const tableRows = () => [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')];
const headers = () =>
  [...document.querySelectorAll('.ant-table-thead th')].map((th) => th.textContent);
const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');
const listParams = (calls: { method: string; url: string }[]) =>
  calls
    .filter(
      (c) =>
        c.method === 'GET' && new URL(c.url, 'http://x').pathname === '/api/admin/notifications',
    )
    .map((c) => new URL(c.url, 'http://x').searchParams);

describe('the list', () => {
  it('has the columns of the spec: account, category, title (en), read, sender, time', async () => {
    useMockBackend({ default: notificationsMock });
    renderPage(<NotificationsPage />);
    await waitFor(() => expect(tableRows().length).toBeGreaterThan(0));
    expect(headers()).toEqual([
      'Account ID',
      'Category',
      'Title (en)',
      'Read',
      'Sent by',
      'Created at',
      'Actions',
    ]);
    expect(tableRows().length).toBe(20);
  });

  it('shows the words of the category and the read state, the sender name, and "System" for a system event', async () => {
    fixed([
      row({ id: 'a', title: 'From an operator' }),
      row({
        id: 'b',
        category: 'SYSTEM_EVENT',
        title: 'Your export is ready',
        isRead: true,
        sentBy: null,
        sentByUsername: null,
      }),
    ]);
    renderPage(<NotificationsPage />);
    const operator = (await screen.findByText('From an operator')).closest('tr') as HTMLElement;
    expect(cellsOf(operator).slice(0, 5)).toEqual([
      'acc-9001',
      'Sent by an operator',
      'From an operator',
      'Unread',
      'root',
    ]);
    const system = screen.getByText('Your export is ready').closest('tr') as HTMLElement;
    expect(cellsOf(system).slice(0, 5)).toEqual([
      'acc-9001',
      'System event',
      'Your export is ready',
      'Read',
      'System',
    ]);
  });

  it('shows a dash for an operator message whose sender account is gone and shows the id then', async () => {
    fixed([row({ sentByUsername: null, sentBy: '1999' })]);
    renderPage(<NotificationsPage />);
    const tr = (await screen.findByText('Hello there')).closest('tr') as HTMLElement;
    expect(cellsOf(tr)[4]).toBe('1999');
  });

  it('asks for the first page of 20 and shows the total', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    renderPage(<NotificationsPage />);
    await waitFor(() => expect(tableRows().length).toBe(20));
    const first = listParams(calls)[0];
    expect(first.get('page')).toBe('1');
    expect(first.get('pageSize')).toBe('20');
    expect(first.get('accountId')).toBeNull();
    expect(first.get('from')).toBeNull();
    expect(document.querySelector('.ant-pagination-item-2')).not.toBeNull();
  });

  it('searches with the account (trimmed), the category and the read state, and starts again at page 1', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    await waitFor(() => expect(tableRows().length).toBe(20));
    await user.click(document.querySelector('.ant-pagination-item-2') as HTMLElement);
    await waitFor(() => expect(listParams(calls).at(-1)?.get('page')).toBe('2'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Account ID' }), {
      target: { value: '  acc-1  ' },
    });
    await chooseOption(user, 'Category', 'System event');
    await chooseOption(user, 'Read state', 'Unread');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => {
      const last = listParams(calls).at(-1) as URLSearchParams;
      expect(Object.fromEntries(last)).toEqual({
        page: '1',
        pageSize: '20',
        accountId: 'acc-1',
        category: 'SYSTEM_EVENT',
        isRead: 'false',
      });
    });
  });

  it('keeps the filters typed but not searched out of the request until Search', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    renderPage(<NotificationsPage />);
    await waitFor(() => expect(tableRows().length).toBe(20));
    const before = listParams(calls).length;
    fireEvent.change(screen.getByRole('textbox', { name: 'Account ID' }), {
      target: { value: 'x' },
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(listParams(calls).length).toBe(before);
  });

  it('sends the time range as the start of the first UTC day and the start of the day after the last', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    await waitFor(() => expect(tableRows().length).toBe(20));
    const [from, to] = screen.getAllByPlaceholderText(/date/i);
    await user.click(from);
    await user.type(from, '2026-10-01{enter}');
    await user.type(to, '2026-10-03{enter}');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => {
      const last = listParams(calls).at(-1) as URLSearchParams;
      expect(last.get('from')).toBe('2026-10-01T00:00:00Z');
      expect(last.get('to')).toBe('2026-10-04T00:00:00Z');
    });
  });

  it('says the range counts UTC days', async () => {
    useMockBackend({ default: notificationsMock });
    renderPage(<NotificationsPage />);
    expect(await screen.findByText('The time range counts UTC days.')).toBeInTheDocument();
  });

  it('shows the empty text when nothing matches', async () => {
    fixed([]);
    renderPage(<NotificationsPage />);
    expect(await screen.findByText('No notifications match')).toBeInTheDocument();
  });

  it('shows the failure with a retry that reads again', async () => {
    let fail = true;
    stubFetch(async () =>
      fail
        ? jsonResponse(500, envelope('INTERNAL_ERROR'))
        : jsonResponse(200, envelope('200', { items: [row()], total: 1 })),
    );
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const retry = await screen.findByRole('button', { name: 'Retry' });
    fail = false;
    await user.click(retry);
    expect(await screen.findByText('Hello there')).toBeInTheDocument();
  });

  it('shows the answer of the newest search when an older one comes back later', async () => {
    const waiting: Record<string, () => void> = {};
    stubFetch(async ({ url }) => {
      const params = new URL(url, 'http://x').searchParams;
      const category = params.get('category') ?? 'all';
      if (category === 'ADMIN') await new Promise<void>((resolve) => (waiting.admin = resolve));
      const title = category === 'ADMIN' ? 'Old answer' : 'New answer';
      return jsonResponse(200, envelope('200', { items: [row({ title })], total: 1 }));
    });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    await screen.findByText('New answer');
    await chooseOption(user, 'Category', 'Sent by an operator');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(waiting.admin).toBeDefined());
    await chooseOption(user, 'Category', 'System event');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByText('New answer');
    waiting.admin();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('Old answer')).toBeNull();
    expect(screen.getByText('New answer')).toBeInTheDocument();
  });

  it('keeps long Arabic and Thai text, 5000 characters without a space and emoji inside the cell', async () => {
    const long = 'ก็'.repeat(2500);
    const arabic = 'مرحبا بك في التطبيق '.repeat(60).trim();
    const emoji = '😀'.repeat(60);
    fixed([
      row({ id: '1', title: long }),
      row({ id: '2', title: arabic }),
      row({ id: '3', title: emoji }),
      row({ id: '4', title: 'x'.repeat(5000), accountId: 'y'.repeat(5000) }),
    ]);
    renderPage(<NotificationsPage />);
    const cell = (await screen.findAllByText(long))[0];
    const button = cell.closest('button') as HTMLElement;
    expect(button.style.overflow).toBe('hidden');
    expect(button.style.maxWidth).not.toBe('');
    expect(button.getAttribute('dir')).toBe('auto');
    expect(screen.getAllByText(arabic)[0].closest('button')?.style.overflow).toBe('hidden');
    const idCell = within(tableRows()[3] as HTMLElement).getByText('y'.repeat(5000));
    expect(getComputedStyle(idCell).overflowWrap).toBe('anywhere');
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1);
  });

  it('does not break on fields that are not what the contract says', async () => {
    fixed([
      row({
        id: 'odd-1',
        title: { en: 'object title' } as never,
        accountId: 12345 as never,
        category: 7 as never,
        isRead: 'yes' as never,
        sentByUsername: { name: 'x' } as never,
        createdAt: 'not a time',
      }),
      row({ id: 'odd-2', title: null as never, createdAt: null as never, category: null as never }),
      row({ id: 'odd-3', title: undefined as never, linkType: 5 as never }),
    ]);
    renderPage(<NotificationsPage />);
    await waitFor(() => expect(tableRows().length).toBe(3));
    expect(screen.getByText('12345')).toBeInTheDocument();
    expect(screen.getByText('not a time')).toBeInTheDocument();
  });

  it('shows a category it does not know as it is', async () => {
    fixed([row({ category: 'MARKETING', title: 'odd one' })]);
    renderPage(<NotificationsPage />);
    expect(await screen.findByText('MARKETING')).toBeInTheDocument();
  });
});

describe('in Chinese', () => {
  it('shows the headers, the words of a row and the send dialog in Chinese, and no language key', async () => {
    fixed([row({ category: 'SYSTEM_EVENT', isRead: true, sentBy: null, sentByUsername: null })]);
    const user = userEvent.setup();
    renderPage(<NotificationsPage />, 'zh-CN');
    await screen.findByText('Hello there');
    expect(headers()).toEqual([
      '账号 ID',
      '类别',
      '标题（en）',
      '是否已读',
      '发送人',
      '创建时间',
      '操作',
    ]);
    const cells = cellsOf(tableRows()[0]);
    expect(cells.slice(1, 5)).toEqual(['系统事件', 'Hello there', '已读', '系统']);
    await user.click(screen.getByRole('button', { name: '发送通知' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('同时推送')).toBeInTheDocument();
    expect(
      within(dialog).getByText('推送遵守用户的公告类通知偏好，偏好关闭的用户只收到收件箱消息。'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/notifications\.[a-z]+\./);
  });
});

describe('what the page says about who can be written to', () => {
  it('says the page sends only to named accounts and points to the manual push tasks', async () => {
    fixed([]);
    renderPage(<NotificationsPage />);
    expect(
      await screen.findByText(
        'Messages here go to the accounts you name. To message all users, use a manual push task in Push management.',
      ),
    ).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Open manual push tasks' });
    expect(link.getAttribute('href')).toBe('/push/tasks');
  });

  it('gives no link to a page the administrator cannot open, and keeps the sentence', async () => {
    signIn('reviewer', { codes: ['NOTIFICATION:VIEW'] });
    fixed([]);
    renderPage(<NotificationsPage />);
    expect(
      await screen.findByText(/To message all users, use a manual push task/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open manual push tasks' })).toBeNull();
  });
});

describe('who sees the send button', () => {
  it('shows it with NOTIFICATION:SEND', async () => {
    fixed([row()]);
    renderPage(<NotificationsPage />);
    expect(await screen.findByRole('button', { name: 'Send notifications' })).toBeInTheDocument();
  });

  it('shows no button and mounts no dialog without it, only the list', async () => {
    signIn('reviewer', { codes: ['NOTIFICATION:VIEW'] });
    fixed([row()]);
    renderPage(<NotificationsPage />);
    await screen.findByText('Hello there');
    expect(screen.queryByRole('button', { name: 'Send notifications' })).toBeNull();
    expect(document.querySelector('.ant-modal')).toBeNull();
  });

  it('mounts no dialog until the button is pressed', async () => {
    fixed([row()]);
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    await screen.findByText('Hello there');
    expect(document.querySelector('.ant-modal')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Send notifications' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});

describe('the detail drawer', () => {
  const open = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
    await user.click(
      within((await screen.findByText(title)).closest('tr') as HTMLElement).getByRole('button', {
        name: 'Details',
      }),
    );
    return screen.findByRole('dialog');
  };

  it('shows the title and the body in every language, and the template key and parameters as dashes for an operator message', async () => {
    fixed([row()], { 'n-9001': detail() });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const drawer = await open(user, 'Hello there');
    expect(await within(drawer).findByText('Notification n-9001')).toBeInTheDocument();
    expect(
      within(drawer).getByText('Hello there', { selector: '[data-testid="title-en"]' }),
    ).toBeInTheDocument();
    expect(within(drawer).getByTestId('title-th')).toHaveTextContent('สวัสดี');
    expect(within(drawer).getByTestId('body-en')).toHaveTextContent('Body text');
    expect(within(drawer).getByTestId('body-th')).toHaveTextContent('ข้อความ');
    expect(within(drawer).getByText('Template key')).toBeInTheDocument();
    expect(within(drawer).getByText('Template parameters')).toBeInTheDocument();
    expect(
      within(drawer).getByText('A message sent by an operator uses no template.'),
    ).toBeInTheDocument();
  });

  it('shows all seven languages of the sample data, English first, each with its title and body', async () => {
    const calls = useMockBackend({ default: notificationsMock });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    await waitFor(() => expect(tableRows().length).toBe(20));
    const rich = notificationsState.rows.find(
      (r) => r.category === 'ADMIN' && Object.keys(r.titleI18n ?? {}).length >= 6,
    ) as (typeof notificationsState.rows)[number];
    fireEvent.change(screen.getByRole('textbox', { name: 'Account ID' }), {
      target: { value: rich.accountId },
    });
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(calls.at(-1)?.url).toContain(`accountId=${rich.accountId}`));
    const title = rich.titleI18n?.en as string;
    const button = await waitFor(() => {
      const found = screen
        .getAllByRole('button', { name: 'Details' })
        .find((b) => b.closest('tr')?.textContent?.includes(title));
      if (!found) throw new Error('no row');
      return found;
    });
    await user.click(button);
    const drawer = await screen.findByRole('dialog');
    await within(drawer).findByTestId('title-en');
    const tags = [...drawer.querySelectorAll('[data-testid^="lang-"]')].map((n) => n.textContent);
    expect(tags[0]).toBe('en');
    expect(tags.sort()).toEqual(Object.keys(rich.titleI18n ?? {}).sort());
    for (const [tag, text] of Object.entries(rich.titleI18n ?? {})) {
      expect(within(drawer).getByTestId(`title-${tag}`)).toHaveTextContent(text);
    }
    for (const [tag, text] of Object.entries(rich.bodyI18n ?? {})) {
      expect(within(drawer).getByTestId(`body-${tag}`)).toHaveTextContent(text);
    }
  });

  it('shows the template key and the parameters of a system event, and says why it has no per-language text', async () => {
    fixed([row({ category: 'SYSTEM_EVENT', title: 'Your avatar did not pass' })], {
      'n-9001': detail({
        category: 'SYSTEM_EVENT',
        titleI18n: null,
        bodyI18n: null,
        templateKey: 'notification.moderation.rejected',
        templateParams: { contentType: 'AVATAR', note: 'ก็'.repeat(50) },
        sentBy: null,
        sentByUsername: null,
      }),
    });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const drawer = await open(user, 'Your avatar did not pass');
    expect(await within(drawer).findByText('notification.moderation.rejected')).toBeInTheDocument();
    expect(within(drawer).getByTestId('template-params').textContent).toContain(
      '"contentType": "AVATAR"',
    );
    expect(within(drawer).getByText(/has no text per language/)).toBeInTheDocument();
    expect(within(drawer).getByText('System')).toBeInTheDocument();
  });

  it('shows the link: nothing, a screen of the app, or an address', async () => {
    fixed([row()], { 'n-9001': detail({ linkType: 'SCREEN', linkTarget: 'store' }) });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const drawer = await open(user, 'Hello there');
    expect(await within(drawer).findByText('App screen: Store')).toBeInTheDocument();
  });

  it('does not break on titles and bodies that are not objects, text that is not text, and odd language keys', async () => {
    fixed([row()], {
      'n-9001': detail({
        titleI18n: { en: 5, __proto__x: null, ไทย: { a: 1 }, ar: 'مرحبا' } as never,
        bodyI18n: 'a string' as never,
        templateKey: 12 as never,
        templateParams: 'text' as never,
      }),
    });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const drawer = await open(user, 'Hello there');
    expect(await within(drawer).findByTestId('title-ar')).toHaveTextContent('مرحبا');
    expect(within(drawer).getByTestId('title-en')).toHaveTextContent('5');
    expect(within(drawer).getByTestId('title-ไทย')).toHaveTextContent('{"a":1}');
  });

  it('shows five thousand characters without a space inside the drawer', async () => {
    const long = 'ก็'.repeat(2500);
    fixed([row()], { 'n-9001': detail({ bodyI18n: { en: long } }) });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const drawer = await open(user, 'Hello there');
    const body = await within(drawer).findByTestId('body-en');
    expect(body).toHaveTextContent(long);
    expect(getComputedStyle(body).overflowWrap).toBe('anywhere');
  });

  it('shows the failure of the detail with its words, and the list stays', async () => {
    stubFetch(async ({ url }) =>
      new URL(url, 'http://x').pathname === '/api/admin/notifications'
        ? jsonResponse(200, envelope('200', { items: [row()], total: 1 }))
        : jsonResponse(404, envelope('RESOURCE_NOT_FOUND')),
    );
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const drawer = await open(user, 'Hello there');
    await within(drawer).findByText(/Failed to load/);
    expect(screen.getByText('Hello there', { selector: 'button *, button' })).toBeInTheDocument();
  });

  it('shows the second row and not the first when the answer of the first comes late', async () => {
    let releaseFirst: () => void = () => {};
    stubFetch(async ({ url }) => {
      const path = new URL(url, 'http://x').pathname;
      if (path === '/api/admin/notifications') {
        return jsonResponse(
          200,
          envelope('200', {
            items: [
              row({ id: 'one', title: 'First row' }),
              row({ id: 'two', title: 'Second row' }),
            ],
            total: 2,
          }),
        );
      }
      if (path.endsWith('/one')) {
        await new Promise<void>((resolve) => (releaseFirst = resolve));
        return jsonResponse(
          200,
          envelope(
            '200',
            detail({ id: 'one', titleI18n: { en: 'Late first' }, bodyI18n: { en: 'late body' } }),
          ),
        );
      }
      return jsonResponse(
        200,
        envelope(
          '200',
          detail({ id: 'two', titleI18n: { en: 'Quick second' }, bodyI18n: { en: 'quick body' } }),
        ),
      );
    });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    await open(user, 'First row');
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    await open(user, 'Second row');
    await screen.findByText('Quick second');
    releaseFirst();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('Late first')).toBeNull();
    expect(screen.getByText('Quick second')).toBeInTheDocument();
  });

  it('opens when the row is pressed, not only the button', async () => {
    fixed([row()], { 'n-9001': detail() });
    const user = userEvent.setup();
    renderPage(<NotificationsPage />);
    const tr = (await screen.findByText('Hello there')).closest('tr') as HTMLElement;
    await user.click(within(tr).getByText('acc-9001'));
    expect(await screen.findByTestId('title-th')).toBeInTheDocument();
  });
});
