import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pushState } from '../../../mock/_core/pushData';
import pushMock from '../../../mock/push.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { fileOf, pngBytes } from '../../../tests/imageBytes';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { setTestAccess } from '../../../tests/stubs/umi-max';
import access from '../../access';
import SchedulesPage from './schedules';
import {
  chooseOption,
  dialogsClosed,
  holdWrites,
  signIn,
  stubObjectUrls,
  uploads,
  writesOf,
} from './testSetup';

vi.mock('../../request/upload', async () => (await import('./testSetup')).uploadModule);

const backend = () => useMockBackend({ default: pushMock });

beforeEach(() => {
  signIn('root');
  stubObjectUrls();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const rowOf = async (title: string) => {
  const found = await screen.findByText(title);
  return found.closest('tr') as HTMLTableRowElement;
};

const DAILY = 'Hello, how are you today?'; // schedule 1: every day 09:00 UTC
const WEEKLY = 'ขอบคุณสำหรับความช่วยเหลือของคุณ'; // schedule 2: Mon Wed Fri 20:30 Asia/Bangkok
const MONTHLY =
  'Esta aplicación me ayuda a hablar con mis amigos todos los días sin ningún problema'; // 3: day 31
const OFF = 'التطبيق رائع 🌟'; // 4: switched off, ended

const pick = (input: HTMLElement, value: string) => {
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
};

const openNew = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: 'New periodic push' }));
  return screen.findByRole('dialog');
};

const fill = (dialog: HTMLElement, over: { time?: string; start?: string; end?: string } = {}) => {
  fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: ' Buenos días ' } });
  fireEvent.change(within(dialog).getByLabelText('Body'), { target: { value: 'Abre la app' } });
  pick(within(dialog).getByLabelText('Time of day'), over.time ?? '09:05');
  pick(within(dialog).getByLabelText('Start date'), over.start ?? '2031-01-05');
  if (over.end) pick(within(dialog).getByLabelText('End date'), over.end);
};

describe('the periodic push page: the list', { timeout: 30000 }, () => {
  it('shows the repeat, the time with its zone, the dates, the switch, the audience and the next task for each schedule', async () => {
    backend();
    renderPage(<SchedulesPage />);
    const daily = await rowOf(DAILY);
    expect(within(daily).getByText('Every day')).toBeInTheDocument();
    expect(within(daily).getByText('09:00 · UTC')).toBeInTheDocument();
    expect(within(daily).getByText('2026-09-01 to no end')).toBeInTheDocument();
    expect(within(daily).getByText('Everyone, guests included')).toBeInTheDocument();
    expect(within(daily).getByRole('switch').getAttribute('aria-checked')).toBe('true');
    expect(within(daily).queryByText('—')).not.toBeInTheDocument(); // it has a next task
    const weekly = await rowOf(WEEKLY);
    expect(within(weekly).getByText('Weekly on Mon, Wed, Fri')).toBeInTheDocument();
    expect(within(weekly).getByText('20:30 · Asia/Bangkok')).toBeInTheDocument();
    const monthly = await rowOf(MONTHLY);
    expect(within(monthly).getByText('Monthly on day 31')).toBeInTheDocument();
    const off = await rowOf(OFF);
    expect(within(off).getByText('2026-06-01 to 2026-08-31')).toBeInTheDocument();
    expect(within(off).getByRole('switch').getAttribute('aria-checked')).toBe('false');
    expect(within(off).getByText('—')).toBeInTheDocument(); // no next task for a schedule that is off
  });

  it('says in the header that the next task time is shown in the time zone of this computer, and keeps the time of day in the zone it was set in', async () => {
    backend();
    renderPage(<SchedulesPage />);
    const weekly = await rowOf(WEEKLY);
    expect(
      screen.getByRole('columnheader', { name: 'Next task (time zone of this computer)' }),
    ).toBeInTheDocument();
    // the time of day is the one that was typed, in its own zone: it is not moved to this computer's zone
    expect(within(weekly).getByText('20:30 · Asia/Bangkok')).toBeInTheDocument();
  });

  it('holds a title without spaces in the cell and survives text that is not text', async () => {
    stubFetch(() =>
      jsonResponse(
        200,
        envelope('200', {
          items: [
            {
              id: '1',
              repeat: 'DAILY',
              timeOfDay: 9,
              timezone: null,
              startDate: {},
              endDate: 5,
              enabled: true,
              nextRunAt: 7,
              audience: 3,
              title: { en: 'object title' },
              body: null,
              linkType: 'NONE',
              linkTarget: null,
              daysOfWeek: 'x',
            },
            {
              id: '2',
              repeat: 'WEEKLY',
              daysOfWeek: [1, 'x', 9],
              timeOfDay: '10:00',
              timezone: 'UTC',
              startDate: '2026-01-01',
              endDate: null,
              enabled: false,
              nextRunAt: null,
              audience: 'ALL',
              title: 'ก'.repeat(300),
              body: 'b',
              linkType: 'NONE',
              linkTarget: null,
            },
          ],
          total: 2,
        }),
      ),
    );
    renderPage(<SchedulesPage />);
    expect((await screen.findByText('ก'.repeat(300))).closest('button')).not.toBeNull();
    expect(screen.getByText(/object title/)).toBeInTheDocument();
  });
});

describe('the periodic push page: the switch and deactivating', { timeout: 30000 }, () => {
  it('turns a schedule off with one PUT that carries the whole schedule, and no picture field', async () => {
    const calls = backend();
    renderPage(<SchedulesPage />);
    fireEvent.click(within(await rowOf(WEEKLY)).getByRole('switch'));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({ method: 'PUT', url: '/api/admin/push/schedules/2' });
    expect(writesOf(calls)[0].body).toEqual({
      repeat: 'WEEKLY',
      daysOfWeek: [1, 3, 5],
      timeOfDay: '20:30',
      timezone: 'Asia/Bangkok',
      startDate: '2026-09-15',
      endDate: null,
      enabled: false,
      audience: 'ALL',
      platforms: ['ANDROID', 'IOS'],
      locales: ['th'],
      title: WEEKLY,
      body: expect.any(String),
      linkType: 'NONE',
      linkTarget: '',
    });
    await waitFor(async () =>
      expect(
        within(await rowOf(WEEKLY))
          .getByRole('switch')
          .getAttribute('aria-checked'),
      ).toBe('false'),
    );
  });

  it('turns a schedule back on, and the next task comes back', async () => {
    const calls = backend();
    pushState.schedules[3].endDate = null; // a schedule that is only switched off, not ended
    renderPage(<SchedulesPage />);
    const off = await rowOf(OFF);
    fireEvent.click(within(off).getByRole('switch'));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toMatchObject({ enabled: true });
    await waitFor(async () =>
      expect(within(await rowOf(OFF)).queryByText('—')).not.toBeInTheDocument(),
    );
  });

  it('sends one request when the switch is pressed twice at once', async () => {
    const calls = backend();
    renderPage(<SchedulesPage />);
    const sw = within(await rowOf(DAILY)).getByRole('switch');
    fireEvent.click(sw);
    fireEvent.click(sw);
    await waitFor(() => expect(writesOf(calls).length).toBeGreaterThanOrEqual(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('deactivates with a question that says the tasks already made are kept, one DELETE, and the row stays, switched off', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<SchedulesPage />);
    const row = await rowOf(DAILY);
    const tasksBefore = pushState.tasks.length;
    await user.click(within(row).getByRole('button', { name: 'Deactivate' }));
    expect(
      await screen.findByText('Deactivate; the tasks already made are kept.'),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'DELETE',
      url: '/api/admin/push/schedules/1',
    });
    await waitFor(async () =>
      expect(
        within(await rowOf(DAILY))
          .getByRole('switch')
          .getAttribute('aria-checked'),
      ).toBe('false'),
    );
    expect(pushState.tasks).toHaveLength(tasksBefore);
  });

  it('has no deactivate button on a schedule that is off already', async () => {
    backend();
    renderPage(<SchedulesPage />);
    const off = await rowOf(OFF);
    expect(within(off).queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    expect(within(off).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('says the deactivation sentence in Chinese as the spec words it', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<SchedulesPage />, 'zh-CN');
    const row = await rowOf(DAILY);
    await user.click(within(row).getByRole('button', { name: '停用' }));
    expect(await screen.findByText('停用，已生成的任务保留')).toBeInTheDocument();
  });
});

describe('the periodic push page: new schedule', { timeout: 60000 }, () => {
  it('sends a daily schedule with its UTC default: no weekdays, no day of the month, no end date, no picture', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<SchedulesPage />);
    const dialog = await openNew(user);
    expect(within(dialog).getByRole('radio', { name: 'Every day' })).toBeChecked();
    expect(
      within(dialog).getByRole('combobox', { name: 'Time zone' }).closest('.ant-select')
        ?.textContent,
    ).toContain('UTC');
    fill(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({ method: 'POST', url: '/api/admin/push/schedules' });
    expect(writesOf(calls)[0].body).toEqual({
      repeat: 'DAILY',
      timeOfDay: '09:05',
      timezone: 'UTC',
      startDate: '2031-01-05',
      endDate: null,
      enabled: true,
      audience: 'ALL',
      title: 'Buenos días',
      body: 'Abre la app',
      linkType: 'NONE',
      linkTarget: '',
    });
    await dialogsClosed();
    expect(await screen.findByText('Buenos días')).toBeInTheDocument();
  });

  it('says the time zone is fixed and not the local time of each user, always', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<SchedulesPage />);
    const dialog = await openNew(user);
    expect(
      within(dialog).getByText(/A fixed time zone, not each user's local time/),
    ).toBeInTheDocument();
  });

  it('sends the zone that was chosen', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<SchedulesPage />);
    const dialog = await openNew(user);
    fill(dialog, { end: '2031-06-30' });
    await user.type(within(dialog).getByRole('combobox', { name: 'Time zone' }), 'Bangkok');
    const found = await screen.findAllByText('Asia/Bangkok', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(found[found.length - 1]);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toMatchObject({
      timezone: 'Asia/Bangkok',
      endDate: '2031-06-30',
    });
  });

  it('weekly: asks for the weekdays, sends them in order and no day of the month', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<SchedulesPage />);
    const dialog = await openNew(user);
    fill(dialog);
    expect(within(dialog).queryByRole('checkbox', { name: 'Mon' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: 'Every week' }));
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Pick at least one weekday')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(within(dialog).getByRole('checkbox', { name: 'Wed' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Mon' }));
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toMatchObject({ repeat: 'WEEKLY', daysOfWeek: [1, 3] });
    expect(Object.keys(writesOf(calls)[0].body as object)).not.toContain('dayOfMonth');
  });

  it('monthly: says that a short month uses its last day, asks for the day, sends it and no weekdays', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<SchedulesPage />);
    const dialog = await openNew(user);
    fill(dialog);
    expect(within(dialog).queryByText(/uses its last day/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: 'Every month' }));
    expect(
      within(dialog).getByText(
        /A month that does not have this day uses its last day: day 31 is sent on the 30th in April/,
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText('Enter a whole number from 1 to 31'),
    ).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Day of the month'), {
      target: { value: '32' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText('Enter a whole number from 1 to 31'),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText('Day of the month'), {
      target: { value: '31' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toMatchObject({ repeat: 'MONTHLY', dayOfMonth: 31 });
    expect(Object.keys(writesOf(calls)[0].body as object)).not.toContain('daysOfWeek');
  });

  it('asks for the time and the start date, and refuses an end date before the start', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<SchedulesPage />);
    const dialog = await openNew(user);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Pick the time of day')).toBeInTheDocument();
    expect(within(dialog).getByText('Pick the start date')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a title')).toBeInTheDocument();
    fill(dialog, { start: '2031-05-02', end: '2031-05-01' });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText('The end date is before the start date'),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('with an account ID list the platform and language filters are disabled and not sent', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<SchedulesPage />);
    const dialog = await openNew(user);
    fill(dialog);
    await chooseOption(user, 'Platforms', 'Android', dialog);
    await chooseOption(user, 'Audience', 'Account ID list', dialog);
    expect(within(dialog).getByRole('combobox', { name: 'Platforms' })).toBeDisabled();
    expect(within(dialog).getByRole('combobox', { name: 'Languages' })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Account IDs'), { target: { value: 'a1, a2' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toMatchObject({
      audience: 'ACCOUNT_IDS',
      accountIds: ['a1', 'a2'],
    });
    expect(Object.keys(writesOf(calls)[0].body as object)).not.toContain('platforms');
    expect(Object.keys(writesOf(calls)[0].body as object)).not.toContain('locales');
  });

  it('uploads the picture first and sends its uploadId only', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<SchedulesPage />);
    const dialog = await openNew(user);
    fill(dialog);
    fireEvent.change(screen.getByTestId('upload-input'), {
      target: { files: [fileOf(pngBytes(40, 40), 'cover.png')] },
    });
    await waitFor(() => expect(uploads).toHaveLength(1));
    expect(uploads[0].url).toBe('/uploads/image');
    await within(dialog).findByText(/Uploaded: cover\.png/);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(String((writesOf(calls)[0].body as { uploadId: string }).uploadId)).toMatch(/^up-img-/);
    expect(JSON.stringify(writesOf(calls)[0].body)).not.toMatch(/imageUrl|mock-files|http/);
  });

  it('sends one request when the form is submitted again while the first request is still on its way', async () => {
    const calls = backend();
    const slow = holdWrites();
    const user = userEvent.setup();
    renderPage(<SchedulesPage />);
    const dialog = await openNew(user);
    fill(dialog);
    const form = dialog.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);
    await waitFor(() => expect(slow.started()).toBe(1));
    fireEvent.submit(form);
    fireEvent.submit(form);
    await new Promise((r) => setTimeout(r, 150));
    expect(slow.started()).toBe(1);
    slow.release();
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
  });

  it('sends one request when Submit is pressed twice at once', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<SchedulesPage />);
    const dialog = await openNew(user);
    fill(dialog);
    const submit = within(dialog).getByRole('button', { name: 'Submit' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(writesOf(calls).length).toBeGreaterThanOrEqual(1));
    await new Promise((r) => setTimeout(r, 150));
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('keeps the dialog and what was typed, and shows the translated text, when the backend refuses', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<SchedulesPage />);
    const dialog = await openNew(user);
    fill(dialog);
    fireEvent.change(within(dialog).getByLabelText('Title'), {
      target: { value: 'x'.repeat(201) },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText(
        'Some input is not valid. Please check the fields and try again.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Title')).toHaveValue('x'.repeat(201));
  });
});

describe('the periodic push page: edit', { timeout: 60000 }, () => {
  it('fills the dialog from the row and sends a PUT by id, with a changed time and no picture', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<SchedulesPage />);
    const row = await rowOf(WEEKLY);
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('radio', { name: 'Every week' })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Mon' })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Tue' })).not.toBeChecked();
    expect(within(dialog).getByLabelText('Time of day')).toHaveValue('20:30');
    expect(within(dialog).getByLabelText('Start date')).toHaveValue('2026-09-15');
    expect(within(dialog).getByLabelText('Title')).toHaveValue(WEEKLY);
    pick(within(dialog).getByLabelText('Time of day'), '21:15');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({ method: 'PUT', url: '/api/admin/push/schedules/2' });
    expect(writesOf(calls)[0].body).toMatchObject({
      repeat: 'WEEKLY',
      daysOfWeek: [1, 3, 5],
      timeOfDay: '21:15',
      timezone: 'Asia/Bangkok',
      platforms: ['ANDROID', 'IOS'],
      locales: ['th'],
    });
    expect(Object.keys(writesOf(calls)[0].body as object)).not.toContain('uploadId');
    await dialogsClosed();
  });
});

describe('the periodic push page: permissions and language', { timeout: 30000 }, () => {
  it('without PUSH:SEND there is no new, no edit, no deactivate, and the switches are off', async () => {
    signIn('root');
    setTestAccess(access({ me: { superAdmin: false, permissions: ['PUSH:VIEW'] } }));
    backend();
    renderPage(<SchedulesPage />);
    const row = await rowOf(DAILY);
    expect(screen.queryByRole('button', { name: 'New periodic push' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    expect(within(row).getByRole('switch')).toBeDisabled();
  });

  it('draws in Chinese', async () => {
    backend();
    renderPage(<SchedulesPage />, 'zh-CN');
    const row = await rowOf(WEEKLY);
    expect(within(row).getByText('每周 周一、周三、周五')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /新建周期推送/ })).toBeInTheDocument();
  });
});
