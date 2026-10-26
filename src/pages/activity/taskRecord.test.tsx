import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import activityMock from '../../../mock/activity.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import TaskRecordPage from './taskRecord';
import { chooseOption, signIn } from './testSetup';

const mock = { default: activityMock };
const OPEN = 'Open the app 📱';

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const record = (over: Record<string, unknown> = {}) => ({
  id: '1',
  accountId: 'acc-1',
  taskId: '2',
  taskName: 'Talk ten minutes',
  taskDate: '2026-10-20',
  currentProgress: 200,
  status: 'IN_PROGRESS',
  timezone: 'Asia/Bangkok',
  windowStartAt: '2026-10-19T17:00:00Z',
  windowEndAt: '2026-10-20T17:00:00Z',
  targetValue: 600,
  rewardCredits: null,
  completedAt: null,
  claimDeadlineAt: null,
  rewardedAt: null,
  creditsGranted: null,
  createdAt: '2026-10-20T01:00:00Z',
  ...over,
});
const answer = (items: unknown[]) =>
  stubFetch(async () => jsonResponse(200, envelope('200', { items, total: items.length })));
const query = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /查\s*询|Query|Search/ }));

describe('the task records page', { timeout: 30000 }, () => {
  it('lists the records of the mock backend with the NAME of the task, never its number, and says the date is a local day', async () => {
    useMockBackend(mock);
    renderPage(<TaskRecordPage />);
    const row = (await screen.findAllByText(OPEN))[0].closest('tr') as HTMLElement;
    expect(within(row).queryByText(/^ID /)).toBeNull();
    expect(screen.getByText('The date is the local day of the user.')).toBeInTheDocument();
    for (const title of [
      'Account ID',
      'Task name',
      'Task date',
      'Progress',
      'Status',
      'Reached at',
      'Claimed at',
      'Credits granted',
      'Created',
    ]) {
      expect(screen.getAllByText(title).length, title).toBeGreaterThan(0);
    }
  });

  it('shows a dash and the id for a task that has been deleted', async () => {
    answer([
      record({ id: '1', taskId: '99', taskName: null }),
      record({ id: '2', taskId: '3', taskName: 'نشاط' }),
    ]);
    renderPage(<TaskRecordPage />);
    const gone = (await screen.findByText('ID 99')).closest('tr') as HTMLElement;
    expect(within(gone).getAllByText('—').length).toBeGreaterThan(0);
    const named = screen.getByText('نشاط').closest('tr') as HTMLElement;
    expect(within(named).queryByText(/^ID /)).toBeNull();
  });

  it('shows the four states in words', async () => {
    answer(
      ['IN_PROGRESS', 'CLAIMABLE', 'REWARDED', 'EXPIRED'].map((status, i) =>
        record({ id: String(i), accountId: `a-${i}`, status }),
      ),
    );
    renderPage(<TaskRecordPage />);
    expect(await screen.findByText('In progress')).toBeInTheDocument();
    for (const word of ['Can be claimed', 'Claimed', 'Expired']) {
      expect(screen.getByText(word)).toBeInTheDocument();
    }
  });

  it('shows the progress with the target, 0 as 0, and an unknown progress as a dash', async () => {
    answer([
      record({ id: '1', accountId: 'a-1', currentProgress: 200, targetValue: 600 }),
      record({ id: '2', accountId: 'a-2', currentProgress: 0, targetValue: 1 }),
      record({ id: '3', accountId: 'a-3', currentProgress: null, targetValue: 5 }),
    ]);
    renderPage(<TaskRecordPage />);
    expect(await screen.findByText('200 / 600')).toBeInTheDocument();
    expect(screen.getByText('0 / 1')).toBeInTheDocument();
    expect(screen.getByText('— / 5')).toBeInTheDocument();
  });

  it('shows the granted credits (0 is 0) and a dash for a time or credits that are not there', async () => {
    answer([
      record({
        id: '1',
        accountId: 'a-1',
        status: 'REWARDED',
        creditsGranted: 0,
        completedAt: '2026-10-20T03:00:00Z',
        rewardedAt: '2026-10-20T03:01:00Z',
      }),
      record({ id: '2', accountId: 'a-2', creditsGranted: null }),
    ]);
    renderPage(<TaskRecordPage />);
    const paid = (await screen.findByText('a-1')).closest('tr') as HTMLElement;
    expect(within(paid).getByText('0')).toBeInTheDocument();
    expect(within(paid).queryAllByText('—')).toHaveLength(0);
    const open = screen.getByText('a-2').closest('tr') as HTMLElement;
    expect(within(open).getAllByText('—').length).toBeGreaterThanOrEqual(3);
    expect(open.textContent).not.toMatch(/null|NaN|undefined/);
  });

  it('sends the account id cleaned at the ends and the chosen status', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskRecordPage />);
    await screen.findAllByText(OPEN);
    await user.type(screen.getByRole('textbox', { name: 'Account ID' }), ' acc-0002 ');
    await chooseOption(user, 'Status', 'Can be claimed');
    await query(user);
    const last = () =>
      new URL(
        [...calls].reverse().find((c) => c.url.includes('/tasks/records'))?.url as string,
        'http://x',
      );
    await waitFor(() => expect(last().searchParams.get('status')).toBe('CLAIMABLE'));
    expect(last().searchParams.get('accountId')).toBe('acc-0002');
  });

  it('is read only: only reads go out, and there is no button that writes', async () => {
    const calls = useMockBackend(mock);
    renderPage(<TaskRecordPage />);
    await screen.findAllByText(OPEN);
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
    for (const label of ['New task', 'Edit', 'Delete', 'Stop', 'Enable']) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
  });

  it('does not break on values that are not text or numbers, and keeps long text inside its cell', async () => {
    answer([
      record({
        accountId: { x: 1 },
        taskName: 'ก'.repeat(300),
        taskDate: null,
        currentProgress: 'many',
        targetValue: {},
        status: 'MYSTERY',
        createdAt: [],
      }),
    ]);
    renderPage(<TaskRecordPage />);
    expect(await screen.findByText('MYSTERY')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ก'.repeat(300) }).getAttribute('data-lines')).toBe(
      '2',
    );
    expect(document.body.textContent).not.toMatch(/\[object Object\]|NaN/);
  });

  it('shows the failure in words of the code with a retry, not the message of the backend', async () => {
    stubFetch(async () =>
      jsonResponse(500, envelope('INTERNAL_ERROR', null, 'SECRET BACKEND MESSAGE')),
    );
    renderPage(<TaskRecordPage />);
    expect(await screen.findByText(/Failed to load/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND MESSAGE');
  });
});
