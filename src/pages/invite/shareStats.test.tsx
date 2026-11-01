import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as inviteMock from '../../../mock/invite.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { withTimeZone } from '../../../tests/withTimeZone';
import enUS from '../../locales/en-US';
import ShareStatsPage from './shareStats';
import { clickExport, signIn, withExportSheet } from './testSetup';

const NOW = '2026-10-26T20:00:00Z';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  signIn('root', { meta: {} });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const funnelRow = (statDate: string, over: Record<string, unknown> = {}) => ({
  statDate,
  sharePv: 100,
  shareUv: 60,
  linkClickPv: 50,
  linkClickUv: 30,
  downloadClickPv: 20,
  downloadClickUv: 15,
  registered: 5,
  ...over,
});
const FUNNEL = [
  funnelRow('2026-10-24'),
  funnelRow('2026-10-25', {
    sharePv: 300,
    shareUv: 150,
    linkClickPv: 100,
    linkClickUv: 70,
    downloadClickPv: 40,
    downloadClickUv: 30,
    registered: 10,
  }),
];
const channelRow = (
  statDate: string,
  shareChannel: unknown,
  sharePv: number,
  shareUv = sharePv,
) => ({
  statDate,
  shareChannel,
  sharePv,
  shareUv,
});
// total PV: whatsapp 1000, facebook 800, line 600, telegram 500, instagram 400, messenger 300, twitter 100
const TOTALS: [string, number, number][] = [
  ['whatsapp', 600, 400],
  ['facebook', 300, 500],
  ['line', 350, 250],
  ['telegram', 200, 300],
  ['instagram', 100, 300],
  ['messenger', 200, 100],
  ['twitter', 60, 40],
];
const CHANNELS = TOTALS.flatMap(([name, a, b]) => [
  channelRow('2026-10-24', name, a, Math.floor(a / 2)),
  channelRow('2026-10-25', name, b, Math.floor(b / 2)),
]);

type Over = {
  funnel?: unknown[];
  channels?: unknown[];
  failFunnel?: boolean;
};
const backend = (over: Over = {}) =>
  stubFetch(async ({ url }) => {
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/admin/invites/share-funnel') {
      if (over.failFunnel)
        return jsonResponse(403, envelope('ADMIN_FORBIDDEN', null, 'raw backend words'));
      return jsonResponse(200, envelope('200', { items: over.funnel ?? FUNNEL }));
    }
    if (u.pathname === '/api/admin/invites/share-channels') {
      const only = u.searchParams.get('shareChannel');
      const rows = (over.channels ?? CHANNELS) as { shareChannel: unknown }[];
      return jsonResponse(
        200,
        envelope('200', { items: only ? rows.filter((r) => r.shareChannel === only) : rows }),
      );
    }
    if (u.pathname.startsWith('/api/admin/stats/land/'))
      return jsonResponse(200, envelope('200', null));
    return jsonResponse(404, envelope('RESOURCE_NOT_FOUND'));
  });

const called = (calls: { url: string }[], path: string) =>
  calls.filter((c) => c.url.startsWith(`/api/admin/invites/${path}`));
const json = (id: string, kind: string) =>
  JSON.parse(within(screen.getByTestId(id)).getByTestId(`chart-${kind}`).textContent ?? '[]');
// The stand-in chart prints its settings as JSON, which drops the tick function but keeps the
// vertical scale that carries it: a chart of counts has one, a chart that leaves the ticks to the
// library has none.
const hasWholeNumberAxis = (id: string) =>
  JSON.parse(
    within(screen.getByTestId(id)).getByTestId('chart-line').getAttribute('data-config') ?? '{}',
  ).scale?.y !== undefined;
const card = async (name: string) =>
  (await screen.findByTestId(`invite-share-card-${name}`)).querySelector('.ant-statistic-content')
    ?.textContent;
const tab = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(screen.getByRole('tab', { name }));

describe('the share statistics page: the range and the overview', { timeout: 30000 }, () => {
  it('asks for the last 7 UTC days from both tables and says the days are UTC', async () => {
    const calls = backend();
    renderPage(<ShareStatsPage />);
    await card('sharePv');
    expect(called(calls, 'share-funnel')[0].url).toBe(
      '/api/admin/invites/share-funnel?from=2026-10-20&to=2026-10-26',
    );
    expect(screen.getByText(/UTC days/)).toBeInTheDocument();
  });

  it('uses the UTC date, not the local one, in Singapore between 00:00 and 08:00', async () => {
    await withTimeZone('Asia/Singapore', async () => {
      vi.setSystemTime(new Date('2026-10-26T17:30:00Z'));
      const calls = backend();
      renderPage(<ShareStatsPage />);
      await card('sharePv');
      expect(called(calls, 'share-funnel')[0].url).toContain('from=2026-10-20&to=2026-10-26');
    });
  });

  it('shows four cards that are sums of counts: shares, link clicks, download clicks and sign-ups', async () => {
    backend();
    renderPage(<ShareStatsPage />);
    expect(await card('sharePv')).toBe('400');
    expect(await card('linkClickPv')).toBe('150');
    expect(await card('downloadClickPv')).toBe('60');
    expect(await card('registered')).toBe('15');
    for (const title of [
      'Shares (PV)',
      'Link clicks (PV)',
      'Download clicks',
      'Invitation sign-ups',
    ]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it('has no card of unique visitors, because they are not added over days', async () => {
    backend();
    renderPage(<ShareStatsPage />);
    await card('sharePv');
    const cards = document.querySelectorAll('[data-testid^="invite-share-card-"]');
    expect(cards).toHaveLength(4);
    for (const one of cards) expect(one.textContent).not.toMatch(/UV|unique/i);
    expect(screen.getByText(enUS['invite.share.uvNote'])).toBeInTheDocument();
  });

  it('draws one line, the daily shares, with every day of the range and 0 for a day without a row', async () => {
    backend();
    renderPage(<ShareStatsPage />);
    await card('sharePv');
    const data = json('invite-share-trend', 'line') as {
      statDate: string;
      series: string;
      value: number;
    }[];
    expect([...new Set(data.map((d) => d.series))]).toEqual(['Shares (PV)']);
    expect(data.map((d) => d.statDate)).toEqual([
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ]);
    expect(data.map((d) => d.value)).toEqual([0, 0, 0, 0, 100, 300, 0]);
    expect(hasWholeNumberAxis('invite-share-trend')).toBe(true);
  });

  it('shows a dash instead of 0 when no day has a row, and sums a day without a number as nothing', async () => {
    backend({ funnel: [] });
    renderPage(<ShareStatsPage />);
    expect(await card('sharePv')).toBe('—');
    expect(await card('registered')).toBe('—');
    expect(document.body.textContent).not.toMatch(/NaN|null/);
  });

  it('ignores a count that is missing, not a number or negative, and never shows a negative sum', async () => {
    backend({
      funnel: [
        funnelRow('2026-10-24', {
          sharePv: null,
          linkClickPv: -7,
          downloadClickPv: 'x',
          registered: undefined,
        }),
        funnelRow('2026-10-25', {
          sharePv: 30,
          linkClickPv: -9,
          downloadClickPv: null,
          registered: -1,
        }),
      ],
    });
    renderPage(<ShareStatsPage />);
    expect(await card('sharePv')).toBe('30');
    expect(await card('linkClickPv')).toBe('—');
    expect(await card('downloadClickPv')).toBe('—');
    expect(await card('registered')).toBe('—');
  });

  it('shows only the words of a known error code and offers to try again', async () => {
    const calls = backend({ failFunnel: true });
    const user = userEvent.setup();
    renderPage(<ShareStatsPage />);
    expect(await screen.findByText(/permission to do this/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw backend words');
    await user.click(screen.getAllByRole('button', { name: 'Retry' })[0]);
    await waitFor(() => expect(called(calls, 'share-funnel').length).toBeGreaterThan(1));
  });

  it('works on the numbers of the mock backend', async () => {
    useMockBackend(inviteMock);
    renderPage(<ShareStatsPage />);
    expect(await card('sharePv')).not.toBe('—');
  });
});

describe('the share statistics page: the funnel', { timeout: 30000 }, () => {
  it('draws share, link click, download click and sign-up, each step against the one before', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ShareStatsPage />);
    await card('sharePv');
    await tab(user, 'Funnel');
    const data = json('invite-share-funnel', 'funnel') as {
      stage: string;
      value: number;
      caption: string;
    }[];
    expect(data.map((d) => [d.stage, d.value])).toEqual([
      ['Share', 400],
      ['Link click', 150],
      ['Download click', 60],
      ['Sign-up', 15],
    ]);
    expect(data.map((d) => d.caption)).toEqual([
      'Share  400',
      'Link click  150  (37.5%)',
      'Download click  60  (40%)',
      'Sign-up  15  (25%)',
    ]);
  });

  it('writes a dash as the ratio of a step whose previous step is 0', async () => {
    backend({
      funnel: [funnelRow('2026-10-24', { linkClickPv: 0, downloadClickPv: 5, registered: 2 })],
    });
    const user = userEvent.setup();
    renderPage(<ShareStatsPage />);
    await card('sharePv');
    await tab(user, 'Funnel');
    const data = json('invite-share-funnel', 'funnel') as { caption: string }[];
    expect(data[1].caption).toBe('Link click  0  (0%)');
    expect(data[2].caption).toBe('Download click  5  (—)');
    expect(data[3].caption).toBe('Sign-up  2  (40%)');
  });

  it('draws the four steps as four lines of one chart', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ShareStatsPage />);
    await card('sharePv');
    await tab(user, 'Funnel');
    const data = json('invite-share-lines', 'line') as {
      statDate: string;
      series: string;
      value: number;
    }[];
    expect([...new Set(data.map((d) => d.series))]).toEqual([
      'Shares (PV)',
      'Link clicks (PV)',
      'Download clicks',
      'Invitation sign-ups',
    ]);
    expect(data).toHaveLength(28);
    expect(screen.getAllByTestId('chart-line').length).toBeGreaterThan(0);
    expect(hasWholeNumberAxis('invite-share-lines')).toBe(true);
  });

  it('lists the days with the six columns, the unique visitors of each day and no total row', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ShareStatsPage />);
    await card('sharePv');
    await tab(user, 'Funnel');
    const table = await screen.findByTestId('invite-share-detail');
    for (const head of [
      'Date',
      'Share PV',
      'Share UV',
      'Link click PV',
      'Download clicks',
      'Sign-ups',
    ]) {
      expect(within(table).getAllByText(head).length, head).toBeGreaterThan(0);
    }
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    const cells = (row: HTMLElement) =>
      within(row)
        .getAllByRole('cell')
        .map((c) => c.textContent);
    expect(cells(rows[1])).toEqual(['2026-10-24', '100', '60', '50', '20', '5']);
    expect(cells(rows[2])).toEqual(['2026-10-25', '300', '150', '100', '40', '10']);
    expect(table.textContent).not.toMatch(/total/i);
  });

  it('shows a dash for a cell that has no number', async () => {
    backend({ funnel: [funnelRow('2026-10-24', { shareUv: null, registered: -3 })] });
    const user = userEvent.setup();
    renderPage(<ShareStatsPage />);
    await card('sharePv');
    await tab(user, 'Funnel');
    const row = within(await screen.findByTestId('invite-share-detail')).getAllByRole('row')[1];
    expect(
      within(row)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['2026-10-24', '100', '—', '50', '20', '—']);
  });

  it('draws no funnel and says so when there is no row', async () => {
    backend({ funnel: [] });
    const user = userEvent.setup();
    renderPage(<ShareStatsPage />);
    await card('sharePv');
    await tab(user, 'Funnel');
    expect(screen.queryByTestId('chart-funnel')).toBeNull();
  });
});

describe('the share statistics page: the channels', { timeout: 30000 }, () => {
  const open = async () => {
    const user = userEvent.setup();
    renderPage(<ShareStatsPage />);
    await card('sharePv');
    await tab(user, 'Channels');
    await screen.findByTestId('invite-channel-pie');
    return user;
  };

  it('asks for the channel table with the range only', async () => {
    const calls = backend();
    await open();
    expect(called(calls, 'share-channels')[0].url).toBe(
      '/api/admin/invites/share-channels?from=2026-10-20&to=2026-10-26',
    );
  });

  it('draws the five channels with the most shares and one "Other" slice for the rest', async () => {
    backend();
    await open();
    const pie = json('invite-channel-pie', 'pie') as {
      channel: string;
      value: number;
      ratio: number;
    }[];
    expect(pie.map((s) => [s.channel, s.value])).toEqual([
      ['whatsapp', 1000],
      ['facebook', 800],
      ['line', 600],
      ['telegram', 500],
      ['instagram', 400],
      ['Other', 400],
    ]);
    expect(pie[0].ratio).toBeCloseTo(1000 / 3700, 6);
    expect(pie.reduce((n, s) => n + s.ratio, 0)).toBeCloseTo(1, 6);
  });

  it('draws the same six as lines of one chart, "Other" being the sum of the rest on each day', async () => {
    backend();
    await open();
    const lines = json('invite-channel-lines', 'line') as {
      statDate: string;
      series: string;
      value: number;
    }[];
    expect([...new Set(lines.map((d) => d.series))]).toEqual([
      'whatsapp',
      'facebook',
      'line',
      'telegram',
      'instagram',
      'Other',
    ]);
    const at = (series: string, day: string) =>
      lines.find((d) => d.series === series && d.statDate === day)?.value;
    expect(at('Other', '2026-10-24')).toBe(260);
    expect(at('Other', '2026-10-25')).toBe(140);
    expect(at('whatsapp', '2026-10-25')).toBe(400);
    expect(at('whatsapp', '2026-10-22')).toBe(0);
    expect(hasWholeNumberAxis('invite-channel-lines')).toBe(true);
  });

  it('draws no "Other" when there are five channels or fewer, and breaks a tie by name', async () => {
    backend({
      channels: [
        channelRow('2026-10-24', 'b_chan', 10),
        channelRow('2026-10-24', 'a_chan', 10),
        channelRow('2026-10-24', 'c_chan', 5),
      ],
    });
    await open();
    const pie = json('invite-channel-pie', 'pie') as { channel: string }[];
    expect(pie.map((s) => s.channel)).toEqual(['a_chan', 'b_chan', 'c_chan']);
  });

  it('draws no pie and says so when no channel has any shares', async () => {
    backend({ channels: [] });
    const user = userEvent.setup();
    renderPage(<ShareStatsPage />);
    await card('sharePv');
    await tab(user, 'Channels');
    await screen.findByTestId('invite-channel-detail');
    expect(screen.queryByTestId('chart-pie')).toBeNull();
  });

  it('offers "All" and the channels that appear in the data, and filters the detail table', async () => {
    backend();
    const user = await open();
    const select = screen.getByRole('combobox', { name: 'Share channel' });
    await user.click(select);
    const listed = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(listed).toEqual([
      'All',
      'facebook',
      'instagram',
      'line',
      'messenger',
      'telegram',
      'twitter',
      'whatsapp',
    ]);
    const options = await screen.findAllByText('line', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    const table = screen.getByTestId('invite-channel-detail');
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(3));
    for (const row of within(table).getAllByRole('row').slice(1)) {
      expect(within(row).getByText('line')).toBeInTheDocument();
    }
  });

  it('lists date, share channel, PV and UV, and keeps a channel name that is odd inside the table', async () => {
    backend({
      channels: [
        channelRow('2026-10-24', 'whatsapp', 40, 25),
        channelRow('2026-10-24', 'x'.repeat(300), 10, 5),
        channelRow('2026-10-24', null, 3, 2),
        channelRow('2026-10-24', 77, 1, 1),
      ],
    });
    await open();
    const table = screen.getByTestId('invite-channel-detail');
    for (const head of ['Date', 'Share channel', 'PV', 'UV']) {
      expect(within(table).getAllByText(head).length, head).toBeGreaterThan(0);
    }
    const first = within(table).getAllByRole('row')[1];
    expect(
      within(first)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['2026-10-24', 'whatsapp', '40', '25']);
    expect(table.textContent).toContain('x'.repeat(300));
    expect(table.textContent).not.toMatch(/null|undefined|\[object/);
  });
});

describe('the share statistics page: landing and export', { timeout: 30000 }, () => {
  it('shows no landing bar without STATS:LAND', async () => {
    signIn('support', { codes: ['INVITE:VIEW'], meta: {} });
    backend();
    renderPage(<ShareStatsPage />);
    await card('sharePv');
    expect(screen.queryByRole('button', { name: 'Re-land this day' })).toBeNull();
  });

  it('lands both share tables of the chosen day (yesterday in UTC), then reads both again', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ShareStatsPage />);
    await card('sharePv');
    await user.click(screen.getByRole('button', { name: 'Re-land this day' }));
    await waitFor(() =>
      expect(calls.filter((c) => c.url.includes('/stats/land/'))).toHaveLength(2),
    );
    expect(calls.filter((c) => c.url.includes('/stats/land/')).map((c) => c.url)).toEqual([
      '/api/admin/stats/land/share-funnel?date=2026-10-25',
      '/api/admin/stats/land/share-channel?date=2026-10-25',
    ]);
    await waitFor(() => expect(called(calls, 'share-funnel')).toHaveLength(2));
  });

  it('exports share-funnel on the overview and the funnel tab, and share-channel on the channel tab', async () => {
    backend();
    const exports = withExportSheet();
    const user = userEvent.setup();
    renderPage(<ShareStatsPage />);
    await card('sharePv');
    await clickExport(user);
    await waitFor(() => expect(exports).toHaveLength(1));
    expect(exports[0].url).toBe(
      '/api/admin/stats/export/share-funnel?from=2026-10-20&to=2026-10-26',
    );
    await tab(user, 'Funnel');
    await clickExport(user);
    await waitFor(() => expect(exports).toHaveLength(2));
    expect(exports[1].url).toBe(exports[0].url);
    await tab(user, 'Channels');
    await screen.findByTestId('invite-channel-pie');
    await clickExport(user);
    await waitFor(() => expect(exports).toHaveLength(3));
    expect(exports[2].url).toBe(
      '/api/admin/stats/export/share-channel?from=2026-10-20&to=2026-10-26',
    );
  });

  it('exports the one channel that is chosen', async () => {
    backend();
    const exports = withExportSheet();
    const user = userEvent.setup();
    renderPage(<ShareStatsPage />);
    await card('sharePv');
    await tab(user, 'Channels');
    await screen.findByTestId('invite-channel-pie');
    await user.click(screen.getByRole('combobox', { name: 'Share channel' }));
    const options = await screen.findAllByText('facebook', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    await clickExport(user);
    await waitFor(() => expect(exports).toHaveLength(1));
    expect(exports[0].url).toBe(
      '/api/admin/stats/export/share-channel?from=2026-10-20&to=2026-10-26&shareChannel=facebook',
    );
  });

  it('shows no export without STATS:EXPORT', async () => {
    signIn('support', { codes: ['INVITE:VIEW'], meta: {} });
    backend();
    renderPage(<ShareStatsPage />);
    await card('sharePv');
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
    fireEvent.scroll(window);
  });
});
