// An answer that comes late must never replace the answer of a newer read. Each page here keeps a
// counter for that; these tests make the older read come last and look at what the page shows.
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { daysIn } from '../../../mock/_core/statRange';
import pushMock from '../../../mock/push.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import RecordsPage from './records';
import StatsPage from './stats';
import TemplatesPage from './templates';
import { signIn } from './testSetup';

beforeEach(() => signIn('root'));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

type Gate = { promise: Promise<void>; open: () => void };
const gate = (): Gate => {
  let open: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
};
const later = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

describe('the send record page: the list', () => {
  const record = (page: number) => ({
    id: `p${page}`,
    accountId: `acc-page-${page}`,
    pushType: 'recall',
    triggerReason: 'daily_recall',
    localDate: '2026-10-01',
    createdAt: '2026-10-01T10:00:00.000Z',
  });

  it('shows the page asked for last when the answer for the page before it comes after', async () => {
    const slow = gate();
    stubFetch(async ({ url }) => {
      const u = new URL(url, 'http://localhost');
      if (u.pathname !== '/api/admin/push/records')
        return jsonResponse(404, envelope('RESOURCE_NOT_FOUND'));
      const page = Number(u.searchParams.get('page'));
      if (page === 2) await slow.promise;
      return jsonResponse(200, envelope('200', { items: [record(page)], total: 60 }));
    });
    renderPage(<RecordsPage />);
    await screen.findByText('acc-page-1');
    // the table blocks the pointer while it reads, so the page changes are sent as clicks on the items
    fireEvent.click(await screen.findByTitle('2'));
    fireEvent.click(await screen.findByTitle('3'));
    await screen.findByText('acc-page-3');
    slow.open();
    await later();
    expect(screen.queryByText('acc-page-2')).toBeNull();
    expect(screen.getByText('acc-page-3')).toBeInTheDocument();
  });
});

describe('the send record page: the result for each token', () => {
  it('keeps the newer read when the effect ran twice and the first read answers last (React strict mode)', async () => {
    const slow = gate();
    let reads = 0;
    stubFetch(async ({ url }) => {
      const u = new URL(url, 'http://localhost');
      if (u.pathname === '/api/admin/push/records') {
        return jsonResponse(
          200,
          envelope('200', {
            items: [
              {
                id: 'x1',
                accountId: 'acc-9',
                pushType: 'recall',
                triggerReason: 'daily_recall',
                localDate: '2026-10-01',
                createdAt: '2026-10-01T10:00:00.000Z',
              },
            ],
            total: 1,
          }),
        );
      }
      reads += 1;
      const mine = reads;
      if (mine === 1) await slow.promise;
      return jsonResponse(
        200,
        envelope('200', {
          id: 'x1',
          deliveries: [
            {
              id: `d${mine}`,
              pushId: 'x1',
              pushTokenId: mine === 1 ? 'tok-old' : 'tok-new',
              result: 'SENT',
              sentAt: '2026-10-01T10:00:01.000Z',
            },
          ],
        }),
      );
    });
    const user = userEvent.setup();
    renderPage(
      <StrictMode>
        <RecordsPage />
      </StrictMode>,
    );
    await waitFor(() => expect(document.querySelectorAll('.ant-table-row').length).toBe(1));
    await user.click(
      within(document.querySelector('.ant-table-row') as HTMLElement).getByRole('button', {
        name: /expand/i,
      }),
    );
    await screen.findByText('tok-new');
    slow.open();
    await later();
    expect(screen.queryByText('tok-old')).toBeNull();
    expect(screen.getByText('tok-new')).toBeInTheDocument();
  });
});

describe('the push result page', () => {
  it('shows the figures of the search made last when the answer of the one before it comes after', async () => {
    const slow = gate();
    let reads = 0;
    stubFetch(async ({ url }) => {
      const u = new URL(url, 'http://localhost');
      if (u.pathname !== '/api/admin/stats/push')
        return jsonResponse(404, envelope('RESOURCE_NOT_FOUND'));
      reads += 1;
      const mine = reads;
      if (mine === 1) await slow.promise;
      const days = daysIn(u.searchParams.get('from') ?? '', u.searchParams.get('to') ?? '');
      return jsonResponse(
        200,
        envelope('200', {
          items: days.slice(0, 1).map((d) => ({
            statDate: d,
            triggerReason: 'daily_recall',
            pushesSent: mine === 1 ? 111 : 222,
            deliveriesOk: 1,
            deliveriesFailed: 0,
            pushesOpened: 1,
          })),
        }),
      );
    });
    const user = userEvent.setup();
    renderPage(<StatsPage />);
    await waitFor(() => expect(reads).toBe(1));
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByText('222');
    slow.open();
    await later();
    expect(screen.queryByText('111')).toBeNull();
    expect(screen.getByText('222')).toBeInTheDocument();
  });
});

describe('the template page: the matrix', () => {
  it('shows the templates as they are after the last change when the read that followed the first change answers last', async () => {
    const calls = useMockBackend({ default: pushMock });
    const real = globalThis.fetch;
    const slow = gate();
    let all = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init: RequestInit = {}) => {
        const url = new URL(String(input), 'http://localhost');
        const isAll =
          (init.method ?? 'GET').toUpperCase() === 'GET' &&
          url.pathname === '/api/admin/push/templates' &&
          url.searchParams.get('pageSize') === '200';
        if (!isAll) return real(input, init);
        all += 1;
        const answer = await real(input, init); // taken now, so it is the state of this moment
        if (all === 2) await slow.promise; // the read after the first change comes last
        return answer;
      }),
    );
    renderPage(<TemplatesPage />);
    expect((await screen.findByTestId('cell-daily_recall-th')).getAttribute('data-state')).toBe(
      'on',
    );
    const puts = () => calls.filter((c) => c.method === 'PUT').length;
    // switch off Thai: one write, then the matrix is read again (read 2, held)
    fireEvent.click(await screen.findByRole('switch', { name: 'On: Daily recall, th' }));
    await waitFor(() => expect(puts()).toBe(1));
    await waitFor(() => expect(all).toBe(2));
    // switch off Arabic: one more write, then the matrix is read again (read 3, at once)
    fireEvent.click(await screen.findByRole('switch', { name: 'On: Daily recall, ar' }));
    await waitFor(() => expect(puts()).toBe(2));
    await waitFor(() =>
      expect(screen.getByTestId('cell-daily_recall-ar').getAttribute('data-state')).not.toBe('on'),
    );
    // read 2 was taken before Arabic was switched off: it must not bring Arabic back
    slow.open();
    await later();
    expect(screen.getByTestId('cell-daily_recall-ar').getAttribute('data-state')).not.toBe('on');
    expect(screen.getByTestId('cell-daily_recall-th').getAttribute('data-state')).not.toBe('on');
  });
});
