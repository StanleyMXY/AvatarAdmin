import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dailyRow } from '../../../mock/_core/statData';
import { daysIn } from '../../../mock/_core/statRange';
import { envelope, jsonResponse, stubFetch, XLSX_TYPE } from '../../../tests/httpStubs';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub, setTestAccess } from '../../../tests/stubs/umi-max';
import { withTimeZone } from '../../../tests/withTimeZone';
import access from '../../access';
import { resetChannelsCache } from '../../components/ChannelSelect';
import { resetSessionState, setToken } from '../../request/session';
import type { StatDailyRow } from '../../services/stats/types';
import DailyPage from './daily';

const NOW = '2026-10-26T20:00:00Z';
const TODAY = '2026-10-26';

const channels = [
  {
    channelCode: 'play',
    name: 'Android store',
    platform: 'ANDROID',
    distribution: 'STORE',
    packageName: 'a.b',
    enabled: true,
    createdAt: null,
  },
];

const as = (permissions: string[], superAdmin = false) =>
  setTestAccess(access({ me: { superAdmin, permissions } }) as unknown as Record<string, unknown>);

beforeEach(() => {
  resetUmiStub();
  resetSessionState();
  resetChannelsCache();
  sessionStorage.clear();
  localStorage.clear();
  setToken('tok');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  as(['STATS:VIEW']);
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:x');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Backend = {
  /** Rows to answer `/stats/daily` with; by default one row per asked day from the mock numbers. */
  rows?: (query: URLSearchParams) => StatDailyRow[];
  failWith?: { status: number; code: string };
};

const sheet = () =>
  new Response(Uint8Array.from([80, 75, 3, 4]), {
    status: 200,
    headers: {
      'content-type': XLSX_TYPE,
      'content-disposition': 'attachment; filename="daily.xlsx"',
    },
  });

const backend = (options: Backend = {}) =>
  stubFetch(async ({ url }) => {
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/admin/channels')
      return jsonResponse(200, envelope('200', { items: channels }));
    if (u.pathname === '/api/admin/stats/daily') {
      if (options.failWith) {
        return jsonResponse(
          options.failWith.status,
          envelope(options.failWith.code, null, 'raw backend words'),
        );
      }
      const q = u.searchParams;
      const rows =
        options.rows?.(q) ??
        daysIn(q.get('from') ?? '', q.get('to') ?? '').map(
          (day) =>
            dailyRow(day, q.get('platform') ?? 'ALL', q.get('channel') ?? 'ALL', TODAY) as unknown,
        );
      return jsonResponse(200, envelope('200', { items: rows }));
    }
    if (u.pathname.startsWith('/api/admin/stats/land/'))
      return jsonResponse(200, envelope('200', null));
    if (u.pathname.startsWith('/api/admin/stats/export/')) return sheet();
    return jsonResponse(404, envelope('RESOURCE_NOT_FOUND'));
  });

const dailyCalls = (calls: { url: string }[]) =>
  calls.filter((c) => c.url.startsWith('/api/admin/stats/daily'));

const full = (over: Partial<StatDailyRow>): StatDailyRow => ({
  ...(dailyRow('2026-10-26', 'ALL', 'ALL', '2099-01-01') as unknown as StatDailyRow),
  ...over,
});

const chartData = () =>
  JSON.parse(screen.getByTestId('chart-line').textContent ?? '[]') as {
    statDate: string;
    series: string;
    value: number | null;
  }[];
const seriesOf = () => [...new Set(chartData().map((d) => d.series))];

const openDetail = async (user = userEvent.setup()) => {
  await user.click(await screen.findByRole('tab', { name: 'Data detail' }));
};
const optionOf = (title: string) =>
  [...document.querySelectorAll('.ant-select-item-option')].find(
    (o) => o.getAttribute('title') === title,
  ) as HTMLElement | undefined;
const bodyRows = () => document.querySelectorAll('.ant-table-tbody tr.ant-table-row');
const headerTexts = () =>
  [...document.querySelectorAll('.ant-table-thead th')].map((h) => h.textContent ?? '');

describe('the daily report: the page', () => {
  it('says the statistics day is UTC, reads the last seven UTC days and starts on the trend chart', async () => {
    const calls = backend();
    renderPage(<DailyPage />);
    expect(screen.getByText(/Statistics days are UTC days/)).toBeInTheDocument();
    await waitFor(() => expect(dailyCalls(calls)).toHaveLength(1));
    expect(dailyCalls(calls)[0].url).toBe(
      '/api/admin/stats/daily?from=2026-10-20&to=2026-10-26&platform=ALL&channel=ALL',
    );
    expect(screen.getByRole('tab', { name: 'Trend chart' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Data detail' })).toBeInTheDocument();
    expect(await screen.findByTestId('chart-line')).toBeInTheDocument();
  });

  it('reads the UTC day even where the local date is already the next day', async () => {
    await withTimeZone('Pacific/Auckland', async () => {
      const calls = backend();
      renderPage(<DailyPage />);
      await waitFor(() => expect(dailyCalls(calls)).toHaveLength(1));
      expect(dailyCalls(calls)[0].url).toContain('to=2026-10-26');
      expect(dailyCalls(calls)[0].url).toContain('from=2026-10-20');
    });
  });

  it('takes the channel packages from the channel list of the backend', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<DailyPage />);
    await waitFor(() => expect(calls.some((c) => c.url === '/api/admin/channels')).toBe(true));
    await user.click(screen.getByRole('combobox', { name: 'Channel package' }));
    expect(await screen.findByTitle('play · Android store')).toBeInTheDocument();
  });

  it('shows what failed in the words of the error code, never the backend words', async () => {
    backend({ failWith: { status: 500, code: 'INTERNAL_ERROR' } });
    renderPage(<DailyPage />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toContain('raw backend words');
    expect(alert.textContent).toMatch(/Failed to load/);
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('only changes what it asks for when Search is pressed, not when a filter is picked', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<DailyPage />);
    await waitFor(() => expect(dailyCalls(calls)).toHaveLength(1));
    await user.click(screen.getByRole('combobox', { name: 'Platform' }));
    await user.click(await screen.findByTitle('Android'));
    expect(dailyCalls(calls)).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(dailyCalls(calls)).toHaveLength(2));
    expect(dailyCalls(calls)[1].url).toContain('platform=ANDROID');
  });
});

describe('the daily report: the trend chart', () => {
  it('draws daily active accounts and new accounts by default', async () => {
    backend();
    renderPage(<DailyPage />);
    await screen.findByTestId('chart-line');
    await waitFor(() => expect(seriesOf()).toEqual(['DAU', 'New accounts']));
  });

  it('lets the metrics be chosen: an added metric is drawn, a removed one is not', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<DailyPage />);
    await waitFor(() => expect(seriesOf()).toEqual(['DAU', 'New accounts']));
    await user.click(screen.getByRole('combobox', { name: 'Metrics' }));
    await waitFor(() => expect(optionOf('Calls connected')).toBeDefined());
    await user.click(optionOf('Calls connected') as HTMLElement);
    await waitFor(() => expect(seriesOf()).toContain('Calls connected'));
    const tag = [...document.querySelectorAll('.ant-select-selection-item')].find(
      (el) => el.getAttribute('title') === 'DAU',
    ) as HTMLElement;
    fireEvent.click(tag.querySelector('.ant-select-selection-item-remove') as HTMLElement);
    await waitFor(() => expect(seriesOf()).not.toContain('DAU'));
    expect(seriesOf()).toContain('Calls connected');
  });

  it('puts every day of the range on the chart, 0 for a day the backend sent no row for', async () => {
    backend({
      rows: () => [full({ statDate: '2026-10-22', dau: 700, newAccountsRegistered: 50 })],
    });
    renderPage(<DailyPage />);
    await waitFor(() => {
      expect(chartData().filter((d) => d.series === 'DAU')).toHaveLength(7);
    });
    const dau = chartData().filter((d) => d.series === 'DAU');
    expect(dau.map((d) => d.statDate)).toEqual([
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ]);
    expect(dau.map((d) => d.value)).toEqual([0, 0, 700, 0, 0, 0, 0]);
  });

  it('does not offer the business metrics for a platform that has none, and draws only the rest', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<DailyPage />);
    await waitFor(() => expect(seriesOf()).toEqual(['DAU', 'New accounts']));
    await user.click(screen.getByRole('combobox', { name: 'Platform' }));
    await user.click(await screen.findByTitle('iOS'));
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(seriesOf()).toEqual(['DAU']));
    await user.click(screen.getByRole('combobox', { name: 'Metrics' }));
    await waitFor(() => expect(optionOf('New accounts')).toBeDefined());
    expect(optionOf('New accounts')?.className).toContain('ant-select-item-option-disabled');
    expect(optionOf('DAU')?.className).not.toContain('ant-select-item-option-disabled');
  });
});

describe('the daily report: the detail table', () => {
  it('is one row per day with no paging, and the date column fixed on the left', async () => {
    backend();
    renderPage(<DailyPage />);
    await openDetail();
    await waitFor(() => expect(bodyRows()).toHaveLength(7));
    expect(document.querySelector('.ant-pagination')).toBeNull();
    expect(headerTexts()[0]).toBe('Date (UTC)');
    expect(
      document.querySelector('.ant-table-thead th.ant-table-cell-fix-start')?.textContent,
    ).toBe('Date (UTC)');
    expect(document.querySelector('.ant-table-tbody td.ant-table-cell-fix-start')).not.toBeNull();
  });

  it('has the columns of the spec', async () => {
    backend();
    renderPage(<DailyPage />);
    await openDetail();
    await waitFor(() => expect(bodyRows()).toHaveLength(7));
    expect(headerTexts()).toEqual([
      'Date (UTC)',
      'DAU',
      'WAU',
      'MAU',
      'Device DAU',
      'New accounts',
      'New guest devices',
      'Guest devices signed up',
      'Accounts that created an avatar',
      'Accounts that cloned a voice',
      'Accounts that started a call',
      'Calls connected',
      'Accounts with a call',
      'Call minutes',
      'Minutes per caller',
      'User messages',
      'Assistant messages',
      'New subscriptions',
      'Active subscriptions',
      'Credit purchases',
      'Credits spent',
      'Guest calls connected',
      'Guest call minutes',
    ]);
  });

  it('has no total, no sum row and no sum card: weekly and monthly actives cannot be added over days', async () => {
    backend();
    renderPage(<DailyPage />);
    await openDetail();
    await waitFor(() => expect(bodyRows()).toHaveLength(7));
    expect(document.querySelector('.ant-table-summary')).toBeNull();
    expect(document.querySelector('.ant-statistic')).toBeNull();
    expect(document.querySelector('.ant-card')).toBeNull();
    const everyDate = [...bodyRows()].map((r) => r.querySelector('td')?.textContent);
    expect(everyDate).toEqual([
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ]);
    expect(headerTexts().some((h) => /^(total|sum)$/i.test(h) || h.includes('合计'))).toBe(false);
  });

  it('shows minutes per caller as call seconds / 60 / callers, and a dash when nobody called', async () => {
    backend({
      rows: () => [
        full({ statDate: '2026-10-25', callSecondsTotal: 6000, accountsWithCall: 4 }),
        full({ statDate: '2026-10-26', callSecondsTotal: 0, accountsWithCall: 0 }),
      ],
    });
    renderPage(<DailyPage />);
    await openDetail();
    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    const index = headerTexts().indexOf('Minutes per caller');
    const cells = (r: Element) => [...r.querySelectorAll('td')].map((td) => td.textContent);
    expect(cells(bodyRows()[0])[index]).toBe('25');
    expect(cells(bodyRows()[1])[index]).toBe('—');
    expect(cells(bodyRows()[0])[headerTexts().indexOf('Call minutes')]).toBe('100');
  });

  it('shows a dash for a missing active-subscription count and marks a back-filled one', async () => {
    backend({
      rows: () => [
        full({
          statDate: '2026-10-24',
          activeSubscriptions: 1100,
          activeSubscriptionsBackfilled: true,
        }),
        full({
          statDate: '2026-10-25',
          activeSubscriptions: 1200,
          activeSubscriptionsBackfilled: false,
        }),
        full({
          statDate: '2026-10-26',
          activeSubscriptions: null,
          activeSubscriptionsBackfilled: null,
        }),
      ],
    });
    renderPage(<DailyPage />);
    await openDetail();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));
    const index = headerTexts().indexOf('Active subscriptions');
    const cell = (row: number) => bodyRows()[row].querySelectorAll('td')[index];
    expect(cell(0).textContent).toContain('1,100');
    expect(within(cell(0) as HTMLElement).getByText('Back-filled')).toBeInTheDocument();
    expect(cell(1).textContent).toBe('1,200');
    expect(cell(2).textContent).toBe('—');
  });

  it('puts a hint icon on the seven metrics of the spec, with the definition', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<DailyPage />);
    await openDetail(user);
    await waitFor(() => expect(bodyRows()).toHaveLength(7));
    const icons = document.querySelectorAll('.ant-table-thead [data-testid^="tip-"]');
    expect([...icons].map((i) => i.getAttribute('data-testid'))).toEqual([
      'tip-dau',
      'tip-wau',
      'tip-mau',
      'tip-dauDevices',
      'tip-guestDevicesNew',
      'tip-sessionsConnected',
      'tip-activeSubscriptions',
    ]);
    await user.hover(
      document.querySelector('.ant-table-thead [data-testid="tip-dau"]') as HTMLElement,
    );
    expect(
      await screen.findByText(/any client event.*events the backend produces itself do not count/i),
    ).toBeInTheDocument();
    await user.hover(
      document.querySelector('.ant-table-thead [data-testid="tip-guestDevicesNew"]') as HTMLElement,
    );
    expect(
      await screen.findByText(/reinstalling the app creates a new device/i),
    ).toBeInTheDocument();
    await user.hover(
      document.querySelector(
        '.ant-table-thead [data-testid="tip-sessionsConnected"]',
      ) as HTMLElement,
    );
    expect(
      await screen.findByText(/accounts only.*guest calls have their own column/i),
    ).toBeInTheDocument();
  });

  it('for a platform other than All: every business cell is a dash and the header says the metrics have no platform dimension', async () => {
    const calls = backend({
      // the backend sends null for them; a number that sneaks in must not be shown either
      rows: () => [
        full({ statDate: '2026-10-26', platform: 'ANDROID', newAccountsRegistered: 99 }),
      ],
    });
    const user = userEvent.setup();
    renderPage(<DailyPage />);
    await openDetail(user);
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(screen.queryByText(/These metrics have no platform dimension/)).toBeNull();
    await user.click(screen.getByRole('combobox', { name: 'Platform' }));
    await user.click(await screen.findByTitle('Android'));
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText(/These metrics have no platform dimension/)).toBeInTheDocument();
    await waitFor(() => expect(dailyCalls(calls)).toHaveLength(2));
    const heads = headerTexts();
    const row = [...bodyRows()[0].querySelectorAll('td')].map((td) => td.textContent);
    for (const title of [
      'New accounts',
      'New guest devices',
      'Guest devices signed up',
      'Calls connected',
      'Accounts with a call',
      'Call minutes',
      'Minutes per caller',
      'User messages',
      'Assistant messages',
      'New subscriptions',
      'Active subscriptions',
      'Credit purchases',
      'Credits spent',
      'Guest calls connected',
      'Guest call minutes',
    ]) {
      expect(row[heads.indexOf(title)], title).toBe('—');
    }
    expect(row[heads.indexOf('DAU')]).not.toBe('—');
    expect(row[heads.indexOf('Accounts that started a call')]).not.toBe('—');
  });

  it('for All: the business numbers are shown and there is no such note', async () => {
    backend();
    renderPage(<DailyPage />);
    await openDetail();
    await waitFor(() => expect(bodyRows()).toHaveLength(7));
    expect(screen.queryByText(/These metrics have no platform dimension/)).toBeNull();
    const index = headerTexts().indexOf('New accounts');
    const value = bodyRows()[0].querySelectorAll('td')[index].textContent;
    expect(value).not.toBe('—');
    expect(value).toMatch(/^\d/);
  });
});

describe('the daily report: landing and export', () => {
  it('shows no landing bar without STATS:LAND', async () => {
    backend();
    renderPage(<DailyPage />);
    await screen.findByTestId('chart-line');
    expect(screen.queryByRole('button', { name: 'Re-land this day' })).toBeNull();
  });

  it('lands both the event and the business summary of the chosen day, then reads the report again', async () => {
    as(['STATS:VIEW', 'STATS:LAND']);
    const calls = backend();
    renderPage(<DailyPage />);
    await waitFor(() => expect(dailyCalls(calls)).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Re-land this day' }));
    await waitFor(() => expect(dailyCalls(calls)).toHaveLength(2));
    const lands = calls.filter((c) => c.url.includes('/stats/land/'));
    expect(lands.map((c) => c.url)).toEqual([
      '/api/admin/stats/land/daily-event?date=2026-10-25',
      '/api/admin/stats/land/daily-business?date=2026-10-25',
    ]);
  });

  it('shows no export without STATS:EXPORT', async () => {
    backend();
    renderPage(<DailyPage />);
    await screen.findByTestId('chart-line');
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
  });

  it('exports as "daily" with exactly the filter on screen, not the one being edited', async () => {
    as(['STATS:VIEW', 'STATS:EXPORT']);
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<DailyPage />);
    await waitFor(() => expect(dailyCalls(calls)).toHaveLength(1));
    // an edit that has not been searched yet
    await user.click(screen.getByRole('combobox', { name: 'Platform' }));
    await user.click(await screen.findByTitle('iOS'));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/stats/export/'))).toBe(true));
    expect(calls.find((c) => c.url.includes('/stats/export/'))?.url).toBe(
      '/api/admin/stats/export/daily?from=2026-10-20&to=2026-10-26&platform=ALL&channel=ALL',
    );
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(dailyCalls(calls)).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole('button', { name: /Export/ })).not.toBeDisabled());
    await user.click(screen.getByRole('button', { name: /Export/ }));
    await waitFor(() =>
      expect(calls.filter((c) => c.url.includes('/stats/export/'))).toHaveLength(2),
    );
    expect(calls.filter((c) => c.url.includes('/stats/export/'))[1].url).toBe(
      '/api/admin/stats/export/daily?from=2026-10-20&to=2026-10-26&platform=IOS&channel=ALL',
    );
  });
});
