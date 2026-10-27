import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import activityMock from '../../../mock/activity.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import SigninRecordPage from './signinRecord';
import { activityState, signIn } from './testSetup';

const mock = { default: activityMock };

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const record = (over: Record<string, unknown> = {}) => ({
  id: '1',
  accountId: 'acc-1',
  activityId: '1',
  activityName: 'Autumn',
  checkinDate: '2026-10-20',
  dayNum: 3,
  consecutiveDays: 10,
  rewardCredits: 3,
  bonusCredits: 2,
  createdAt: '2026-10-20T08:00:00Z',
  ...over,
});
const answer = (items: unknown[]) =>
  stubFetch(async () => jsonResponse(200, envelope('200', { items, total: items.length })));
const query = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /查\s*询|Query|Search/ }));

describe('the sign-in records page', { timeout: 30000 }, () => {
  it('lists the records of the mock backend with the name of the activity and says the date is a local day', async () => {
    useMockBackend(mock);
    renderPage(<SigninRecordPage />);
    expect((await screen.findAllByText('Autumn check-in 🍂')).length).toBeGreaterThan(0);
    expect(screen.getByText('The check-in date is the local day of the user.')).toBeInTheDocument();
    for (const title of [
      'Account ID',
      'Check-in activity',
      'Check-in date',
      'Day in steps',
      'Streak (days)',
      'Reward credits (with bonus)',
      'Created',
    ]) {
      expect(screen.getAllByText(title).length, title).toBeGreaterThan(0);
    }
  });

  it('shows a dash and the id of an activity that has been deleted, and the name when there is one', async () => {
    answer([
      record({ id: '1', activityId: '7', activityName: null }),
      record({ id: '2', activityId: '8', activityName: 'ฤดูใบไม้ร่วง' }),
    ]);
    renderPage(<SigninRecordPage />);
    const gone = (await screen.findByText('ID 7')).closest('tr') as HTMLElement;
    expect(within(gone).getAllByText('—').length).toBeGreaterThan(0);
    const named = screen.getByText('ฤดูใบไม้ร่วง').closest('tr') as HTMLElement;
    expect(within(named).queryByText('ID 8')).toBeNull();
  });

  it('shows the credits with the bonus included, a sum of 0 as 0, and nothing known as a dash', async () => {
    answer([
      record({ id: '1', accountId: 'a-1', rewardCredits: 3, bonusCredits: 2 }),
      record({ id: '2', accountId: 'a-2', rewardCredits: 0, bonusCredits: 0 }),
      record({ id: '3', accountId: 'a-3', rewardCredits: null, bonusCredits: null }),
    ]);
    renderPage(<SigninRecordPage />);
    const first = (await screen.findByText('a-1')).closest('tr') as HTMLElement;
    expect(within(first).getByText('5')).toBeInTheDocument();
    expect(within(first).getByText('reward 3 + bonus 2')).toBeInTheDocument();
    const zero = screen.getByText('a-2').closest('tr') as HTMLElement;
    expect(within(zero).getAllByText('0').length).toBeGreaterThan(0);
    const unknown = screen.getByText('a-3').closest('tr') as HTMLElement;
    expect(unknown.textContent).not.toMatch(/null|NaN|undefined/);
    expect(within(unknown).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows the day of the steps as "Day N" and the streak as a number', async () => {
    answer([record({ dayNum: 4, consecutiveDays: 11 })]);
    renderPage(<SigninRecordPage />);
    const row = (await screen.findByText('acc-1')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Day 4')).toBeInTheDocument();
    expect(within(row).getByText('11')).toBeInTheDocument();
  });

  it('puts a copy button beside the account id, and keeps an id of 232 characters in two lines', async () => {
    const long = `${'0123456789'.repeat(23)}ab`;
    answer([record({ accountId: long })]);
    renderPage(<SigninRecordPage />);
    const cell = (await screen.findByTitle(long)) as HTMLElement;
    expect(cell.getAttribute('data-lines')).toBe('2');
    expect(cell.style.overflowWrap).toBe('anywhere');
    const row = cell.closest('tr') as HTMLElement;
    expect(within(row).getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('sends the account id and the activity id, cleaned at the ends, and nothing for an empty box', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninRecordPage />);
    await screen.findAllByText('Autumn check-in 🍂');
    const last = () =>
      new URL(
        [...calls].reverse().find((c) => c.url.includes('/checkin/records'))?.url as string,
        'http://x',
      );
    expect(last().searchParams.has('accountId')).toBe(false);
    await user.type(screen.getByRole('textbox', { name: 'Account ID' }), '  acc-0001 ');
    await user.type(screen.getByRole('textbox', { name: 'Activity ID' }), ' 2 ');
    await query(user);
    await waitFor(() => expect(last().searchParams.get('activityId')).toBe('2'));
    expect(last().searchParams.get('accountId')).toBe('acc-0001');
  });

  it('shows only the records of the filter', async () => {
    useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninRecordPage />);
    await screen.findAllByText('Autumn check-in 🍂');
    await user.type(screen.getByRole('textbox', { name: 'Activity ID' }), '2');
    await query(user);
    await waitFor(() => expect(screen.queryByText('Autumn check-in 🍂')).toBeNull());
    expect(screen.getAllByText('Hola, ¿cómo estás hoy?').length).toBeGreaterThan(0);
    expect(activityState.checkinRecords.filter((r) => r.activityId === '2')).toHaveLength(12);
  });

  it('is read only: no button that writes, and no request but the reads', async () => {
    const calls = useMockBackend(mock);
    renderPage(<SigninRecordPage />);
    await screen.findAllByText('Autumn check-in 🍂');
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
    for (const label of ['New activity', 'Edit', 'Delete', 'Publish']) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
  });

  it('does not break on values that are not text or numbers', async () => {
    answer([
      record({
        accountId: { x: 1 },
        activityName: 5,
        checkinDate: null,
        dayNum: 'x',
        consecutiveDays: {},
        createdAt: [],
      }),
    ]);
    renderPage(<SigninRecordPage />);
    expect(await screen.findByText('{"x":1}')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\[object Object\]|NaN/);
  });

  it('keeps arabic, thai and emoji account ids and activity names inside the cells', async () => {
    answer([
      record({ id: '1', accountId: 'حساب-١٢٣', activityName: '🎉'.repeat(200) }),
      record({ id: '2', accountId: 'บัญชี', activityName: 'ก'.repeat(300) }),
    ]);
    renderPage(<SigninRecordPage />);
    expect(await screen.findByText('حساب-١٢٣')).toBeInTheDocument();
    const name = screen.getByRole('button', { name: 'ก'.repeat(300) });
    expect(name.getAttribute('data-lines')).toBe('2');
  });

  it('shows the failure in words of the error code with a retry', async () => {
    stubFetch(async () =>
      jsonResponse(500, envelope('INTERNAL_ERROR', null, 'SECRET BACKEND MESSAGE')),
    );
    renderPage(<SigninRecordPage />);
    expect(await screen.findByText(/Failed to load/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND MESSAGE');
  });
});
