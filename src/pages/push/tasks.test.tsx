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
import TasksPage from './tasks';
import {
  chooseOption,
  dialogsClosed,
  holdWrites,
  META,
  signIn,
  stubObjectUrls,
  uploadModule,
  uploads,
  writesOf,
} from './testSetup';

vi.mock('../../request/upload', async () => (await import('./testSetup')).uploadModule);

const backend = () => useMockBackend({ default: pushMock });

beforeEach(() => {
  signIn('root');
  stubObjectUrls();
  expect(uploadModule).toBeDefined();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const rowOf = async (title: string) => {
  const found = await screen.findByText(title);
  return found.closest('tr') as HTMLTableRowElement;
};

/** The sample tasks by id: 1 is waiting (Thai), 3 is sending, 4 is done, 5 was missed, 6 was cancelled. */
const titleOf = (id: string) => pushState.tasks.find((t) => t.id === id)?.title as string;

const openNew = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: 'New task' }));
  return screen.findByRole('dialog');
};

const basics = (dialog: HTMLElement, title = ' Nueva función ', body = 'Pruébala hoy') => {
  fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: title } });
  fireEvent.change(within(dialog).getByLabelText('Body'), { target: { value: body } });
};

const pick = (input: HTMLElement, value: string) => {
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
};

describe('the manual task page: the list', { timeout: 30000 }, () => {
  it('lists title, audience, status, sent, failed, creator and planned time', async () => {
    backend();
    renderPage(<TasksPage />);
    const done = await rowOf(titleOf('4'));
    expect(within(done).getByText('Done')).toBeInTheDocument();
    expect(within(done).getByText('1,148')).toBeInTheDocument(); // 1000 + 4 * 37
    expect(within(done).getByText('Everyone, guests included')).toBeInTheDocument();
    expect(within(done).getByText('root')).toBeInTheDocument();
    const waiting = await rowOf(titleOf('1'));
    expect(within(waiting).getByText('Waiting')).toBeInTheDocument();
    const sending = await rowOf(titleOf('3'));
    expect(within(sending).getByText('Sending')).toBeInTheDocument();
    expect(within(sending).getByText('120')).toBeInTheDocument();
    const cancelled = await rowOf(titleOf('6'));
    expect(within(cancelled).getByText('Cancelled')).toBeInTheDocument();
    expect(within(cancelled).getByText('Guests only')).toBeInTheDocument();
  });

  it('marks a task that was cancelled as missed, and shows the id of a creator who was deleted', async () => {
    backend();
    renderPage(<TasksPage />);
    const missed = await rowOf(titleOf('5'));
    expect(within(missed).getByText('Missed')).toBeInTheDocument();
    // task 7 was made by an administrator who has been deleted: the name is null, the id stays
    const gone = await rowOf(titleOf('7'));
    expect(within(gone).getByText('9999')).toBeInTheDocument();
  });

  it('shows titles in every language and holds a title without spaces in a cell', async () => {
    backend();
    pushState.tasks[0].title = 'ก'.repeat(200);
    pushState.tasks[1].title = '🙂'.repeat(100);
    pushState.tasks[2].title = 'ب'.repeat(300);
    renderPage(<TasksPage />);
    for (const text of ['ก'.repeat(200), '🙂'.repeat(100), 'ب'.repeat(300)]) {
      const found = await screen.findByText(text);
      expect(found.closest('button')).not.toBeNull();
    }
    expect(await screen.findByText(titleOf('4'))).toBeInTheDocument();
  });

  it('survives a number, a list or nothing where the backend promised text', async () => {
    stubFetch(() =>
      jsonResponse(
        200,
        envelope('200', {
          items: [
            {
              id: '1',
              audience: 7,
              status: ['x'],
              title: { en: 'object title' },
              body: null,
              scheduledAt: 12,
              createdByUsername: { a: 1 },
              createdBy: null,
              sentCount: 'many',
              failedCount: null,
              note: 5,
            },
            {
              id: '2',
              audience: 'ALL',
              status: 'PENDING',
              title: 'Plain',
              scheduledAt: '2026-10-26T10:00:00.000Z',
              sentCount: 0,
              failedCount: 0,
            },
          ],
          total: 2,
        }),
      ),
    );
    renderPage(<TasksPage />);
    expect(await screen.findByText('Plain')).toBeInTheDocument();
    expect(screen.getByText(/object title/)).toBeInTheDocument();
  });
});

describe('the manual task page: cancel', { timeout: 30000 }, () => {
  it('has a cancel button on a waiting task and on no other', async () => {
    backend();
    renderPage(<TasksPage />);
    await rowOf(titleOf('4'));
    for (const id of ['3', '4', '5', '6']) {
      expect(
        within(await rowOf(titleOf(id))).queryByRole('button', { name: 'Cancel task' }),
        id,
      ).not.toBeInTheDocument();
    }
    expect(
      within(await rowOf(titleOf('1'))).getByRole('button', { name: 'Cancel task' }),
    ).toBeInTheDocument();
    expect(
      within(await rowOf(titleOf('2'))).getByRole('button', { name: 'Cancel task' }),
    ).toBeInTheDocument();
  });

  it('asks in the row, then cancels with one POST and shows the task as cancelled', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TasksPage />);
    const row = await rowOf(titleOf('1'));
    await user.click(within(row).getByRole('button', { name: 'Cancel task' }));
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'POST',
      url: '/api/admin/push/tasks/1/cancel',
    });
    await waitFor(async () =>
      expect(within(await rowOf(titleOf('1'))).getByText('Cancelled')).toBeInTheDocument(),
    );
    expect(
      within(await rowOf(titleOf('1'))).queryByRole('button', { name: 'Cancel task' }),
    ).not.toBeInTheDocument();
  });

  it('says the state does not allow it (translated, not the backend words) when the task started meanwhile, and reads the list again', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<TasksPage />);
    const row = await rowOf(titleOf('1'));
    (pushState.tasks.find((t) => t.id === '1') as { status: string }).status = 'RUNNING';
    await user.click(within(row).getByRole('button', { name: 'Cancel task' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText('The current state of the item does not allow this action.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Only a task that has not started/)).not.toBeInTheDocument();
    await waitFor(async () =>
      expect(within(await rowOf(titleOf('1'))).getByText('Sending')).toBeInTheDocument(),
    );
  });

  it('sends one request when OK is pressed twice at once', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TasksPage />);
    const row = await rowOf(titleOf('1'));
    await user.click(within(row).getByRole('button', { name: 'Cancel task' }));
    const ok = await screen.findByRole('button', { name: 'OK' });
    fireEvent.click(ok);
    fireEvent.click(ok);
    await waitFor(() => expect(writesOf(calls).length).toBeGreaterThanOrEqual(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(writesOf(calls)).toHaveLength(1);
  });
});

describe('the manual task page: new task', { timeout: 60000 }, () => {
  it('sends a task for everyone at once: no time, no filters, no picture, the words trimmed', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TasksPage />);
    const dialog = await openNew(user);
    basics(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const posted = writesOf(calls)[0];
    expect(posted).toMatchObject({ method: 'POST', url: '/api/admin/push/tasks' });
    expect(posted.body).toEqual({
      audience: 'ALL',
      title: 'Nueva función',
      body: 'Pruébala hoy',
      linkType: 'NONE',
      linkTarget: '',
    });
    await dialogsClosed();
    expect(await screen.findByText('Nueva función')).toBeInTheDocument();
  });

  it('sends the platforms and languages that were chosen for an audience that allows them', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TasksPage />);
    const dialog = await openNew(user);
    basics(dialog);
    await chooseOption(user, 'Audience', 'Guests only', dialog);
    await chooseOption(user, 'Platforms', 'Android', dialog);
    await chooseOption(user, 'Languages', 'th', dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toMatchObject({
      audience: 'GUESTS',
      platforms: ['ANDROID'],
      locales: ['th'],
    });
    expect(Object.keys(writesOf(calls)[0].body as object)).not.toContain('accountIds');
  });

  it('with an account ID list the platform and language filters are disabled, emptied and not sent', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TasksPage />);
    const dialog = await openNew(user);
    basics(dialog);
    await chooseOption(user, 'Platforms', 'iOS', dialog);
    await chooseOption(user, 'Languages', 'ar', dialog);
    expect(within(dialog).getByRole('combobox', { name: 'Platforms' })).not.toBeDisabled();
    expect(within(dialog).queryByLabelText('Account IDs')).not.toBeInTheDocument();
    await chooseOption(user, 'Audience', 'Account ID list', dialog);
    expect(within(dialog).getByRole('combobox', { name: 'Platforms' })).toBeDisabled();
    expect(within(dialog).getByRole('combobox', { name: 'Languages' })).toBeDisabled();
    // nothing is left chosen in the two filters
    expect(dialog.querySelectorAll('.ant-select-selection-item')).toHaveLength(0);
    // another audience: the filters work again, and are empty; the list works again after that
    await chooseOption(user, 'Audience', 'Registered accounts only', dialog);
    expect(within(dialog).getByRole('combobox', { name: 'Platforms' })).not.toBeDisabled();
    expect(dialog.querySelectorAll('.ant-select-selection-item')).toHaveLength(0);
    await chooseOption(user, 'Audience', 'Account ID list', dialog);
    fireEvent.change(within(dialog).getByLabelText('Account IDs'), {
      target: { value: 'acc-1\nacc-2, acc-3  acc-1' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toEqual({
      audience: 'ACCOUNT_IDS',
      accountIds: ['acc-1', 'acc-2', 'acc-3'],
      title: 'Nueva función',
      body: 'Pruébala hoy',
      linkType: 'NONE',
      linkTarget: '',
    });
  });

  it('wants at least one account ID for a list, and sends nothing without it', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TasksPage />);
    const dialog = await openNew(user);
    basics(dialog);
    await chooseOption(user, 'Audience', 'Account ID list', dialog);
    fireEvent.change(within(dialog).getByLabelText('Account IDs'), { target: { value: ' \n , ' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Enter at least one account ID')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('asks for the title and the body', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TasksPage />);
    const dialog = await openNew(user);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Enter a title')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter the body')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('sends a time chosen on the picker as the UTC instant of the clock it shows, and says that it is UTC', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TasksPage />);
    const dialog = await openNew(user);
    basics(dialog);
    expect(within(dialog).queryByLabelText('Time (UTC)')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: 'At a time' }));
    expect(within(dialog).getByText(/The time is UTC/)).toBeInTheDocument();
    pick(within(dialog).getByLabelText('Time (UTC)'), '2031-03-04 21:45');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { scheduledAt: string }).scheduledAt).toBe(
      '2031-03-04T21:45:00.000Z',
    );
  });

  it('wants the time once "at a time" is chosen, and does not take a time that has passed', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TasksPage />);
    const dialog = await openNew(user);
    basics(dialog);
    await user.click(within(dialog).getByRole('radio', { name: 'At a time' }));
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Pick the time')).toBeInTheDocument();
    pick(within(dialog).getByLabelText('Time (UTC)'), '2020-01-01 10:00');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Pick a time that has not passed')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('uploads the picture first and sends its uploadId only, with the upload control for push pictures', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TasksPage />);
    const dialog = await openNew(user);
    basics(dialog);
    expect(within(dialog).getByText(/Accepted: JPEG \/ PNG/)).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('upload-input'), {
      target: { files: [fileOf(pngBytes(50, 50), 'promo.png')] },
    });
    await waitFor(() => expect(uploads).toHaveLength(1));
    expect(uploads[0].url).toBe('/uploads/image');
    await within(dialog).findByText(/Uploaded: promo\.png/);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(String((writesOf(calls)[0].body as { imageUploadId: string }).imageUploadId)).toMatch(
      /^up-img-/,
    );
    expect(JSON.stringify(writesOf(calls)[0].body)).not.toMatch(/imageUrl|mock-files|http/);
  });

  it('keeps Submit disabled while the picture is uploading', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<TasksPage />);
    const dialog = await openNew(user);
    basics(dialog);
    let release: (v: unknown) => void = () => {};
    const slow = new Promise((resolve) => {
      release = resolve;
    });
    const original = uploadModule.uploadFile;
    uploadModule.uploadFile = async (options) => {
      await slow;
      return original(options);
    };
    try {
      fireEvent.change(screen.getByTestId('upload-input'), {
        target: { files: [fileOf(pngBytes(50, 50), 'slow.png')] },
      });
      const submit = within(dialog).getByRole('button', { name: 'Submit' });
      await waitFor(() => expect(submit).toBeDisabled());
      release(null);
      await waitFor(() => expect(submit).not.toBeDisabled());
    } finally {
      uploadModule.uploadFile = original;
    }
  });

  it('sends the link kind and screen, the same control as on the template', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<TasksPage />);
    const dialog = await openNew(user);
    basics(dialog);
    const box = within(within(dialog).getByTestId('link-field'));
    await user.click(box.getAllByRole('combobox')[0]);
    const kind = await screen.findAllByText('App screen', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(kind[kind.length - 1]);
    await user.click(box.getAllByRole('combobox')[1]);
    const screens = await screen.findAllByText('Store', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(screens[screens.length - 1]);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toMatchObject({ linkType: 'SCREEN', linkTarget: 'store' });
  });

  it('sends one request when the form is submitted again while the first request is still on its way', async () => {
    const calls = backend();
    const slow = holdWrites();
    const user = userEvent.setup();
    renderPage(<TasksPage />);
    const dialog = await openNew(user);
    basics(dialog);
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
    renderPage(<TasksPage />);
    const dialog = await openNew(user);
    basics(dialog);
    const submit = within(dialog).getByRole('button', { name: 'Submit' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(writesOf(calls).length).toBeGreaterThanOrEqual(1));
    await new Promise((r) => setTimeout(r, 150));
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('shows the translated text and field mark when the backend refuses, and keeps the dialog and what was typed', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<TasksPage />);
    const dialog = await openNew(user);
    basics(dialog, 'x'.repeat(201));
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText(
        'Some input is not valid. Please check the fields and try again.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('The value is too long.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Title')).toHaveValue('x'.repeat(201));
  });
});

describe('the manual task page: languages and permissions', { timeout: 30000 }, () => {
  it('offers the supported languages for the language filter when meta has them, and lets any tag be typed otherwise', async () => {
    signIn('root', { meta: { ...META, supportedLocales: undefined } });
    backend();
    const user = userEvent.setup();
    renderPage(<TasksPage />);
    const dialog = await openNew(user);
    expect(within(dialog).getByRole('combobox', { name: 'Languages' })).not.toBeDisabled();
    await user.type(within(dialog).getByRole('combobox', { name: 'Languages' }), 'vi');
    const typed = await screen.findAllByText('vi', { selector: '.ant-select-item-option-content' });
    await user.click(typed[typed.length - 1]);
    expect(
      [...dialog.querySelectorAll('.ant-select-selection-item')].some(
        (el) => el.textContent === 'vi',
      ),
    ).toBe(true);
  });

  it('without PUSH:SEND there is no new task and no cancel', async () => {
    signIn('root');
    setTestAccess(access({ me: { superAdmin: false, permissions: ['PUSH:VIEW'] } }));
    backend();
    renderPage(<TasksPage />);
    const row = await rowOf(titleOf('1'));
    expect(screen.queryByRole('button', { name: 'New task' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Cancel task' })).not.toBeInTheDocument();
  });

  it('draws in Chinese', async () => {
    backend();
    renderPage(<TasksPage />, 'zh-CN');
    expect(await screen.findByRole('button', { name: /新建任务/ })).toBeInTheDocument();
    const row = await rowOf(titleOf('1'));
    expect(within(row).getByText('等待中')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: '取消任务' })).toBeInTheDocument();
  });
});
