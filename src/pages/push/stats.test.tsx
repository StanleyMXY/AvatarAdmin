import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { daysIn } from '../../../mock/_core/statRange';
import { envelope, jsonResponse, stubFetch, XLSX_TYPE } from '../../../tests/httpStubs';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub, setTestAccess } from '../../../tests/stubs/umi-max';
import { withTimeZone } from '../../../tests/withTimeZone';
import access from '../../access';
import { resetSessionState, setToken } from '../../request/session';
import type { PushStatRow } from '../../services/stats';
import StatsPage from './stats';

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
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const row = (
  statDate: string,
  triggerReason: string,
  over: Partial<PushStatRow> = {},
): PushStatRow => ({
  statDate,
  triggerReason,
  pushesSent: 200,
  deliveriesOk: 180,
  deliveriesFailed: 20,
  pushesOpened: 50,
  ...over,
});

const sheet = () =>
  new Response(Uint8Array.from([80, 75, 3, 4]), {
    status: 200,
    headers: {
      'content-type': XLSX_TYPE,
      'content-disposition': 'attachment; filename="push.xlsx"',
    },
  });

type Backend = {
  rows?: (q: URLSearchParams) => PushStatRow[];
  fail?: { status: number; code: string };
};

/** Two rows a day, one for each of two reasons, unless the test says otherwise. */
const backend = (options: Backend = {}) =>
  stubFetch(async ({ url }) => {
    const u = new URL(url, 'http://localhost');
    const q = u.searchParams;
    if (u.pathname === '/api/admin/stats/push') {
      if (options.fail) {
        return jsonResponse(
          options.fail.status,
          envelope(options.fail.code, null, 'raw backend words'),
        );
      }
      const days = daysIn(q.get('from') ?? '', q.get('to') ?? '');
      const only = q.get('triggerReason');
      const rows =
        options.rows?.(q) ??
        days.flatMap((d) =>
          ['daily_recall', 'streak_at_risk']
            .filter((r) => !only || r === only)
            .map((r) => row(d, r)),
        );
      return jsonResponse(200, envelope('200', { items: rows }));
    }
    if (u.pathname.startsWith('/api/admin/stats/land/'))
      return jsonResponse(200, envelope('200', null));
    if (u.pathname.startsWith('/api/admin/stats/export/')) return sheet();
    return jsonResponse(404, envelope('RESOURCE_NOT_FOUND'));
  });

const callsTo = (calls: { url: string }[], path: string) =>
  calls.filter((c) => c.url.startsWith(`/api/admin/stats/${path}`));
const bodyRows = () => [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')];
const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');
const chartData = () =>
  JSON.parse(screen.getByTestId('chart-line').textContent ?? '[]') as {
    statDate: string;
    series: string;
    value: number | null;
  }[];

describe('the push result page: reading', () => {
  it('says the day is UTC and reads the last seven UTC days, also where the local date is the next day', async () => {
    await withTimeZone('Pacific/Auckland', async () => {
      const calls = backend();
      renderPage(<StatsPage />);
      expect(screen.getByText(/Statistics days are UTC days/)).toBeInTheDocument();
      await waitFor(() => expect(callsTo(calls, 'push')).toHaveLength(1));
      expect(callsTo(calls, 'push')[0].url).toBe(
        '/api/admin/stats/push?from=2026-10-20&to=2026-10-26',
      );
    });
  });

  it('shows one chart and the table together, with a row for each day and trigger reason', async () => {
    backend();
    renderPage(<StatsPage />);
    await screen.findByTestId('chart-line');
    expect(screen.getAllByTestId('chart-line')).toHaveLength(1);
    await waitFor(() => expect(bodyRows()).toHaveLength(14));
    expect(cellsOf(bodyRows()[0]).slice(0, 2)).toEqual(['2026-10-20', 'Daily recall']);
    expect(cellsOf(bodyRows()[1]).slice(0, 2)).toEqual(['2026-10-20', 'Streak at risk']);
  });

  it('has date, reason, sent, accepted, failed, opened and the open rate, in that order, and no total row', async () => {
    backend();
    renderPage(<StatsPage />);
    await waitFor(() => expect(bodyRows()).toHaveLength(14));
    const heads = [...document.querySelectorAll('.ant-table-thead th')].map(
      (h) => h.textContent ?? '',
    );
    expect(heads).toEqual([
      'Date (UTC)',
      'Trigger reason',
      'Sent',
      'Accepted',
      'Failed',
      'Opened',
      'Open rate',
    ]);
    expect(cellsOf(bodyRows()[0])).toEqual([
      '2026-10-20',
      'Daily recall',
      '200',
      '180',
      '20',
      '50',
      '25%',
    ]);
    expect(document.body.textContent).not.toMatch(/Total/i);
  });

  it('draws one chart with four lines, the counts of the reasons of a day added up, and 0 for a day with no row', async () => {
    backend({
      rows: () => [
        row('2026-10-25', 'daily_recall', {
          pushesSent: 100,
          deliveriesOk: 90,
          deliveriesFailed: 10,
          pushesOpened: 20,
        }),
        row('2026-10-25', 'admin', {
          pushesSent: 40,
          deliveriesOk: 38,
          deliveriesFailed: 2,
          pushesOpened: 4,
        }),
      ],
    });
    renderPage(<StatsPage />);
    await screen.findByTestId('chart-line');
    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    const data = chartData();
    expect([...new Set(data.map((d) => d.series))]).toEqual([
      'Sent',
      'Accepted',
      'Failed',
      'Opened',
    ]);
    const at = (series: string, day: string) =>
      data.find((d) => d.series === series && d.statDate === day)?.value;
    expect(at('Sent', '2026-10-25')).toBe(140);
    expect(at('Accepted', '2026-10-25')).toBe(128);
    expect(at('Failed', '2026-10-25')).toBe(12);
    expect(at('Opened', '2026-10-25')).toBe(24);
    // all seven days are on the axis; a day with no row is 0
    expect(data.filter((d) => d.series === 'Sent')).toHaveLength(7);
    expect(at('Sent', '2026-10-22')).toBe(0);
  });

  it('draws the chart theme-aware with a line chart (not a bar or a pie)', async () => {
    backend();
    renderPage(<StatsPage />);
    expect(await screen.findByTestId('chart-line')).toBeInTheDocument();
    expect(screen.queryByTestId('chart-column')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chart-pie')).not.toBeInTheDocument();
  });

  it('says there is nothing in a range with no rows, and still draws the chart with zeros', async () => {
    backend({ rows: () => [] });
    renderPage(<StatsPage />);
    expect(await screen.findByText('No push results in this range.')).toBeInTheDocument();
    expect(chartData().every((d) => d.value === 0)).toBe(true);
  });

  it('shows what failed in the words of the error code, never the backend words, with a retry', async () => {
    backend({ fail: { status: 500, code: 'INTERNAL_ERROR' } });
    renderPage(<StatsPage />);
    const text = await screen.findByText(/Failed to load/);
    expect(text.closest('.ant-alert-error')).not.toBeNull();
    expect(document.body.textContent).not.toContain('raw backend words');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('the push result page: the open rate', () => {
  it('is opened over sent; a dash when nothing was sent; 0% for a real zero; above 100% as it is', async () => {
    backend({
      rows: () => [
        row('2026-10-26', 'daily_recall', { pushesSent: 200, pushesOpened: 50 }),
        row('2026-10-25', 'daily_recall', {
          pushesSent: 0,
          deliveriesOk: 0,
          deliveriesFailed: 0,
          pushesOpened: 7,
        }),
        row('2026-10-24', 'daily_recall', { pushesSent: 40, pushesOpened: 0 }),
        row('2026-10-23', 'daily_recall', { pushesSent: 10, pushesOpened: 15 }),
        row('2026-10-22', 'daily_recall', {
          pushesSent: 0,
          deliveriesOk: 0,
          deliveriesFailed: 0,
          pushesOpened: 0,
        }),
      ],
    });
    renderPage(<StatsPage />);
    await waitFor(() => expect(bodyRows()).toHaveLength(5));
    const rate = (i: number) => cellsOf(bodyRows()[i])[6];
    expect([0, 1, 2, 3, 4].map(rate)).toEqual(['25%', '—', '0%', '150%', '—']);
  });

  it('shows a dash for a count that is missing or not a number, never NaN or null', async () => {
    backend({
      rows: () => [
        {
          statDate: '2026-10-26',
          triggerReason: 'admin',
          pushesSent: null,
          deliveriesOk: 'many',
          deliveriesFailed: undefined,
          pushesOpened: null,
        } as unknown as PushStatRow,
      ],
    });
    renderPage(<StatsPage />);
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(cellsOf(bodyRows()[0])).toEqual([
      '2026-10-26',
      'Sent by an administrator',
      '—',
      '—',
      '—',
      '—',
      '—',
    ]);
    expect(document.body.textContent).not.toMatch(/NaN|null|undefined/);
  });

  it('says in the hints of the opened column and the rate that opens are counted on the day of the tap', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await waitFor(() => expect(bodyRows()).toHaveLength(14));
    const icon = (id: string) =>
      document.querySelector(`.ant-table-thead [data-testid="${id}"]`) as HTMLElement;
    await user.hover(icon('tip-opened'));
    expect(
      await screen.findByText(
        'Opens are counted on the day of the tap, which is not always the day of the send.',
      ),
    ).toBeInTheDocument();
    await user.unhover(icon('tip-opened'));
    await user.hover(icon('tip-rate'));
    expect(await screen.findByText(/Opened divided by sent\./)).toBeInTheDocument();
  });

  it('shows a trigger reason it does not know as it is', async () => {
    backend({ rows: () => [row('2026-10-26', 'recall'), row('2026-10-26', 'announcement')] });
    renderPage(<StatsPage />);
    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    expect(cellsOf(bodyRows()[0])[1]).toBe('recall');
  });
});

describe('the push result page: the filters', () => {
  it('reads again only when Search is pressed, with the reason that was chosen, and sends no reason for "all"', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await waitFor(() => expect(bodyRows()).toHaveLength(14));
    await user.click(screen.getByRole('combobox', { name: 'Trigger reason' }));
    const options = await screen.findAllByText('Streak at risk', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    expect(callsTo(calls, 'push')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(callsTo(calls, 'push')).toHaveLength(2));
    expect(callsTo(calls, 'push')[1].url).toBe(
      '/api/admin/stats/push?from=2026-10-20&to=2026-10-26&triggerReason=streak_at_risk',
    );
    await waitFor(() => expect(bodyRows()).toHaveLength(7));
  });

  it('offers the four trigger reasons and "all reasons"', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await screen.findByTestId('chart-line');
    await user.click(screen.getByRole('combobox', { name: 'Trigger reason' }));
    for (const text of [
      'All reasons',
      'Daily recall',
      'Streak at risk',
      'Sent by an administrator',
      'System event',
    ]) {
      expect(
        (await screen.findAllByText(text, { selector: '.ant-select-item-option-content' })).length,
        text,
      ).toBeGreaterThan(0);
    }
  });

  it('reads the range that was picked, after Search', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await waitFor(() => expect(bodyRows()).toHaveLength(14));
    await user.click(document.querySelector('.ant-picker-range input') as HTMLElement);
    await user.click(await screen.findByText('Last 30 days'));
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(callsTo(calls, 'push')).toHaveLength(2));
    expect(callsTo(calls, 'push')[1].url).toBe(
      '/api/admin/stats/push?from=2026-09-27&to=2026-10-26',
    );
  });
});

describe('the push result page: landing and export', () => {
  it('lands "push" for the chosen day (yesterday in UTC by default) and then reads again', async () => {
    as(['STATS:VIEW', 'STATS:LAND']);
    const calls = backend();
    renderPage(<StatsPage />);
    await waitFor(() => expect(bodyRows()).toHaveLength(14));
    fireEvent.click(screen.getByRole('button', { name: 'Re-land this day' }));
    await waitFor(() => expect(callsTo(calls, 'land/')).toHaveLength(1));
    expect(callsTo(calls, 'land/')[0].url).toBe('/api/admin/stats/land/push?date=2026-10-25');
    await waitFor(() => expect(callsTo(calls, 'push')).toHaveLength(2));
  });

  it('shows no landing bar without STATS:LAND', async () => {
    backend();
    renderPage(<StatsPage />);
    await waitFor(() => expect(bodyRows()).toHaveLength(14));
    expect(screen.queryByRole('button', { name: 'Re-land this day' })).toBeNull();
  });

  it('exports "push" with exactly the range and reason on screen', async () => {
    as(['STATS:VIEW', 'STATS:EXPORT']);
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await waitFor(() => expect(bodyRows()).toHaveLength(14));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(callsTo(calls, 'export')).toHaveLength(1));
    expect(callsTo(calls, 'export')[0].url).toBe(
      '/api/admin/stats/export/push?from=2026-10-20&to=2026-10-26',
    );
    // a reason chosen but not searched is not what is on screen
    await user.click(screen.getByRole('combobox', { name: 'Trigger reason' }));
    const options = await screen.findAllByText('System event', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    await waitFor(() => expect(screen.getByRole('button', { name: /Export/ })).not.toBeDisabled());
    await user.click(screen.getByRole('button', { name: /Export/ }));
    await waitFor(() => expect(callsTo(calls, 'export')).toHaveLength(2));
    expect(callsTo(calls, 'export')[1].url).toBe(
      '/api/admin/stats/export/push?from=2026-10-20&to=2026-10-26',
    );
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(callsTo(calls, 'push')).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole('button', { name: /Export/ })).not.toBeDisabled());
    await user.click(screen.getByRole('button', { name: /Export/ }));
    await waitFor(() => expect(callsTo(calls, 'export')).toHaveLength(3));
    expect(callsTo(calls, 'export')[2].url).toBe(
      '/api/admin/stats/export/push?from=2026-10-20&to=2026-10-26&triggerReason=system_event',
    );
  });

  it('shows no export without STATS:EXPORT', async () => {
    backend();
    renderPage(<StatsPage />);
    await waitFor(() => expect(bodyRows()).toHaveLength(14));
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
  });

  it('draws in Chinese', async () => {
    backend();
    renderPage(<StatsPage />, 'zh-CN');
    await waitFor(() => expect(bodyRows()).toHaveLength(14));
    const heads = [...document.querySelectorAll('.ant-table-thead th')].map(
      (h) => h.textContent ?? '',
    );
    expect(heads).toEqual([
      '日期（UTC）',
      '触发原因',
      '发送数',
      '送达成功数',
      '送达失败数',
      '点开数',
      '点开率',
    ]);
    expect(within(bodyRows()[0] as HTMLElement).getByText('每日召回')).toBeInTheDocument();
  });
});
