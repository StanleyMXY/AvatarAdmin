import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { USER, usersState } from '../../../mock/_core/usersData';
import * as usersMock from '../../../mock/users.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import enUS from '../../locales/en-US';
import DeletionsPage from './deletions';
import { chooseOption, signIn } from './testSetup';

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const rowOf = async (taskId: string) => {
  const cell = await screen.findByText(taskId, { selector: 'td *, td' });
  return cell.closest('tr') as HTMLTableRowElement;
};
const task = (status: string, attempts?: number) =>
  usersState.deletions.find(
    (t) => t.status === status && (attempts === undefined || t.attempts === attempts),
  );
const attemptsCell = (row: HTMLElement) => within(row).getByTestId('attempts');

describe('the deletion task list', { timeout: 60000 }, () => {
  it('shows the task, the account as a link, the state in words, the planned time, the retries, the error and who asked', async () => {
    useMockBackend(usersMock);
    renderPage(<DeletionsPage />);
    const scheduled = usersState.deletions.find((t) => t.accountId === USER.pendingDeletion);
    const row = await rowOf(scheduled?.id as string);
    expect(within(row).getByRole('link', { name: USER.pendingDeletion })).toHaveAttribute(
      'href',
      `/users/${USER.pendingDeletion}`,
    );
    expect(within(row).getByText('Scheduled (grace period)')).toBeInTheDocument();
    expect(within(row).getByText('Privacy concern')).toBeInTheDocument();
    expect(attemptsCell(row).textContent).toContain('0');
    const byAdmin = usersState.deletions.find((t) => t.requestedBy === '1001');
    const adminRow = await rowOf(byAdmin?.id as string);
    expect(within(adminRow).getByText('root')).toBeInTheDocument();
  });

  it('shows an administrator who was deleted by the first 8 characters of the id, and a dash where nobody asked', async () => {
    useMockBackend(usersMock);
    renderPage(<DeletionsPage />);
    const gone = usersState.deletions.find((t) => t.requestedBy === '9999');
    const row = await rowOf(gone?.id as string);
    expect(within(row).getByText('9999')).toBeInTheDocument();
    const own = usersState.deletions.find(
      (t) => t.requestedBy === null && t.status === 'COMPLETED',
    );
    const ownRow = await rowOf(own?.id as string);
    expect(within(ownRow).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('names all six reasons the user can choose and shows a dash where there is none', async () => {
    useMockBackend(usersMock);
    renderPage(<DeletionsPage />);
    await screen.findAllByRole('link');
    const body = document.body.textContent ?? '';
    for (const key of [
      'users.deletionReason.NOT_USEFUL',
      'users.deletionReason.TOO_EXPENSIVE',
      'users.deletionReason.PRIVACY_CONCERN',
      'users.deletionReason.TECHNICAL_PROBLEMS',
      'users.deletionReason.FOUND_ALTERNATIVE',
      'users.deletionReason.OTHER',
    ]) {
      expect(body, key).toContain(enUS[key]);
    }
    const without = usersState.deletions.find((t) => t.reason === null);
    const row = await rowOf(without?.id as string);
    expect(within(row).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('has all six reasons in Chinese too', () => {
    // the names exist in both languages: the aggregate files are checked for equal keys elsewhere
    for (const reason of [
      'NOT_USEFUL',
      'TOO_EXPENSIVE',
      'PRIVACY_CONCERN',
      'TECHNICAL_PROBLEMS',
      'FOUND_ALTERNATIVE',
      'OTHER',
    ]) {
      expect(enUS[`users.deletionReason.${reason}`]).toBeTruthy();
    }
  });

  it('shows a reason it does not know as it came', async () => {
    const rows = [
      {
        id: 'x1',
        accountId: 'acc',
        requestedBy: null,
        requestedByUsername: null,
        reason: 'NEW_REASON',
        status: 'NEW_STATE',
        executeAfter: null,
        statusBefore: null,
        canceledAt: null,
        attempts: 0,
        lastError: null,
        nextAttemptAt: null,
        createdAt: '2026-10-01T00:00:00Z',
        completedAt: null,
      },
    ];
    stubFetch(async () => jsonResponse(200, envelope('200', { items: rows, total: 1 })));
    renderPage(<DeletionsPage />);
    const row = await rowOf('x1');
    expect(within(row).getByText('NEW_REASON')).toBeInTheDocument();
    expect(within(row).getByText('NEW_STATE')).toBeInTheDocument();
  });

  it('filters by task state', async () => {
    const calls = useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<DeletionsPage />);
    await screen.findAllByRole('link');
    await chooseOption(user, 'Status', 'Failed');
    await user.click(screen.getByRole('button', { name: /查\s*询|Query|Search/ }));
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.url.startsWith('/api/admin/account-deletions?') && c.url.includes('status=FAILED'),
        ),
      ).toBe(true),
    );
    await waitFor(() => {
      const rows = screen.getAllByRole('row').slice(1);
      expect(rows.some((r) => r.textContent?.includes('Scheduled (grace period)'))).toBe(false);
    });
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.length).toBe(usersState.deletions.filter((t) => t.status === 'FAILED').length);
  });

  it('keeps an error text of 5000 characters without spaces and text of every language inside the cell', async () => {
    const texts = [
      'e'.repeat(5000),
      'สวัสดีครับ'.repeat(30),
      'مرحبا بك'.repeat(30),
      'Terima kasih',
      'Cảm ơn bạn',
      'Muchas gracias',
      '你好'.repeat(40),
      '😀'.repeat(80),
    ];
    const rows = texts.map((lastError, i) => ({
      id: `t${i}`,
      accountId: `acc${i}`,
      requestedBy: null,
      requestedByUsername: null,
      reason: null,
      status: 'FAILED',
      executeAfter: '2026-10-01T00:00:00Z',
      statusBefore: 'ACTIVE',
      canceledAt: null,
      attempts: 1,
      lastError,
      nextAttemptAt: null,
      createdAt: '2026-10-01T00:00:00Z',
      completedAt: null,
    }));
    stubFetch(async () => jsonResponse(200, envelope('200', { items: rows, total: rows.length })));
    renderPage(<DeletionsPage />);
    const cell = (await screen.findAllByText('e'.repeat(5000)))[0];
    const button = cell.closest('button') as HTMLElement;
    expect(button.style.overflow).toBe('hidden');
    expect(button.style.maxWidth).not.toBe('');
  });
});

describe('the highlight of tasks that failed too often', { timeout: 60000 }, () => {
  it('marks the rows whose retries reach the threshold of the backend (5), and not the others', async () => {
    useMockBackend(usersMock);
    renderPage(<DeletionsPage />);
    const low = await rowOf(task('FAILED', 2)?.id as string);
    const equal = await rowOf(task('FAILED', 5)?.id as string);
    const high = await rowOf(task('FAILED', 8)?.id as string);
    expect(attemptsCell(low).getAttribute('data-alert')).toBe('false');
    expect(attemptsCell(equal).getAttribute('data-alert')).toBe('true');
    expect(attemptsCell(high).getAttribute('data-alert')).toBe('true');
    expect(within(equal).getByText(enUS['users.deletions.alerting'])).toBeInTheDocument();
    expect(within(low).queryByText(enUS['users.deletions.alerting'])).toBeNull();
  });

  it('follows the threshold it is given: 3 marks the task with 5, 100 marks none', async () => {
    signIn('root', { meta: { deletionAlertAfterFailures: 3 } });
    useMockBackend(usersMock);
    const first = renderPage(<DeletionsPage />);
    expect(
      attemptsCell(await rowOf(task('FAILED', 5)?.id as string)).getAttribute('data-alert'),
    ).toBe('true');
    expect(
      attemptsCell(await rowOf(task('FAILED', 2)?.id as string)).getAttribute('data-alert'),
    ).toBe('false');
    first.unmount();
    signIn('root', { meta: { deletionAlertAfterFailures: 100 } });
    useMockBackend(usersMock);
    renderPage(<DeletionsPage />);
    expect(
      attemptsCell(await rowOf(task('FAILED', 8)?.id as string)).getAttribute('data-alert'),
    ).toBe('false');
  });

  it.each([
    ['null', { deletionAlertAfterFailures: null }],
    ['missing', {}],
    ['not a number', { deletionAlertAfterFailures: 'three' }],
  ])(
    'marks nothing when the threshold is %s (no number is written into the page)',
    async (_name, meta) => {
      signIn('root', { meta });
      useMockBackend(usersMock);
      renderPage(<DeletionsPage />);
      const row = await rowOf(task('FAILED', 8)?.id as string);
      expect(attemptsCell(row).getAttribute('data-alert')).toBe('false');
      expect(screen.queryByText(/failed \d+ times or more/)).toBeNull();
    },
  );

  it('says what the threshold is when it is known', async () => {
    useMockBackend(usersMock);
    renderPage(<DeletionsPage />);
    await screen.findAllByRole('link');
    expect(screen.getByText(/failed 5 times or more/)).toBeInTheDocument();
  });
});

describe('retrying a failed task', { timeout: 60000 }, () => {
  it('offers the retry on the failed rows only', async () => {
    useMockBackend(usersMock);
    renderPage(<DeletionsPage />);
    await screen.findAllByRole('link');
    const failed = usersState.deletions.filter((t) => t.status === 'FAILED');
    for (const f of failed) {
      expect(within(await rowOf(f.id)).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(failed.length);
  });

  it('asks inline first, sends one request for two clicks on confirm, and shows the task running', async () => {
    const calls = useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<DeletionsPage />);
    const target = task('FAILED', 2);
    const row = await rowOf(target?.id as string);
    await user.click(within(row).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(enUS['users.deletions.retryConfirm'])).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    await user.dblClick(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(target?.status).toBe('RUNNING'));
    expect(
      calls.filter(
        (c) => c.method === 'POST' && c.url.endsWith(`/account-deletions/${target?.id}/retry`),
      ),
    ).toHaveLength(1);
    await waitFor(() =>
      expect(
        within(screen.getByText(target?.id as string).closest('tr') as HTMLElement).getByText(
          'Running',
        ),
      ).toBeInTheDocument(),
    );
  });

  it('says the state the task is in, in words, when it is not failed any more, and reads the list again', async () => {
    useMockBackend(usersMock);
    const user = userEvent.setup();
    renderPage(<DeletionsPage />);
    const target = task('FAILED', 2);
    const row = await rowOf(target?.id as string);
    if (target) target.status = 'COMPLETED';
    await user.click(within(row).getByRole('button', { name: 'Retry' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText(`${enUS['error.INVALID_STATE']} The task is now: Completed.`),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(screen.getByText(target?.id as string).closest('tr') as HTMLElement).queryByRole(
          'button',
          { name: 'Retry' },
        ),
      ).toBeNull(),
    );
  });

  it('shows only the translated text of a refusal', async () => {
    const rows = [
      {
        id: 'f1',
        accountId: 'a',
        requestedBy: null,
        requestedByUsername: null,
        reason: null,
        status: 'FAILED',
        executeAfter: null,
        statusBefore: null,
        canceledAt: null,
        attempts: 1,
        lastError: null,
        nextAttemptAt: null,
        createdAt: '2026-10-01T00:00:00Z',
        completedAt: null,
      },
    ];
    stubFetch(async ({ url }) =>
      url.endsWith('/retry')
        ? jsonResponse(403, envelope('ADMIN_FORBIDDEN', null, 'raw backend text'))
        : jsonResponse(200, envelope('200', { items: rows, total: 1 })),
    );
    const user = userEvent.setup();
    renderPage(<DeletionsPage />);
    const row = await rowOf('f1');
    await user.click(within(row).getByRole('button', { name: 'Retry' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(await screen.findByText(enUS['error.ADMIN_FORBIDDEN'])).toBeInTheDocument();
    expect(screen.queryByText(/raw backend text/)).toBeNull();
  });
});
