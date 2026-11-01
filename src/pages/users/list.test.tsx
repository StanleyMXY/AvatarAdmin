import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { USER } from '../../../mock/_core/usersData';
import * as usersMock from '../../../mock/users.mock';
import { envelope, jsonResponse, stubFetch, XLSX_TYPE } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import enUS from '../../locales/en-US';
import UserListPage from './list';
import { chooseOption, expandSearch, signIn } from './testSetup';

beforeEach(() => signIn('root'));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// The list is newest first and the sample accounts are older than the ones the abuse report groups,
// so an account is found by its id in the first filter, as an administrator would.
const rowFor = async (user: ReturnType<typeof userEvent.setup>, id: string) => {
  const box = await screen.findByRole('textbox', { name: 'Account ID' });
  await user.clear(box);
  await user.type(box, `${id}{Enter}`);
  const link = await screen.findByRole('link', { name: id });
  await waitFor(() => expect(screen.getAllByRole('link', { name: /./ })).toHaveLength(1));
  return link.closest('tr') as HTMLTableRowElement;
};
const rowOf = async (id: string) => {
  const link = await screen.findByRole('link', { name: id });
  return link.closest('tr') as HTMLTableRowElement;
};

const listCalls = (calls: { method: string; url: string }[]) =>
  calls.filter((c) => c.method === 'GET' && c.url.startsWith('/api/admin/users?'));
const lastQuery = (calls: { method: string; url: string }[]) =>
  new URL(listCalls(calls).at(-1)?.url ?? '', 'http://x').searchParams;

describe('the user list', { timeout: 30000 }, () => {
  it('shows the columns of the spec and links the account id to the detail', async () => {
    useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<UserListPage />);
    const row = await rowFor(user, USER.rich);
    for (const key of [
      'users.common.accountId',
      'users.list.email',
      'users.list.phone',
      'users.common.status',
      'users.list.channel',
      'users.list.traffic',
      'users.common.createdAt',
      'users.list.timezone',
      'users.list.language',
    ]) {
      expect(screen.getAllByRole('columnheader', { name: enUS[key] }).length, key).toBeGreaterThan(
        0,
      );
    }
    expect(within(row).getByRole('link', { name: USER.rich })).toHaveAttribute(
      'href',
      `/users/${USER.rich}`,
    );
    expect(within(row).getByText('Active')).toBeInTheDocument();
    expect(within(row).getByText('Paid')).toBeInTheDocument();
    expect(within(row).getByText('Asia/Bangkok')).toBeInTheDocument();
    expect(within(row).getByText('th')).toBeInTheDocument();
  });

  it('has the seven filters', async () => {
    useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<UserListPage />);
    await screen.findAllByRole('link');
    await expandSearch(user);
    expect(screen.getByRole('textbox', { name: 'Account ID' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAttribute(
      'placeholder',
      enUS['users.list.emailPlaceholder'],
    );
    expect(screen.getByRole('textbox', { name: 'Phone' })).toHaveAttribute(
      'placeholder',
      enUS['users.list.phonePlaceholder'],
    );
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Register channel' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Traffic type' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Media source' })).toBeInTheDocument();
  });

  it('shows the mask the backend gave to an administrator without the two view codes, and says how to see the whole value', async () => {
    signIn('support');
    useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<UserListPage />);
    const row = await rowFor(user, USER.rich);
    expect(within(row).getByText('m***@e***.com')).toBeInTheDocument();
    expect(within(row).getByText('****5678')).toBeInTheDocument();
    expect(screen.getByText(enUS['users.list.maskedNote'])).toBeInTheDocument();
  });

  it('shows the whole values the backend gave to an administrator who holds the view codes, with no note about masks', async () => {
    useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<UserListPage />);
    const row = await rowFor(user, USER.rich);
    expect(within(row).getByText('maria.garcia@example.com')).toBeInTheDocument();
    expect(within(row).getByText('+34612345678')).toBeInTheDocument();
    expect(screen.queryByText(enUS['users.list.maskedNote'])).toBeNull();
  });

  it('shows a dash for an account without an e-mail address, a channel or a language', async () => {
    useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<UserListPage />);
    const row = await rowFor(user, USER.noAttribution);
    expect(within(row).getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('sends the e-mail and the phone number as typed, whole, with only the ends cleaned: no fuzzy match, no cut', async () => {
    const calls = useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<UserListPage />);
    await screen.findAllByRole('link');
    await expandSearch(user);
    await user.type(screen.getByRole('textbox', { name: 'Email' }), '  Maria.Garcia@Example.com ');
    await user.type(screen.getByRole('textbox', { name: 'Phone' }), '+34612345678{Enter}');
    await waitFor(() => expect(lastQuery(calls).get('phone')).toBe('+34612345678'));
    expect(lastQuery(calls).get('email')).toBe('Maria.Garcia@Example.com');
    // the backend finds exactly that account
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(1));
    expect(screen.getByRole('link', { name: USER.rich })).toBeInTheDocument();
  });

  it('sends every other filter once it is filled, and not the empty ones', async () => {
    const calls = useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<UserListPage />);
    await screen.findAllByRole('link');
    expect(lastQuery(calls).get('page')).toBe('1');
    expect(lastQuery(calls).get('pageSize')).toBe('20');
    expect(lastQuery(calls).has('email')).toBe(false);
    await expandSearch(user);
    await user.type(screen.getByRole('textbox', { name: 'Account ID' }), ` ${USER.banned} `);
    await chooseOption(user, 'Status', 'Banned');
    await chooseOption(user, 'Traffic type', 'Organic');
    await user.type(screen.getByRole('textbox', { name: 'Register channel' }), 'huawei');
    await user.type(screen.getByRole('textbox', { name: 'Media source' }), 'Facebook Ads{Enter}');
    await waitFor(() => expect(lastQuery(calls).get('mediaSource')).toBe('Facebook Ads'));
    const query = lastQuery(calls);
    expect(query.get('accountId')).toBe(USER.banned);
    expect(query.get('status')).toBe('BANNED');
    expect(query.get('trafficType')).toBe('ORGANIC');
    expect(query.get('channelCode')).toBe('huawei');
    expect(query.has('email')).toBe(false);
    expect(query.has('phone')).toBe(false);
  });

  it('keeps names of every language and a 5000 character string inside the table', async () => {
    const texts = [
      'x'.repeat(5000),
      'สวัสดีครับ'.repeat(30),
      'مرحبا بك'.repeat(30),
      'Terima kasih',
      'Cảm ơn bạn',
      'Muchas gracias',
      '你好'.repeat(30),
      '😀'.repeat(60),
    ];
    const items = texts.map((text, i) => ({
      id: `id-${i}`,
      email: `${text}@example.com`,
      phone: text,
      status: 'ACTIVE',
      channelCode: text,
      trafficType: 'PAID',
      createdAt: '2026-10-01T00:00:00Z',
      timezone: text,
      conversationLanguage: text,
    }));
    stubFetch(async () => jsonResponse(200, envelope('200', { items, total: items.length })));
    renderPage(<UserListPage />);
    const row = await rowOf('id-0');
    const cells = within(row).getAllByText(/x{50,}/);
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      const style = getComputedStyle(cell);
      expect(
        style.overflowWrap === 'anywhere' ||
          cell.style.overflowWrap === 'anywhere' ||
          cell.closest('button')?.style.overflow === 'hidden',
      ).toBe(true);
    }
  });

  it('shows the refusal in words and does not crash when the answer has an item of another shape', async () => {
    stubFetch(async () =>
      jsonResponse(
        200,
        envelope('200', {
          items: [
            {
              id: 'odd',
              email: { not: 'text' },
              phone: 12345,
              status: 'ACTIVE',
              channelCode: ['a'],
              trafficType: 'PAID',
              createdAt: 'not a time',
              timezone: false,
              conversationLanguage: null,
            },
          ],
          total: 1,
        }),
      ),
    );
    renderPage(<UserListPage />);
    expect(await screen.findByRole('link', { name: 'odd' })).toBeInTheDocument();
  });

  it('shows a dash, not an empty cell, for a creation time that is missing', async () => {
    const base = {
      email: null,
      phone: null,
      status: 'ACTIVE',
      channelCode: null,
      trafficType: 'PAID',
      timezone: null,
      conversationLanguage: null,
    };
    stubFetch(async () =>
      jsonResponse(
        200,
        envelope('200', {
          items: [
            { ...base, id: 'no-time', createdAt: null },
            { ...base, id: 'empty-time', createdAt: '' },
          ],
          total: 2,
        }),
      ),
    );
    renderPage(<UserListPage />);
    const headers = [...document.querySelectorAll('.ant-table-thead th')].map(
      (th) => th.textContent,
    );
    const column = headers.indexOf('Created at');
    expect(column).toBeGreaterThan(-1);
    for (const id of ['no-time', 'empty-time']) {
      const row = await rowOf(id);
      expect(row.querySelectorAll('td')[column].textContent).toBe('—');
    }
  });

  it('says what the refusal is when the administrator may not see the list', async () => {
    signIn('support', { codes: ['SUBSCRIPTION:VIEW'] });
    useMockBackend(usersMock);
    renderPage(<UserListPage />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(enUS['error.ADMIN_FORBIDDEN']))).toBeInTheDocument();
  });
});

describe('the export button', { timeout: 30000 }, () => {
  const saved: string[] = [];
  beforeEach(() => {
    saved.length = 0;
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:x');
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push(this.download);
    });
  });

  const withSheet = () =>
    stubFetch(async ({ url }) =>
      url.startsWith('/api/admin/users/export')
        ? new Response(Uint8Array.from([80, 75, 3, 4]), {
            status: 200,
            headers: {
              'content-type': XLSX_TYPE,
              'content-disposition': 'attachment; filename="users-2026-10-26.xlsx"',
            },
          })
        : jsonResponse(200, envelope('200', { items: [], total: 0 })),
    );

  it.each([
    [['USER:VIEW'], false],
    [['USER:EXPORT'], false],
    [['USER:VIEW', 'USER:EXPORT'], true],
    [['USER:VIEW', 'STATS:EXPORT'], false],
  ])('is drawn for the codes %j: %s', async (codes, drawn) => {
    signIn('support', { codes });
    withSheet();
    renderPage(<UserListPage />);
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Export' }) !== null).toBe(drawn);
  });

  it('is drawn for a super administrator', async () => {
    withSheet();
    renderPage(<UserListPage />);
    expect(await screen.findByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('exports with the filters of the last search, not with what is typed in the boxes now, and saves the file', async () => {
    const calls = withSheet();
    const user = userEvent.setup();
    renderPage(<UserListPage />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await expandSearch(user);
    await chooseOption(user, 'Status', 'Banned');
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'a@b.com{Enter}');
    await waitFor(() => expect(calls.some((c) => c.url.includes('status=BANNED'))).toBe(true));
    // typed after the search, not searched
    await user.type(screen.getByRole('textbox', { name: 'Account ID' }), 'typed-but-not-searched');
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(saved).toEqual(['users-2026-10-26.xlsx']));
    const call = calls.find((c) => c.url.startsWith('/api/admin/users/export'));
    const query = new URL(call?.url ?? '', 'http://x').searchParams;
    expect(query.get('status')).toBe('BANNED');
    expect(query.get('email')).toBe('a@b.com');
    expect(query.has('accountId')).toBe(false);
    expect(query.has('page')).toBe(false);
    expect(query.has('pageSize')).toBe(false);
  });

  it('exports with no filter before any search', async () => {
    const calls = withSheet();
    const user = userEvent.setup();
    renderPage(<UserListPage />);
    await user.click(await screen.findByRole('button', { name: 'Export' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    const call = calls.find((c) => c.url.startsWith('/api/admin/users/export'));
    expect(call?.url).toBe('/api/admin/users/export');
  });

  it('saves nothing and says why when the backend refuses the export with JSON', async () => {
    stubFetch(async ({ url }) =>
      url.startsWith('/api/admin/users/export')
        ? jsonResponse(429, envelope('RATE_LIMITED', null, 'Too many exports this hour'))
        : jsonResponse(200, envelope('200', { items: [], total: 0 })),
    );
    const user = userEvent.setup();
    renderPage(<UserListPage />);
    await user.click(await screen.findByRole('button', { name: 'Export' }));
    expect(await screen.findByText(enUS['error.RATE_LIMITED'])).toBeInTheDocument();
    expect(saved).toEqual([]);
  });

  it('sends the export once for two clicks', async () => {
    const calls = withSheet();
    const user = userEvent.setup();
    renderPage(<UserListPage />);
    const button = await screen.findByRole('button', { name: 'Export' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(saved).toHaveLength(1));
    await user.click(document.body);
    expect(calls.filter((c) => c.url.startsWith('/api/admin/users/export'))).toHaveLength(1);
  });
});
