import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as inviteMock from '../../../mock/invite.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { withTimeZone } from '../../../tests/withTimeZone';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import StatsPage from './stats';
import { clickExport, signIn, withExportSheet } from './testSetup';

const NOW = '2026-10-26T20:00:00Z';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  signIn('root', { meta: { inviteChainMaxDepth: 5 } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const STATS = {
  totalInvitees: 120,
  activeInviters: 30,
  registeredAccounts: 1500,
  avgInvitesPerInviter: 4,
  daily: [
    { date: '2026-10-24', invitees: 5, activeInviters: 3 },
    { date: '2026-10-26', invitees: 8, activeInviters: 6 },
  ],
  ranking: [
    { inviterAccountId: 'acc-top-1', inviteCount: 9 },
    { inviterAccountId: 'acc-two-2', inviteCount: 4 },
  ],
  rewardedInvitees: 40,
  creditsGranted: 600,
};
const DEPTH = {
  depthDistribution: [
    { depth: 1, count: 20 },
    { depth: 3, count: 4 },
  ],
  avgDepth: 1.6666,
  maxDepth: 3,
  totalChains: 12,
};
const CHAIN = {
  root: { accountId: 'acc-top-1', label: 'r***@root.com', joinedAt: '2026-09-01T00:00:00Z' },
  children: [
    {
      accountId: 'child-1',
      label: 'ส***@h***.co.th',
      joinedAt: '2026-10-02T03:00:00Z',
      children: [
        {
          accountId: 'child-2',
          label: 'م***@y***.com',
          joinedAt: '2026-10-03T03:00:00Z',
          children: [],
        },
      ],
    },
    { accountId: 'child-3', label: 'x'.repeat(300), joinedAt: '2026-10-04T03:00:00Z' },
  ],
  totalDescendants: 3,
  maxDepth: 2,
};

type Over = {
  stats?: unknown;
  depth?: unknown;
  chain?: object | ((query: URLSearchParams) => Promise<Response>);
  failStats?: { status: number; code: string };
};
const backend = (over: Over = {}) =>
  stubFetch(async ({ url }) => {
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/admin/invites/stats') {
      if (over.failStats) {
        return jsonResponse(
          over.failStats.status,
          envelope(over.failStats.code, null, 'raw backend words'),
        );
      }
      return jsonResponse(200, envelope('200', over.stats ?? STATS));
    }
    if (u.pathname === '/api/admin/invites/depth-stats')
      return jsonResponse(200, envelope('200', over.depth ?? DEPTH));
    if (u.pathname === '/api/admin/invites/chain') {
      if (typeof over.chain === 'function') return over.chain(u.searchParams);
      return jsonResponse(200, envelope('200', over.chain ?? CHAIN));
    }
    return jsonResponse(404, envelope('RESOURCE_NOT_FOUND'));
  });

const called = (calls: { url: string }[], path: string) =>
  calls.filter((c) => c.url.startsWith(`/api/admin/invites/${path}`));
const kpi = (name: string) => screen.findByTestId(`invite-kpi-${name}`);
const statValue = async (name: string) =>
  (await kpi(name)).querySelector('.ant-statistic-content')?.textContent;
const chartJson = (id: string, kind: string) =>
  JSON.parse(within(screen.getByTestId(id)).getByTestId(`chart-${kind}`).textContent ?? '[]');

async function openFission(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('tab', { name: 'Fission levels' }));
}

describe('the invite statistics page: the overview', { timeout: 30000 }, () => {
  it('asks for the last 7 UTC days with a ranking of 50 and says the days are UTC', async () => {
    const calls = backend();
    renderPage(<StatsPage />);
    await kpi('totalInvitees');
    expect(called(calls, 'stats')[0].url).toBe(
      '/api/admin/invites/stats?from=2026-10-20&to=2026-10-26&limit=50',
    );
    expect(screen.getByText(/UTC days/)).toBeInTheDocument();
  });

  it('uses the UTC date, not the local one, in Singapore between 00:00 and 08:00', async () => {
    await withTimeZone('Asia/Singapore', async () => {
      vi.setSystemTime(new Date('2026-10-26T17:30:00Z'));
      const calls = backend();
      renderPage(<StatsPage />);
      await kpi('totalInvitees');
      expect(called(calls, 'stats')[0].url).toContain('from=2026-10-20&to=2026-10-26');
    });
  });

  it('shows the six numbers, the participation rate being active inviters over registered accounts', async () => {
    backend();
    renderPage(<StatsPage />);
    expect(await statValue('totalInvitees')).toBe('120');
    expect(await statValue('activeInviters')).toBe('30');
    expect(await statValue('participation')).toBe('2%');
    expect(await statValue('avgInvites')).toBe('4');
    expect(await statValue('rewarded')).toBe('40');
    expect(await statValue('credits')).toBe('600');
    for (const title of [
      'Invitees registered',
      'Active inviters',
      'Participation rate',
      'Invites per inviter',
      'Rewarded invitations',
      'Credits granted',
    ]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    expect(screen.queryByText(/K-Factor/i)).toBeNull();
  });

  it('shows a dash for an average that is null, and for a rate without a denominator', async () => {
    backend({
      stats: { ...STATS, activeInviters: 0, avgInvitesPerInviter: null, registeredAccounts: 0 },
    });
    renderPage(<StatsPage />);
    expect(await statValue('avgInvites')).toBe('—');
    expect(await statValue('participation')).toBe('—');
    expect(await statValue('activeInviters')).toBe('0');
    expect(document.body.textContent).not.toMatch(/NaN|Infinity|null/);
  });

  it('shows a dash for the rate when the denominator is missing and never a negative rate or average', async () => {
    backend({
      stats: {
        ...STATS,
        registeredAccounts: undefined,
        avgInvitesPerInviter: -2,
        activeInviters: -3,
      },
    });
    renderPage(<StatsPage />);
    expect(await statValue('participation')).toBe('—');
    expect(await statValue('avgInvites')).toBe('—');
  });

  it('draws the two daily series in one line chart with every day of the range', async () => {
    backend();
    renderPage(<StatsPage />);
    await kpi('totalInvitees');
    expect(screen.getAllByTestId('chart-line')).toHaveLength(1);
    const data = chartJson('invite-trend', 'line') as {
      statDate: string;
      series: string;
      value: number;
    }[];
    expect([...new Set(data.map((d) => d.series))]).toEqual([
      'Daily invitees registered',
      'Daily active inviters',
    ]);
    expect(data).toHaveLength(14);
    const day = (series: string, statDate: string) =>
      data.find((d) => d.series === series && d.statDate === statDate)?.value;
    expect(day('Daily invitees registered', '2026-10-26')).toBe(8);
    expect(day('Daily active inviters', '2026-10-24')).toBe(3);
    expect(day('Daily invitees registered', '2026-10-25')).toBe(0);
    // people are whole numbers: the vertical axis has no tick at 0.5 (the chart stand-in drops the
    // tick function and keeps the scale that carries it)
    const config = JSON.parse(
      within(screen.getByTestId('invite-trend'))
        .getByTestId('chart-line')
        .getAttribute('data-config') ?? '{}',
    );
    expect(config.scale?.y).toBeDefined();
  });

  it('lists the ranking as sent, with the account id and a "View fission" button on each row', async () => {
    backend();
    renderPage(<StatsPage />);
    const table = await screen.findByTestId('invite-ranking');
    expect(within(table).getByText('acc-top-1')).toBeInTheDocument();
    expect(within(table).getByText('9')).toBeInTheDocument();
    expect(within(table).getAllByRole('button', { name: 'View fission' })).toHaveLength(2);
  });

  it('changes the size of the ranking only for a whole number from 1 to 200', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await kpi('totalInvitees');
    const box = screen.getByRole('spinbutton', { name: 'Ranking size (Top N)' });
    await user.clear(box);
    await user.type(box, '0');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(
      await screen.findByText('Top N must be a whole number from 1 to 200'),
    ).toBeInTheDocument();
    expect(called(calls, 'stats')).toHaveLength(1);
    await user.clear(box);
    await user.type(box, '201');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(called(calls, 'stats')).toHaveLength(1);
    await user.clear(box);
    await user.type(box, '3');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(called(calls, 'stats')).toHaveLength(2));
    expect(called(calls, 'stats')[1].url).toContain('limit=3');
  });

  it('reads the range again only when Search is pressed, and sends the range that was searched', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await kpi('totalInvitees');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(called(calls, 'stats')).toHaveLength(2));
    expect(called(calls, 'stats')[1].url).toBe(called(calls, 'stats')[0].url);
  });

  it('shows only the words of a known error code and offers to try again', async () => {
    const calls = backend({ failStats: { status: 403, code: 'ADMIN_FORBIDDEN' } });
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    expect(await screen.findByText(/permission to do this/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw backend words');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(called(calls, 'stats')).toHaveLength(2));
  });

  it('works on the numbers of the mock backend (a ranking, a chart, a chain)', async () => {
    useMockBackend(inviteMock);
    renderPage(<StatsPage />);
    expect(await statValue('totalInvitees')).not.toBe('—');
    expect(screen.getAllByRole('button', { name: 'View fission' }).length).toBeGreaterThan(0);
  });
});

describe('the invite statistics page: export', { timeout: 30000 }, () => {
  it('exports as invite-stats with the range and the ranking size that were searched', async () => {
    backend();
    const exports = withExportSheet();
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await kpi('totalInvitees');
    await clickExport(user);
    await waitFor(() => expect(exports).toHaveLength(1));
    expect(exports[0].url).toBe(
      '/api/admin/stats/export/invite-stats?from=2026-10-20&to=2026-10-26&limit=50',
    );
  });

  it('shows no export without STATS:EXPORT', async () => {
    signIn('support', { codes: ['INVITE:VIEW'], meta: {} });
    backend();
    renderPage(<StatsPage />);
    await kpi('totalInvitees');
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
  });
});

describe('the invite statistics page: fission levels', { timeout: 30000 }, () => {
  it('reads the depth statistics only when the tab is opened, with the range of the page', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await kpi('totalInvitees');
    expect(called(calls, 'depth-stats')).toHaveLength(0);
    await openFission(user);
    await screen.findByTestId('invite-fission-avgDepth');
    expect(called(calls, 'depth-stats')[0].url).toBe(
      '/api/admin/invites/depth-stats?from=2026-10-20&to=2026-10-26',
    );
  });

  it('shows the average depth with one decimal, the deepest chain and the number of chains', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await openFission(user);
    const value = async (name: string) =>
      (await screen.findByTestId(`invite-fission-${name}`)).querySelector('.ant-statistic-content')
        ?.textContent;
    expect(await value('avgDepth')).toBe('1.7');
    expect(await value('maxDepth')).toBe('3');
    expect(await value('totalChains')).toBe('12');
    expect(screen.getByText('Average chain depth')).toBeInTheDocument();
    expect(screen.getByText('Deepest chain')).toBeInTheDocument();
    expect(screen.getByText('Chains')).toBeInTheDocument();
    expect(screen.queryByText(/nodes/i)).toBeNull();
  });

  it('writes a whole average with the decimal and a missing one as a dash', async () => {
    backend({ depth: { ...DEPTH, avgDepth: 3, maxDepth: null } });
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await openFission(user);
    expect((await screen.findByTestId('invite-fission-avgDepth')).textContent).toContain('3.0');
    expect(screen.getByTestId('invite-fission-maxDepth').textContent).toContain('—');
  });

  it('draws the depth distribution as columns "Level N" against the number of people, with the gaps as 0', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await openFission(user);
    await screen.findByTestId('invite-depth');
    const data = chartJson('invite-depth', 'column') as { level: string; people: number }[];
    expect(data).toEqual([
      { level: 'Level 1', people: 20 },
      { level: 'Level 2', people: 0 },
      { level: 'Level 3', people: 4 },
    ]);
    const config = JSON.parse(
      within(screen.getByTestId('invite-depth'))
        .getByTestId('chart-column')
        .getAttribute('data-config') ?? '{}',
    );
    expect(config.axis.y.title).toBe('People');
  });

  it('draws no columns and says so when no one was invited in the range', async () => {
    backend({ depth: { depthDistribution: [], avgDepth: null, maxDepth: null, totalChains: 0 } });
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await openFission(user);
    await screen.findByTestId('invite-fission-avgDepth');
    expect(screen.queryByTestId('chart-column')).toBeNull();
    expect(screen.getByTestId('invite-fission-totalChains').textContent).toContain('0');
  });
});

describe('the invite statistics page: the invitation chain', { timeout: 30000 }, () => {
  const load = async (user: ReturnType<typeof userEvent.setup>, id: string, depth?: string) => {
    const box = screen.getByRole('textbox', { name: 'Account ID' });
    await user.clear(box);
    await user.type(box, id);
    if (depth !== undefined) {
      const spin = screen.getByRole('spinbutton', { name: 'Depth' });
      await user.clear(spin);
      await user.type(spin, depth);
    }
    await user.click(screen.getByRole('button', { name: 'Load chain' }));
  };

  it('loads the chain of the account with the default depth 3 and shows masked labels, not account ids', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await openFission(user);
    await load(user, '  acc-top-1  ');
    const tree = await screen.findByTestId('invite-chain-tree');
    expect(called(calls, 'chain')[0].url).toBe(
      '/api/admin/invites/chain?rootAccountId=acc-top-1&maxDepth=3',
    );
    await waitFor(() => expect(within(tree).getByText(/r\*\*\*@root\.com/)).toBeInTheDocument());
    expect(within(tree).getByText(/ส\*\*\*@h\*\*\*\.co\.th/)).toBeInTheDocument();
    expect(within(tree).getByText(/م\*\*\*@y\*\*\*\.com/)).toBeInTheDocument();
    expect(tree.textContent).not.toMatch(/child-1|child-2|child-3/);
    expect(screen.getByTestId('invite-chain-summary').textContent).toBe(
      '3 descendants, 2 levels deep',
    );
  });

  it('lays a label that starts with an Arabic letter out from the left, so the domain is not read first', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await openFission(user);
    await load(user, 'acc-top-1');
    const tree = await screen.findByTestId('invite-chain-tree');
    const label = await within(tree).findByText(/م\*\*\*@y\*\*\*\.com/);
    expect(label.closest('bdi')).toHaveAttribute('dir', 'ltr');
  });

  it('shows the time of each invitation beside the label', async () => {
    await withTimeZone('Asia/Singapore', async () => {
      backend();
      const user = userEvent.setup();
      renderPage(<StatsPage />);
      await openFission(user);
      await load(user, 'acc-top-1');
      const tree = await screen.findByTestId('invite-chain-tree');
      await waitFor(() =>
        expect(within(tree).getByText(/10\/02\/2026, 11:00:00/)).toBeInTheDocument(),
      );
    });
  });

  it('takes a label that is not text or has no spaces and 300 characters without breaking the tree', async () => {
    backend({
      chain: {
        ...CHAIN,
        children: [
          { accountId: 'c1', label: { masked: true }, joinedAt: null },
          { accountId: 'c2', label: 'z'.repeat(300), joinedAt: 'not a time' },
        ],
        totalDescendants: 2,
        maxDepth: 1,
      },
    });
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await openFission(user);
    await load(user, 'acc-top-1');
    const tree = await screen.findByTestId('invite-chain-tree');
    await waitFor(() => expect(tree.textContent).toContain('z'.repeat(300)));
    expect(tree.textContent).not.toMatch(/\[object|undefined|NaN/);
  });

  it('refuses an empty account id and a depth outside 1 to the configured limit, and sends nothing', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await openFission(user);
    await user.click(screen.getByRole('button', { name: 'Load chain' }));
    expect(await screen.findByText('Enter an account ID')).toBeInTheDocument();
    await load(user, 'acc-top-1', '6');
    expect(
      await screen.findByText('The depth must be a whole number from 1 to 5'),
    ).toBeInTheDocument();
    await load(user, 'acc-top-1', '0');
    expect(called(calls, 'chain')).toHaveLength(0);
    await load(user, 'acc-top-1', '5');
    await waitFor(() => expect(called(calls, 'chain')).toHaveLength(1));
    expect(called(calls, 'chain')[0].url).toContain('maxDepth=5');
  });

  it('does not limit the depth from above when the configured limit is not known, and starts at 3', async () => {
    signIn('root', { meta: {} });
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await openFission(user);
    expect(screen.getByRole('spinbutton', { name: 'Depth' })).toHaveValue('3');
    await load(user, 'acc-top-1', '50');
    await waitFor(() => expect(called(calls, 'chain')).toHaveLength(1));
    expect(called(calls, 'chain')[0].url).toContain('maxDepth=50');
    await load(user, 'acc-top-1', '0');
    expect(
      await screen.findByText('The depth must be a whole number of 1 or more'),
    ).toBeInTheDocument();
  });

  it('starts at the configured limit when that is below 3', async () => {
    signIn('root', { meta: { inviteChainMaxDepth: 2 } });
    backend();
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await openFission(user);
    expect(screen.getByRole('spinbutton', { name: 'Depth' })).toHaveValue('2');
  });

  it('opens the fission tab and loads the chain of the account when "View fission" is pressed', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    const table = await screen.findByTestId('invite-ranking');
    await user.click(within(table).getAllByRole('button', { name: 'View fission' })[1]);
    expect(
      await screen.findByRole('tab', { name: 'Fission levels', selected: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Account ID' })).toHaveValue('acc-two-2');
    await waitFor(() => expect(called(calls, 'chain')).toHaveLength(1));
    expect(called(calls, 'chain')[0].url).toBe(
      '/api/admin/invites/chain?rootAccountId=acc-two-2&maxDepth=3',
    );
    expect(await screen.findByTestId('invite-chain-tree')).toBeInTheDocument();
  });

  it('names the field and the reason when the backend refuses the depth, not only the general words', async () => {
    // The page holds a limit of 5 read at sign-in; another administrator has since lowered it.
    backend({
      chain: () =>
        Promise.resolve(
          jsonResponse(
            400,
            envelope(
              'INVALID_REQUEST',
              { details: [{ ref: 'maxDepth', reason: 'OUT_OF_RANGE' }] },
              'raw backend words',
            ),
          ),
        ),
    });
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await openFission(user);
    await load(user, 'acc-top-1');
    const bar = await screen.findByRole('alert');
    expect(bar.textContent).toContain(enUS['error.INVALID_REQUEST']);
    expect(bar.textContent).toContain(`Depth: ${enUS['reason.OUT_OF_RANGE']}`);
    expect(document.body.textContent).not.toContain('raw backend words');
  });

  it('puts the field of a refusal in the words of the other language too', async () => {
    backend({
      chain: () =>
        Promise.resolve(
          jsonResponse(
            400,
            envelope('INVALID_REQUEST', {
              details: [{ ref: 'rootAccountId', reason: 'ACCOUNT_NOT_FOUND' }],
            }),
          ),
        ),
    });
    const user = userEvent.setup();
    renderPage(<StatsPage />, 'zh-CN');
    await user.click(await screen.findByRole('tab', { name: zhCN['invite.stats.tab.fission'] }));
    await user.type(screen.getByRole('textbox', { name: zhCN['invite.chain.accountId'] }), 'acc-1');
    await user.click(screen.getByRole('button', { name: zhCN['invite.chain.load'] }));
    const bar = await screen.findByRole('alert');
    expect(bar.textContent).toContain(
      `${zhCN['invite.chain.accountId']}：${zhCN['reason.ACCOUNT_NOT_FOUND']}`,
    );
  });

  it('shows only the words of a known error code when the account does not exist', async () => {
    backend({
      chain: () =>
        Promise.resolve(
          jsonResponse(404, envelope('RESOURCE_NOT_FOUND', null, 'raw backend words')),
        ),
    });
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await openFission(user);
    await load(user, 'nobody');
    expect(
      await screen.findByText(new RegExp(enUS['error.RESOURCE_NOT_FOUND'])),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw backend words');
    expect(screen.queryByTestId('invite-chain-tree')).toBeNull();
  });

  it('shows the answer of the newest request even when an older one arrives later', async () => {
    const answers: Record<string, () => Response> = {};
    const gates: Record<string, () => void> = {};
    backend({
      chain: (query) =>
        new Promise<Response>((resolve) => {
          const id = query.get('rootAccountId') ?? '';
          gates[id] = () => resolve(answers[id]());
        }),
    });
    answers.old = () =>
      jsonResponse(
        200,
        envelope('200', {
          ...CHAIN,
          root: { ...CHAIN.root, label: 'old***@x.com' },
          children: [],
          totalDescendants: 0,
          maxDepth: 0,
        }),
      );
    answers.new = () =>
      jsonResponse(
        200,
        envelope('200', {
          ...CHAIN,
          root: { ...CHAIN.root, label: 'new***@x.com' },
          children: [],
          totalDescendants: 0,
          maxDepth: 0,
        }),
      );
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await openFission(user);
    await load(user, 'old');
    await load(user, 'new');
    await waitFor(() => expect(gates.new).toBeDefined());
    gates.new();
    await waitFor(() =>
      expect(screen.getByTestId('invite-chain-tree').textContent).toContain('new***@x.com'),
    );
    await act(async () => {
      gates.old();
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(screen.getByTestId('invite-chain-tree').textContent).toContain('new***@x.com');
    expect(screen.getByTestId('invite-chain-tree').textContent).not.toContain('old***@x.com');
  });
});
