import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moderationState } from '../../../mock/_core/moderationData';
import * as moderationMock from '../../../mock/moderation.mock';
import { envelope, jsonResponse } from '../../../tests/httpStubs';
import { useMockBackend as installMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { withTimeZone } from '../../../tests/withTimeZone';
import StatsPage from './stats';
import { interceptFetch, signIn } from './testSetup';

beforeEach(() => signIn('reviewer'));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const statsUrl = (calls: { url: string }[]) =>
  new URL(
    calls.filter((c) => c.url.includes('/moderation/stats')).at(-1)?.url as string,
    'http://x',
  );
const statValue = (testId: string) =>
  screen.getByTestId(testId).querySelector('.ant-statistic-content-value')?.textContent;

describe('the moderation statistics page', { timeout: 30000 }, () => {
  it('asks for the last 7 UTC days, including today, and says the days are UTC', async () => {
    const calls = installMockBackend(moderationMock);
    renderPage(<StatsPage />);
    await screen.findByTestId('moderation-total-created');
    const url = statsUrl(calls);
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
      const calls = installMockBackend(moderationMock);
      renderPage(<StatsPage />);
      await waitFor(() =>
        expect(calls.some((c) => c.url.includes('/moderation/stats'))).toBe(true),
      );
      expect(statsUrl(calls).searchParams.get('to')).toBe('2026-10-26');
      expect(statsUrl(calls).searchParams.get('from')).toBe('2026-10-20');
    });
  });

  it('shows the four totals, the average handling time and the longest wait', async () => {
    installMockBackend(moderationMock);
    renderPage(<StatsPage />);
    await screen.findByTestId('moderation-total-created');
    const created = moderationState.records.length;
    expect(statValue('moderation-total-created')).toBe(String(created));
    expect(statValue('moderation-total-blocked')).toBe('1');
    const approved = moderationState.records.filter((r) => r.status === 'APPROVED').length;
    const rejected = moderationState.records.filter((r) => r.status === 'REJECTED').length;
    expect(statValue('moderation-total-approved')).toBe(String(approved));
    expect(statValue('moderation-total-rejected')).toBe(String(rejected));
    expect(statValue('moderation-oldest-pending')).toMatch(/^3 d 4 h$/);
    expect(statValue('moderation-avg-handle')).toMatch(/h|min/);
  });

  it('shows a dash, not 0 or NaN, for the average and the longest wait when they are null', async () => {
    moderationState.records = moderationState.records.filter((r) => r.status === 'BLOCKED');
    installMockBackend(moderationMock);
    renderPage(<StatsPage />);
    await screen.findByTestId('moderation-total-created');
    expect(statValue('moderation-avg-handle')).toBe('—');
    expect(statValue('moderation-oldest-pending')).toBe('—');
    expect(document.body.textContent).not.toMatch(/NaN|null|undefined/);
  });

  it('lists the rows by day, content type and source, newest day first, with the names of the types', async () => {
    installMockBackend(moderationMock);
    renderPage(<StatsPage />);
    await screen.findByTestId('moderation-total-created');
    const table = document.querySelector('.ant-table') as HTMLElement;
    expect(within(table).getAllByText('Message').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Report').length).toBeGreaterThan(0);
    const days = [...table.querySelectorAll('tbody tr td:first-child')].map((c) => c.textContent);
    expect(days).toEqual([...days].sort().reverse());
  });

  it('says that there are no records when the range has none', async () => {
    moderationState.records = [];
    installMockBackend(moderationMock);
    renderPage(<StatsPage />);
    expect(await screen.findByText('No records in this range')).toBeInTheDocument();
    expect(statValue('moderation-total-created')).toBe('0');
  });

  it('shows the translated text and a retry when the statistics cannot be read', async () => {
    let failing = true;
    installMockBackend(moderationMock);
    interceptFetch((url) =>
      failing && url.includes('/moderation/stats')
        ? jsonResponse(
            400,
            envelope(
              'INVALID_REQUEST',
              { details: [{ ref: 'to', reason: 'OUT_OF_RANGE' }] },
              'raw backend words',
            ),
          )
        : undefined,
    );
    renderPage(<StatsPage />);
    expect(
      await screen.findByText(/The moderation statistics could not be loaded/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/raw backend words/)).toBeNull();
    failing = false;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('moderation-total-created')).toBeInTheDocument();
  });
});
