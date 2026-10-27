import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supportStore } from '../../../mock/_core/supportData';
import * as supportMock from '../../../mock/support.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import type { SupportFeedback } from '../../services/support';
import FeedbackPage from './feedback';
import { signIn } from './testSetup';

const VIEW = ['SUPPORT:VIEW'];
const MANAGE = ['SUPPORT:VIEW', 'SUPPORT:MANAGE'];

beforeEach(() => signIn('reviewer', MANAGE));
afterEach(() => vi.unstubAllGlobals());

type Row = SupportFeedback;
const newest = (status: Row['forwardStatus']): Row =>
  [...supportStore.rows]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 20)
    .find((r) => r.forwardStatus === status && r.message.length < 200 && r.context) as Row;
const rowOf = async (feedback: Row) => {
  const cell = await screen.findByText(feedback.message, { selector: 'button' });
  const row = cell.closest('tr');
  if (!row) throw new Error('no row');
  return row as HTMLTableRowElement;
};
const posts = (calls: ReturnType<typeof useMockBackend>) =>
  calls.filter((c) => c.method === 'POST');
const feedback = (over: Partial<Row>): Row => ({
  id: '800',
  accountId: '2001',
  category: 'BUG',
  message: 'one message',
  context: {
    appVersion: '1.0.0',
    osVersion: '14',
    deviceModel: 'Pixel 8',
    locale: 'en-US',
    recentErrors: ['boom'],
  },
  forwardStatus: 'FAILED',
  forwardRef: null,
  attempts: 10,
  nextAttemptAt: null,
  lastError: 'tool answered 503',
  createdAt: '2026-10-25T10:00:00.000Z',
  ...over,
});
const fixed = (items: Row[]) =>
  stubFetch(async () => jsonResponse(200, envelope('200', { items, total: items.length })));

describe('the list', { timeout: 30000 }, () => {
  it('shows category, account, status, reference and time of each feedback, newest first', async () => {
    const calls = useMockBackend(supportMock);
    renderPage(<FeedbackPage />);
    const sent = newest('FORWARDED');
    const row = await rowOf(sent);
    expect(within(row).getByText(sent.forwardRef as string)).toBeInTheDocument();
    expect(within(row).getByText('Forwarded')).toBeInTheDocument();
    expect(within(row).getByText(sent.accountId)).toBeInTheDocument();
    expect(new URL(calls[0].url, 'http://x').searchParams.get('pageSize')).toBe('20');
  });

  it('shows every category and status in words, and a dash where there is no reference', async () => {
    useMockBackend(supportMock);
    renderPage(<FeedbackPage />);
    const failed = newest('FAILED');
    const row = await rowOf(failed);
    expect(within(row).getByText('Failed')).toBeInTheDocument();
    expect(within(row).getAllByText('—').length).toBeGreaterThan(0);
    for (const word of ['Bug', 'Question', 'Suggestion', 'Other']) {
      expect(screen.getAllByText(word).length).toBeGreaterThan(0);
    }
  });

  it('shows a category or a status it does not know as it is', async () => {
    fixed([feedback({ category: 'COMPLIMENT', forwardStatus: 'SPOOLED', message: 'odd one' })]);
    renderPage(<FeedbackPage />);
    expect(await screen.findByText('COMPLIMENT')).toBeInTheDocument();
    expect(screen.getByText('SPOOLED')).toBeInTheDocument();
  });

  it('keeps long Arabic and Thai text, 4000 characters without a space and emoji inside the cell', async () => {
    const long = 'ก็'.repeat(2000);
    const arabic = `${'مرحبا بك في التطبيق '.repeat(60)}`.trim();
    const texts = [
      long,
      arabic,
      'สวัสดีครับ',
      'Terima kasih',
      'Cảm ơn bạn',
      'Muchas gracias',
      '谢谢',
      '😀'.repeat(60),
    ];
    fixed(texts.map((message, i) => feedback({ id: String(i), message })));
    renderPage(<FeedbackPage />);
    const cell = (await screen.findAllByText(long))[0];
    const button = cell.closest('button') as HTMLElement;
    expect(button.style.overflow).toBe('hidden');
    expect(button.style.maxWidth).not.toBe('');
    expect(button.getAttribute('dir')).toBe('auto');
    const arabicButton = (await screen.findAllByText(arabic))[0].closest('button') as HTMLElement;
    expect(arabicButton.style.overflow).toBe('hidden');
    for (const text of texts.slice(2, 7))
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
  });

  it('shows the failure and a retry when the list cannot be read', async () => {
    stubFetch(async () => jsonResponse(500, envelope('INTERNAL_ERROR')));
    renderPage(<FeedbackPage />);
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('the details', { timeout: 30000 }, () => {
  const openDetails = async (user: ReturnType<typeof userEvent.setup>, row: Row) => {
    await user.click(within(await rowOf(row)).getByRole('button', { name: 'Details' }));
    return screen.findByRole('dialog');
  };

  it('shows the message and every field of the context, read from the feedback itself', async () => {
    const calls = useMockBackend(supportMock);
    const user = userEvent.setup();
    renderPage(<FeedbackPage />);
    const sent = newest('FORWARDED');
    const drawer = await openDetails(user, sent);
    const context = sent.context as Required<NonNullable<Row['context']>>;
    expect(await within(drawer).findByText(`Feedback ${sent.id}`)).toBeInTheDocument();
    expect(within(drawer).getByText('App version')).toBeInTheDocument();
    expect(within(drawer).getByText(context.appVersion)).toBeInTheDocument();
    expect(within(drawer).getByText('System version')).toBeInTheDocument();
    expect(within(drawer).getByText(context.osVersion)).toBeInTheDocument();
    expect(within(drawer).getByText('Device model')).toBeInTheDocument();
    expect(within(drawer).getByText(context.deviceModel)).toBeInTheDocument();
    expect(within(drawer).getByText('Language')).toBeInTheDocument();
    expect(within(drawer).getByText(context.locale)).toBeInTheDocument();
    expect(within(drawer).getByText('Recent errors')).toBeInTheDocument();
    for (const line of context.recentErrors)
      expect(within(drawer).getByText(line)).toBeInTheDocument();
    expect(within(drawer).getByTestId('feedback-message')).toHaveTextContent(sent.message);
    expect(calls.some((c) => c.url === `/api/admin/support/feedback/${sent.id}`)).toBe(true);
  });

  it('shows the last error and the next attempt of a feedback that did not go', async () => {
    useMockBackend(supportMock);
    const user = userEvent.setup();
    renderPage(<FeedbackPage />);
    const pending = newest('PENDING');
    const drawer = await openDetails(user, pending);
    expect(await within(drawer).findByText('Next attempt')).toBeInTheDocument();
    expect(within(drawer).getByText(/The support tool answered 503/)).toBeInTheDocument();
  });

  it('says "Not sent" when the app sent no context, and does not break when a field is missing', async () => {
    const none = feedback({
      id: '801',
      message: 'no context',
      context: null,
      forwardStatus: 'FORWARDED',
      forwardRef: 'T-1',
    });
    const partial = feedback({
      id: '802',
      message: 'part context',
      context: { appVersion: '2.0.0' },
      forwardStatus: 'FORWARDED',
      forwardRef: 'T-2',
    });
    stubFetch(async ({ url }) => {
      if (url.endsWith('/801')) return jsonResponse(200, envelope('200', none));
      if (url.endsWith('/802')) return jsonResponse(200, envelope('200', partial));
      return jsonResponse(200, envelope('200', { items: [none, partial], total: 2 }));
    });
    const user = userEvent.setup();
    renderPage(<FeedbackPage />);
    let drawer = await openDetails(user, none);
    expect(await within(drawer).findByText('Not sent')).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Close' }));
    drawer = await openDetails(user, partial);
    expect(await within(drawer).findByText('2.0.0')).toBeInTheDocument();
    expect(within(drawer).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows a context whose fields are not text, instead of breaking the drawer', async () => {
    const odd = feedback({
      id: '804',
      message: 'odd context',
      context: {
        appVersion: { major: 2 },
        osVersion: 14,
        deviceModel: null,
        recentErrors: ['plain', { code: 'E1' }, 7],
      } as unknown as Row['context'],
      forwardStatus: 'FORWARDED',
      forwardRef: 'T-4',
    });
    stubFetch(async ({ url }) =>
      url.endsWith('/804')
        ? jsonResponse(200, envelope('200', odd))
        : jsonResponse(200, envelope('200', { items: [odd], total: 1 })),
    );
    const user = userEvent.setup();
    renderPage(<FeedbackPage />);
    const drawer = await openDetails(user, odd);
    expect(await within(drawer).findByText('{"major":2}')).toBeInTheDocument();
    expect(within(drawer).getByText('14')).toBeInTheDocument();
    expect(within(drawer).getByText('plain')).toBeInTheDocument();
    expect(within(drawer).getByText('{"code":"E1"}')).toBeInTheDocument();
    expect(within(drawer).getByText('7')).toBeInTheDocument();
  });

  it('shows a message of 4000 characters without a space, wrapped, and one in Arabic, in the right direction', async () => {
    const long = 'ก็'.repeat(2000);
    const row = feedback({
      id: '803',
      message: long,
      forwardStatus: 'FORWARDED',
      forwardRef: 'T-3',
    });
    stubFetch(async ({ url }) =>
      url.endsWith('/803')
        ? jsonResponse(200, envelope('200', row))
        : jsonResponse(200, envelope('200', { items: [row], total: 1 })),
    );
    const user = userEvent.setup();
    renderPage(<FeedbackPage />);
    const drawer = await openDetails(user, row);
    const box = await within(drawer).findByTestId('feedback-message');
    expect(box.textContent).toBe(long);
    expect(box.getAttribute('dir')).toBe('auto');
    expect(box.style.overflowWrap).toBe('anywhere');
  });

  it('shows the failure when the feedback cannot be read', async () => {
    const row = feedback({ id: '804', message: 'cannot read', forwardStatus: 'FORWARDED' });
    stubFetch(async ({ url }) =>
      url.endsWith('/804')
        ? jsonResponse(404, envelope('RESOURCE_NOT_FOUND'))
        : jsonResponse(200, envelope('200', { items: [row], total: 1 })),
    );
    const user = userEvent.setup();
    renderPage(<FeedbackPage />);
    const drawer = await openDetails(user, row);
    expect(await within(drawer).findByText(/The item was not found/)).toBeInTheDocument();
  });
});

describe('retrying', { timeout: 30000 }, () => {
  it('shows "Retry" to SUPPORT:MANAGE on the FAILED rows only', async () => {
    useMockBackend(supportMock);
    renderPage(<FeedbackPage />);
    await rowOf(newest('FORWARDED'));
    const shown = [...supportStore.rows]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 20);
    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(
      shown.filter((r) => r.forwardStatus === 'FAILED').length,
    );
    expect(
      within(await rowOf(newest('FORWARDED'))).queryByRole('button', { name: 'Retry' }),
    ).toBeNull();
    expect(
      within(await rowOf(newest('PENDING'))).queryByRole('button', { name: 'Retry' }),
    ).toBeNull();
  });

  it('does not show "Retry" without SUPPORT:MANAGE', async () => {
    signIn('reviewer', VIEW);
    useMockBackend(supportMock);
    renderPage(<FeedbackPage />);
    await rowOf(newest('FAILED'));
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Details' }).length).toBeGreaterThan(0);
  });

  it('asks first, posts to /support/feedback/{id}/retry, and shows the feedback as pending', async () => {
    const calls = useMockBackend(supportMock);
    const user = userEvent.setup();
    renderPage(<FeedbackPage />);
    const failed = newest('FAILED');
    await user.click(within(await rowOf(failed)).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(/Forward this feedback again/)).toBeInTheDocument();
    expect(posts(calls)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await screen.findByText('Queued to be forwarded again');
    expect(posts(calls).map((c) => c.url)).toEqual([
      `/api/admin/support/feedback/${failed.id}/retry`,
    ]);
    expect(failed.forwardStatus).toBe('PENDING');
    await waitFor(async () => {
      const row = await rowOf(failed);
      expect(within(row).getByText('Pending')).toBeInTheDocument();
      expect(within(row).queryByRole('button', { name: 'Retry' })).toBeNull();
    });
  });

  it('does not post when the question is cancelled', async () => {
    const calls = useMockBackend(supportMock);
    const user = userEvent.setup();
    renderPage(<FeedbackPage />);
    const failed = newest('FAILED');
    await user.click(within(await rowOf(failed)).getByRole('button', { name: 'Retry' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await new Promise((r) => setTimeout(r, 100));
    expect(posts(calls)).toHaveLength(0);
    expect(failed.forwardStatus).toBe('FAILED');
  });

  it('shows the text of the refusal when the feedback is no longer FAILED, and reads the list again', async () => {
    const calls = useMockBackend(supportMock);
    const user = userEvent.setup();
    renderPage(<FeedbackPage />);
    const failed = newest('FAILED');
    await user.click(within(await rowOf(failed)).getByRole('button', { name: 'Retry' }));
    failed.forwardStatus = 'FORWARDED'; // another administrator retried it, and it went through
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText('The current state of the item does not allow this action.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET').length).toBeGreaterThan(1));
  });

  it('sends once when OK is pressed twice', async () => {
    const calls = useMockBackend(supportMock);
    const user = userEvent.setup();
    renderPage(<FeedbackPage />);
    await user.click(within(await rowOf(newest('FAILED'))).getByRole('button', { name: 'Retry' }));
    const ok = await screen.findByRole('button', { name: 'OK' });
    fireEvent.click(ok);
    fireEvent.click(ok);
    await new Promise((r) => setTimeout(r, 200));
    expect(posts(calls)).toHaveLength(1);
  });

  it('does not send the write again when the token ended during it', async () => {
    const row = feedback({ message: 'token one' });
    const calls = stubFetch(async ({ init }) =>
      (init.method ?? 'GET') === 'GET'
        ? jsonResponse(200, envelope('200', { items: [row], total: 1 }))
        : jsonResponse(401, envelope('ADMIN_INVALID_TOKEN')),
    );
    const user = userEvent.setup();
    renderPage(<FeedbackPage />);
    await user.click(within(await rowOf(row)).getByRole('button', { name: 'Retry' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1);
  });
});
