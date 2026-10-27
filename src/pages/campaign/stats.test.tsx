import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { campaignState } from '../../../mock/_core/campaignData';
import campaignMock from '../../../mock/campaign.mock';
import configMock from '../../../mock/config.mock';
import statsMock from '../../../mock/stats.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { withTimeZone } from '../../../tests/withTimeZone';
import StatsPage from './stats';
import {
  chooseOption,
  jsonAnswer,
  META,
  NOW,
  overrideFetch,
  sheetAnswer,
  signIn,
} from './testSetup';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:x');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const mockModules = () =>
  useMockBackend({ default: campaignMock }, { default: configMock }, { default: statsMock });
const performanceCalls = (calls: { method: string; url: string }[]) =>
  calls
    .filter((c) => c.url.startsWith('/api/admin/attribution/performance'))
    .map((c) => new URL(c.url, 'http://x').searchParams);
const tables = () => [...document.querySelectorAll('.ant-table')];
const rowsOf = (table: Element) => [...table.querySelectorAll('tbody tr.ant-table-row')];
const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');
const headsOf = (table: Element) =>
  [...table.querySelectorAll('thead th')].map((th) => th.textContent ?? '');
const chartData = () =>
  JSON.parse(screen.getByTestId('chart-line').textContent ?? '[]') as {
    statDate: string;
    series: string;
    value: number | null;
  }[];
const ready = async () => {
  await waitFor(() => expect(tables()).toHaveLength(2));
  await waitFor(() => expect(rowsOf(tables()[0]).length).toBeGreaterThan(0));
};

describe('the campaign results page: reading', () => {
  it('says the days are UTC and that today is provisional, as the overview does, and reads the last seven UTC days, also where the local date is the next day', async () => {
    signIn('root');
    await withTimeZone('Pacific/Auckland', async () => {
      const calls = mockModules();
      renderPage(<StatsPage />);
      expect(screen.getByText(/Statistics days are UTC days/)).toBeInTheDocument();
      expect(
        screen.getByText("Today's figures are provisional and are refreshed every 15 minutes."),
      ).toBeInTheDocument();
      await ready();
      const reads = performanceCalls(calls);
      expect(reads).toHaveLength(2);
      for (const read of reads) {
        expect(read.get('from')).toBe('2026-10-20');
        expect(read.get('to')).toBe('2026-10-26');
      }
      expect(reads.map((r) => r.get('groupBy')).sort()).toEqual(['campaign', 'day']);
    });
  });

  it('does not give the number of minutes when the backend has not said it', async () => {
    signIn('root', { meta: { ...META, landIntervalMinutes: null } });
    mockModules();
    renderPage(<StatsPage />);
    expect(screen.getByText("Today's figures are provisional.")).toBeInTheDocument();
    await ready();
  });

  it('shows the chart and both tables together', async () => {
    signIn('root');
    mockModules();
    renderPage(<StatsPage />);
    await ready();
    expect(screen.getAllByTestId('chart-line')).toHaveLength(1);
    expect(tables()).toHaveLength(2);
  });

  it('has the columns of the spec in its order, with the currency of the costs in the heads', async () => {
    signIn('root');
    mockModules();
    renderPage(<StatsPage />);
    await ready();
    const [summary, daily] = tables();
    expect(headsOf(summary)).toEqual([
      'Campaign ID',
      'Name',
      'Page views',
      'Clicks',
      'Click rate',
      'Installs',
      'Registrations',
      'Install rate',
      'Registration rate',
      'Total cost (USD)',
      'CPA (USD)',
      'CPI (USD)',
    ]);
    expect(headsOf(daily)).toEqual([
      'Date (UTC)',
      'Page views',
      'Clicks',
      'Click rate',
      'Installs',
      'Registrations',
      'Install rate',
      'Registration rate',
      'Total cost (USD)',
      'CPA (USD)',
      'CPI (USD)',
    ]);
  });

  it('leaves the currency out of the heads for an administrator who cannot read it from the configuration', async () => {
    signIn('support', { codes: ['ATTRIBUTION:VIEW'] });
    mockModules();
    renderPage(<StatsPage />);
    await ready();
    expect(headsOf(tables()[0]).slice(9)).toEqual(['Total cost', 'CPA', 'CPI']);
  });

  it('writes the code and the name of each campaign in whatever language the name is, from the list of campaigns', async () => {
    signIn('root');
    mockModules();
    renderPage(<StatsPage />);
    await ready();
    await waitFor(() => expect(screen.getByText('spring_th')).toBeInTheDocument());
    const text = rowsOf(tables()[0])
      .map((r) => r.textContent)
      .join(' ');
    for (const campaign of campaignState.campaigns) {
      expect(text, campaign.code).toContain(campaign.code);
      expect(text, campaign.name).toContain(campaign.name);
    }
    expect(text).toMatch(/[฀-๿]/);
    expect(text).toMatch(new RegExp(String.fromCharCode(91, 0x600, 45, 0x6ff, 93)));
  });

  it('shows a dash for every rate and every cost per unit whose denominator is 0, and 0 for a count that is 0', async () => {
    signIn('root');
    mockModules();
    renderPage(<StatsPage />);
    await ready();
    await waitFor(() => expect(screen.getByText('summer_vn')).toBeInTheDocument());
    const quiet = rowsOf(tables()[0]).find((r) => r.textContent?.includes('summer_vn')) as Element;
    expect(cellsOf(quiet)).toEqual([
      'summer_vn',
      'Chiến dịch mùa hè Việt Nam',
      '0',
      '0',
      '—',
      '0',
      '0',
      '—',
      '—',
      '0.00',
      '—',
      '—',
    ]);
  });

  it('writes the rates as percentages and the costs with two decimals', async () => {
    signIn('root');
    mockModules();
    renderPage(<StatsPage />);
    await ready();
    await waitFor(() => expect(screen.getByText('spring_th')).toBeInTheDocument());
    const busy = rowsOf(tables()[0]).find((r) => r.textContent?.includes('spring_th')) as Element;
    const cells = cellsOf(busy);
    for (const at of [4, 7, 8]) expect(cells[at], `column ${at}`).toMatch(/^\d+(\.\d)?%$/);
    for (const at of [9, 10, 11]) expect(cells[at], `column ${at}`).toMatch(/^[\d,]+\.\d{2}$/);
  });

  it('has a row for the unattributed installs with its share of the matched and unattributed installs', async () => {
    signIn('root');
    mockModules();
    renderPage(<StatsPage />);
    await ready();
    const row = await screen.findByTestId('unattributed-row');
    expect(within(row).getByText('Unattributed')).toBeInTheDocument();
    const count = Number(
      within(row).getByTestId('unattributed-count').textContent?.replace(/,/g, ''),
    );
    expect(count).toBeGreaterThan(0);
    const matched = rowsOf(tables()[0])
      .filter((r) => r !== row)
      .reduce((sum, r) => sum + Number(cellsOf(r)[5].replace(/,/g, '')), 0);
    const share = Math.round((count / (matched + count)) * 1000) / 10;
    expect(within(row).getByTestId('unattributed-share').textContent).toContain(`${share}%`);
    // the other cells of the row have no figure
    expect(cellsOf(row)[0]).toBe('—');
    expect(cellsOf(row)[2]).toBe('—');
  });

  it('draws one line chart of the counts of the days, with a point for every day of the range', async () => {
    signIn('root');
    mockModules();
    renderPage(<StatsPage />);
    await ready();
    const points = chartData();
    expect(new Set(points.map((p) => p.series))).toEqual(
      new Set(['Page views', 'Clicks', 'Installs', 'Registrations']),
    );
    expect(new Set(points.map((p) => p.statDate)).size).toBe(7);
    expect(points).toHaveLength(28);
  });

  it('shows the days of the daily table with 20 rows to a page', async () => {
    signIn('root');
    mockModules();
    overrideFetch(({ url }) => {
      if (url.pathname !== '/api/admin/attribution/performance') return undefined;
      if (url.searchParams.get('groupBy') === 'campaign')
        return jsonAnswer(200, '200', { items: [] });
      const items = Array.from({ length: 45 }, (_, i) => ({
        statDate: new Date(Date.UTC(2026, 8, 12 + i)).toISOString().slice(0, 10),
        pageViews: 100 + i,
        clicks: 50,
        clickRate: 0.5,
        installs: 10,
        installRate: 0.2,
        registered: 5,
        registerRate: 0.5,
        cost: 10,
        cpa: 2,
        cpi: 1,
      }));
      return jsonAnswer(200, '200', { items });
    });
    renderPage(<StatsPage />);
    await waitFor(() => expect(tables()).toHaveLength(2));
    await waitFor(() => expect(rowsOf(tables()[1])).toHaveLength(20));
    expect(document.querySelectorAll('.ant-pagination-item').length).toBe(3);
  });
});

describe('the campaign results page: the filter', () => {
  it('reads again with the campaign that was chosen and without the row of unattributed installs', async () => {
    signIn('root');
    const calls = mockModules();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<StatsPage />);
    await ready();
    expect(await screen.findByTestId('unattributed-row')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Campaign' })).not.toHaveClass('x'),
    );
    await chooseOption(user, 'Campaign', /spring_th/);
    // choosing alone changes nothing: the search button asks
    expect(performanceCalls(calls)).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(performanceCalls(calls)).toHaveLength(4));
    const campaignId = campaignState.campaigns.find((c) => c.code === 'spring_th')?.id;
    for (const read of performanceCalls(calls).slice(2))
      expect(read.get('campaignId')).toBe(campaignId);
    await waitFor(() => expect(screen.queryByTestId('unattributed-row')).not.toBeInTheDocument());
    expect(rowsOf(tables()[0])).toHaveLength(1);
  });
});

describe('the campaign results page: export and landing', () => {
  // The name is found by its text: happy-dom never ends the animation of the loading icon, which
  // would stay in the accessible name of a button that has been loading once.
  const exportButton = () =>
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'Export') ?? null;

  it('has no export button without STATS:EXPORT, and no re-landing without STATS:LAND', async () => {
    signIn('support', { codes: ['ATTRIBUTION:VIEW'] });
    mockModules();
    renderPage(<StatsPage />);
    await ready();
    expect(exportButton()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Re-land this day' })).not.toBeInTheDocument();
  });

  it('exports attribution-performance with the filters of the last search, and saves the file', async () => {
    signIn('support', { codes: ['ATTRIBUTION:VIEW', 'STATS:EXPORT'] });
    mockModules();
    const taken = overrideFetch(({ url }) =>
      url.pathname.startsWith('/api/admin/stats/export/') ? sheetAnswer() : undefined,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<StatsPage />);
    await ready();
    await chooseOption(user, 'Campaign', /spring_th/);
    // the filter that was only chosen is not the filter of the export
    await user.click(exportButton() as HTMLElement);
    await waitFor(() => expect(taken).toHaveLength(1));
    const first = new URL(taken[0].url, 'http://x');
    expect(first.pathname).toBe('/api/admin/stats/export/attribution-performance');
    expect(first.searchParams.get('from')).toBe('2026-10-20');
    expect(first.searchParams.get('to')).toBe('2026-10-26');
    expect(first.searchParams.get('groupBy')).toBe('campaign');
    expect(first.searchParams.has('campaignId')).toBe(false);
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(rowsOf(tables()[0])).toHaveLength(1));
    await user.click(exportButton() as HTMLElement);
    await waitFor(() => expect(taken).toHaveLength(2));
    const campaignId = campaignState.campaigns.find((c) => c.code === 'spring_th')?.id;
    expect(new URL(taken[1].url, 'http://x').searchParams.get('campaignId')).toBe(campaignId);
  });

  it('sends one export request when the button is pressed twice while the file is on its way, and saves no file when the backend refuses', async () => {
    signIn('support', { codes: ['ATTRIBUTION:VIEW', 'STATS:EXPORT'] });
    mockModules();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const taken = overrideFetch(async ({ url }) => {
      if (!url.pathname.startsWith('/api/admin/stats/export/')) return undefined;
      await gate;
      return jsonAnswer(400, 'INVALID_REQUEST', null, 'raw words about rows');
    });
    renderPage(<StatsPage />);
    await ready();
    const button = exportButton() as HTMLElement;
    fireEvent.click(button);
    fireEvent.click(button);
    release();
    await waitFor(() => expect(taken).toHaveLength(1));
    await waitFor(() => expect(document.body.textContent).toContain('narrow the date range'));
    expect(document.body.textContent).not.toContain('raw words about rows');
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });

  it('re-lands the day before today in UTC, once for two presses, and reads the page again', async () => {
    signIn('root');
    const calls = mockModules();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const taken = overrideFetch(async ({ url, method }) => {
      if (method !== 'POST' || !url.pathname.startsWith('/api/admin/stats/land/')) return undefined;
      await gate;
      return jsonAnswer(200, '200', null);
    });
    renderPage(<StatsPage />);
    await ready();
    const before = performanceCalls(calls).length;
    const button = screen.getByRole('button', { name: 'Re-land this day' });
    fireEvent.click(button);
    fireEvent.click(button);
    release();
    await waitFor(() => expect(taken).toHaveLength(1));
    expect(taken[0].url).toBe('/api/admin/stats/land/attribution-daily?date=2026-10-25');
    await waitFor(() => expect(performanceCalls(calls).length).toBe(before + 2));
  });
});

describe('the campaign results page: what goes wrong', () => {
  it('shows the words of the error code, not the words of the backend, and reads again with the retry button', async () => {
    signIn('root');
    mockModules();
    let failing = true;
    overrideFetch(({ url }) =>
      failing && url.pathname === '/api/admin/attribution/performance'
        ? jsonAnswer(429, 'RATE_LIMITED', null, 'raw backend words')
        : undefined,
    );
    renderPage(<StatsPage />);
    const bar = await screen.findByText(/Failed to load:/);
    expect(bar.textContent).toContain('Too many requests');
    expect(document.body.textContent).not.toContain('raw backend words');
    expect(tables()).toHaveLength(0);
    failing = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await ready();
    expect(screen.queryByText(/Failed to load:/)).not.toBeInTheDocument();
  });

  it('disables the campaign filter and says which permission is missing when the list is refused (403), and still shows the figures, with the id for the code', async () => {
    signIn('support', { codes: ['ATTRIBUTION:VIEW'] });
    mockModules();
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/attribution/campaigns'
        ? jsonAnswer(403, 'ADMIN_FORBIDDEN', null, 'raw words')
        : undefined,
    );
    renderPage(<StatsPage />);
    await ready();
    const note = await screen.findByTestId('campaign-select-forbidden');
    expect(note.textContent).toBe(
      'Choosing a campaign needs the permission "Manage campaign accounts and attribution settings".',
    );
    expect(screen.getByRole('combobox', { name: 'Campaign' })).toBeDisabled();
    const first = cellsOf(rowsOf(tables()[0])[0]);
    expect(first[0]).toMatch(/^\d+$/);
    expect(first[1]).toBe('—');
  });

  it('offers to read the list of campaigns again when it fails for another reason', async () => {
    signIn('root');
    mockModules();
    let failing = true;
    overrideFetch(({ url }) =>
      failing && url.pathname === '/api/admin/attribution/campaigns'
        ? jsonAnswer(500, 'INTERNAL_ERROR')
        : undefined,
    );
    renderPage(<StatsPage />);
    await screen.findByText('The campaigns could not be read.');
    failing = false;
    const retries = screen.getAllByRole('button', { name: 'Retry' });
    fireEvent.click(retries[retries.length - 1]);
    await waitFor(() =>
      expect(screen.queryByText('The campaigns could not be read.')).not.toBeInTheDocument(),
    );
  });

  it('never lets a slow answer to an older search replace the answer to the newer one', async () => {
    signIn('root');
    mockModules();
    const releases: (() => void)[] = [];
    let reads = 0;
    overrideFetch(async ({ url }) => {
      if (url.pathname !== '/api/admin/attribution/performance') return undefined;
      reads += 1;
      // the first two reads (the first search) are held back; the later ones are not
      if (reads <= 2) await new Promise<void>((resolve) => releases.push(resolve));
      return undefined;
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<StatsPage />);
    await waitFor(() => expect(reads).toBe(2));
    await chooseOption(user, 'Campaign', /spring_th/);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(rowsOf(tables()[0])).toHaveLength(1));
    for (const release of releases) release();
    await new Promise((resolve) => setTimeout(resolve, 50));
    // the old answer would have had eight rows
    expect(rowsOf(tables()[0])).toHaveLength(1);
  });

  it('does not break on figures that are missing, text, negative or objects, and writes a dash for what cannot be worked out', async () => {
    signIn('root');
    mockModules();
    overrideFetch(({ url }) => {
      if (url.pathname !== '/api/admin/attribution/performance') return undefined;
      if (url.searchParams.get('groupBy') === 'day') return jsonAnswer(200, '200', { items: [] });
      return jsonAnswer(200, '200', {
        items: [
          {
            campaignId: '9',
            campaignName: { odd: 1 },
            pageViews: 0,
            clicks: null,
            clickRate: 0.4,
            installs: '7',
            registered: -1,
            installRate: -2,
            registerRate: Number.NaN,
            cost: null,
            cpa: 3,
            cpi: 'x',
          },
          {
            campaignId: '8',
            pageViews: 10,
            clicks: 5,
            clickRate: 0.5,
            installs: 2,
            registered: 1,
            cost: '12.5',
          },
        ],
      });
    });
    renderPage(<StatsPage />);
    await waitFor(() => expect(rowsOf(tables()[0])).toHaveLength(2));
    expect(cellsOf(rowsOf(tables()[0])[0])).toEqual([
      '9',
      '{"odd":1}',
      '0',
      '—',
      '—',
      '—',
      '-1',
      '—',
      '—',
      '—',
      '—',
      '—',
    ]);
    expect(cellsOf(rowsOf(tables()[0])[1]).slice(2)).toEqual([
      '10',
      '5',
      '50%',
      '2',
      '1',
      '40%',
      '50%',
      '12.50',
      '12.50',
      '6.25',
    ]);
  });

  it('keeps a name of 5000 characters without a space, and Arabic, Thai and emoji names, inside the table, one click from the whole text', async () => {
    signIn('root');
    mockModules();
    const names = ['ا'.repeat(5000), 'ก'.repeat(300), `Promo ${'🎉'.repeat(40)}`];
    overrideFetch(({ url }) => {
      if (url.pathname !== '/api/admin/attribution/performance') return undefined;
      if (url.searchParams.get('groupBy') === 'day') return jsonAnswer(200, '200', { items: [] });
      return jsonAnswer(200, '200', {
        items: names.map((campaignName, i) => ({
          campaignId: String(i + 1),
          campaignName,
          pageViews: 1,
        })),
      });
    });
    renderPage(<StatsPage />);
    await waitFor(() => expect(rowsOf(tables()[0])).toHaveLength(3));
    for (const [i, name] of names.entries()) {
      const button = rowsOf(tables()[0])[i].querySelector('button[data-lines]') as HTMLElement;
      expect(button.textContent).toBe(name);
      expect(button.style.maxWidth).toBe('220px');
      expect(button.style.overflowWrap).toBe('anywhere');
    }
  });
});

describe('the campaign results page: the explanation', () => {
  it('shows the explanation of the report, which can be closed and stays closed', async () => {
    signIn('root');
    mockModules();
    const first = renderPage(<StatsPage />);
    expect(screen.getByText('How to read this report')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() =>
      expect(screen.queryByText('How to read this report')).not.toBeInTheDocument(),
    );
    expect(localStorage.getItem('reportHelper:campaign')).toBe('1');
    await ready();
    first.unmount();
    renderPage(<StatsPage />);
    expect(screen.queryByText('How to read this report')).not.toBeInTheDocument();
  });

  it('is written in Chinese too', async () => {
    signIn('root');
    mockModules();
    renderPage(<StatsPage />, 'zh-CN');
    await ready();
    expect(headsOf(tables()[0])).toEqual([
      '投放 ID',
      '名称',
      '访问量',
      '点击数',
      '点击率',
      '安装数',
      '注册数',
      '安装率',
      '注册转化率',
      '总花费（USD）',
      'CPA（USD）',
      'CPI（USD）',
    ]);
    expect(screen.getByText('如何阅读此报表')).toBeInTheDocument();
    expect(screen.getByText('今日数据是临时值，每隔 15 分钟刷新一次。')).toBeInTheDocument();
  });
});
