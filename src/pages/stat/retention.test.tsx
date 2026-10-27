import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { retentionRow } from '../../../mock/_core/statData';
import { daysIn } from '../../../mock/_core/statRange';
import { envelope, jsonResponse, stubFetch, XLSX_TYPE } from '../../../tests/httpStubs';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub, setTestAccess } from '../../../tests/stubs/umi-max';
import { withTimeZone } from '../../../tests/withTimeZone';
import access from '../../access';
import { resetChannelsCache } from '../../components/ChannelSelect';
import { resetSessionState, setToken } from '../../request/session';
import type { ReactivationRow, RetentionRow } from '../../services/stats/types';
import RetentionPage from './retention';

const NOW = '2026-10-26T20:00:00Z';
const TODAY = '2026-10-26';

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

const sheet = () =>
  new Response(Uint8Array.from([80, 75, 3, 4]), {
    status: 200,
    headers: {
      'content-type': XLSX_TYPE,
      'content-disposition': 'attachment; filename="retention.xlsx"',
    },
  });

type Backend = {
  retention?: (query: URLSearchParams) => RetentionRow[];
  reactivation?: (query: URLSearchParams) => ReactivationRow[];
};

const backend = (options: Backend = {}) =>
  stubFetch(async ({ url }) => {
    const u = new URL(url, 'http://localhost');
    const q = u.searchParams;
    const days = () => daysIn(q.get('from') ?? '', q.get('to') ?? '');
    if (u.pathname === '/api/admin/channels')
      return jsonResponse(200, envelope('200', { items: [] }));
    if (u.pathname === '/api/admin/stats/retention') {
      const rows =
        options.retention?.(q) ??
        days().map((day) =>
          retentionRow(
            day,
            q.get('type') ?? 'ACTIVE',
            q.get('platform') ?? 'ALL',
            q.get('channel') ?? 'ALL',
            TODAY,
          ),
        );
      return jsonResponse(200, envelope('200', { items: rows }));
    }
    if (u.pathname === '/api/admin/stats/reactivation') {
      const silenceDays = Number(q.get('silenceDays') ?? '7');
      const rows =
        options.reactivation?.(q) ??
        days().map((statDate) => ({ statDate, silenceDays, silentUsers: 200, reactivated: 30 }));
      return jsonResponse(200, envelope('200', { items: rows }));
    }
    if (u.pathname.startsWith('/api/admin/stats/land/'))
      return jsonResponse(200, envelope('200', null));
    if (u.pathname.startsWith('/api/admin/stats/export/')) return sheet();
    return jsonResponse(404, envelope('RESOURCE_NOT_FOUND'));
  });

const callsTo = (calls: { url: string }[], path: string) =>
  calls.filter((c) => c.url.startsWith(`/api/admin/stats/${path}`));

const cohort = (cohortDate: string, over: Partial<RetentionRow> = {}): RetentionRow => ({
  cohortDate,
  retentionType: 'ACTIVE',
  platform: 'ALL',
  channelCode: 'ALL',
  cohortSize: 100,
  d1: 40,
  d3: 30,
  d5: 25,
  d7: 20,
  d14: 15,
  d21: 12,
  d30: 10,
  d60: null,
  d90: null,
  ...over,
});

const bodyRows = () => document.querySelectorAll('.ant-table-tbody tr.ant-table-row');
const headerTexts = () =>
  [...document.querySelectorAll('.ant-table-thead th')].map((h) => h.textContent ?? '');
const charts = () => screen.queryAllByTestId('chart-line');
const tab = (name: string) => screen.getByRole('tab', { name });

describe('the retention report: the page', () => {
  it('has the three tabs, active first, and says the statistics day is UTC', async () => {
    backend();
    renderPage(<RetentionPage />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Active retention',
      'Call retention',
      'Reactivation',
    ]);
    expect(tab('Active retention')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Statistics days are UTC days/)).toBeInTheDocument();
  });

  it('reads the last 30 cohort days as type ACTIVE, and CALL on the call tab', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<RetentionPage />);
    await waitFor(() => expect(callsTo(calls, 'retention')).toHaveLength(1));
    expect(callsTo(calls, 'retention')[0].url).toBe(
      '/api/admin/stats/retention?from=2026-09-27&to=2026-10-26&type=ACTIVE&platform=ALL&channel=ALL',
    );
    await user.click(tab('Call retention'));
    await waitFor(() => expect(callsTo(calls, 'retention')).toHaveLength(2));
    expect(callsTo(calls, 'retention')[1].url).toBe(
      '/api/admin/stats/retention?from=2026-09-27&to=2026-10-26&type=CALL&platform=ALL&channel=ALL',
    );
  });

  it('reads UTC days even where the local date is already the next day', async () => {
    await withTimeZone('Pacific/Auckland', async () => {
      const calls = backend();
      renderPage(<RetentionPage />);
      await waitFor(() => expect(callsTo(calls, 'retention')).toHaveLength(1));
      expect(callsTo(calls, 'retention')[0].url).toContain('to=2026-10-26');
    });
  });

  it('shows what failed in the words of the error code, never the backend words', async () => {
    stubFetch(async ({ url }) =>
      url.startsWith('/api/admin/channels')
        ? jsonResponse(200, envelope('200', { items: [] }))
        : jsonResponse(500, envelope('INTERNAL_ERROR', null, 'raw backend words')),
    );
    renderPage(<RetentionPage />);
    const text = await screen.findByText(/Failed to load/);
    expect(text.closest('.ant-alert-error')).not.toBeNull();
    expect(document.body.textContent).not.toContain('raw backend words');
  });
});

describe('the retention report: the active and call tabs', () => {
  it('shows D1, D7 and D30 by default: one chart with three lines and three columns', async () => {
    backend({ retention: () => [cohort('2026-10-01')] });
    renderPage(<RetentionPage />);
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(charts()).toHaveLength(1);
    const series = JSON.parse(charts()[0].textContent ?? '[]') as { series: string }[];
    expect([...new Set(series.map((d) => d.series))]).toEqual(['Day 1', 'Day 7', 'Day 30']);
    expect(headerTexts()).toEqual(['Sign-up day', 'Size', 'Day 1', 'Day 7', 'Day 30']);
  });

  it('offers D1, D3, D5, D7, D14, D21, D30, D60, D90 and lets them be chosen', async () => {
    backend({ retention: () => [cohort('2026-10-01')] });
    const user = userEvent.setup();
    renderPage(<RetentionPage />);
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    await user.click(screen.getByRole('combobox', { name: 'Retention days' }));
    const options = [...document.querySelectorAll('.ant-select-item-option')].map((o) =>
      o.getAttribute('title'),
    );
    expect(options).toEqual(['D1', 'D3', 'D5', 'D7', 'D14', 'D21', 'D30', 'D60', 'D90']);
    await user.click(await screen.findByTitle('D3'));
    await waitFor(() =>
      expect(headerTexts()).toEqual(['Sign-up day', 'Size', 'Day 1', 'Day 3', 'Day 7', 'Day 30']),
    );
    expect(charts()).toHaveLength(1);
    const series = JSON.parse(charts()[0].textContent ?? '[]') as { series: string }[];
    expect([...new Set(series.map((d) => d.series))]).toEqual([
      'Day 1',
      'Day 3',
      'Day 7',
      'Day 30',
    ]);
  });

  it('shows a cell that has not come yet as a dash and a real zero as 0%', async () => {
    backend({
      retention: () => [
        cohort('2026-10-25', { d1: null, d7: null, d30: null }),
        cohort('2026-10-01', { d1: 0 }),
      ],
    });
    renderPage(<RetentionPage />);
    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    expect(screen.getByTestId('cell-2026-10-25-d1')).toHaveTextContent('—');
    expect(screen.getByTestId('cell-2026-10-25-d30')).toHaveTextContent('—');
    expect(screen.getByTestId('cell-2026-10-01-d1')).toHaveTextContent('0%');
    expect(screen.getByTestId('cell-2026-10-01-d7')).toHaveTextContent('20%');
  });

  it('draws no point for a cohort without a value for that day', async () => {
    backend({ retention: () => [cohort('2026-10-25', { d1: null }), cohort('2026-10-01')] });
    renderPage(<RetentionPage />);
    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    const points = JSON.parse(charts()[0].textContent ?? '[]') as {
      cohortDate: string;
      series: string;
    }[];
    // D1 has no value for 2026-10-25, so that day is missing from the D1 line only
    expect(points.filter((d) => d.series === 'Day 1').map((d) => d.cohortDate)).toEqual([
      '2026-10-01',
    ]);
  });

  it('asks for the platform and the channel package and keeps them off the reactivation tab', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<RetentionPage />);
    expect(screen.getByRole('combobox', { name: 'Platform' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Channel package' })).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Platform' }));
    await user.click(await screen.findByTitle('Android'));
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(callsTo(calls, 'retention')).toHaveLength(2));
    expect(callsTo(calls, 'retention')[1].url).toContain('platform=ANDROID');
    await user.click(tab('Reactivation'));
    expect(screen.queryByRole('combobox', { name: 'Platform' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Channel package' })).toBeNull();
  });

  it('names the date of the landing bar "Check day" and says it fills the cells of that day, not the whole row', async () => {
    as(['STATS:VIEW', 'STATS:LAND']);
    const calls = backend();
    renderPage(<RetentionPage />);
    await waitFor(() => expect(callsTo(calls, 'retention')).toHaveLength(1));
    expect(screen.getByText('Check day (UTC)')).toBeInTheDocument();
    expect(
      screen.getByText(/fills the cells of each N that fall on that day, not the whole row/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('Date (UTC)')).toBeNull();
  });

  it('lands "retention" on the check day (yesterday in UTC), then reads the report again', async () => {
    as(['STATS:VIEW', 'STATS:LAND']);
    const calls = backend();
    renderPage(<RetentionPage />);
    await waitFor(() => expect(callsTo(calls, 'retention')).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Re-land this day' }));
    await waitFor(() => expect(callsTo(calls, 'retention')).toHaveLength(2));
    expect(callsTo(calls, 'land/').map((c) => c.url)).toEqual([
      '/api/admin/stats/land/retention?date=2026-10-25',
    ]);
  });

  it('shows no landing bar without STATS:LAND', async () => {
    backend();
    renderPage(<RetentionPage />);
    await screen.findAllByTestId('chart-line');
    expect(screen.queryByRole('button', { name: 'Re-land this day' })).toBeNull();
    expect(screen.queryByText('Check day (UTC)')).toBeNull();
  });

  it('exports "retention" with exactly the filter on screen', async () => {
    as(['STATS:VIEW', 'STATS:EXPORT']);
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<RetentionPage />);
    await waitFor(() => expect(callsTo(calls, 'retention')).toHaveLength(1));
    await user.click(tab('Call retention'));
    await waitFor(() => expect(callsTo(calls, 'retention')).toHaveLength(2));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(callsTo(calls, 'export')).toHaveLength(1));
    expect(callsTo(calls, 'export')[0].url).toBe(
      '/api/admin/stats/export/retention?from=2026-09-27&to=2026-10-26&type=CALL&platform=ALL&channel=ALL',
    );
  });

  it('shows no export without STATS:EXPORT', async () => {
    backend();
    renderPage(<RetentionPage />);
    await screen.findAllByTestId('chart-line');
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
  });
});

describe('the retention report: the reactivation tab', () => {
  const openReactivation = async () => {
    const user = userEvent.setup();
    await user.click(tab('Reactivation'));
    return user;
  };

  it('reads silence 7 by default and offers 7, 14 and 30', async () => {
    const calls = backend();
    renderPage(<RetentionPage />);
    const user = await openReactivation();
    await waitFor(() => expect(callsTo(calls, 'reactivation')).toHaveLength(1));
    expect(callsTo(calls, 'reactivation')[0].url).toBe(
      '/api/admin/stats/reactivation?from=2026-09-27&to=2026-10-26&silenceDays=7',
    );
    await user.click(screen.getByRole('combobox', { name: 'Silent days' }));
    expect(
      [...document.querySelectorAll('.ant-select-item-option')].map((o) => o.getAttribute('title')),
    ).toEqual(['7 days', '14 days', '30 days']);
    await user.click(await screen.findByTitle('30 days'));
    await waitFor(() => expect(callsTo(calls, 'reactivation')).toHaveLength(2));
    expect(callsTo(calls, 'reactivation')[1].url).toContain('silenceDays=30');
  });

  it('has the table of day, silent users, reactivated users and rate, a line and a column chart', async () => {
    backend({
      reactivation: () => [
        { statDate: '2026-10-24', silenceDays: 7, silentUsers: 200, reactivated: 30 },
        { statDate: '2026-10-25', silenceDays: 7, silentUsers: 0, reactivated: 0 },
      ],
    });
    renderPage(<RetentionPage />);
    await openReactivation();
    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    expect(headerTexts()).toEqual([
      'Day (UTC)',
      'Silent users',
      'Reactivated users',
      'Reactivation rate',
    ]);
    const cells = (row: Element) => [...row.querySelectorAll('td')].map((td) => td.textContent);
    expect(cells(bodyRows()[0])).toEqual(['2026-10-24', '200', '30', '15%']);
    // nobody was silent: no rate (not 0%, not NaN)
    expect(cells(bodyRows()[1])).toEqual(['2026-10-25', '0', '0', '—']);
    expect(screen.getAllByTestId('chart-line')).toHaveLength(1);
    expect(screen.getAllByTestId('chart-column')).toHaveLength(1);
  });

  it('leaves a day without a rate as a gap in the line, not as 0', async () => {
    backend({
      reactivation: () => [
        { statDate: '2026-10-24', silenceDays: 7, silentUsers: 200, reactivated: 30 },
        { statDate: '2026-10-25', silenceDays: 7, silentUsers: 0, reactivated: 0 },
      ],
    });
    renderPage(<RetentionPage />);
    await openReactivation();
    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    const line = JSON.parse(screen.getByTestId('chart-line').textContent ?? '[]') as {
      statDate: string;
      rate: number | null;
    }[];
    expect(line.find((d) => d.statDate === '2026-10-24')?.rate).toBeCloseTo(0.15);
    expect(line.find((d) => d.statDate === '2026-10-25')?.rate).toBeNull();
  });

  it('puts every day of the range on the charts: 0 users and no rate for a day the backend sent no row for', async () => {
    backend({
      reactivation: () => [
        { statDate: '2026-10-10', silenceDays: 7, silentUsers: 100, reactivated: 20 },
      ],
    });
    renderPage(<RetentionPage />);
    await openReactivation();
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    const line = JSON.parse(screen.getByTestId('chart-line').textContent ?? '[]') as {
      statDate: string;
      rate: number | null;
    }[];
    const column = JSON.parse(screen.getByTestId('chart-column').textContent ?? '[]') as {
      statDate: string;
      reactivated: number;
    }[];
    expect(line).toHaveLength(30);
    expect(column).toHaveLength(30);
    expect(column.find((d) => d.statDate === '2026-10-10')?.reactivated).toBe(20);
    expect(column.find((d) => d.statDate === '2026-10-11')?.reactivated).toBe(0);
    expect(line.find((d) => d.statDate === '2026-10-11')?.rate).toBeNull();
    expect(line[0].statDate).toBe('2026-09-27');
    expect(line[29].statDate).toBe('2026-10-26');
    // the table shows only what the backend sent
    expect(bodyRows()).toHaveLength(1);
  });

  it('lands "reactivation" with a plain date label', async () => {
    as(['STATS:VIEW', 'STATS:LAND']);
    const calls = backend();
    renderPage(<RetentionPage />);
    await openReactivation();
    await waitFor(() => expect(callsTo(calls, 'reactivation')).toHaveLength(1));
    expect(screen.getByText('Date (UTC)')).toBeInTheDocument();
    expect(screen.queryByText('Check day (UTC)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Re-land this day' }));
    await waitFor(() => expect(callsTo(calls, 'reactivation')).toHaveLength(2));
    expect(callsTo(calls, 'land/').map((c) => c.url)).toEqual([
      '/api/admin/stats/land/reactivation?date=2026-10-25',
    ]);
  });

  it('exports "reactivation" with the range and the silent days, and no platform or channel', async () => {
    as(['STATS:VIEW', 'STATS:EXPORT']);
    const calls = backend();
    renderPage(<RetentionPage />);
    const user = await openReactivation();
    await waitFor(() => expect(callsTo(calls, 'reactivation')).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(callsTo(calls, 'export')).toHaveLength(1));
    expect(callsTo(calls, 'export')[0].url).toBe(
      '/api/admin/stats/export/reactivation?from=2026-09-27&to=2026-10-26&silenceDays=7',
    );
  });
});

describe('the retention report: the "how to read this report" panel', () => {
  it('is shown on the retention tabs with the cohort definition and what Day N means', async () => {
    backend();
    renderPage(<RetentionPage />);
    expect(screen.getByText('How to read this report')).toBeInTheDocument();
    expect(screen.getByText(/day the account was registered/i)).toBeInTheDocument();
    expect(screen.getByText(/exactly day N/i)).toBeInTheDocument();
    expect(
      screen.getByText(/events the backend produces itself .* do not count/i),
    ).toBeInTheDocument();
  });

  it('can be closed, stays closed after a reload, and is kept apart from the reactivation panel', async () => {
    backend();
    const user = userEvent.setup();
    const { unmount } = renderPage(<RetentionPage />);
    await user.click(
      within(
        screen.getByText('How to read this report').closest('.ant-alert') as HTMLElement,
      ).getByRole('button', { name: /close/i }),
    );
    expect(screen.queryByText('How to read this report')).toBeNull();
    expect(localStorage.getItem('reportHelper:retention')).toBe('1');
    unmount();
    renderPage(<RetentionPage />);
    expect(screen.queryByText('How to read this report')).toBeNull();
    await user.click(tab('Reactivation'));
    expect(screen.getByText('How to read this report')).toBeInTheDocument();
    expect(screen.getByText(/Silent users are accounts registered before/)).toBeInTheDocument();
    // the other way round: closing this one leaves the retention panel as it was
    await user.click(
      within(
        screen.getByText('How to read this report').closest('.ant-alert') as HTMLElement,
      ).getByRole('button', { name: /close/i }),
    );
    expect(localStorage.getItem('reportHelper:reactivation')).toBe('1');
    await user.click(tab('Active retention'));
    expect(screen.queryByText('How to read this report')).toBeNull();
  });
});
