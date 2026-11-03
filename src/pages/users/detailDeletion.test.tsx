import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '../../../mock/_core/store';
import { USER, usersState } from '../../../mock/_core/usersData';
import * as usersMock from '../../../mock/users.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { setTestLocation } from '../../../tests/stubs/umi-max';
import { formatInstant } from '../../utils/format';
import UserDetailPage from './detail';
import { signIn } from './testSetup';

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const backend = () => useMockBackend(usersMock);
const open = async (id: string, locale: 'en-US' | 'zh-CN' = 'en-US') => {
  setTestLocation({ pathname: `/users/${encodeURIComponent(id)}`, search: '' });
  renderPage(<UserDetailPage />, locale);
  await screen.findByTestId('field-state');
};
const field = (name: string) => screen.getByTestId(`field-${name}`);
const taskOf = (accountId: string) => {
  const task = usersState.deletions.find((row) => row.accountId === accountId);
  if (!task) throw new Error('no task');
  return task;
};

// The detail carries the open deletion of the account (backend answer 60): the page says where it
// ends and who started it, without reading the list of deletion tasks.
describe('the deletion that is open, on the overview of an account', { timeout: 30000 }, () => {
  it('says the state, the day it is planned for and when it was asked for, from the detail alone', async () => {
    const calls = backend();
    await open(USER.pendingDeletion);
    const task = taskOf(USER.pendingDeletion);
    await waitFor(() =>
      expect(field('deletion-status')).toHaveTextContent('Scheduled (grace period)'),
    );
    expect(field('deletion-executeAfter')).toHaveTextContent(
      formatInstant(String(task.executeAfter), 'en-US'),
    );
    expect(field('deletion-createdAt')).toHaveTextContent(formatInstant(task.createdAt, 'en-US'));
    expect(calls.some((call) => call.url.includes('account-deletions'))).toBe(false);
  });

  it('says the user asked for it when there is no administrator behind the request', async () => {
    backend();
    await open(USER.pendingDeletion);
    expect(field('deletion-requestedBy')).toHaveTextContent(/^The user$/);
  });

  it('names the administrator who started it, in any script', async () => {
    backend();
    const task = taskOf('2003');
    const admin = store.admins.get(String(task.requestedBy));
    if (admin) admin.username = 'สมชาย ผู้ดูแล';
    await open('2003');
    expect(field('deletion-requestedBy')).toHaveTextContent('สมชาย ผู้ดูแล');
  });

  it('says the administrator is gone, with the start of the id, when the request has an administrator and no name', async () => {
    backend();
    taskOf('2003').requestedBy = 'abcdef0123456789';
    await open('2003');
    const words = field('deletion-requestedBy');
    expect(words).toHaveTextContent('An administrator who has been deleted (abcdef01)');
    expect(words).not.toHaveTextContent('The user');
  });

  it('shows a task that runs or failed as well, with its state in words', async () => {
    backend();
    await open(USER.deleting);
    expect(field('deletion-status')).toHaveTextContent('Running');
  });

  it('shows nothing of a deletion for an account that has none, and for one whose tasks are over', async () => {
    backend();
    await open(USER.rich);
    expect(screen.queryByTestId('field-deletion-status')).toBeNull();
    expect(screen.queryByText('Account deletion')).toBeNull();
  });

  it('writes the words in Chinese', async () => {
    backend();
    await open(USER.pendingDeletion, 'zh-CN');
    expect(field('deletion-status')).toHaveTextContent('已预定（宽限期内）');
    expect(field('deletion-requestedBy')).toHaveTextContent('用户自己');
    expect(screen.getByText('待处理的账号删除')).toBeInTheDocument();
  });

  it('shows the section to an administrator who has USER:VIEW only', async () => {
    signIn('support', { codes: ['USER:VIEW'] });
    backend();
    await open(USER.pendingDeletion);
    expect(field('deletion-status')).toBeInTheDocument();
  });

  it('reads a detail without the field as no deletion, as an older backend answered', async () => {
    backend();
    stubFetch(async ({ url }) =>
      url.endsWith(`/users/${USER.rich}`)
        ? jsonResponse(
            200,
            envelope('200', {
              id: USER.rich,
              status: 'ACTIVE',
              loginMethods: [],
              companionship: {},
              counts: {},
              attribution: null,
              createdAt: '2026-10-01T00:00:00Z',
              trafficType: 'ORGANIC',
            }),
          )
        : jsonResponse(404, envelope('RESOURCE_NOT_FOUND', null)),
    );
    await open(USER.rich);
    expect(screen.queryByTestId('field-deletion-status')).toBeNull();
  });
});
