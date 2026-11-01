import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { daysIn } from '../../../mock/_core/statRange';
import { envelope, jsonResponse } from '../../../tests/httpStubs';
import { renderPage } from '../../../tests/renderPage';
import { withTimeZone } from '../../../tests/withTimeZone';
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
import TaskStatsPage from './taskStats';

beforeEach(() => startStatsTest(['STATS:VIEW']));
afterEach(stopStatsTest);

const summary = (over: Record<string, unknown> = {}) => ({
  taskId: '1',
  taskName: 'Open the app',
  totalRecords: 200,
  completedCount: 100,
  rewardedCount: 90,
  creditsIssued: 270,
  completionRate: 0.5,
  ...over,
});
const day = (
  statDate: string,
  totalRecords: number,
  completedCount: number,
  rewardedCount: number,
) => ({
  statDate,
  totalRecords,
  completedCount,
  rewardedCount,
});

const normal = {
  'tasks/summary': () => [
    summary(),
    summary({
      taskId: '2',
      taskName: 'ขอบคุณ',
      totalRecords: 3,
      completedCount: 1,
      rewardedCount: 1,
      creditsIssued: 4,
      completionRate: 1 / 3,
    }),
    summary({
      taskId: '3',
      taskName: 'مهمة',
      totalRecords: 0,
      completedCount: 0,
      rewardedCount: 0,
      creditsIssued: 0,
      completionRate: null,
    }),
  ],
  'tasks/daily': () => [day('2026-10-21', 50, 30, 20), day('2026-10-26', 70, 60, 40)],
};

describe('the task statistics page', { timeout: 30000 }, () => {
  it('says the days are the local days of the users, not UTC days, and that a claim on the next day counts for the task day', async () => {
    serve(normal);
    renderPage(<TaskStatsPage />);
    expect(
      await screen.findByText(
        'The dates here are local days of the users, not UTC days: the same date is a different real moment in each time zone.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'A reward claimed on the next day still counts for the day the task belongs to.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Statistics days are UTC days/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/\(UTC/);
  });

  it('asks for the last 7 days of both reports to begin with', async () => {
    const calls = serve(normal);
    renderPage(<TaskStatsPage />);
    await screen.findByText('By task');
    for (const path of ['tasks/summary', 'tasks/daily']) {
      const url = new URL(callsTo(calls, path)[0].url, 'http://x');
      expect([url.searchParams.get('from'), url.searchParams.get('to')], path).toEqual([
        '2026-10-20',
        '2026-10-26',
      ]);
    }
  });

  it('draws records, completions and claims for every day of the range (a day without a row is 0)', async () => {
    serve(normal);
    renderPage(<TaskStatsPage />);
    await screen.findByText('By task');
    const data = chartData('line');
    expect(data).toHaveLength(21);
    const byLine = (series: string) => data.filter((d) => d.series === series);
    expect(byLine('Records').map((d) => d.statDate)).toEqual(daysIn('2026-10-20', '2026-10-26'));
    expect(byLine('Records').map((d) => d.value)).toEqual([0, 50, 0, 0, 0, 0, 70]);
    expect(byLine('Completed').map((d) => d.value)).toEqual([0, 30, 0, 0, 0, 0, 60]);
    expect(byLine('Claimed').map((d) => d.value)).toEqual([0, 20, 0, 0, 0, 0, 40]);
  });

  it('the table has each task with its counts, the rate with one decimal, and the credits issued', async () => {
    serve(normal);
    renderPage(<TaskStatsPage />);
    await screen.findByText('By task');
    expect(cellTexts()).toEqual([
      ['Open the app', '200', '100', '90', '50.0%', '270'],
      ['ขอบคุณ', '3', '1', '1', '33.3%', '4'],
      ['مهمة', '0', '0', '0', '—', '0'],
    ]);
  });

  it('shows a rate that the backend did not give (no records) as a dash, and a count that is not a number as a dash', async () => {
    serve({
      ...normal,
      'tasks/summary': () => [
        summary({ completionRate: null, totalRecords: null, creditsIssued: 'x' }),
        summary({ taskId: '9', taskName: 5, completionRate: 'x' }),
      ],
    });
    renderPage(<TaskStatsPage />);
    await screen.findByText('By task');
    expect(cellTexts()[0]).toEqual(['Open the app', '—', '100', '90', '—', '—']);
    expect(document.body.textContent).not.toMatch(/null|NaN|undefined|\[object Object\]/);
  });

  it('keeps a task name of 300 letters without a space, thai and arabic names, inside the cell', async () => {
    serve({
      ...normal,
      'tasks/summary': () => [
        summary({ taskName: 'ก'.repeat(300) }),
        summary({ taskId: '2', taskName: 'مرحبا 🎉'.repeat(40) }),
      ],
    });
    renderPage(<TaskStatsPage />);
    const button = await screen.findByRole('button', { name: 'ก'.repeat(300) });
    expect(button.getAttribute('data-lines')).toBe('2');
    expect(button.style.overflowWrap).toBe('anywhere');
  });

  it('shows the empty state of a range without tasks', async () => {
    serve({ 'tasks/summary': () => [], 'tasks/daily': () => [] });
    renderPage(<TaskStatsPage />);
    expect(await screen.findByText('There is no data in the chosen range')).toBeInTheDocument();
  });

  it('a failure of one report is shown in words of the code with a retry; the other report still shows', async () => {
    serve(normal, ({ url }) =>
      url.includes('tasks/summary')
        ? jsonResponse(500, envelope('INTERNAL_ERROR', null, 'SECRET BACKEND MESSAGE'))
        : undefined,
    );
    renderPage(<TaskStatsPage />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND MESSAGE');
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
    expect(await screen.findByTestId('chart-line')).toBeInTheDocument();
  });
});

describe('the range and the answers that come late', { timeout: 30000 }, () => {
  it('asks again with the typed range only when Search is pressed', async () => {
    const calls = serve(normal);
    const user = userEvent.setup();
    renderPage(<TaskStatsPage />);
    await screen.findByText('By task');
    await setRange(user, '2026-10-10', '2026-10-12');
    expect(callsTo(calls, 'tasks/summary')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(callsTo(calls, 'tasks/summary')).toHaveLength(2));
    expect(
      new URL(callsTo(calls, 'tasks/summary')[1].url, 'http://x').searchParams.get('from'),
    ).toBe('2026-10-10');
    expect(new URL(callsTo(calls, 'tasks/daily')[1].url, 'http://x').searchParams.get('from')).toBe(
      '2026-10-10',
    );
  });

  it.each(['Pacific/Kiritimati', 'Etc/GMT+12', 'America/Los_Angeles'])(
    'sends the days typed as they were typed in %s, to both reports and the landing day as the UTC yesterday',
    async (zone) => {
      await withTimeZone(zone, async () => {
        as(['STATS:VIEW', 'STATS:LAND']);
        const calls = serve(normal);
        const user = userEvent.setup();
        renderPage(<TaskStatsPage />);
        await screen.findByText('By task');
        await setRange(user, '2026-09-01', '2026-09-05');
        await user.click(screen.getByRole('button', { name: 'Search' }));
        await waitFor(() => expect(callsTo(calls, 'tasks/summary')).toHaveLength(2));
        for (const path of ['tasks/summary', 'tasks/daily']) {
          const url = new URL(callsTo(calls, path)[1].url, 'http://x');
          expect([url.searchParams.get('from'), url.searchParams.get('to')]).toEqual([
            '2026-09-01',
            '2026-09-05',
          ]);
        }
        await user.click(screen.getByRole('button', { name: 'Re-land this day' }));
        expect(await screen.findByText('Re-landed 2026-10-25')).toBeInTheDocument();
      });
    },
  );

  it('the answer of an earlier search never replaces the answer of a later one', async () => {
    let releaseFirst: () => void = () => {};
    const first = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let n = 0;
    serve(normal, async ({ url }) => {
      if (!url.includes('tasks/summary')) return undefined;
      n += 1;
      if (n === 1) {
        await first;
        return jsonResponse(200, envelope('200', { items: [summary({ taskName: 'OLD ANSWER' })] }));
      }
      return jsonResponse(200, envelope('200', { items: [summary({ taskName: 'NEW ANSWER' })] }));
    });
    const user = userEvent.setup();
    renderPage(<TaskStatsPage />);
    await setRange(user, '2026-10-24', '2026-10-26');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByText('NEW ANSWER');
    releaseFirst();
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getByText('NEW ANSWER')).toBeInTheDocument();
    expect(screen.queryByText('OLD ANSWER')).toBeNull();
  });
});

describe('the export and landing', { timeout: 30000 }, () => {
  it('has no Export button without STATS:EXPORT', async () => {
    serve(normal);
    renderPage(<TaskStatsPage />);
    await screen.findByText('By task');
    expect(screen.queryByRole('button', { name: /Export/ })).toBeNull();
  });

  it('with STATS:EXPORT the button downloads task-summary for the range of the last search', async () => {
    as(['STATS:VIEW', 'STATS:EXPORT']);
    const calls = serve(normal);
    const user = userEvent.setup();
    renderPage(<TaskStatsPage />);
    await screen.findByText('By task');
    await user.click(screen.getByRole('button', { name: /Export/ }));
    await waitFor(() => expect(callsTo(calls, 'export/task-summary')).toHaveLength(1));
    const url = new URL(callsTo(calls, 'export/task-summary')[0].url, 'http://x');
    expect([url.searchParams.get('from'), url.searchParams.get('to')]).toEqual([
      '2026-10-20',
      '2026-10-26',
    ]);
    expect(await screen.findByText(/Saved /)).toBeInTheDocument();
  });

  it('exports the range of the last search, not the range being edited', async () => {
    as(['STATS:VIEW', 'STATS:EXPORT']);
    const calls = serve(normal);
    const user = userEvent.setup();
    renderPage(<TaskStatsPage />);
    await screen.findByText('By task');
    await setRange(user, '2026-10-01', '2026-10-05');
    expect(rangeInputs()[0]).toHaveValue('2026-10-01');
    await user.click(screen.getByRole('button', { name: /Export/ }));
    await waitFor(() => expect(callsTo(calls, 'export/task-summary')).toHaveLength(1));
    const url = new URL(callsTo(calls, 'export/task-summary')[0].url, 'http://x');
    expect([url.searchParams.get('from'), url.searchParams.get('to')]).toEqual([
      '2026-10-20',
      '2026-10-26',
    ]);
  });

  it('lands task-daily for the day, named as a local day; not drawn without STATS:LAND; one request for two presses', async () => {
    serve(normal);
    const { unmount } = renderPage(<TaskStatsPage />);
    await screen.findByText('By task');
    expect(screen.queryByRole('button', { name: 'Re-land this day' })).toBeNull();
    unmount();

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
    renderPage(<TaskStatsPage />);
    await screen.findByText('By task');
    expect(screen.getByText('Date (local day of the users)')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Re-land this day' });
    await user.click(button);
    await user.click(button);
    release();
    expect(await screen.findByText('Re-landed 2026-10-25')).toBeInTheDocument();
    expect(calls.filter((c) => c.init.method === 'POST').map((c) => c.url)).toEqual([
      '/api/admin/stats/land/task-daily?date=2026-10-25',
    ]);
    await waitFor(() => expect(callsTo(calls, 'tasks/summary')).toHaveLength(2));
    expect(callsTo(calls, 'tasks/daily')).toHaveLength(2);
  });
});
