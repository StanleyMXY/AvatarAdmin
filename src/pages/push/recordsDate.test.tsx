import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pushState } from '../../../mock/_core/pushData';
import pushMock from '../../../mock/push.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { jsonAnswer, overrideFetch } from '../../../tests/pageHelpers';
import { renderPage } from '../../../tests/renderPage';
import RecordsPage from './records';
import { signIn } from './testSetup';

// The send records can be limited to the days they were created on (`from`, `to`: UTC days, both
// ends included). The range is the shared DateRangeUtc; a 400 that names `from` or `to` goes to it.

// 26 October 20:00 UTC: the records of the mock are made back from this instant (record n, 3n+1 hours
// before it), so six of them were created on the 26th and the rest on the days before.
const NOW = new Date('2026-10-26T20:00:00Z');
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  signIn('root');
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const filterBox = () => screen.getByRole('search');
const bodyRows = () => [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')];
const reads = (calls: { method: string; url: string }[]) =>
  calls.filter((c) => c.method === 'GET' && /^\/api\/admin\/push\/records\?/.test(c.url));
const lastQuery = (calls: { method: string; url: string }[]) =>
  Object.fromEntries(new URL(reads(calls).at(-1)?.url ?? '', 'http://x').searchParams);
const withDays = (keep: (day: string) => boolean) =>
  pushState.records.filter((r) => keep(r.createdAt.slice(0, 10)));

const useRange = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(
    within(filterBox()).getByRole('checkbox', { name: /Only records created in a date range/ }),
  );
const pickPreset = async (label: string) => {
  const inputs = document.querySelectorAll('.ant-picker-input input');
  fireEvent.mouseDown(inputs[0]);
  fireEvent.focus(inputs[0]);
  fireEvent.click(inputs[0]);
  fireEvent.click(await screen.findByText(label));
};

describe('the creation day filter of the send records', { timeout: 30000 }, () => {
  it('is off at first: no date is sent, and the range picker is not there until it is asked for', async () => {
    const calls = useMockBackend({ default: pushMock });
    renderPage(<RecordsPage />);
    await waitFor(() => expect(bodyRows().length).toBe(20));
    expect(lastQuery(calls)).not.toHaveProperty('from');
    expect(lastQuery(calls)).not.toHaveProperty('to');
    expect(document.querySelector('.ant-picker-range')).toBeNull();
    expect(screen.getByText(/UTC days, both ends included/)).toBeInTheDocument();
  });

  it('offers the last 7 days (UTC) once asked for, and sends them only when Search is pressed', async () => {
    const calls = useMockBackend({ default: pushMock });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<RecordsPage />);
    await waitFor(() => expect(bodyRows().length).toBe(20));
    const before = reads(calls).length;
    await useRange(user);
    expect(document.querySelector('.ant-picker-range')).not.toBeNull();
    expect(reads(calls)).toHaveLength(before);
    await user.click(within(filterBox()).getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(lastQuery(calls)).toMatchObject({ from: '2026-10-20', to: '2026-10-26', page: '1' }),
    );
  });

  it('sends the one day that was picked as both ends, and shows the records of that UTC day', async () => {
    const calls = useMockBackend({ default: pushMock });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<RecordsPage />);
    await waitFor(() => expect(bodyRows().length).toBe(20));
    await useRange(user);
    await pickPreset('Today (UTC)');
    await user.click(within(filterBox()).getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(lastQuery(calls)).toMatchObject({ from: '2026-10-26', to: '2026-10-26' }),
    );
    const today = withDays((day) => day === '2026-10-26');
    expect(today).toHaveLength(6);
    await waitFor(() => expect(bodyRows()).toHaveLength(today.length));
    // together with the filters that were there
    const account = today[0].accountId;
    await user.type(within(filterBox()).getByRole('textbox', { name: 'Account ID' }), account);
    await user.click(within(filterBox()).getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(lastQuery(calls)).toMatchObject({
        from: '2026-10-26',
        to: '2026-10-26',
        accountId: account,
      }),
    );
  });

  it('starts again from the first page when the range is searched', async () => {
    const calls = useMockBackend({ default: pushMock });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<RecordsPage />);
    await waitFor(() => expect(bodyRows().length).toBe(20));
    await user.click(await screen.findByTitle('2'));
    await waitFor(() => expect(lastQuery(calls).page).toBe('2'));
    await useRange(user);
    await user.click(within(filterBox()).getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(lastQuery(calls)).toMatchObject({ page: '1', from: '2026-10-20' }));
  });

  it('Reset takes the range away: the picker goes, and the next read has no date', async () => {
    const calls = useMockBackend({ default: pushMock });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<RecordsPage />);
    await waitFor(() => expect(bodyRows().length).toBe(20));
    await useRange(user);
    await user.click(within(filterBox()).getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(lastQuery(calls)).toHaveProperty('from'));
    await user.click(within(filterBox()).getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(lastQuery(calls)).not.toHaveProperty('from'));
    expect(lastQuery(calls)).not.toHaveProperty('to');
    expect(document.querySelector('.ant-picker-range')).toBeNull();
    expect(
      within(filterBox()).getByRole('checkbox', { name: /Only records created in a date range/ }),
    ).not.toBeChecked();
  });

  it('takes the range off again when the box is unticked: the next Search sends no date', async () => {
    const calls = useMockBackend({ default: pushMock });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<RecordsPage />);
    await waitFor(() => expect(bodyRows().length).toBe(20));
    await useRange(user);
    await user.click(within(filterBox()).getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(lastQuery(calls)).toHaveProperty('from'));
    await useRange(user);
    await user.click(within(filterBox()).getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(lastQuery(calls)).not.toHaveProperty('from'));
  });

  it('writes a 400 that names `to` under the picker in the words of the code, and the bar of the page says the read failed', async () => {
    useMockBackend({ default: pushMock });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<RecordsPage />);
    await waitFor(() => expect(bodyRows().length).toBe(20));
    overrideFetch(({ url, method }) =>
      method === 'GET' && url.pathname === '/api/admin/push/records' && url.searchParams.has('to')
        ? jsonAnswer(
            400,
            'INVALID_REQUEST',
            { details: [{ ref: 'to', reason: 'OUT_OF_RANGE' }] },
            'to must not be before from',
          )
        : undefined,
    );
    await useRange(user);
    await user.click(within(filterBox()).getByRole('button', { name: 'Search' }));
    const line = await screen.findByTestId('stat-range-error');
    expect(line.textContent).toContain('End date');
    expect(line.textContent).toContain('The value is outside the allowed range.');
    expect(document.body.textContent).not.toContain('must not be before');
  });

  it('says it in Chinese too', async () => {
    useMockBackend({ default: pushMock });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<RecordsPage />, 'zh-CN');
    await waitFor(() => expect(bodyRows().length).toBe(20));
    await user.click(
      within(filterBox()).getByRole('checkbox', { name: /只看创建日期在某个范围内的记录/ }),
    );
    expect(screen.getByText(/UTC 日，含首尾/)).toBeInTheDocument();
  });
});
