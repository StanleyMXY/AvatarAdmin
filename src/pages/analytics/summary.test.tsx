import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyticsStore } from '../../../mock/_core/analyticsData';
import * as analyticsMock from '../../../mock/analytics.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { withTimeZone } from '../../../tests/withTimeZone';
import enUS from '../../locales/en-US';
import SummaryPage from './summary';
import { signIn, VIEW } from './testSetup';

beforeEach(() => signIn('support', { codes: VIEW }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const summaryCalls = (calls: { url: string }[]) =>
  calls.filter((c) => c.url.includes('/analytics/event-summary'));
const lastUrl = (calls: { url: string }[]) =>
  new URL(summaryCalls(calls).at(-1)?.url as string, 'http://x');
const dataRows = () =>
  Array.from(document.querySelectorAll('tbody tr.ant-table-row')) as HTMLElement[];
const openPicker = () => {
  const input = document.querySelectorAll('.ant-picker-input input')[0];
  fireEvent.mouseDown(input);
  fireEvent.focus(input);
  fireEvent.click(input);
};
const firstColumn = () => dataRows().map((r) => r.querySelector('td')?.textContent);

describe('the event summary page', { timeout: 30000 }, () => {
  it('asks for the last 7 UTC days, including today, and says the days are UTC', async () => {
    const calls = useMockBackend(analyticsMock);
    renderPage(<SummaryPage />);
    await waitFor(() => expect(summaryCalls(calls)).toHaveLength(1));
    const url = lastUrl(calls);
    const today = new Date().toISOString().slice(0, 10);
    expect(url.searchParams.get('to')).toBe(today);
    expect(
      Date.parse(`${today}T00:00:00Z`) - Date.parse(`${url.searchParams.get('from')}T00:00:00Z`),
    ).toBe(6 * 86400000);
    expect(screen.getByText(/UTC days/)).toBeInTheDocument();
  });

  it('uses the UTC date, not the local one, in Singapore between 00:00 and 08:00', async () => {
    await withTimeZone('Asia/Singapore', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-26T17:30:00Z')); // 27 October 01:30 in Singapore
      const calls = useMockBackend(analyticsMock);
      renderPage(<SummaryPage />);
      await waitFor(() => expect(summaryCalls(calls)).toHaveLength(1));
      expect(lastUrl(calls).searchParams.get('to')).toBe('2026-10-26');
      expect(lastUrl(calls).searchParams.get('from')).toBe('2026-10-20');
    });
  });

  it('shows the event names with triggers and distinct accounts, most triggers first', async () => {
    stubFetch(() =>
      jsonResponse(
        200,
        envelope('200', {
          items: [
            { eventName: 'big', pv: 1234567, uv: 99 },
            { eventName: 'mid', pv: 10, uv: 10 },
            { eventName: 'mid_b', pv: 10, uv: 2 },
            { eventName: 'small', pv: 1, uv: 0 },
          ],
        }),
      ),
    );
    renderPage(<SummaryPage />);
    await screen.findByText('big');
    expect(firstColumn()).toEqual(['big', 'mid', 'mid_b', 'small']);
    expect(within(dataRows()[0]).getByText('1,234,567')).toBeInTheDocument();
    for (const title of ['Event name', 'Triggers (pv)', 'Distinct accounts (uv)']) {
      expect(
        screen.getByRole('columnheader', { name: new RegExp(title.replace(/[()]/g, '\\$&')) }),
      ).toBeInTheDocument();
    }
  });

  it('puts the highest pv first even when the backend sends another order', async () => {
    stubFetch(() =>
      jsonResponse(
        200,
        envelope('200', {
          items: [
            { eventName: 'low', pv: 1, uv: 1 },
            { eventName: 'high', pv: 50, uv: 1 },
          ],
        }),
      ),
    );
    renderPage(<SummaryPage />);
    await screen.findByText('high');
    expect(firstColumn()).toEqual(['high', 'low']);
  });

  it('pages 50 at a time on the front end; one request carries every event name', async () => {
    const calls = useMockBackend(analyticsMock);
    renderPage(<SummaryPage />);
    await waitFor(() => expect(dataRows().length).toBe(50));
    const total =
      analyticsStore.events.length > 0
        ? new Set(analyticsStore.events.map((e) => e.eventName)).size
        : 0;
    expect(total).toBeGreaterThan(50);
    expect(screen.getByText(`${total} event names`)).toBeInTheDocument();
    const before = summaryCalls(calls).length;
    await userEvent.click(screen.getByTitle('2'));
    await waitFor(() => expect(dataRows().length).toBe(total - 50));
    expect(summaryCalls(calls)).toHaveLength(before);
  });

  it('sorts by a column when its header is pressed', async () => {
    useMockBackend(analyticsMock);
    renderPage(<SummaryPage />);
    await waitFor(() => expect(dataRows().length).toBe(50));
    await userEvent.click(screen.getByRole('columnheader', { name: /Event name/ }));
    await waitFor(() => {
      const names = firstColumn() as string[];
      expect(names).toEqual([...names].sort());
    });
  });

  it('asks again when Query is pressed, with the chosen days', async () => {
    const calls = useMockBackend(analyticsMock);
    renderPage(<SummaryPage />);
    await waitFor(() => expect(summaryCalls(calls)).toHaveLength(1));
    openPicker();
    fireEvent.click(await screen.findByText('Last 30 days'));
    await userEvent.click(screen.getByRole('button', { name: 'Query' }));
    await waitFor(() => expect(summaryCalls(calls)).toHaveLength(2));
    const url = lastUrl(calls);
    expect(
      Date.parse(`${url.searchParams.get('to')}T00:00:00Z`) -
        Date.parse(`${url.searchParams.get('from')}T00:00:00Z`),
    ).toBe(29 * 86400000);
  });

  it('refuses a range longer than analyticsLiveMaxRangeDays before asking, and says so', async () => {
    signIn('support', { codes: VIEW, meta: { analyticsLiveMaxRangeDays: 10 } });
    const calls = useMockBackend(analyticsMock);
    renderPage(<SummaryPage />);
    await waitFor(() => expect(summaryCalls(calls)).toHaveLength(1));
    openPicker();
    fireEvent.click(await screen.findByText('Last 30 days'));
    expect(await screen.findByText('At most 10 days at a time')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 100));
    // nothing was asked for the refused range, and Query asks for the range that is still chosen
    expect(summaryCalls(calls)).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Query' }));
    await waitFor(() => expect(summaryCalls(calls)).toHaveLength(2));
    const url = lastUrl(calls);
    expect(
      Date.parse(`${url.searchParams.get('to')}T00:00:00Z`) -
        Date.parse(`${url.searchParams.get('from')}T00:00:00Z`),
    ).toBe(6 * 86400000);
  });

  it('shows only the translated words of the code when the backend refuses the range (no limit known here)', async () => {
    stubFetch(() =>
      jsonResponse(
        400,
        envelope(
          'INVALID_REQUEST',
          { details: [{ ref: 'to', reason: 'OUT_OF_RANGE' }] },
          'range is longer than 31 days',
        ),
      ),
    );
    renderPage(<SummaryPage />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(enUS['error.INVALID_REQUEST']);
    expect(alert.textContent).not.toContain('range is longer than 31 days');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows an empty table, not a failure, when there are no events in the range', async () => {
    stubFetch(() => jsonResponse(200, envelope('200', { items: [] })));
    renderPage(<SummaryPage />);
    expect(await screen.findByText('No events in this range')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps long and unusual event names inside the table', async () => {
    const long = 'x'.repeat(64);
    stubFetch(() =>
      jsonResponse(
        200,
        envelope('200', {
          items: [
            { eventName: long, pv: 5, uv: 1 },
            { eventName: 'ก็'.repeat(2500), pv: 4, uv: 1 },
          ],
        }),
      ),
    );
    renderPage(<SummaryPage />);
    await screen.findByText(long);
    expect(document.body.textContent).not.toMatch(/NaN|undefined|null/);
  });
});
