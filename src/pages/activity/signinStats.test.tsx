import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { daysIn } from '../../../mock/_core/statRange';
import { envelope, jsonResponse } from '../../../tests/httpStubs';
import { renderPage } from '../../../tests/renderPage';
import SigninStatsPage from './signinStats';
import {
  as,
  callsTo,
  cellTexts,
  chartData,
  rangeInputs,
  serve,
  setRange,
  startStatsTest,
  stopStatsTest,
} from './statsTestSetup';

beforeEach(() => startStatsTest(['STATS:VIEW']));
afterEach(stopStatsTest);

const users = (statDate: string, userCount: number | null = 10) => ({ statDate, userCount });
const bucket = (consecutiveDays: number, checkinCount: number | null) => ({
  consecutiveDays,
  checkinCount,
});

const normal = {
  'checkin/daily-users': () => [
    users('2026-10-21', 40),
    users('2026-10-23', 0),
    users('2026-10-26', 55),
  ],
  'checkin/streak-buckets': () => [bucket(2, 30), bucket(1, 100), bucket(3, 0)],
};

/** The first report is drawn (the table draws a header twice, so the title is looked for in the plural). */
const ready = () => screen.findAllByText('Check-in date');
const tab = (name: string) => screen.getByRole('tab', { name });
const panel = () => screen.getByRole('tabpanel');

describe('the check-in statistics page', { timeout: 30000 }, () => {
  it('says the days are the local days of the users, not UTC days, and nowhere says UTC', async () => {
    serve(normal);
    renderPage(<SigninStatsPage />);
    expect(
      await screen.findByText(
        'The dates here are local days of the users, not UTC days: the same date is a different real moment in each time zone.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Statistics days are UTC days/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/UTC\)/);
    expect(document.body.textContent).not.toMatch(/\(UTC|Today \(|Yesterday \(/);
  });

  it('asks for the last 7 days of both reports to begin with', async () => {
    const calls = serve(normal);
    renderPage(<SigninStatsPage />);
    await ready();
    for (const path of ['checkin/daily-users', 'checkin/streak-buckets']) {
      const url = new URL(callsTo(calls, path)[0].url, 'http://x');
      expect(url.searchParams.get('from'), path).toBe('2026-10-20');
      expect(url.searchParams.get('to'), path).toBe('2026-10-26');
    }
  });

  it('has the two tabs; the first draws a line of every day of the range (a day without a row is 0) and a table of the rows', async () => {
    serve(normal);
    renderPage(<SigninStatsPage />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Check-ins per day',
      'Streak distribution',
    ]);
    await ready();
    const data = chartData('line', panel());
    expect(data).toHaveLength(7);
    expect(data.map((d) => d.statDate)).toEqual(daysIn('2026-10-20', '2026-10-26'));
    expect(data.map((d) => d.value)).toEqual(
      [0, 40, 0, 0, 0, 0, 55].map((v, i) => (i === 3 ? 0 : v)),
    );
    expect(data.every((d) => d.series === 'Users')).toBe(true);
    expect(cellTexts(panel())).toEqual([
      ['2026-10-21', '40'],
      ['2026-10-23', '0'],
      ['2026-10-26', '55'],
    ]);
  });

  it('shows a count that is not a number as a dash, not as 0 or null', async () => {
    serve({
      ...normal,
      'checkin/daily-users': () => [users('2026-10-21', null), { statDate: null, userCount: 'x' }],
    });
    renderPage(<SigninStatsPage />);
    await ready();
    const table = panel().querySelector('.ant-table') as HTMLElement;
    expect(table.textContent ?? '').not.toMatch(/null|NaN|undefined/);
    expect(cellTexts(panel())[0]).toEqual(['2026-10-21', '—']);
    expect(cellTexts(panel())[1]).toEqual(['—', '—']);
  });

  it('the second tab shows the columns by streak, "N days" on the axis, and the table in the order of the streak', async () => {
    serve(normal);
    const user = userEvent.setup();
    renderPage(<SigninStatsPage />);
    await ready();
    await user.click(tab('Streak distribution'));
    await waitFor(() => expect(within(panel()).getByTestId('chart-column')).toBeInTheDocument());
    expect(chartData('column', panel())).toEqual([
      { label: '1 days', count: 100 },
      { label: '2 days', count: 30 },
      { label: '3 days', count: 0 },
    ]);
    expect(cellTexts(panel())).toEqual([
      ['1', '100'],
      ['2', '30'],
      ['3', '0'],
    ]);
    expect(within(panel()).getAllByText('Streak (days)').length).toBeGreaterThan(0);
    expect(within(panel()).getAllByText('Check-ins').length).toBeGreaterThan(0);
  });

  it('shows the empty state of a range without rows', async () => {
    serve({ 'checkin/daily-users': () => [], 'checkin/streak-buckets': () => [] });
    renderPage(<SigninStatsPage />);
    expect(await screen.findByText('There is no data in the chosen range')).toBeInTheDocument();
    expect(chartData('line', panel()).every((d) => d.value === 0)).toBe(true);
  });

  it('a failure of one report is shown in words of the code with a retry, and the other tab is not touched', async () => {
    serve(normal, ({ url }) =>
      url.includes('daily-users')
        ? jsonResponse(500, envelope('INTERNAL_ERROR', null, 'SECRET BACKEND MESSAGE'))
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<SigninStatsPage />);
    expect(await within(panel()).findByText(/Failed to load/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND MESSAGE');
    expect(within(panel()).getByRole('button', { name: /Retry/ })).toBeInTheDocument();
    await user.click(tab('Streak distribution'));
    expect((await within(panel()).findAllByText('Streak (days)')).length).toBeGreaterThan(0);
    expect(cellTexts(panel())).toHaveLength(3);
  });
});

describe('the range, Search and the answers that come late', { timeout: 30000 }, () => {
  it('asks again with the range that was typed only when Search is pressed', async () => {
    const calls = serve(normal);
    const user = userEvent.setup();
    renderPage(<SigninStatsPage />);
    await ready();
    await setRange(user, '2026-09-01', '2026-09-05');
    expect(callsTo(calls, 'checkin/daily-users')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(callsTo(calls, 'checkin/daily-users')).toHaveLength(2));
    const url = new URL(callsTo(calls, 'checkin/daily-users')[1].url, 'http://x');
    expect([url.searchParams.get('from'), url.searchParams.get('to')]).toEqual([
      '2026-09-01',
      '2026-09-05',
    ]);
  });

  it('offers only the presets "Last 7 days" and "Last 30 days", which do not name UTC', async () => {
    serve(normal);
    const user = userEvent.setup();
    renderPage(<SigninStatsPage />);
    await ready();
    await user.click(rangeInputs()[0]);
    expect(await screen.findByText('Last 30 days')).toBeInTheDocument();
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    expect(screen.queryByText(/Today|Yesterday/)).toBeNull();
  });

  it('refuses a range longer than the backend allows (from GET /meta) with a message and does not ask', async () => {
    as(['STATS:VIEW'], false, { statsMaxRangeDays: 10 });
    const calls = serve(normal);
    const user = userEvent.setup();
    renderPage(<SigninStatsPage />);
    await ready();
    await setRange(user, '2026-08-01', '2026-10-26');
    expect(await screen.findByText('At most 10 days at a time')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await new Promise((r) => setTimeout(r, 100));
    const asked = callsTo(calls, 'checkin/daily-users').map((c) =>
      new URL(c.url, 'http://x').searchParams.get('from'),
    );
    expect(asked).toEqual(['2026-10-20', '2026-10-20']);
  });

  it('the answer of an earlier search never replaces the answer of a later one', async () => {
    let releaseFirst: () => void = () => {};
    const first = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let n = 0;
    serve(normal, async ({ url, query }) => {
      if (!url.includes('daily-users')) return undefined;
      n += 1;
      if (n === 1) {
        await first;
        return jsonResponse(200, envelope('200', { items: [users('2026-10-20', 999)] }));
      }
      return jsonResponse(200, envelope('200', { items: [users(query.get('from') ?? '', 7)] }));
    });
    const user = userEvent.setup();
    renderPage(<SigninStatsPage />);
    await setRange(user, '2026-10-24', '2026-10-26');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(cellTexts(panel())).toEqual([['2026-10-24', '7']]));
    releaseFirst();
    await new Promise((r) => setTimeout(r, 100));
    expect(cellTexts(panel())).toEqual([['2026-10-24', '7']]);
  });
});

describe('the export', { timeout: 30000 }, () => {
  it('follows the tab: check-in users for the first, streaks for the second, with the range that was searched', async () => {
    as(['STATS:VIEW', 'STATS:EXPORT']);
    const calls = serve(normal);
    const user = userEvent.setup();
    renderPage(<SigninStatsPage />);
    await ready();
    await user.click(screen.getByRole('button', { name: /Export/ }));
    await waitFor(() => expect(callsTo(calls, 'export/checkin-daily-users')).toHaveLength(1));
    const one = new URL(callsTo(calls, 'export/checkin-daily-users')[0].url, 'http://x');
    expect([one.searchParams.get('from'), one.searchParams.get('to')]).toEqual([
      '2026-10-20',
      '2026-10-26',
    ]);
    await user.click(tab('Streak distribution'));
    await waitFor(() => expect(screen.getByRole('button', { name: /Export/ })).not.toBeDisabled());
    await user.click(screen.getByRole('button', { name: /Export/ }));
    await waitFor(() => expect(callsTo(calls, 'export/checkin-streaks')).toHaveLength(1));
  });

  it('uses the range of the last search, not the range being edited', async () => {
    as(['STATS:VIEW', 'STATS:EXPORT']);
    const calls = serve(normal);
    const user = userEvent.setup();
    renderPage(<SigninStatsPage />);
    await ready();
    await setRange(user, '2026-10-01', '2026-10-05');
    expect(rangeInputs()[0]).toHaveValue('2026-10-01');
    await user.click(screen.getByRole('button', { name: /Export/ }));
    await waitFor(() => expect(callsTo(calls, 'export/checkin-daily-users')).toHaveLength(1));
    expect(
      new URL(callsTo(calls, 'export/checkin-daily-users')[0].url, 'http://x').searchParams.get(
        'from',
      ),
    ).toBe('2026-10-20');
  });

  it('is not drawn without STATS:EXPORT', async () => {
    serve(normal);
    renderPage(<SigninStatsPage />);
    await ready();
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
  });

  it('a refusal of the backend is shown in words and no file is saved', async () => {
    as(['STATS:VIEW', 'STATS:EXPORT']);
    serve(normal, ({ url }) =>
      url.includes('/export/')
        ? jsonResponse(429, envelope('RATE_LIMITED', null, 'SECRET BACKEND MESSAGE'))
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<SigninStatsPage />);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(
      await screen.findByText(/Too many requests|too frequent|Please try again/i),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND MESSAGE');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});

describe('landing a day again', { timeout: 30000 }, () => {
  it('is not drawn without STATS:LAND', async () => {
    serve(normal);
    renderPage(<SigninStatsPage />);
    await ready();
    expect(screen.queryByRole('button', { name: 'Re-land this day' })).toBeNull();
  });

  it('names the date as the local day of the users, offers yesterday, lands checkin-daily and reads both reports again', async () => {
    as(['STATS:VIEW', 'STATS:LAND']);
    const calls = serve(normal);
    const user = userEvent.setup();
    renderPage(<SigninStatsPage />);
    await ready();
    expect(screen.getByText('Date (local day of the users)')).toBeInTheDocument();
    expect(screen.queryByText('Date (UTC)')).toBeNull();
    expect(document.querySelector('.ant-picker:not(.ant-picker-range) input')).toHaveValue(
      '2026-10-25',
    );
    await user.click(screen.getByRole('button', { name: 'Re-land this day' }));
    expect(await screen.findByText('Re-landed 2026-10-25')).toBeInTheDocument();
    const lands = calls.filter((c) => c.init.method === 'POST');
    expect(lands.map((c) => c.url)).toEqual([
      '/api/admin/stats/land/checkin-daily?date=2026-10-25',
    ]);
    await waitFor(() => expect(callsTo(calls, 'checkin/daily-users')).toHaveLength(2));
    expect(callsTo(calls, 'checkin/streak-buckets')).toHaveLength(2);
  });

  it('a second press while it runs sends one request', async () => {
    as(['STATS:VIEW', 'STATS:LAND']);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const calls = serve(normal, async ({ url, method }) => {
      if (method === 'POST' && url.includes('/land/')) {
        await gate;
        return jsonResponse(200, envelope('200', null));
      }
      return undefined;
    });
    const user = userEvent.setup();
    renderPage(<SigninStatsPage />);
    await ready();
    const button = screen.getByRole('button', { name: 'Re-land this day' });
    await user.click(button);
    await user.click(button);
    release();
    expect(await screen.findByText('Re-landed 2026-10-25')).toBeInTheDocument();
    expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1);
  });

  it('a failure is shown in words of the code and nothing is read again', async () => {
    as(['STATS:VIEW', 'STATS:LAND']);
    const calls = serve(normal, ({ url, method }) =>
      method === 'POST' && url.includes('/land/')
        ? jsonResponse(409, envelope('INVALID_STATE', { status: 'x' }, 'SECRET BACKEND MESSAGE'))
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<SigninStatsPage />);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Re-land this day' }));
    expect(
      await screen.findByText('The current state of the item does not allow this action.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND MESSAGE');
    expect(callsTo(calls, 'checkin/daily-users')).toHaveLength(1);
  });
});
