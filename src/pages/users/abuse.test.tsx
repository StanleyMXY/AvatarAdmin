import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usersState } from '../../../mock/_core/usersData';
import * as usersMock from '../../../mock/users.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { withTimeZone } from '../../../tests/withTimeZone';
import enUS from '../../locales/en-US';
import { lastNDaysUtc, utcDayRangeToInstants } from '../../utils/utcDay';
import AbusePage from './abuse';
import { signIn } from './testSetup';

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const clusterCalls = (calls: { method: string; url: string }[]) =>
  calls.filter((c) => c.method === 'GET' && c.url.startsWith('/api/admin/abuse/clusters?'));
const lastClusterQuery = (calls: { method: string; url: string }[]) =>
  new URL(clusterCalls(calls).at(-1)?.url ?? '', 'http://x').searchParams;

/** The key the mock gives to the accounts whose ids start with `prefix`, by device. */
const keyOf = (prefix: string, by: 'device' | 'ip' = 'device') => {
  const user = usersState.users.find((u) => u.id.startsWith(prefix));
  return (by === 'device' ? user?.deviceKey : user?.ipKey) as string;
};
const clusterRow = async (key: string) => {
  const cell = await screen.findByText(key.slice(0, 8));
  return cell.closest('tr') as HTMLTableRowElement;
};
const expand = async (user: ReturnType<typeof userEvent.setup>, row: HTMLElement) => {
  await user.click(within(row).getByRole('button', { name: /expand/i }));
};
const accountRow = async (id: string) =>
  (await screen.findByRole('link', { name: id })).closest('tr') as HTMLTableRowElement;

describe('the notes at the top', { timeout: 30000 }, () => {
  it('say that paid accounts are not counted or acted on, and that the result by IP is a reference only', async () => {
    useMockBackend(usersMock);
    renderPage(<AbusePage />);
    expect(await screen.findByText(enUS['users.abuse.noteFree'])).toBeInTheDocument();
    expect(screen.getByText(enUS['users.abuse.noteIp'])).toBeInTheDocument();
  });

  it('say it in the words of the spec in Chinese', async () => {
    useMockBackend(usersMock);
    renderPage(<AbusePage />, 'zh-CN');
    expect(await screen.findByText('付费账号不计入、不处理。')).toBeInTheDocument();
    expect(
      screen.getByText('同一个 IP 下可能有大量真实用户，按 IP 的结果只作参考。'),
    ).toBeInTheDocument();
  });
});

describe('the two tabs and the first request', { timeout: 30000 }, () => {
  it('has a tab by device and a tab by IP, starts by device, and asks for the last seven UTC days with no threshold', async () => {
    const calls = useMockBackend(usersMock);
    renderPage(<AbusePage />);
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['By device', 'By IP']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(clusterCalls(calls).length).toBeGreaterThan(0));
    const query = lastClusterQuery(calls);
    const week = lastNDaysUtc(7);
    const range = utcDayRangeToInstants(week.from, week.to);
    expect(query.get('by')).toBe('DEVICE');
    expect(query.get('from')).toBe(range.from);
    expect(query.get('to')).toBe(range.to);
    expect(query.has('minFreeAccounts')).toBe(false);
    expect(query.get('page')).toBe('1');
    expect(query.get('pageSize')).toBe('20');
  });

  it('asks for the same UTC days wherever the browser is', async () => {
    const answers: string[] = [];
    for (const tz of ['Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
      await withTimeZone(tz, async () => {
        const calls = useMockBackend(usersMock);
        const { unmount } = renderPage(<AbusePage />);
        await waitFor(() => expect(clusterCalls(calls).length).toBeGreaterThan(0));
        const query = lastClusterQuery(calls);
        answers.push(`${query.get('from')}|${query.get('to')}`);
        unmount();
      });
    }
    expect(answers[0]).toBe(answers[1]);
    expect(answers[0]).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00Z\|\d{4}-\d{2}-\d{2}T00:00:00Z$/);
  });

  it('lists the clusters from the backend with the first eight characters of the key, the counts and the times', async () => {
    useMockBackend(usersMock);
    renderPage(<AbusePage />);
    const devA = keyOf('dev-a-');
    const row = await clusterRow(devA);
    expect(within(row).getByText('9')).toBeInTheDocument(); // accounts
    expect(within(row).getByText('7')).toBeInTheDocument(); // free
    expect(within(row).getByText('2')).toBeInTheDocument(); // paid
    // the whole key is never printed
    expect(screen.queryByText(devA)).toBeNull();
    // only clusters with enough free accounts are listed
    expect(screen.queryByText(keyOf('dev-c-').slice(0, 8))).toBeNull();
  });

  it('switches to the IP view, which asks by=IP and shows the clusters by IP', async () => {
    const calls = useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<AbusePage />);
    await clusterRow(keyOf('dev-a-'));
    await user.click(screen.getByRole('tab', { name: 'By IP' }));
    await clusterRow(keyOf('ip-a-', 'ip'));
    expect(lastClusterQuery(calls).get('by')).toBe('IP');
    expect(screen.queryByText(keyOf('dev-a-').slice(0, 8))).toBeNull();
  });
});

describe('the threshold', { timeout: 30000 }, () => {
  const box = () => screen.getByRole('spinbutton', { name: enUS['users.abuse.threshold'] });

  it('is empty, and shows the default from GET /meta as its hint', async () => {
    useMockBackend(usersMock);
    renderPage(<AbusePage />);
    await screen.findAllByRole('tab');
    expect((box() as HTMLInputElement).value).toBe('');
    expect(box()).toHaveAttribute('placeholder', 'Server default: 5');
  });

  it('shows the plain hint when the backend gave no default', async () => {
    signIn('root', { meta: { abuseClusterMinFreeAccounts: null } });
    useMockBackend(usersMock);
    renderPage(<AbusePage />);
    await screen.findAllByRole('tab');
    expect(box()).toHaveAttribute('placeholder', enUS['users.abuse.thresholdServer']);
  });

  it('shows the plain hint when GET /meta could not be read', async () => {
    signIn('root', { meta: {} });
    useMockBackend(usersMock);
    renderPage(<AbusePage />);
    await screen.findAllByRole('tab');
    expect(box()).toHaveAttribute('placeholder', enUS['users.abuse.thresholdServer']);
  });

  it('sends what is typed once Search is pressed, shows the smaller clusters, and sends nothing again when it is cleared', async () => {
    const calls = useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<AbusePage />);
    await clusterRow(keyOf('dev-a-'));
    const small = keyOf('dev-c-').slice(0, 8);
    expect(screen.queryByText(small)).toBeNull();
    await user.type(box(), '2');
    // typing alone asks nothing
    expect(lastClusterQuery(calls).has('minFreeAccounts')).toBe(false);
    await user.click(screen.getByRole('button', { name: enUS['users.abuse.search'] }));
    expect(await screen.findByText(small)).toBeInTheDocument();
    expect(lastClusterQuery(calls).get('minFreeAccounts')).toBe('2');
    await user.clear(box());
    await user.click(screen.getByRole('button', { name: enUS['users.abuse.search'] }));
    await waitFor(() => expect(lastClusterQuery(calls).has('minFreeAccounts')).toBe(false));
    await waitFor(() => expect(screen.queryByText(small)).toBeNull());
  });

  it('sends a threshold of 0, which is a real bound and not "empty"', async () => {
    const calls = useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<AbusePage />);
    await clusterRow(keyOf('dev-a-'));
    await user.type(box(), '0');
    await user.click(screen.getByRole('button', { name: enUS['users.abuse.search'] }));
    await waitFor(() => expect(lastClusterQuery(calls).get('minFreeAccounts')).toBe('0'));
  });

  it('keeps the threshold when the tab changes', async () => {
    const calls = useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<AbusePage />);
    await clusterRow(keyOf('dev-a-'));
    await user.type(box(), '3');
    await user.click(screen.getByRole('button', { name: enUS['users.abuse.search'] }));
    await waitFor(() => expect(lastClusterQuery(calls).get('minFreeAccounts')).toBe('3'));
    await user.click(screen.getByRole('tab', { name: 'By IP' }));
    await waitFor(() => expect(lastClusterQuery(calls).get('by')).toBe('IP'));
    expect(lastClusterQuery(calls).get('minFreeAccounts')).toBe('3');
  });
});

describe('the accounts of a cluster', { timeout: 60000 }, () => {
  const openCluster = async (user: ReturnType<typeof userEvent.setup>, prefix = 'dev-a-') => {
    const row = await clusterRow(keyOf(prefix));
    await expand(user, row);
    return keyOf(prefix);
  };

  it('opens under the row with the account id as a link to the user, the time, the state, whether it pays and how it signed up', async () => {
    const calls = useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<AbusePage />);
    await openCluster(user);
    const free = await accountRow('dev-a-01');
    expect(within(free).getByRole('link', { name: 'dev-a-01' })).toHaveAttribute(
      'href',
      '/users/dev-a-01',
    );
    expect(within(free).getByText('Active')).toBeInTheDocument();
    expect(within(free).getByText('No')).toBeInTheDocument();
    expect(within(free).getByText('Email')).toBeInTheDocument();
    const paid = await accountRow('dev-a-08');
    expect(within(paid).getByText('Yes')).toBeInTheDocument();
    const read = calls.find((c) => c.url.startsWith('/api/admin/abuse/clusters/accounts?'));
    const query = new URL(read?.url ?? '', 'http://x').searchParams;
    expect(query.get('by')).toBe('DEVICE');
    expect(query.get('key')).toBe(keyOf('dev-a-'));
  });

  it('gives a ban button to the free accounts only, and none to the paid ones', async () => {
    useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<AbusePage />);
    await openCluster(user);
    const free = await accountRow('dev-a-01');
    expect(within(free).getByRole('button', { name: 'Ban' })).toBeEnabled();
    for (const id of ['dev-a-08', 'dev-a-09']) {
      const paid = await accountRow(id);
      expect(within(paid).queryByRole('button', { name: 'Ban' })).toBeNull();
    }
  });

  it('draws no ban button at all for an administrator without USER:BAN', async () => {
    signIn('support', { codes: ['ABUSE:VIEW', 'USER:VIEW'] });
    useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<AbusePage />);
    await openCluster(user);
    await accountRow('dev-a-01');
    expect(screen.queryByRole('button', { name: 'Ban' })).toBeNull();
  });

  it('disables the ban of an account that is not active', async () => {
    const banned = usersState.users.find((u) => u.id === 'dev-a-02');
    if (banned) banned.status = 'BANNED';
    const waiting = usersState.users.find((u) => u.id === 'dev-a-03');
    if (waiting) waiting.status = 'PENDING_DELETION';
    useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<AbusePage />);
    await openCluster(user);
    expect(
      within(await accountRow('dev-a-02')).getByRole('button', { name: 'Ban' }),
    ).toBeDisabled();
    expect(
      within(await accountRow('dev-a-03')).getByRole('button', { name: 'Ban' }),
    ).toBeDisabled();
  });

  it('bans through the same dialog as the detail page, with the same notes, and shows the new state in the row', async () => {
    const calls = useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<AbusePage />);
    await openCluster(user);
    const row = await accountRow('dev-a-01');
    await user.click(within(row).getByRole('button', { name: 'Ban' }));
    const dialog = (await screen.findAllByRole('dialog')).at(-1) as HTMLElement;
    expect(within(dialog).getByText(enUS['users.ban.hint'])).toBeInTheDocument();
    expect(within(dialog).getByText(enUS['users.ban.consequence'])).toBeInTheDocument();
    await user.click(within(dialog).getByRole('textbox'));
    await user.paste('Several accounts from one device');
    await user.dblClick(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() =>
      expect(
        within(
          screen.getByRole('link', { name: 'dev-a-01' }).closest('tr') as HTMLElement,
        ).getByText('Banned'),
      ).toBeInTheDocument(),
    );
    expect(
      calls.filter((c) => c.method === 'POST' && c.url.endsWith('/users/dev-a-01/ban')),
    ).toHaveLength(1);
    expect(
      within(screen.getByRole('link', { name: 'dev-a-01' }).closest('tr') as HTMLElement).getByRole(
        'button',
        { name: 'Ban' },
      ),
    ).toBeDisabled();
  });

  it('says the failure in words when the clusters cannot be read', async () => {
    stubFetch(async () => jsonResponse(403, envelope('ADMIN_FORBIDDEN', null, 'raw backend text')));
    renderPage(<AbusePage />);
    expect(await screen.findByText(new RegExp(enUS['error.ADMIN_FORBIDDEN']))).toBeInTheDocument();
    expect(screen.queryByText(/raw backend text/)).toBeNull();
  });

  it('keeps ids of every language and 5000 characters without spaces inside the row', async () => {
    const ids = ['i'.repeat(5000), 'สวัสดีครับ'.repeat(20), 'مرحبا بك'.repeat(20), '😀'.repeat(60)];
    stubFetch(async ({ url }) => {
      if (url.startsWith('/api/admin/abuse/clusters/accounts')) {
        return jsonResponse(
          200,
          envelope('200', {
            items: ids.map((accountId) => ({
              accountId,
              createdAt: '2026-10-25T01:00:00Z',
              status: 'ACTIVE',
              paid: false,
              registerMethod: 'PHONE',
            })),
            total: ids.length,
          }),
        );
      }
      return jsonResponse(
        200,
        envelope('200', {
          items: [
            {
              key: 'abcdef0123456789'.repeat(4),
              accounts: 4,
              freeAccounts: 4,
              paidAccounts: 0,
              firstCreatedAt: '2026-10-24T01:00:00Z',
              lastCreatedAt: '2026-10-25T01:00:00Z',
            },
          ],
          total: 1,
        }),
      );
    });
    const user = userEvent.setup();
    renderPage(<AbusePage />);
    const row = await clusterRow('abcdef0123456789');
    await expand(user, row);
    const link = await screen.findByRole('link', { name: 'i'.repeat(5000) });
    expect(
      getComputedStyle(link).overflowWrap === 'anywhere' || link.style.overflowWrap === 'anywhere',
    ).toBe(true);
    expect(screen.getByRole('link', { name: ids[1] })).toBeInTheDocument();
  });
});
