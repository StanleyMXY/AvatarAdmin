import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moderationState, RECORD_ID } from '../../../mock/_core/moderationData';
import * as moderationMock from '../../../mock/moderation.mock';
import { envelope, jsonResponse } from '../../../tests/httpStubs';
import { useMockBackend as installMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { withTimeZone } from '../../../tests/withTimeZone';
import QueuePage from './queue';
import { chooseOption, expandSearch, interceptFetch, signIn } from './testSetup';

beforeEach(() => signIn('reviewer'));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const rowOf = async (id: string) => {
  const link = await screen.findByRole('link', { name: id });
  const row = link.closest('tr');
  if (!row) throw new Error(`no row for ${id}`);
  return row as HTMLTableRowElement;
};
const listCalls = (calls: { url: string }[]) =>
  calls.filter((c) => c.url.includes('/moderation/records?'));

describe('the review queue', { timeout: 30000 }, () => {
  it('lists the oldest waiting record first, with its type, source, status and how long it has waited', async () => {
    installMockBackend(moderationMock);
    renderPage(<QueuePage />);
    const row = await rowOf(RECORD_ID.oldestImage);
    const rows = screen.getAllByRole('row').filter((r) => r.querySelector('td'));
    expect(rows[0]).toBe(row);
    expect(within(row).getByText('Generated standard image')).toBeInTheDocument();
    expect(within(row).getByText('Automatic')).toBeInTheDocument();
    expect(within(row).getByText('Medium risk')).toBeInTheDocument();
    expect(within(row).getByText('Waiting for review')).toBeInTheDocument();
    expect(within(row).getByText('0.72')).toBeInTheDocument();
    expect(within(row).getByText(/^3 d 4 h$/)).toBeInTheDocument();
  });

  it('has a column for the waiting time and one for the creation time, with the time of the record in each', async () => {
    installMockBackend(moderationMock);
    renderPage(<QueuePage />);
    const row = await rowOf(RECORD_ID.oldestImage);
    const headers = [...document.querySelectorAll('.ant-table-thead th')].map(
      (th) => th.textContent,
    );
    expect(headers).toEqual(
      expect.arrayContaining([
        'Waiting',
        'Created',
        'Status',
        'Record ID',
        'Content type',
        'Source',
        'Automatic level',
        'Categories',
        'Score',
      ]),
    );
    expect(headers.filter((h) => h === 'Waiting' || h === 'Created')).toHaveLength(2);
    const created = moderationState.records.find((r) => r.id === RECORD_ID.oldestImage)
      ?.createdAt as string;
    expect(
      within(row).getByText(
        new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23',
        }).format(new Date(created)),
      ),
    ).toBeInTheDocument();
  });

  it('shows the longest wait at the top of the page', async () => {
    installMockBackend(moderationMock);
    renderPage(<QueuePage />);
    expect(await screen.findByTestId('moderation-oldest')).toHaveTextContent(
      'The oldest waiting record has waited 3 d 4 h',
    );
  });

  it('says that nothing is waiting, and does not show a zero, when nothing is', async () => {
    moderationState.records = moderationState.records.filter((r) => r.status !== 'PENDING_REVIEW');
    installMockBackend(moderationMock);
    renderPage(<QueuePage />);
    expect(await screen.findByTestId('moderation-oldest')).toHaveTextContent(
      'No record is waiting',
    );
  });

  it('asks the statistics for the current UTC day, not the local one', async () => {
    await withTimeZone('Asia/Singapore', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-26T17:30:00Z')); // 27 October 01:30 in Singapore
      const calls = installMockBackend(moderationMock);
      renderPage(<QueuePage />);
      await waitFor(() =>
        expect(calls.some((c) => c.url.includes('/moderation/stats'))).toBe(true),
      );
      const url = new URL(
        calls.find((c) => c.url.includes('/moderation/stats'))?.url as string,
        'http://x',
      );
      expect(url.searchParams.get('from')).toBe('2026-10-26');
      expect(url.searchParams.get('to')).toBe('2026-10-26');
    });
  });

  it('shows the translated text and a retry when the waiting time cannot be read, and the list still loads', async () => {
    installMockBackend(moderationMock);
    interceptFetch((url) =>
      url.includes('/moderation/stats')
        ? jsonResponse(503, envelope('TEMPORARILY_UNAVAILABLE', null, 'raw backend words'))
        : undefined,
    );
    renderPage(<QueuePage />);
    expect(
      await screen.findByText(/waiting time of the oldest record could not be read/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/raw backend words/)).toBeNull();
    expect(await rowOf(RECORD_ID.oldestImage)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows a dash instead of a waiting time for a record that was handled', async () => {
    installMockBackend(moderationMock);
    const user = userEvent.setup();
    renderPage(<QueuePage />);
    await rowOf(RECORD_ID.oldestImage);
    await expandSearch(user);
    await chooseOption(user, 'Status', 'Approved');
    await user.click(screen.getByRole('button', { name: /查\s*询|Query|Search/ }));
    const row = await rowOf(RECORD_ID.approved);
    expect(within(row).getByText('Approved')).toBeInTheDocument();
    expect(within(row).getAllByText('—').length).toBeGreaterThanOrEqual(1);
    expect(within(row).queryByText(/ d | h | min /)).toBeNull();
  });

  it('links each record to its detail page', async () => {
    installMockBackend(moderationMock);
    renderPage(<QueuePage />);
    const row = await rowOf(RECORD_ID.reportedAvatar);
    expect(within(row).getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      `/moderation/${RECORD_ID.reportedAvatar}`,
    );
  });

  it('has Complaint among the sources and the generated image and the action clip among the content types, and sends what is chosen', async () => {
    const calls = installMockBackend(moderationMock);
    const user = userEvent.setup();
    renderPage(<QueuePage />);
    await rowOf(RECORD_ID.oldestImage);
    await expandSearch(user);

    await user.click(screen.getByRole('combobox', { name: 'Source' }));
    const optionTexts = async () =>
      (await screen.findAllByText(/.+/, { selector: '.ant-select-item-option-content' })).map(
        (o) => o.textContent,
      );
    await waitFor(async () =>
      expect(await optionTexts()).toEqual(
        expect.arrayContaining(['Automatic', 'Report', 'Complaint']),
      ),
    );
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('combobox', { name: 'Content type' }));
    await waitFor(async () =>
      expect(await optionTexts()).toEqual(
        expect.arrayContaining([
          'Generated standard image',
          'Action clip',
          'Avatar photo',
          'Voice sample',
          'Message',
          'Persona',
          'Companion name',
        ]),
      ),
    );
    await user.keyboard('{Escape}');

    await chooseOption(user, 'Source', 'Complaint');
    await chooseOption(user, 'Content type', 'Action clip');
    await user.click(screen.getByRole('button', { name: /查\s*询|Query|Search/ }));
    await waitFor(() => {
      const last = listCalls(calls).at(-1)?.url as string;
      expect(last).toContain('source=COMPLAINT');
      expect(last).toContain('contentType=ACTION_CLIP');
    });
  });

  it('sends no filter when none is chosen', async () => {
    const calls = installMockBackend(moderationMock);
    renderPage(<QueuePage />);
    await rowOf(RECORD_ID.oldestImage);
    expect(listCalls(calls)[0].url).toBe('/api/admin/moderation/records?page=1&pageSize=20');
  });

  it('keeps a category of 5000 characters without spaces inside its cell, in Thai and in Arabic', async () => {
    for (const text of ['ก'.repeat(5000), 'ع'.repeat(5000)]) {
      const first = moderationState.records.find((r) => r.id === RECORD_ID.oldestImage);
      if (first) first.categories = [text];
      installMockBackend(moderationMock);
      const view = renderPage(<QueuePage />);
      const row = await rowOf(RECORD_ID.oldestImage);
      const cell = within(row)
        .getAllByRole('button')
        .find((b) => b.textContent === text);
      expect(cell).toBeTruthy();
      expect(cell).toHaveStyle({ overflowWrap: 'anywhere', overflow: 'hidden' });
      view.unmount();
    }
  });

  it('shows a refusal of the list with the translated text and a retry', async () => {
    installMockBackend(moderationMock);
    interceptFetch((url) =>
      url.includes('/moderation/records?')
        ? jsonResponse(403, envelope('ADMIN_FORBIDDEN'))
        : undefined,
    );
    renderPage(<QueuePage />);
    expect(await screen.findByText(/You do not have permission to do this/)).toBeInTheDocument();
  });
});
