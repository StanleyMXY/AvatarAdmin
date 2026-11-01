import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import pushMock from '../../../mock/push.mock';
import {
  expectFailureFollowsLanguage,
  failRequests,
  renderWithLocaleSwitch,
} from '../../../tests/failureLanguage';
import { useMockBackend } from '../../../tests/mockBackend';
import RecordsPage from './records';
import SchedulesPage from './schedules';
import StatsPage from './stats';
import TasksPage from './tasks';
import TemplatesPage from './templates';
import { chooseOption, signIn, stubObjectUrls } from './testSetup';

vi.mock('../../request/upload', async () => (await import('./testSetup')).uploadModule);

beforeEach(() => {
  signIn('root');
  stubObjectUrls();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const backend = () => useMockBackend({ default: pushMock });
const pick = (input: HTMLElement, value: string) => {
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
};

describe('the failures of the push pages follow the language', { timeout: 60000 }, () => {
  it('the statistics whose read failed', async () => {
    const _calls = backend();
    failRequests(/GET .*stats\/push/);
    const view = renderWithLocaleSwitch(<StatsPage />);
    await expectFailureFollowsLanguage(view);
  });

  it('the send records whose read failed', async () => {
    const _calls = backend();
    failRequests(/GET .*push\/records$/);
    const view = renderWithLocaleSwitch(<RecordsPage />);
    await expectFailureFollowsLanguage(view);
  });

  it('the result of one record that could not be read', async () => {
    const _calls = backend();
    failRequests(/GET .*push\/records\/\w+/);
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<RecordsPage />);
    await waitFor(() =>
      expect(document.querySelectorAll('tbody tr.ant-table-row')).not.toHaveLength(0),
    );
    const row = document.querySelectorAll('tbody tr.ant-table-row')[0] as HTMLElement;
    await user.click(within(row).getByRole('button', { name: /expand/i }));
    await expectFailureFollowsLanguage(view);
  });

  it('the matrix of templates whose read failed', async () => {
    const _calls = backend();
    failRequests(/GET .*push\/templates/);
    const view = renderWithLocaleSwitch(<TemplatesPage />);
    await expectFailureFollowsLanguage(view);
  });

  it('the template that could not be saved', async () => {
    const _calls = backend();
    failRequests((path, method) => method === 'POST' && path.includes('push/templates'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<TemplatesPage />);
    await user.click(await screen.findByRole('button', { name: 'New template' }));
    const dialog = await screen.findByRole('dialog');
    await chooseOption(user, 'Trigger reason', 'Streak at risk', dialog);
    await chooseOption(user, 'Language', 'ar', dialog);
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: ' عنوان جديد ' } });
    fireEvent.change(within(dialog).getByLabelText('Body'), { target: { value: 'نص الرسالة' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await expectFailureFollowsLanguage(view);
  });

  it('the manual task that could not be created', async () => {
    const _calls = backend();
    failRequests((path, method) => method === 'POST' && path.endsWith('push/tasks'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<TasksPage />);
    await user.click(await screen.findByRole('button', { name: 'New task' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Title'), {
      target: { value: 'Nueva función' },
    });
    fireEvent.change(within(dialog).getByLabelText('Body'), { target: { value: 'Pruébala hoy' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await expectFailureFollowsLanguage(view);
  });

  it('the periodic push that could not be created', async () => {
    const _calls = backend();
    failRequests((path, method) => method === 'POST' && path.endsWith('push/schedules'));
    const user = userEvent.setup();
    const view = renderWithLocaleSwitch(<SchedulesPage />);
    await user.click(await screen.findByRole('button', { name: 'New periodic push' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Buenos días' } });
    fireEvent.change(within(dialog).getByLabelText('Body'), { target: { value: 'Abre la app' } });
    pick(within(dialog).getByLabelText('Time of day'), '09:05');
    pick(within(dialog).getByLabelText('Start date'), '2031-01-05');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await expectFailureFollowsLanguage(view);
  });
});
