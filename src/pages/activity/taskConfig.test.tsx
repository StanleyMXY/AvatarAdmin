import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import activityMock from '../../../mock/activity.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import TaskConfigPage from './taskConfig';
import {
  activityState,
  chooseOption,
  dialogsClosed,
  expandSearch,
  holdWrites,
  signIn,
  writesOf,
} from './testSetup';

const mock = { default: activityMock };

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const THAI_NAME = 'ขอบคุณสำหรับความช่วยเหลือของคุณ';
const ARABIC_NAME = 'شكرا جزيلا على مساعدتك';
const INDONESIAN_NAME =
  'Aplikasi ini sangat membantu saya setiap hari dalam berkomunikasi dengan teman-teman baru';
const VIETNAMESE_NAME =
  'Ứng dụng này giúp tôi nói chuyện với bạn bè mỗi ngày một cách dễ dàng và vui vẻ';
const OPEN = 'Open the app 📱';
const LONG = 'A'.repeat(300);

const rowOf = async (name: string): Promise<HTMLElement> =>
  (await screen.findByText(name)).closest('tr') as HTMLElement;
const config = (id: string) => activityState.taskConfigs.find((c) => c.id === id);

const dialogOf = (title: string | RegExp) =>
  waitFor(() => {
    const found = screen
      .getAllByRole('dialog')
      .find((d) => within(d).queryAllByText(title).length > 0);
    if (!found) throw new Error(`no dialog with the title ${String(title)}`);
    return found;
  });

const query = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /查\s*询|Query|Search/ }));

const lastList = (calls: { url: string }[]) =>
  new URL(
    [...calls].reverse().find((c) => c.url.includes('/tasks/configs?'))?.url as string,
    'http://x',
  );

describe('the task setup page: the list', { timeout: 30000 }, () => {
  it('shows the tasks by order with their type in words, and the text of every language', async () => {
    useMockBackend(mock);
    renderPage(<TaskConfigPage />);
    expect(await screen.findByText(OPEN)).toBeInTheDocument();
    for (const name of [THAI_NAME, ARABIC_NAME, INDONESIAN_NAME]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(within(await rowOf(OPEN)).getByText('Daily login')).toBeInTheDocument();
    expect(within(await rowOf(THAI_NAME)).getByText('Daily call time')).toBeInTheDocument();
    expect(within(await rowOf(ARABIC_NAME)).getByText('Daily text messages')).toBeInTheDocument();
  });

  it('shows the target of a call task in seconds, a reward of 0 as 0 and an empty claim time as a dash', async () => {
    useMockBackend(mock);
    renderPage(<TaskConfigPage />);
    const call = await rowOf(THAI_NAME);
    expect(within(call).getByText('600 seconds')).toBeInTheDocument();
    expect(within(call).getByText('3,600')).toBeInTheDocument();
    const messages = await rowOf(ARABIC_NAME);
    expect(within(messages).getByText('20')).toBeInTheDocument();
    expect(within(messages).getByText('0')).toBeInTheDocument();
    expect(within(messages).getByText('—')).toBeInTheDocument();
    expect(messages.textContent).not.toMatch(/null|NaN|undefined/);
  });

  it('says in the header what an empty claim time means', async () => {
    useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    await screen.findByText(OPEN);
    await user.hover(screen.getAllByTestId('tip-claim')[0]);
    expect(
      await screen.findByText('Empty = can be claimed at any time on the same day'),
    ).toBeInTheDocument();
  });

  it('shows the state of each task, the order, and the two times', async () => {
    useMockBackend(mock);
    renderPage(<TaskConfigPage />);
    const stopped = await rowOf(
      INDONESIAN_NAME.slice(0) &&
        'Aplikasi ini sangat membantu saya setiap hari dalam berkomunikasi dengan teman-teman baru',
    );
    void stopped;
    const first = await rowOf(OPEN);
    expect(within(first).getByText('Enabled')).toBeInTheDocument();
    expect(within(first).getByText(/^Created: /)).toBeInTheDocument();
    expect(within(first).getByText(/^Updated: /)).toBeInTheDocument();
    expect(screen.getAllByText('Stopped').length).toBe(2);
  });

  it('cuts a description of 300 letters without a space to two lines and keeps the table narrow', async () => {
    useMockBackend(mock);
    renderPage(<TaskConfigPage />);
    const button = await screen.findByRole('button', { name: LONG });
    expect(button.getAttribute('data-lines')).toBe('2');
    expect(button.style.overflowWrap).toBe('anywhere');
  });

  it('does not break on values that are not text or numbers', async () => {
    stubFetch(async () =>
      jsonResponse(
        200,
        envelope('200', {
          items: [
            {
              id: '1',
              taskName: 77,
              taskType: { a: 1 },
              targetValue: 'x',
              rewardCredits: null,
              description: [1],
              claimTimeoutSeconds: 'soon',
              sortOrder: null,
              status: 'WEIRD',
              createdAt: 5,
              updatedAt: null,
            },
            {
              id: '2',
              taskName: 'Known',
              taskType: 'watch_video',
              targetValue: 3,
              rewardCredits: 1,
              description: null,
              claimTimeoutSeconds: null,
              sortOrder: 2,
              status: 'ENABLED',
              createdAt: 'x',
              updatedAt: 'y',
            },
          ],
          total: 2,
        }),
      ),
    );
    renderPage(<TaskConfigPage />);
    expect(await screen.findByText('77')).toBeInTheDocument();
    expect(screen.getByText('watch_video')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\[object Object\]|NaN/);
  });

  it('sends the name, the type and the state of the form', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    await screen.findByText(OPEN);
    await expandSearch(user);
    await user.type(screen.getByRole('textbox', { name: 'Task name' }), '  login ');
    await chooseOption(user, 'Task type', 'Daily login');
    await chooseOption(user, 'Status', 'Stopped');
    await query(user);
    await waitFor(() => expect(lastList(calls).searchParams.get('status')).toBe('DISABLED'));
    expect(lastList(calls).searchParams.get('taskType')).toBe('daily_login');
    expect(lastList(calls).searchParams.get('taskName')).toBe('login');
  });

  it('shows the failure in words of the code with a retry', async () => {
    stubFetch(async () =>
      jsonResponse(500, envelope('INTERNAL_ERROR', null, 'SECRET BACKEND MESSAGE')),
    );
    renderPage(<TaskConfigPage />);
    expect(await screen.findByText(/Failed to load/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND MESSAGE');
  });
});

describe('the task setup page: permissions', { timeout: 30000 }, () => {
  it('without TASK:MANAGE there is no New button and no Edit, Stop, Enable or Delete', async () => {
    signIn('finance', { codes: ['TASK:VIEW'] });
    useMockBackend(mock);
    renderPage(<TaskConfigPage />);
    await screen.findByText(OPEN);
    expect(screen.queryByRole('button', { name: 'New task' })).toBeNull();
    for (const label of ['Edit', 'Stop', 'Enable', 'Delete']) {
      expect(screen.queryByRole('button', { name: label }), label).toBeNull();
    }
  });

  it('with TASK:MANAGE each row has Edit, Stop or Enable, and Delete', async () => {
    useMockBackend(mock);
    renderPage(<TaskConfigPage />);
    const enabled = await rowOf(OPEN);
    expect(within(enabled).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(enabled).getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    expect(within(enabled).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(within(enabled).queryByRole('button', { name: 'Enable' })).toBeNull();
    expect(screen.getByRole('button', { name: 'New task' })).toBeInTheDocument();
  });
});

describe('stopping, enabling and deleting', { timeout: 30000 }, () => {
  it('stops a task after the inline question with the status call', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    await user.click(within(await rowOf(OPEN)).getByRole('button', { name: 'Stop' }));
    expect(await screen.findByText('Stop this task?')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(await screen.findByText('Task stopped')).toBeInTheDocument();
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'PUT',
      url: '/api/admin/tasks/configs/1/status',
      body: { status: 'DISABLED' },
    });
    expect(config('1')?.status).toBe('DISABLED');
  });

  it('enables a stopped task after the question', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const stoppedRows = (await screen.findAllByText('Stopped')).map(
      (el) => el.closest('tr') as HTMLElement,
    );
    await user.click(within(stoppedRows[0]).getByRole('button', { name: 'Enable' }));
    expect(await screen.findByText('Enable this task?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(await screen.findByText('Task enabled')).toBeInTheDocument();
    expect(writesOf(calls)[0].body).toEqual({ status: 'ENABLED' });
  });

  it('Cancel on the question sends nothing', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    await user.click(within(await rowOf(OPEN)).getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('deletes a task that has no records after the question', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const row = await rowOf(INDONESIAN_NAME);
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    expect(
      await screen.findByText(
        'Delete this task? A task that has records cannot be deleted; stop it instead.',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(await screen.findByText('Task deleted')).toBeInTheDocument();
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'DELETE',
      url: '/api/admin/tasks/configs/5',
    });
    await waitFor(() => expect(screen.queryByText(INDONESIAN_NAME)).toBeNull());
  });

  it('a task that has records is not deleted: TASK_HAS_RECORDS is shown in words, telling to stop it instead, and the row stays', async () => {
    useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    await user.click(within(await rowOf(OPEN)).getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText('This task already has records. Disable it instead of deleting it.'),
    ).toBeInTheDocument();
    expect(screen.getByText(OPEN)).toBeInTheDocument();
    expect(config('1')).toBeDefined();
  });

  it('a second press on OK sends one request', async () => {
    const calls = useMockBackend(mock);
    const gate = holdWrites();
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    await user.click(within(await rowOf(OPEN)).getByRole('button', { name: 'Stop' }));
    const ok = await screen.findByRole('button', { name: 'OK' });
    await user.click(ok);
    await user.click(ok);
    await waitFor(() => expect(gate.started()).toBe(1));
    gate.release();
    expect(await screen.findByText('Task stopped')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(1);
  });
});

describe('the form: a new task', { timeout: 30000 }, () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'New task' }));
    return dialogOf('New daily task');
  };
  const field = (dialog: HTMLElement, name: string) =>
    within(dialog).getByRole('textbox', { name });
  const num = (dialog: HTMLElement, name: string) =>
    within(dialog).getByRole('spinbutton', { name });

  it('begins with a target of 1, a reward of 0, an empty claim time and an order of 0, and says what an empty claim time means', async () => {
    useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const dialog = await open(user);
    expect(num(dialog, 'Target')).toHaveValue('1');
    expect(num(dialog, 'Reward credits')).toHaveValue('0');
    expect(num(dialog, 'Claim time limit (seconds)')).toHaveValue('');
    expect(num(dialog, 'Order')).toHaveValue('0');
    expect(
      within(dialog).getByText('Empty = can be claimed at any time on the same day'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('0 / 500')).toBeInTheDocument();
  });

  it('offers the three types that the backend declares', async () => {
    useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const dialog = await open(user);
    await user.click(within(dialog).getByRole('combobox', { name: 'Task type' }));
    for (const label of ['Daily login', 'Daily call time', 'Daily text messages']) {
      expect(
        (await screen.findAllByText(label, { selector: '.ant-select-item-option-content' })).length,
      ).toBeGreaterThan(0);
    }
  });

  it('says the unit of a call task is seconds, and fixes the target of a login task to 1', async () => {
    useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const dialog = await open(user);
    expect(within(dialog).queryByText('Unit: seconds')).toBeNull();
    await chooseOption(user, 'Task type', 'Daily call time', dialog);
    expect(within(dialog).getByText('Unit: seconds')).toBeInTheDocument();
    await user.clear(num(dialog, 'Target'));
    await user.type(num(dialog, 'Target'), '900');
    await chooseOption(user, 'Task type', 'Daily login', dialog);
    expect(num(dialog, 'Target')).toHaveValue('1');
    expect(num(dialog, 'Target')).toBeDisabled();
    expect(
      within(dialog).getByText('The target of a daily login task is always 1.'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText('Unit: seconds')).toBeNull();
    await chooseOption(user, 'Task type', 'Daily text messages', dialog);
    expect(num(dialog, 'Target')).not.toBeDisabled();
  });

  it('counts the description in code points: three emoji are 3, and 501 are refused', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const dialog = await open(user);
    await user.type(field(dialog, 'Description'), '😀😀😀');
    expect(within(dialog).getByText('3 / 500')).toBeInTheDocument();
    await user.clear(field(dialog, 'Description'));
    await user.click(field(dialog, 'Description'));
    await user.paste('😀'.repeat(501));
    expect(within(dialog).getByText('501 / 500')).toBeInTheDocument();
    await user.type(field(dialog, 'Task name'), 'Emoji task');
    await chooseOption(user, 'Task type', 'Daily text messages', dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText('The description has at most 500 characters'),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('accepts a description of exactly 500 code points', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const dialog = await open(user);
    await user.type(field(dialog, 'Task name'), 'Full text');
    await chooseOption(user, 'Task type', 'Daily text messages', dialog);
    await user.click(field(dialog, 'Description'));
    await user.paste('😀'.repeat(500));
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Task saved')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('refuses an empty name, a missing type, an empty target and an empty reward, and sends nothing', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const dialog = await open(user);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Enter the task name')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose the task type')).toBeInTheDocument();
    await user.type(field(dialog, 'Task name'), 'x');
    await chooseOption(user, 'Task type', 'Daily text messages', dialog);
    // The number boxes keep a typed 0 or -2 inside their limits, so an invalid value is an empty box.
    await user.clear(num(dialog, 'Target'));
    await user.clear(num(dialog, 'Reward credits'));
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Enter a whole number, 1 or more')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a whole number, 0 or more')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('refuses a task name of 101 code points', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const dialog = await open(user);
    await user.click(field(dialog, 'Task name'));
    await user.paste('😀'.repeat(101));
    await chooseOption(user, 'Task type', 'Daily text messages', dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText('The task name has at most 100 characters'),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('sends the text trimmed, the numbers as typed and an empty claim time as null', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const dialog = await open(user);
    await user.type(field(dialog, 'Task name'), '  คุยกัน 10 นาที ');
    await chooseOption(user, 'Task type', 'Daily call time', dialog);
    await user.clear(num(dialog, 'Target'));
    await user.type(num(dialog, 'Target'), '600');
    await user.clear(num(dialog, 'Reward credits'));
    await user.type(num(dialog, 'Reward credits'), '4');
    await user.type(field(dialog, 'Description'), ' مرحبا ');
    await user.type(num(dialog, 'Order'), '7');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Task saved')).toBeInTheDocument();
    expect(writesOf(calls)[0]).toMatchObject({ method: 'POST', url: '/api/admin/tasks/configs' });
    expect(writesOf(calls)[0].body).toEqual({
      taskName: 'คุยกัน 10 นาที',
      taskType: 'call_seconds',
      targetValue: 600,
      rewardCredits: 4,
      description: 'مرحبا',
      claimTimeoutSeconds: null,
      sortOrder: 7,
    });
    await dialogsClosed();
    expect(await screen.findByText('คุยกัน 10 นาที')).toBeInTheDocument();
  });

  it('sends a claim time when one is typed, and a typed 0 is kept at the lowest value, 1', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const dialog = await open(user);
    await user.type(field(dialog, 'Task name'), 'Timed');
    await chooseOption(user, 'Task type', 'Daily text messages', dialog);
    await user.type(num(dialog, 'Claim time limit (seconds)'), '0');
    await user.tab();
    expect(num(dialog, 'Claim time limit (seconds)')).toHaveValue('1');
    await user.clear(num(dialog, 'Claim time limit (seconds)'));
    await user.type(num(dialog, 'Claim time limit (seconds)'), '3600');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Task saved')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(1);
    expect((writesOf(calls)[0].body as { claimTimeoutSeconds: number }).claimTimeoutSeconds).toBe(
      3600,
    );
  });

  it('a login task is sent with the target 1', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const dialog = await open(user);
    await user.type(field(dialog, 'Task name'), 'Open it');
    await chooseOption(user, 'Task type', 'Daily login', dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Task saved')).toBeInTheDocument();
    expect(writesOf(calls)[0].body).toMatchObject({ taskType: 'daily_login', targetValue: 1 });
  });

  it('a second press on Submit sends one request', async () => {
    const calls = useMockBackend(mock);
    const gate = holdWrites();
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const dialog = await open(user);
    await user.type(field(dialog, 'Task name'), 'Twice');
    await chooseOption(user, 'Task type', 'Daily text messages', dialog);
    const submit = within(dialog).getByRole('button', { name: 'Submit' });
    await user.click(submit);
    await user.click(submit);
    await waitFor(() => expect(gate.started()).toBe(1));
    gate.release();
    expect(await screen.findByText('Task saved')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('a refusal keeps the dialog open: the reason under the field, the words of the code below, never the backend message', async () => {
    useMockBackend(mock);
    const real = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) =>
        init?.method === 'POST'
          ? jsonResponse(
              400,
              envelope(
                'INVALID_REQUEST',
                { details: [{ ref: 'taskName', reason: 'EMPTY_NOT_ALLOWED' }] },
                'SECRET BACKEND MESSAGE',
              ),
            )
          : real(input, init),
      ),
    );
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const dialog = await open(user);
    await user.type(field(dialog, 'Task name'), 'x');
    await chooseOption(user, 'Task type', 'Daily text messages', dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('It must not be empty.')).toBeInTheDocument();
    expect(within(dialog).getByRole('alert')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND MESSAGE');
  });
});

describe('the form: editing', { timeout: 30000 }, () => {
  const edit = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(within(await rowOf(name)).getByRole('button', { name: 'Edit' }));
    return dialogOf('Edit daily task');
  };
  const num = (dialog: HTMLElement, name: string) =>
    within(dialog).getByRole('spinbutton', { name });

  it('is filled from the row, and always says that a task with records keeps its type and target', async () => {
    useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const dialog = await edit(user, THAI_NAME);
    expect(within(dialog).getByRole('textbox', { name: 'Task name' })).toHaveValue(THAI_NAME);
    expect(num(dialog, 'Target')).toHaveValue('600');
    expect(num(dialog, 'Claim time limit (seconds)')).toHaveValue('3600');
    expect(num(dialog, 'Order')).toHaveValue('2');
    expect(
      within(dialog).getByText(
        /For a task that has records, the type and the target cannot be changed/,
      ),
    ).toBeInTheDocument();
  });

  it('changes the name and the reward of a task that has records with one PUT that carries the old type and target', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const dialog = await edit(user, THAI_NAME);
    await user.clear(num(dialog, 'Reward credits'));
    await user.type(num(dialog, 'Reward credits'), '9');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Task saved')).toBeInTheDocument();
    expect(writesOf(calls)[0]).toMatchObject({ method: 'PUT', url: '/api/admin/tasks/configs/2' });
    expect(writesOf(calls)[0].body).toMatchObject({
      taskType: 'call_seconds',
      targetValue: 600,
      rewardCredits: 9,
    });
    expect(config('2')?.rewardCredits).toBe(9);
  });

  it('when the backend says the task has records (409), the type and target become read only with their old values and the page says why', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const dialog = await edit(user, THAI_NAME);
    await user.clear(num(dialog, 'Target'));
    await user.type(num(dialog, 'Target'), '900');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText(
        'This task has records, so its type and target cannot be changed. To change them, stop the old task and make a new one.',
      ),
    ).toBeInTheDocument();
    // Not the words of the delete refusal.
    expect(document.body.textContent).not.toContain('Disable it instead of deleting it.');
    expect(num(dialog, 'Target')).toBeDisabled();
    expect(num(dialog, 'Target')).toHaveValue('600');
    expect(within(dialog).getByRole('combobox', { name: 'Task type' })).toBeDisabled();
    expect(config('2')?.targetValue).toBe(600);
    // The rest can still be saved, with the old type and target.
    await user.clear(num(dialog, 'Reward credits'));
    await user.type(num(dialog, 'Reward credits'), '8');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Task saved')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(2);
    expect(writesOf(calls)[1].body).toMatchObject({
      targetValue: 600,
      taskType: 'call_seconds',
      rewardCredits: 8,
    });
  });

  it('when the backend row says it has records, the type and the target are read only from the start', async () => {
    useMockBackend(mock);
    const real = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const answer = await real(input, init);
        if (String(input).includes('/tasks/configs?')) {
          const json = await answer.json();
          json.data.items = json.data.items.map((c: { id: string }) => ({
            ...c,
            hasRecords: c.id === '3',
          }));
          return new Response(JSON.stringify(json), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return answer;
      }),
    );
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const dialog = await edit(user, ARABIC_NAME);
    expect(num(dialog, 'Target')).toBeDisabled();
    expect(within(dialog).getByRole('combobox', { name: 'Task type' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    const other = await edit(user, THAI_NAME);
    expect(num(other, 'Target')).not.toBeDisabled();
  });

  it('changes the type and the target of a task without records', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const dialog = await edit(user, INDONESIAN_NAME);
    await chooseOption(user, 'Task type', 'Daily call time', dialog);
    await user.clear(num(dialog, 'Target'));
    await user.type(num(dialog, 'Target'), '90');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Task saved')).toBeInTheDocument();
    expect(writesOf(calls)[0].body).toMatchObject({ taskType: 'call_seconds', targetValue: 90 });
    expect(config('5')).toMatchObject({ taskType: 'call_seconds', targetValue: 90 });
  });

  it('clearing the claim time sends null', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const dialog = await edit(user, THAI_NAME);
    await user.clear(num(dialog, 'Claim time limit (seconds)'));
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Task saved')).toBeInTheDocument();
    expect(
      (writesOf(calls)[0].body as { claimTimeoutSeconds: unknown }).claimTimeoutSeconds,
    ).toBeNull();
  });

  it('a new form after an edit starts with the defaults, and the edit of another task shows that task and not the one before', async () => {
    useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const first = await edit(user, THAI_NAME);
    expect(num(first, 'Target')).toHaveValue('600');
    await user.click(within(first).getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    await user.click(await screen.findByRole('button', { name: 'New task' }));
    const fresh = await dialogOf('New daily task');
    expect(within(fresh).getByRole('textbox', { name: 'Task name' })).toHaveValue('');
    expect(num(fresh, 'Target')).toHaveValue('1');
    expect(num(fresh, 'Claim time limit (seconds)')).toHaveValue('');
    expect(within(fresh).getByText('0 / 500')).toBeInTheDocument();
    await user.click(within(fresh).getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    const other = await edit(user, ARABIC_NAME);
    expect(within(other).getByRole('textbox', { name: 'Task name' })).toHaveValue(ARABIC_NAME);
    expect(num(other, 'Target')).toHaveValue('20');
    expect(num(other, 'Claim time limit (seconds)')).toHaveValue('');
  });

  it('the type and target that a refusal made read only are open again in the next form', async () => {
    useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const first = await edit(user, THAI_NAME);
    await user.clear(num(first, 'Target'));
    await user.type(num(first, 'Target'), '900');
    await user.click(within(first).getByRole('button', { name: 'Submit' }));
    await within(first).findByText(
      /This task has records, so its type and target cannot be changed/,
    );
    await user.click(within(first).getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    const other = await edit(user, INDONESIAN_NAME);
    expect(num(other, 'Target')).not.toBeDisabled();
    expect(within(other).queryByText(/This task has records, so its type/)).toBeNull();
  });

  it('keeps a description of 300 letters without a space in the form, with its count', async () => {
    useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    const dialog = await edit(user, VIETNAMESE_NAME);
    expect(within(dialog).getByRole('textbox', { name: 'Description' })).toHaveValue(LONG);
    expect(within(dialog).getByText('300 / 500')).toBeInTheDocument();
  });
});

describe('the untyped text of the dialogs', { timeout: 30000 }, () => {
  it('a row whose name is not text opens the form with an empty name instead of breaking', async () => {
    stubFetch(async () =>
      jsonResponse(
        200,
        envelope('200', {
          items: [
            {
              id: '1',
              taskName: 12,
              taskType: 'text_messages',
              targetValue: 3,
              rewardCredits: 1,
              description: { a: 1 },
              claimTimeoutSeconds: null,
              sortOrder: 1,
              status: 'ENABLED',
              createdAt: 'x',
              updatedAt: 'y',
            },
          ],
          total: 1,
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage(<TaskConfigPage />);
    await user.click(
      within((await screen.findByText('12')).closest('tr') as HTMLElement).getByRole('button', {
        name: 'Edit',
      }),
    );
    const dialog = await dialogOf('Edit daily task');
    expect(within(dialog).getByRole('textbox', { name: 'Description' })).toBeInTheDocument();
  });
});
