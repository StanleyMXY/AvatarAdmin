import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch, XLSX_TYPE } from '../../../tests/httpStubs';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub, setTestAccess } from '../../../tests/stubs/umi-max';
import { withTimeZone } from '../../../tests/withTimeZone';
import access from '../../access';
import { resetSessionState, setToken } from '../../request/session';
import type { StatDailyRow } from '../../services/stats/types';
import AnalyticsPage from './analytics';

const NOW = '2026-10-26T20:00:00Z';

const as = (permissions: string[]) =>
  setTestAccess(
    access({ me: { superAdmin: false, permissions } }) as unknown as Record<string, unknown>,
  );

beforeEach(() => {
  resetUmiStub();
  resetSessionState();
  sessionStorage.clear();
  localStorage.clear();
  setToken('tok');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  as(['STATS:VIEW']);
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:x');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Only the columns this page reads; the rest of a daily row is not its business.
const drow = (statDate: string, over: Partial<StatDailyRow> = {}): StatDailyRow =>
  ({
    statDate,
    sessionsConnected: 10,
    accountsWithCall: 4,
    callSecondsTotal: 6000,
    ...over,
  }) as StatDailyRow;

type Backend = {
  rows?: (n: number, query: URLSearchParams) => StatDailyRow[] | Promise<StatDailyRow[]>;
  failWith?: { status: number; code: string };
};

const backend = (options: Backend = {}) => {
  let n = 0;
  return stubFetch(async ({ url }) => {
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/admin/stats/daily') {
      if (options.failWith) {
        return jsonResponse(
          options.failWith.status,
          envelope(options.failWith.code, null, 'raw backend words'),
        );
      }
      n += 1;
      const rows = await (options.rows?.(n, u.searchParams) ?? []);
      return jsonResponse(200, envelope('200', { items: rows }));
    }
    if (u.pathname.startsWith('/api/admin/stats/land/'))
      return jsonResponse(200, envelope('200', null));
    if (u.pathname.startsWith('/api/admin/stats/export/'))
      return new Response(Uint8Array.from([80, 75, 3, 4]), {
        status: 200,
        headers: { 'content-type': XLSX_TYPE },
      });
    return jsonResponse(404, envelope('RESOURCE_NOT_FOUND'));
  });
};

const dailyCalls = (calls: { url: string }[]) =>
  calls.filter((c) => c.url.startsWith('/api/admin/stats/daily'));
const bodyRows = () => document.querySelectorAll('.ant-table-tbody tr.ant-table-row');
const headerTexts = () =>
  [...document.querySelectorAll('.ant-table-thead th')].map((h) => h.textContent ?? '');
const cellsOf = (r: Element) => [...r.querySelectorAll('td')].map((td) => td.textContent);
const chartData = () =>
  JSON.parse(screen.getByTestId('chart-line').textContent ?? '[]') as {
    statDate: string;
    series: string;
    value: number | null;
  }[];
const chartConfig = () =>
  JSON.parse(screen.getByTestId('chart-line').getAttribute('data-config') ?? '{}') as {
    colorField?: string;
    axis?: { x?: { title?: string }; y?: { title?: string } };
  };
const seriesOf = (label: string) => chartData().filter((d) => d.series === label);

const ready = async (rows: Backend['rows'] = () => [drow('2026-10-26')]) => {
  const calls = backend({ rows });
  renderPage(<AnalyticsPage />);
  await screen.findByTestId('chart-line');
  await waitFor(() => expect(bodyRows().length).toBeGreaterThan(0));
  return calls;
};

describe('the call analytics page: what it asks for', () => {
  it('says the statistics day is UTC and reads the last seven UTC days of platform ALL', async () => {
    const calls = backend({ rows: () => [drow('2026-10-26')] });
    renderPage(<AnalyticsPage />);
    expect(screen.getByText(/Statistics days are UTC days/)).toBeInTheDocument();
    await waitFor(() => expect(dailyCalls(calls)).toHaveLength(1));
    expect(dailyCalls(calls)[0].url).toBe(
      '/api/admin/stats/daily?from=2026-10-20&to=2026-10-26&platform=ALL',
    );
  });

  it('reads the UTC day even where the local date is already the next day', async () => {
    await withTimeZone('Pacific/Auckland', async () => {
      const calls = backend({ rows: () => [] });
      renderPage(<AnalyticsPage />);
      await waitFor(() => expect(dailyCalls(calls)).toHaveLength(1));
      expect(dailyCalls(calls)[0].url).toContain('from=2026-10-20&to=2026-10-26');
    });
  });

  it('has a date range and no platform or channel filter', async () => {
    await ready();
    expect(document.querySelector('.ant-picker-range')).not.toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Platform' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Channel package' })).toBeNull();
  });

  it('shows what failed in the words of the error code, never the backend words', async () => {
    backend({ failWith: { status: 500, code: 'INTERNAL_ERROR' } });
    renderPage(<AnalyticsPage />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toContain('raw backend words');
    expect(alert.textContent).toMatch(/Failed to load/);
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('never lets an older answer replace a newer one', async () => {
    let releaseFirst: (rows: StatDailyRow[]) => void = () => {};
    const first = new Promise<StatDailyRow[]>((resolve) => {
      releaseFirst = resolve;
    });
    const calls = backend({
      rows: (n) => (n === 1 ? first : [drow('2026-10-26', { sessionsConnected: 77 })]),
    });
    const user = userEvent.setup();
    renderPage(<AnalyticsPage />);
    await waitFor(() => expect(dailyCalls(calls)).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(cellsOf(bodyRows()[0])[1]).toBe('77'));
    releaseFirst([drow('2026-10-26', { sessionsConnected: 11 })]);
    await new Promise((r) => setTimeout(r, 30));
    expect(cellsOf(bodyRows()[0])[1]).toBe('77');
  });
});

describe('the call analytics page: the trend chart', () => {
  it('is one chart with the five metrics of the spec as its lines, in the order of the spec', async () => {
    await ready();
    expect(screen.getAllByTestId('chart-line')).toHaveLength(1);
    expect(chartConfig().colorField).toBe('series');
    expect([...new Set(chartData().map((d) => d.series))]).toEqual([
      'Calls connected',
      'Accounts with a call',
      'Total call minutes',
      'Minutes per caller',
      'Calls per caller',
    ]);
  });

  it('names what the axes count', async () => {
    await ready();
    expect(chartConfig().axis?.y?.title).toBe('Count / minutes');
    expect(chartConfig().axis?.x?.title).toBe('Date (UTC)');
  });

  it('puts every day of the range on it: 0 for a day without a row, and a gap where a per-caller figure is not known', async () => {
    await ready(() => [
      drow('2026-10-22', { sessionsConnected: 10, accountsWithCall: 4, callSecondsTotal: 6000 }),
    ]);
    const dates = seriesOf('Calls connected').map((d) => d.statDate);
    expect(dates).toEqual([
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ]);
    expect(seriesOf('Calls connected').map((d) => d.value)).toEqual([0, 0, 10, 0, 0, 0, 0]);
    expect(seriesOf('Total call minutes').map((d) => d.value)).toEqual([0, 0, 100, 0, 0, 0, 0]);
    expect(seriesOf('Minutes per caller').map((d) => d.value)).toEqual([
      null,
      null,
      25,
      null,
      null,
      null,
      null,
    ]);
    expect(seriesOf('Calls per caller').map((d) => d.value)).toEqual([
      null,
      null,
      2.5,
      null,
      null,
      null,
      null,
    ]);
  });

  it('does not draw a column that is null as 0', async () => {
    await ready(() => [
      drow('2026-10-26', {
        sessionsConnected: null,
        accountsWithCall: null,
        callSecondsTotal: null,
      }),
    ]);
    const today = (label: string) => seriesOf(label).find((d) => d.statDate === '2026-10-26');
    expect(today('Calls connected')?.value).toBeNull();
    expect(today('Accounts with a call')?.value).toBeNull();
    expect(today('Total call minutes')?.value).toBeNull();
    expect(today('Minutes per caller')?.value).toBeNull();
  });
});

describe('the call analytics page: the detail table', () => {
  it('has the columns of the spec, one row per day, no paging and no total row', async () => {
    await ready(() => [drow('2026-10-25'), drow('2026-10-26')]);
    expect(headerTexts()).toEqual([
      'Date (UTC)',
      'Calls connected',
      'Accounts with a call',
      'Total call minutes',
      'Minutes per caller',
      'Calls per caller',
    ]);
    expect(bodyRows()).toHaveLength(2);
    expect(document.querySelector('.ant-pagination')).toBeNull();
    expect(document.querySelector('.ant-table-summary')).toBeNull();
    expect(
      document.querySelector('.ant-table-thead th.ant-table-cell-fix-start')?.textContent,
    ).toBe('Date (UTC)');
  });

  it('shows minutes as seconds / 60, minutes per caller as seconds / 60 / callers, calls per caller as calls / callers', async () => {
    await ready(() => [
      drow('2026-10-26', { sessionsConnected: 10, accountsWithCall: 4, callSecondsTotal: 6000 }),
    ]);
    expect(cellsOf(bodyRows()[0])).toEqual(['2026-10-26', '10', '4', '100', '25', '2.5']);
  });

  it('shows a dash for both per-caller figures when nobody called, and still shows a 0 as 0', async () => {
    await ready(() => [
      drow('2026-10-26', { sessionsConnected: 0, accountsWithCall: 0, callSecondsTotal: 0 }),
    ]);
    expect(cellsOf(bodyRows()[0])).toEqual(['2026-10-26', '0', '0', '0', '—', '—']);
  });

  it('shows 0 per caller when there are callers and no calls or minutes, never a dash and never negative', async () => {
    await ready(() => [
      drow('2026-10-26', { sessionsConnected: 0, accountsWithCall: 3, callSecondsTotal: 0 }),
    ]);
    expect(cellsOf(bodyRows()[0])).toEqual(['2026-10-26', '0', '3', '0', '0', '0']);
  });

  it('shows a dash for a column the backend did not give, and for a figure made from it', async () => {
    await ready(() => [
      drow('2026-10-26', { sessionsConnected: null, accountsWithCall: 4, callSecondsTotal: null }),
    ]);
    expect(cellsOf(bodyRows()[0])).toEqual(['2026-10-26', '—', '4', '—', '—', '—']);
  });

  it('shows a negative number from the backend as a dash, not a negative figure', async () => {
    await ready(() => [
      drow('2026-10-26', { sessionsConnected: -5, accountsWithCall: 4, callSecondsTotal: -600 }),
    ]);
    const cells = cellsOf(bodyRows()[0]).slice(1);
    expect(cells.some((c) => c?.includes('-'))).toBe(false);
    expect(cells).toContain('—');
  });

  it('formats the numbers for the language of the interface', async () => {
    backend({
      rows: () => [
        drow('2026-10-26', {
          sessionsConnected: 12345,
          accountsWithCall: 4,
          callSecondsTotal: 7_200_000,
        }),
      ],
    });
    renderPage(<AnalyticsPage />, 'zh-CN');
    await waitFor(() => expect(bodyRows().length).toBeGreaterThan(0));
    expect(cellsOf(bodyRows()[0])[1]).toBe('12,345');
    expect(cellsOf(bodyRows()[0])[3]).toBe('120,000');
  });
});

describe('the call analytics page: landing', () => {
  it('shows no landing bar without STATS:LAND', async () => {
    await ready();
    expect(screen.queryByRole('button', { name: 'Re-land this day' })).toBeNull();
  });

  it('lands daily-business for yesterday (UTC), reads again, and a second click sends nothing', async () => {
    as(['STATS:VIEW', 'STATS:LAND']);
    const calls = await ready();
    const button = screen.getByRole('button', { name: 'Re-land this day' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(dailyCalls(calls)).toHaveLength(2));
    expect(calls.filter((c) => c.url.includes('/stats/land/')).map((c) => c.url)).toEqual([
      '/api/admin/stats/land/daily-business?date=2026-10-25',
    ]);
  });

  it('has no export (the spec gives the call analytics page none)', async () => {
    as(['STATS:VIEW', 'STATS:EXPORT', 'STATS:LAND']);
    await ready();
    expect(screen.queryByRole('button', { name: /Export/ })).toBeNull();
  });
});
