import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pushState } from '../../../mock/_core/pushData';
import pushMock from '../../../mock/push.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import RecordsPage from './records';
import { signIn } from './testSetup';

beforeEach(() => signIn('root'));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const backend = () => useMockBackend({ default: pushMock });
const bodyRows = () => [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')];
const cells = (row: Element) => [...row.querySelectorAll('td')].map((td) => td.textContent ?? '');

/** The sample record n (1 is the newest) with the number of tokens it was sent to (1 + n % 3). */
const recordId = (n: number) => `rec-${String(n).padStart(4, '0')}`;

describe('the send record page: the list', { timeout: 30000 }, () => {
  it('lists account, type, trigger reason, local date and creation time, newest first, 20 to a page', async () => {
    const calls = backend();
    renderPage(<RecordsPage />);
    await waitFor(() => expect(bodyRows().length).toBe(20));
    expect(calls.some((c) => c.url === '/api/admin/push/records?page=1&pageSize=20')).toBe(true);
    const first = pushState.records.find((r) => r.id === recordId(1));
    const text = cells(bodyRows()[0]).join('|');
    expect(text).toContain(first?.accountId);
    expect(text).toContain('Streak at risk'); // n = 1 -> index 1 -> streak_at_risk
    expect(text).toContain('Recall');
    expect(text).toContain(first?.localDate);
    expect(document.querySelector('.ant-pagination')?.textContent).toMatch(/2/);
  });

  it('links the account to the user page only for an administrator who may see users', async () => {
    const accountOf = () => {
      const first = pushState.records.find((r) => r.id === recordId(1));
      return String(first?.accountId);
    };
    signIn('support', { codes: ['PUSH:VIEW', 'USER:VIEW'] });
    backend();
    const withUsers = renderPage(<RecordsPage />);
    await waitFor(() => expect(bodyRows().length).toBe(20));
    const account = accountOf();
    expect(
      within(bodyRows()[0] as HTMLElement)
        .getByRole('link', { name: account })
        .getAttribute('href'),
    ).toBe(`/users/${encodeURIComponent(account)}`);
    withUsers.unmount();

    signIn('support', { codes: ['PUSH:VIEW'] });
    backend();
    renderPage(<RecordsPage />);
    await waitFor(() => expect(bodyRows().length).toBe(20));
    expect(within(bodyRows()[0] as HTMLElement).queryByRole('link', { name: account })).toBeNull();
    expect(bodyRows()[0].textContent).toContain(account);
  });

  it('asks for the next page when the page is changed', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<RecordsPage />);
    await waitFor(() => expect(bodyRows().length).toBe(20));
    await user.click(await screen.findByTitle('2'));
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/admin/push/records?page=2&pageSize=20')).toBe(true),
    );
    await waitFor(() => expect(bodyRows().length).toBe(12));
  });

  it('writes the type and the reason in words, and shows a code it does not know as it is', async () => {
    stubFetch(() =>
      jsonResponse(
        200,
        envelope('200', {
          items: [
            {
              id: 'a',
              accountId: 'acc-1',
              pushType: 'announcement',
              triggerReason: 'admin',
              localDate: '2026-10-01',
              createdAt: '2026-10-01T10:00:00.000Z',
            },
            {
              id: 'b',
              accountId: 'acc-2',
              pushType: 'future_type',
              triggerReason: 'future_reason',
              localDate: '2026-10-02',
              createdAt: '2026-10-02T10:00:00.000Z',
            },
          ],
          total: 2,
        }),
      ),
    );
    renderPage(<RecordsPage />);
    await waitFor(() => expect(bodyRows().length).toBe(2));
    expect(cells(bodyRows()[0])).toEqual(
      expect.arrayContaining(['Announcement', 'Sent by an administrator']),
    );
    expect(cells(bodyRows()[1])).toEqual(expect.arrayContaining(['future_type', 'future_reason']));
  });

  it('holds an account id of 300 characters and one in Arabic in the cell, and survives values that are not text', async () => {
    stubFetch(() =>
      jsonResponse(
        200,
        envelope('200', {
          items: [
            {
              id: 'a',
              accountId: 'ب'.repeat(300),
              pushType: 'recall',
              triggerReason: 'daily_recall',
              localDate: '2026-10-01',
              createdAt: '2026-10-01T10:00:00.000Z',
            },
            {
              id: 'b',
              accountId: { x: 1 },
              pushType: 5,
              triggerReason: null,
              localDate: null,
              createdAt: 12,
            },
          ],
          total: 2,
        }),
      ),
    );
    renderPage(<RecordsPage />);
    await waitFor(() => expect(bodyRows().length).toBe(2));
    expect(screen.getByText('ب'.repeat(300))).toBeInTheDocument();
    expect(document.body.textContent).toContain('{"x":1}');
  });

  it('says why in the words of the error code when the list cannot be read', async () => {
    stubFetch(() => jsonResponse(500, envelope('INTERNAL_ERROR', null, 'raw backend words')));
    renderPage(<RecordsPage />);
    const alert = await screen.findByText(/Failed to load/);
    expect(alert.closest('.ant-alert-error')).not.toBeNull();
    expect(document.body.textContent).not.toContain('raw backend words');
  });
});

describe('the send record page: the result for each token', { timeout: 30000 }, () => {
  const expand = async (user: ReturnType<typeof userEvent.setup>, index: number) => {
    await waitFor(() => expect(bodyRows().length).toBeGreaterThan(index));
    const row = bodyRows()[index];
    await user.click(within(row as HTMLElement).getByRole('button', { name: /expand/i }));
    return row;
  };

  it('opens a row, reads that record and shows one line for each token with the result in words', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<RecordsPage />);
    // record n = 2 was sent to 1 + 2 % 3 = 3 tokens; the results cycle through the list
    await expand(user, 1);
    await waitFor(() =>
      expect(calls.some((c) => c.url === `/api/admin/push/records/${recordId(2)}`)).toBe(true),
    );
    const expected = pushState.deliveries.filter((d) => d.pushId === recordId(2));
    expect(expected).toHaveLength(3);
    const detail = await screen.findByTestId('deliveries');
    for (const d of expected) expect(within(detail).getByText(d.pushTokenId)).toBeInTheDocument();
    expect(within(detail).getAllByRole('row').length).toBe(1 + 3); // header and three tokens
    expect(within(detail).getByText('Token no longer valid')).toBeInTheDocument();
    expect(within(detail).getAllByText('Accepted by the push service').length).toBeGreaterThan(0);
  });

  it('reads a record once for each time it is opened and does not read the records that stay closed', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<RecordsPage />);
    await waitFor(() => expect(bodyRows().length).toBe(20));
    expect(calls.filter((c) => /push\/records\/rec-/.test(c.url))).toHaveLength(0);
    await expand(user, 0);
    await screen.findByTestId('deliveries');
    expect(calls.filter((c) => /push\/records\/rec-/.test(c.url))).toHaveLength(1);
  });

  it('says so when a record has no result for any token', async () => {
    backend();
    pushState.deliveries = pushState.deliveries.filter((d) => d.pushId !== recordId(1));
    const user = userEvent.setup();
    renderPage(<RecordsPage />);
    await expand(user, 0);
    expect(await screen.findByText('No result was recorded for this push.')).toBeInTheDocument();
  });

  it('says why in the words of the error code when the result cannot be read, with a retry that reads it again', async () => {
    // the list and the detail come from this stub: the detail fails first, then works
    let failing = true;
    stubFetch(({ url }) => {
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
      if (failing)
        return jsonResponse(404, envelope('RESOURCE_NOT_FOUND', null, 'raw backend words'));
      return jsonResponse(
        200,
        envelope('200', {
          id: 'x1',
          accountId: 'acc-9',
          pushType: 'recall',
          triggerReason: 'daily_recall',
          localDate: '2026-10-01',
          createdAt: '2026-10-01T10:00:00.000Z',
          deliveries: [
            {
              id: 'd1',
              pushId: 'x1',
              pushTokenId: 'tok-77',
              result: 'FAILED',
              sentAt: '2026-10-01T10:00:01.000Z',
            },
          ],
        }),
      );
    });
    const user = userEvent.setup();
    renderPage(<RecordsPage />);
    await expand(user, 0);
    expect(
      await screen.findByText(/The results could not be read: The item was not found\./),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw backend words');
    failing = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('tok-77')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('shows a result code it does not know as it is, and survives a delivery with values that are not text', async () => {
    stubFetch(({ url }) => {
      const u = new URL(url, 'http://localhost');
      if (u.pathname === '/api/admin/push/records') {
        return jsonResponse(
          200,
          envelope('200', {
            items: [
              {
                id: 'x1',
                accountId: 'a',
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
      return jsonResponse(
        200,
        envelope('200', {
          id: 'x1',
          deliveries: [
            { id: 'd1', pushTokenId: 't-1', result: 'THROTTLED', sentAt: 12 },
            { id: 'd2', pushTokenId: { a: 1 }, result: null, sentAt: null },
          ],
        }),
      );
    });
    const user = userEvent.setup();
    renderPage(<RecordsPage />);
    await expand(user, 0);
    expect(await screen.findByText('THROTTLED')).toBeInTheDocument();
    expect(screen.getByText('t-1')).toBeInTheDocument();
  });

  it('draws in Chinese', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<RecordsPage />, 'zh-CN');
    await expand(user, 1);
    const detail = await screen.findByTestId('deliveries');
    expect(within(detail).getByText('对每个 token 的发送结果')).toBeInTheDocument();
    expect(within(detail).getByText('Token 已失效')).toBeInTheDocument();
  });
});
