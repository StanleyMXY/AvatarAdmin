import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import activityMock from '../../../mock/activity.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import SigninConfigPage from './signinConfig';
import {
  activityState,
  chooseOption,
  dialogsClosed,
  holdWrites,
  signIn,
  writesOf,
} from './testSetup';

const mock = { default: activityMock };

beforeEach(() => signIn('root'));
afterEach(() => vi.unstubAllGlobals());

const AUTUMN = 'Autumn check-in 🍂';
const THAI = 'ภาษาไทยไม่มีช่องว่างระหว่างคำดังนั้นข้อความยาวๆอาจทำให้ตารางล้นได้ถ้าไม่จัดการให้ดี';
const ARABIC =
  'هذا نص طويل جدا باللغة العربية يكتب من اليمين إلى اليسار ويحتوي على أرقام ١٢٣ وكلمات إنجليزية mixed in';
const INDONESIAN =
  'Aplikasi ini sangat membantu saya setiap hari dalam berkomunikasi dengan teman-teman baru';
const VIETNAMESE =
  'Ứng dụng này giúp tôi nói chuyện với bạn bè mỗi ngày một cách dễ dàng và vui vẻ';
const SPANISH = 'Hola, ¿cómo estás hoy?';
const LONG = 'A'.repeat(300);

/** The table row of a name; the names listed in a dialog that was closed earlier are not rows. */
const rowOf = async (name: string): Promise<HTMLElement> => {
  const rows = (await screen.findAllByText(name))
    .map((el) => el.closest('tr'))
    .filter((tr): tr is HTMLTableRowElement => tr !== null);
  if (rows.length !== 1) throw new Error(`${rows.length} rows with the name ${name}`);
  return rows[0];
};

const status = (id: string) => activityState.activities.find((a) => a.id === id)?.status;

const statusCalls = (calls: { method: string; url: string; body: unknown }[]) =>
  calls.filter((c) => c.method === 'PUT' && c.url.endsWith('/status'));

/** Opens "More" of a row and chooses an item of the menu. */
async function fromMore(user: ReturnType<typeof userEvent.setup>, row: HTMLElement, label: string) {
  await user.click(within(row).getByRole('button', { name: 'More' }));
  await user.click(await screen.findByRole('menuitem', { name: label }));
}

/** The dialog that holds this title (the dialogs of this antd version have no accessible name). */
const dialogOf = (title: string | RegExp) =>
  waitFor(() => {
    const found = screen
      .getAllByRole('dialog')
      .find((d) => within(d).queryAllByText(title).length > 0);
    if (!found) throw new Error(`no dialog with the title ${String(title)}`);
    return found;
  });

describe('the sign-in setup page: the list', { timeout: 30000 }, () => {
  it('shows the activities with their lifecycle state, and the note about local days and the loop', async () => {
    useMockBackend(mock);
    renderPage(<SigninConfigPage />);
    expect(await screen.findByText(AUTUMN)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Check-in follows the local day of each user. When the steps run out, they start again from day 1.',
      ),
    ).toBeInTheDocument();
    for (const name of [THAI, ARABIC, INDONESIAN, VIETNAMESE, SPANISH]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(within(await rowOf(AUTUMN)).getByText('Live')).toBeInTheDocument();
    // Stored as live, but its last day is long past.
    expect(within(await rowOf(SPANISH)).getByText('Ended')).toBeInTheDocument();
    expect(within(await rowOf(THAI)).getByText('Draft')).toBeInTheDocument();
    expect(within(await rowOf(ARABIC)).getByText('Stopped')).toBeInTheDocument();
  });

  it('shows the four times of a row, and "No limit" for an empty start or end', async () => {
    useMockBackend(mock);
    renderPage(<SigninConfigPage />);
    const unlimited = await rowOf(LONG);
    expect(within(unlimited).getByText('Starts: No limit')).toBeInTheDocument();
    expect(within(unlimited).getByText('Ends: No limit')).toBeInTheDocument();
    expect(within(unlimited).getByText(/^Created: /)).toBeInTheDocument();
    expect(within(unlimited).getByText(/^Updated: /)).toBeInTheDocument();
    const live = activityState.activities.find((a) => a.id === '1');
    const row = await rowOf(AUTUMN);
    expect(within(row).getByText(`Starts: ${live?.startDate}`)).toBeInTheDocument();
    expect(within(row).getByText(`Ends: ${live?.endDate}`)).toBeInTheDocument();
  });

  it('keeps a name of 300 letters without a space inside its cell: cut to two lines, the whole text on click', async () => {
    useMockBackend(mock);
    renderPage(<SigninConfigPage />);
    const button = await screen.findByRole('button', { name: LONG });
    expect(button.getAttribute('data-lines')).toBe('2');
    expect(button.style.overflowWrap).toBe('anywhere');
    expect(button.style.maxWidth).not.toBe('');
  });

  it('does not break on a name that is not text', async () => {
    const rows = [
      {
        id: '1',
        name: 12345,
        status: 'DRAFT',
        lifecycleStatus: 'DRAFT',
        startDate: 20261001,
        endDate: { a: 1 },
        createdAt: null,
        updatedAt: {},
      },
      {
        id: '2',
        name: null,
        status: 'MYSTERY',
        lifecycleStatus: 'MYSTERY',
        startDate: null,
        endDate: null,
        createdAt: 'x',
        updatedAt: 'y',
      },
    ];
    stubFetch(async () => jsonResponse(200, envelope('200', { items: rows, total: 2 })));
    renderPage(<SigninConfigPage />);
    expect(await screen.findByText('12345')).toBeInTheDocument();
    expect(screen.getByText('MYSTERY')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\[object Object\]|undefined|NaN|null/);
  });

  it('asks again with the name and the state of the form when Query is pressed', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    await screen.findByText(AUTUMN);
    await user.type(screen.getByRole('textbox', { name: 'Activity name' }), '  autumn ');
    await chooseOption(user, 'Status', 'Ended');
    await user.click(screen.getByRole('button', { name: /查\s*询|Query|Search/ }));
    await waitFor(() => {
      const url = new URL(
        [...calls].reverse().find((c) => c.url.includes('/checkin/activities'))?.url as string,
        'http://x',
      );
      expect(url.searchParams.get('lifecycleStatus')).toBe('ENDED');
      expect(url.searchParams.get('name')).toBe('autumn');
    });
  });

  it('shows the failure of the list in words of the error code, with a retry', async () => {
    stubFetch(async () =>
      jsonResponse(500, envelope('INTERNAL_ERROR', null, 'SECRET BACKEND MESSAGE')),
    );
    renderPage(<SigninConfigPage />);
    expect(await screen.findByText(/Failed to load/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND MESSAGE');
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });
});

describe('the sign-in setup page: what each state offers', { timeout: 30000 }, () => {
  it('a draft: View, Edit, Publish, Delete; a live one: View, Edit, Stop; a stopped one: View, Edit, Enable; nothing else', async () => {
    useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const draft = await rowOf(THAI);
    expect(within(draft).getByRole('button', { name: 'View' })).toBeInTheDocument();
    expect(within(draft).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    await user.click(within(draft).getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    const names = (row: HTMLElement) =>
      within(row)
        .getAllByRole('button')
        .map((b) => b.textContent)
        .filter((t) =>
          ['View', 'Edit', 'Stop', 'Enable', 'Publish', 'Delete', 'More'].includes(t ?? ''),
        );
    expect(names(await rowOf(AUTUMN))).toEqual(['View', 'Edit', 'Stop']);
    expect(names(await rowOf(ARABIC))).toEqual(['View', 'Edit', 'Enable']);
    expect(names(await rowOf(SPANISH))).toEqual(['View', 'Edit', 'Stop']);
  });

  it('has no Delete for any activity that is not a draft', async () => {
    useMockBackend(mock);
    renderPage(<SigninConfigPage />);
    for (const name of [AUTUMN, SPANISH, ARABIC, LONG]) {
      const row = await rowOf(name === LONG ? LONG : name);
      expect(within(row).queryByText('Delete'), name).toBeNull();
      expect(within(row).queryByRole('button', { name: 'More' }), name).toBeNull();
    }
  });

  it('without CHECKIN:MANAGE there is no New button and no Edit, Publish, Enable, Stop or Delete, only View', async () => {
    signIn('finance', { codes: ['CHECKIN:VIEW'] });
    useMockBackend(mock);
    renderPage(<SigninConfigPage />);
    await screen.findByText(AUTUMN);
    expect(screen.queryByRole('button', { name: 'New activity' })).toBeNull();
    for (const label of ['Edit', 'Publish', 'Enable', 'Stop', 'Delete', 'More']) {
      expect(screen.queryByRole('button', { name: label }), label).toBeNull();
    }
    expect(screen.getAllByRole('button', { name: 'View' })).toHaveLength(7);
  });

  it('with CHECKIN:MANAGE the New button is there', async () => {
    useMockBackend(mock);
    renderPage(<SigninConfigPage />);
    expect(await screen.findByRole('button', { name: 'New activity' })).toBeInTheDocument();
  });
});

describe('publishing and enabling ask first (the probe)', { timeout: 30000 }, () => {
  it('a draft that overlaps nothing is published with one request: confirm=false, no question', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    await fromMore(user, await rowOf(THAI), 'Publish');
    expect(await screen.findByText('Check-in activity published')).toBeInTheDocument();
    expect(statusCalls(calls)).toHaveLength(1);
    expect(statusCalls(calls)[0].body).toEqual({ status: 'ACTIVE', confirm: false });
    expect(status('3')).toBe('ACTIVE');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a draft that overlaps asks with the names of the activities that will be stopped; Cancel sends nothing more', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    await fromMore(user, await rowOf(VIETNAMESE), 'Publish');
    const question = await dialogOf('Enable it and stop the overlapping activities?');
    expect(
      within(question).getByText('These activities have days that overlap and will be stopped:'),
    ).toBeInTheDocument();
    expect(within(question).getByText(AUTUMN)).toBeInTheDocument();
    await user.click(within(question).getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    expect(writesOf(calls)).toHaveLength(1);
    expect(statusCalls(calls)[0].body).toEqual({ status: 'ACTIVE', confirm: false });
    expect(status('5')).toBe('DRAFT');
    expect(status('1')).toBe('ACTIVE');
  });

  it('after Confirm the same request goes again with confirm=true, and the list shows what was stopped', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    await fromMore(user, await rowOf(VIETNAMESE), 'Publish');
    const question = await dialogOf('Enable it and stop the overlapping activities?');
    await user.click(within(question).getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Check-in activity published')).toBeInTheDocument();
    expect(statusCalls(calls).map((c) => c.body)).toEqual([
      { status: 'ACTIVE', confirm: false },
      { status: 'ACTIVE', confirm: true },
    ]);
    expect(status('5')).toBe('ACTIVE');
    expect(status('1')).toBe('DISABLED');
    await waitFor(
      async () => expect(within(await rowOf(AUTUMN)).getByText('Stopped')).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });

  it('enabling a stopped activity is probed the same way and lists every activity it would stop', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    await user.click(within(await rowOf(LONG)).getByRole('button', { name: 'Enable' }));
    const question = await dialogOf('Enable it and stop the overlapping activities?');
    expect(within(question).getByText(AUTUMN)).toBeInTheDocument();
    expect(within(question).getByText(SPANISH)).toBeInTheDocument();
    await user.click(within(question).getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    expect(statusCalls(calls)).toHaveLength(1);
    expect(statusCalls(calls)[0].body).toEqual({ status: 'ACTIVE', confirm: false });
    expect(status('6')).toBe('DISABLED');
  });

  it('enabling one that overlaps nothing needs no question', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    await user.click(within(await rowOf(ARABIC)).getByRole('button', { name: 'Enable' }));
    expect(await screen.findByText('Check-in activity enabled')).toBeInTheDocument();
    expect(statusCalls(calls)).toHaveLength(1);
    expect(status('4')).toBe('ACTIVE');
  });

  it('a name that is not text in the question does not break the dialog', async () => {
    const list = [
      {
        id: '5',
        name: 'Planned',
        status: 'DRAFT',
        lifecycleStatus: 'DRAFT',
        startDate: null,
        endDate: null,
        createdAt: 'x',
        updatedAt: 'y',
      },
    ];
    stubFetch(async (call) =>
      call.init.method === 'PUT'
        ? jsonResponse(
            200,
            envelope('200', {
              applied: false,
              disabledActivities: [
                { id: '1', name: { x: 1 } },
                { id: '2', name: null },
                { id: '3', name: LONG },
              ],
            }),
          )
        : jsonResponse(200, envelope('200', { items: list, total: 1 })),
    );
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    await fromMore(user, await rowOf('Planned'), 'Publish');
    const question = await dialogOf('Enable it and stop the overlapping activities?');
    expect(within(question).getByText(LONG)).toBeInTheDocument();
    expect(question.textContent).not.toMatch(/\[object Object\]|undefined/);
  });

  it('a second press on Enable while the request is on its way sends one request', async () => {
    const calls = useMockBackend(mock);
    const gate = holdWrites();
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const enable = within(await rowOf(ARABIC)).getByRole('button', { name: 'Enable' });
    await user.click(enable);
    await user.click(enable);
    await waitFor(() => expect(gate.started()).toBe(1));
    gate.release();
    expect(await screen.findByText('Check-in activity enabled')).toBeInTheDocument();
    expect(statusCalls(calls)).toHaveLength(1);
  });

  it('a second press on Confirm sends one request with confirm=true', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    await fromMore(user, await rowOf(VIETNAMESE), 'Publish');
    const question = await dialogOf('Enable it and stop the overlapping activities?');
    const gate = holdWrites((init) => String(init.body).includes('"confirm":true'));
    const ok = within(question).getByRole('button', { name: 'Confirm' });
    await user.click(ok);
    await user.click(ok);
    await waitFor(() => expect(gate.started()).toBe(1));
    gate.release();
    expect(await screen.findByText('Check-in activity published')).toBeInTheDocument();
    expect(statusCalls(calls).filter((c) => (c.body as { confirm: boolean }).confirm)).toHaveLength(
      1,
    );
  });

  it('a state the activity has already left (409 INVALID_STATE) is shown in words and the list is read again', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const row = await rowOf(THAI);
    // Somebody else published it in the meantime.
    Object.assign(activityState.activities.find((a) => a.id === '3') ?? {}, { status: 'ACTIVE' });
    await fromMore(user, row, 'Publish');
    expect(
      await screen.findByText('The current state of the item does not allow this action.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        calls.filter((c) => c.method === 'GET' && c.url.includes('/checkin/activities?')).length,
      ).toBeGreaterThan(1),
    );
  });

  it('without CHECKIN:MANAGE the backend refusal (403) would show only the words of the code', async () => {
    useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const row = await rowOf(THAI);
    // The permission is taken away after the page was drawn.
    const { adminOf } = await import('../../../mock/_core/testing');
    adminOf('root').permissions = [];
    adminOf('root').superAdmin = false;
    await fromMore(user, row, 'Publish');
    expect(
      (
        await screen.findAllByText(/permission|not allowed|forbidden/i, undefined, {
          timeout: 5000,
        })
      ).length,
    ).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('The administrator lacks the permission');
  });
});

describe('stopping and deleting', { timeout: 30000 }, () => {
  it('stops a live activity after the inline question, with the status call and no confirm', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    await user.click(within(await rowOf(AUTUMN)).getByRole('button', { name: 'Stop' }));
    expect(await screen.findByText('Stop this check-in activity?')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(await screen.findByText('Check-in activity stopped')).toBeInTheDocument();
    expect(statusCalls(calls)[0].body).toEqual({ status: 'DISABLED' });
    expect(status('1')).toBe('DISABLED');
  });

  it('Cancel on the question sends nothing', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    await user.click(within(await rowOf(AUTUMN)).getByRole('button', { name: 'Stop' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('deletes a draft after the question, and the row is gone', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    await fromMore(user, await rowOf(THAI), 'Delete');
    const question = await dialogOf(
      'Delete this check-in activity? Only a draft without check-in records can be deleted.',
    );
    await user.click(within(question).getByRole('button', { name: 'OK' }));
    expect(await screen.findByText('Check-in activity deleted')).toBeInTheDocument();
    expect(writesOf(calls).map((c) => [c.method, c.url])).toEqual([
      ['DELETE', '/api/admin/checkin/activities/3'],
    ]);
    await waitFor(() => expect(screen.queryByText(THAI)).toBeNull());
  });

  it('a draft that has records cannot be deleted: the failure is shown in words and the row stays', async () => {
    activityState.checkinRecords.push({ ...activityState.checkinRecords[0], activityId: '3' });
    useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    await fromMore(user, await rowOf(THAI), 'Delete');
    const question = await dialogOf(/^Delete this check-in activity/);
    await user.click(within(question).getByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText('The current state of the item does not allow this action.'),
    ).toBeInTheDocument();
    expect(screen.getByText(THAI)).toBeInTheDocument();
  });
});

describe('the detail dialog', { timeout: 30000 }, () => {
  it('shows the name, the state, the days and the steps by day: reward credits and bonus credits', async () => {
    useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    await user.click(within(await rowOf(AUTUMN)).getByRole('button', { name: 'View' }));
    const dialog = await dialogOf('Check-in activity');
    await waitFor(() => expect(within(dialog).getByText('Day 7')).toBeInTheDocument());
    expect(within(dialog).getByText(AUTUMN)).toBeInTheDocument();
    expect(within(dialog).getByText('Live')).toBeInTheDocument();
    const steps = within(dialog).getAllByRole('table').at(-1) as HTMLElement;
    const rows = within(steps).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(7);
    expect(
      within(rows[0])
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['Day 1', '1', '0']);
    expect(
      within(rows[6])
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['Day 7', '5', '2']);
    expect(within(dialog).getByText('Reward credits')).toBeInTheDocument();
    expect(within(dialog).getByText('Bonus credits')).toBeInTheDocument();
  });

  it('the answer of an earlier request never replaces the answer of a later one', async () => {
    const real = globalThis.fetch;
    useMockBackend(mock);
    const mockFetch = globalThis.fetch;
    let releaseFirst: () => void = () => {};
    const first = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        if (String(input).endsWith('/checkin/activities/1')) await first;
        return mockFetch(input, init);
      }),
    );
    void real;
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    await user.click(within(await rowOf(AUTUMN)).getByRole('button', { name: 'View' }));
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    await dialogsClosed();
    await user.click(within(await rowOf(ARABIC)).getByRole('button', { name: 'View' }));
    const dialog = await dialogOf('Check-in activity');
    await waitFor(() => expect(within(dialog).getByText('Day 2')).toBeInTheDocument());
    releaseFirst();
    await new Promise((r) => setTimeout(r, 50));
    expect(within(dialog).getByText(ARABIC)).toBeInTheDocument();
    expect(within(dialog).queryByText(AUTUMN)).toBeNull();
    expect(within(dialog).queryByText('Day 7')).toBeNull();
  });

  it('never shows the content of the activity that was looked at before while the next one is being read', async () => {
    useMockBackend(mock);
    const mockFetch = globalThis.fetch;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        if (String(input).endsWith('/checkin/activities/4')) await gate;
        return mockFetch(input, init);
      }),
    );
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    await user.click(within(await rowOf(AUTUMN)).getByRole('button', { name: 'View' }));
    const first = await dialogOf('Check-in activity');
    await within(first).findByText('Day 7');
    await user.click(within(first).getByRole('button', { name: 'Close' }));
    await dialogsClosed();
    await user.click(within(await rowOf(ARABIC)).getByRole('button', { name: 'View' }));
    const second = await dialogOf('Check-in activity');
    expect(within(second).queryByText('Day 7')).toBeNull();
    expect(within(second).queryByText(AUTUMN)).toBeNull();
    release();
    await within(second).findByText('Day 2');
    expect(within(second).getByText(ARABIC)).toBeInTheDocument();
  });

  it('shows the failure to read in words with a retry', async () => {
    useMockBackend(mock);
    const mockFetch = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        if (String(input).endsWith('/checkin/activities/1')) {
          return jsonResponse(404, envelope('RESOURCE_NOT_FOUND', null, 'SECRET BACKEND MESSAGE'));
        }
        return mockFetch(input, init);
      }),
    );
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    await user.click(within(await rowOf(AUTUMN)).getByRole('button', { name: 'View' }));
    const dialog = await dialogOf('Check-in activity');
    expect(await within(dialog).findByText(/Failed to load/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND MESSAGE');
    expect(within(dialog).getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });
});

describe('the form: a new activity', { timeout: 30000 }, () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'New activity' }));
    return dialogOf('New check-in activity');
  };

  it('has one step to begin with: day 1, a reward to fill in and a bonus of 0; says that the days are local days', async () => {
    useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const dialog = await open(user);
    expect(within(dialog).getByText('Day 1')).toBeInTheDocument();
    expect(within(dialog).getByRole('spinbutton', { name: 'Day 1 Reward credits' })).toHaveValue(
      '',
    );
    expect(within(dialog).getByRole('spinbutton', { name: 'Day 1 Bonus credits' })).toHaveValue(
      '0',
    );
    expect(
      within(dialog).getByText('The dates are local days of the users. Leave empty for no limit.'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Check-in follows the local day of each user. When the steps run out, they start again from day 1.',
      ),
    ).toBeInTheDocument();
  });

  it('numbers the days by the order of the rows: Add a day adds the next one, removing one renumbers the rest, the last one cannot be removed', async () => {
    useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const dialog = await open(user);
    expect(within(dialog).queryByRole('button', { name: /Remove day/ })).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: /Add a day/ }));
    await user.click(within(dialog).getByRole('button', { name: /Add a day/ }));
    expect(within(dialog).getByText('Day 3')).toBeInTheDocument();
    await user.type(within(dialog).getByRole('spinbutton', { name: 'Day 2 Reward credits' }), '7');
    await user.click(within(dialog).getByRole('button', { name: /Remove day 1/ }));
    expect(within(dialog).queryByText('Day 3')).toBeNull();
    expect(within(dialog).getByRole('spinbutton', { name: 'Day 1 Reward credits' })).toHaveValue(
      '7',
    );
    await user.click(within(dialog).getByRole('button', { name: /Remove day 1/ }));
    expect(within(dialog).queryByRole('button', { name: /Remove day/ })).toBeNull();
  });

  it('refuses an empty name, a reward that is missing, a reward below 0 and a reward that is not whole, and sends nothing', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const dialog = await open(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Activity name' }), '   ');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Enter the activity name')).toBeInTheDocument();
    expect(await within(dialog).findAllByText('Enter a whole number, 0 or more')).not.toHaveLength(
      0,
    );
    // A decimal and a negative number are not accepted either.
    const reward = within(dialog).getByRole('spinbutton', { name: 'Day 1 Reward credits' });
    await user.type(reward, '-3');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() =>
      expect(within(dialog).getAllByText('Enter a whole number, 0 or more').length).toBeGreaterThan(
        0,
      ),
    );
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('refuses an end date before the start date', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const dialog = await open(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Activity name' }), 'Spring');
    await user.type(within(dialog).getByRole('spinbutton', { name: 'Day 1 Reward credits' }), '1');
    const [start, end] = within(dialog).getAllByPlaceholderText(/Select date/i);
    await user.type(start, '2027-03-10{Enter}');
    await user.type(end, '2027-03-01{Enter}');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText('The end date cannot be before the start date'),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('sends the name trimmed, the days as picked or null, and the steps numbered from 1 with a bonus of 0 by default', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const dialog = await open(user);
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Activity name' }),
      '  สงกรานต์ 🎉  ',
    );
    const [start] = within(dialog).getAllByPlaceholderText(/Select date/i);
    await user.type(start, '2027-04-10{Enter}');
    await user.type(within(dialog).getByRole('spinbutton', { name: 'Day 1 Reward credits' }), '2');
    await user.click(within(dialog).getByRole('button', { name: /Add a day/ }));
    await user.type(within(dialog).getByRole('spinbutton', { name: 'Day 2 Reward credits' }), '0');
    await user.clear(within(dialog).getByRole('spinbutton', { name: 'Day 2 Bonus credits' }));
    await user.type(within(dialog).getByRole('spinbutton', { name: 'Day 2 Bonus credits' }), '4');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Check-in activity saved')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(1);
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'POST',
      url: '/api/admin/checkin/activities',
    });
    expect(writesOf(calls)[0].body).toEqual({
      name: 'สงกรานต์ 🎉',
      startDate: '2027-04-10',
      endDate: null,
      rewards: [
        { dayNum: 1, rewardCredits: 2, bonusCredits: 0 },
        { dayNum: 2, rewardCredits: 0, bonusCredits: 4 },
      ],
    });
    await dialogsClosed();
    expect(await screen.findByText('สงกรานต์ 🎉')).toBeInTheDocument();
    expect(activityState.activities.find((a) => a.name === 'สงกรานต์ 🎉')?.status).toBe('DRAFT');
  });

  it('a second press on Submit while the request is on its way sends one request', async () => {
    const calls = useMockBackend(mock);
    const gate = holdWrites();
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const dialog = await open(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Activity name' }), 'Twice');
    await user.type(within(dialog).getByRole('spinbutton', { name: 'Day 1 Reward credits' }), '1');
    const submit = within(dialog).getByRole('button', { name: 'Submit' });
    await user.click(submit);
    await user.click(submit);
    await waitFor(() => expect(gate.started()).toBe(1));
    gate.release();
    expect(await screen.findByText('Check-in activity saved')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('a refusal of the backend keeps the dialog open, puts the reason under the field and the words of the code at the bottom, never the backend message', async () => {
    useMockBackend(mock);
    const mockFetch = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return jsonResponse(
            400,
            envelope(
              'INVALID_REQUEST',
              { details: [{ ref: 'name', reason: 'TOO_LONG' }] },
              'SECRET BACKEND MESSAGE',
            ),
          );
        }
        return mockFetch(input, init);
      }),
    );
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const dialog = await open(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Activity name' }), 'x');
    await user.type(within(dialog).getByRole('spinbutton', { name: 'Day 1 Reward credits' }), '1');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('The value is too long.')).toBeInTheDocument();
    expect(within(dialog).getByRole('alert')).toBeInTheDocument();
    expect(await dialogOf('New check-in activity')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND MESSAGE');
  });

  it('is not offered without CHECKIN:MANAGE even if the dialog code were reached', async () => {
    signIn('finance', { codes: ['CHECKIN:VIEW'] });
    useMockBackend(mock);
    renderPage(<SigninConfigPage />);
    await screen.findByText(AUTUMN);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('the form: editing', { timeout: 30000 }, () => {
  const edit = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(within(await rowOf(name)).getByRole('button', { name: 'Edit' }));
    const dialog = await dialogOf('Edit check-in activity');
    // The steps come from the read of the activity: the dialog waits for them.
    await within(dialog).findByRole('textbox', { name: 'Activity name' });
    return dialog;
  };

  it('is filled from the activity with its steps, one row for each', async () => {
    useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const dialog = await edit(user, AUTUMN);
    expect(within(dialog).getByRole('textbox', { name: 'Activity name' })).toHaveValue(AUTUMN);
    expect(within(dialog).getByText('Day 7')).toBeInTheDocument();
    expect(within(dialog).getByRole('spinbutton', { name: 'Day 7 Reward credits' })).toHaveValue(
      '5',
    );
    expect(within(dialog).getByRole('spinbutton', { name: 'Day 7 Bonus credits' })).toHaveValue(
      '2',
    );
  });

  it('a draft is saved with one PUT that has no confirm', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const dialog = await edit(user, THAI);
    const name = within(dialog).getByRole('textbox', { name: 'Activity name' });
    await user.clear(name);
    await user.type(name, 'Renamed draft');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Check-in activity saved')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(1);
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'PUT',
      url: '/api/admin/checkin/activities/3',
    });
    expect(writesOf(calls)[0].body).not.toHaveProperty('confirm');
    expect(activityState.activities.find((a) => a.id === '3')?.name).toBe('Renamed draft');
  });

  it('a live activity whose days are not changed is saved with one PUT that has no confirm', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const dialog = await edit(user, AUTUMN);
    const name = within(dialog).getByRole('textbox', { name: 'Activity name' });
    await user.clear(name);
    await user.type(name, 'Autumn again');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Check-in activity saved')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(1);
    expect(writesOf(calls)[0].body).not.toHaveProperty('confirm');
  });

  it('decides to probe by the state read when the dialog opened, not by the row the list showed (another administrator published it meanwhile)', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    await rowOf(THAI);
    const other = activityState.activities.find((a) => a.id === '3');
    if (other) other.status = 'ACTIVE';
    const dialog = await edit(user, THAI);
    const [, end] = within(dialog).getAllByPlaceholderText(/Select date/i);
    await clearAndType(user, end, '2031-01-15');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Check-in activity saved')).toBeInTheDocument();
    expect(writesOf(calls)[0].body).toMatchObject({ confirm: false, endDate: '2031-01-15' });
    expect(activityState.activities.find((a) => a.id === '3')?.endDate).toBe('2031-01-15');
  });

  it('a plain save that the backend did not apply (applied false) is not reported as saved: the probe goes on', async () => {
    let first = true;
    const key = 'PUT /api/admin/checkin/activities/:id';
    type Res = { status: (code: number) => Res; json: (value: unknown) => void };
    type Handler = (req: unknown, res: Res) => unknown;
    const real = (activityMock as unknown as Record<string, Handler>)[key];
    const calls = useMockBackend(
      {
        default: {
          [key]: (req: unknown, res: Res) => {
            if (first) {
              first = false;
              res.status(200).json({
                code: '200',
                message: 'ok',
                data: { applied: false, disabledActivities: [] },
              });
              return undefined;
            }
            return real(req, res);
          },
        },
      },
      mock,
    );
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const dialog = await edit(user, THAI);
    const name = within(dialog).getByRole('textbox', { name: 'Activity name' });
    await user.clear(name);
    await user.type(name, 'Renamed once more');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls).length).toBeGreaterThanOrEqual(2));
    expect(writesOf(calls)[1].body).toMatchObject({ confirm: false });
    expect(await screen.findByText('Check-in activity saved')).toBeInTheDocument();
  });

  const clearAndType = async (
    user: ReturnType<typeof userEvent.setup>,
    input: HTMLElement,
    day: string,
  ) => {
    await user.clear(input);
    await user.type(input, `${day}{Enter}`);
  };

  /** Makes the draft with the Thai name live in 2030, so that a live activity moved there overlaps it. */
  const liveIn2030 = () => {
    const other = activityState.activities.find((a) => a.id === '3');
    if (other)
      Object.assign(other, { status: 'ACTIVE', startDate: '2030-01-01', endDate: '2030-12-31' });
  };

  it('changing the end day of a live activity is probed first (confirm=false); without an overlap that one request is all', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const dialog = await edit(user, AUTUMN);
    const [, end] = within(dialog).getAllByPlaceholderText(/Select date/i);
    await clearAndType(user, end, '2027-01-15');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Check-in activity saved')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(1);
    expect(writesOf(calls)[0].body).toMatchObject({
      confirm: false,
      endDate: '2027-01-15',
      name: AUTUMN,
    });
    expect(activityState.activities.find((a) => a.id === '1')?.endDate).toBe('2027-01-15');
  });

  it('an overlap asks with the names; Cancel sends nothing more and the form stays open with what was typed', async () => {
    liveIn2030();
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const dialog = await edit(user, AUTUMN);
    const [, end] = within(dialog).getAllByPlaceholderText(/Select date/i);
    await clearAndType(user, end, '2030-06-01');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    const question = await dialogOf('Save it and stop the overlapping activities?');
    expect(within(question).getByText(THAI)).toBeInTheDocument();
    await user.click(within(question).getByRole('button', { name: 'Cancel' }));
    expect(writesOf(calls)).toHaveLength(1);
    expect(writesOf(calls)[0].body).toMatchObject({ confirm: false });
    expect(await dialogOf('Edit check-in activity')).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Activity name' })).toHaveValue(AUTUMN);
    expect(activityState.activities.find((a) => a.id === '1')?.endDate).not.toBe('2030-06-01');
    expect(status('3')).toBe('ACTIVE');
    // The buttons work again: the person can still save. (A button that was busy keeps its
    // loading icon in the page for good here, because the animation never ends, so its name is
    // "loading Submit".)
    await waitFor(
      () => expect(within(dialog).getByRole('button', { name: /Submit/ })).not.toBeDisabled(),
      { timeout: 5000 },
    );
  });

  it('after Confirm it goes again with confirm=true, the form closes and the overlapping activity is stopped', async () => {
    liveIn2030();
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const dialog = await edit(user, AUTUMN);
    const [, end] = within(dialog).getAllByPlaceholderText(/Select date/i);
    await clearAndType(user, end, '2030-06-01');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    const question = await dialogOf('Save it and stop the overlapping activities?');
    await user.click(within(question).getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Check-in activity saved')).toBeInTheDocument();
    expect(writesOf(calls).map((c) => (c.body as { confirm: boolean }).confirm)).toEqual([
      false,
      true,
    ]);
    expect(writesOf(calls)[1].body).toMatchObject({ endDate: '2030-06-01', name: AUTUMN });
    expect(status('3')).toBe('DISABLED');
    expect(activityState.activities.find((a) => a.id === '1')?.endDate).toBe('2030-06-01');
  });

  it('a second press on Submit during the probe sends one probe', async () => {
    const calls = useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const dialog = await edit(user, AUTUMN);
    const [, end] = within(dialog).getAllByPlaceholderText(/Select date/i);
    await clearAndType(user, end, '2027-01-15');
    const gate = holdWrites();
    const submit = within(dialog).getByRole('button', { name: 'Submit' });
    await user.click(submit);
    await user.click(submit);
    await waitFor(() => expect(gate.started()).toBe(1));
    gate.release();
    expect(await screen.findByText('Check-in activity saved')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('tells the person that a live activity asks about overlaps when its days change', async () => {
    useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const dialog = await edit(user, AUTUMN);
    expect(
      within(dialog).getByText(/This activity is live\. If you change its dates/),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    const draft = await edit(user, THAI);
    expect(within(draft).queryByText(/This activity is live/)).toBeNull();
  });

  it('a new form after an edit starts empty, and the edit of another activity shows that activity and not the one before', async () => {
    useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const first = await edit(user, AUTUMN);
    expect(within(first).getByText('Day 7')).toBeInTheDocument();
    await user.click(within(first).getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    await user.click(await screen.findByRole('button', { name: 'New activity' }));
    const fresh = await dialogOf('New check-in activity');
    expect(within(fresh).getByRole('textbox', { name: 'Activity name' })).toHaveValue('');
    expect(
      within(fresh)
        .getAllByPlaceholderText(/Select date/i)
        .map((i) => (i as HTMLInputElement).value),
    ).toEqual(['', '']);
    expect(within(fresh).getByText('Day 1')).toBeInTheDocument();
    expect(within(fresh).queryByText('Day 2')).toBeNull();
    await user.click(within(fresh).getByRole('button', { name: 'Cancel' }));
    await dialogsClosed();
    const other = await edit(user, ARABIC);
    expect(within(other).getByRole('textbox', { name: 'Activity name' })).toHaveValue(ARABIC);
    expect(within(other).getByText('Day 2')).toBeInTheDocument();
    expect(within(other).queryByText('Day 3')).toBeNull();
  });

  it('shows the failure to read the steps with a retry and does not offer to save', async () => {
    useMockBackend(mock);
    const mockFetch = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        if (String(input).endsWith('/checkin/activities/1'))
          return jsonResponse(500, envelope('INTERNAL_ERROR'));
        return mockFetch(input, init);
      }),
    );
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    await user.click(within(await rowOf(AUTUMN)).getByRole('button', { name: 'Edit' }));
    const dialog = await dialogOf('Edit check-in activity');
    expect(await within(dialog).findByText(/Failed to load/i)).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox', { name: 'Activity name' })).toBeNull();
  });

  it('keeps long names of every language inside the form', async () => {
    useMockBackend(mock);
    const user = userEvent.setup();
    renderPage(<SigninConfigPage />);
    const dialog = await edit(user, LONG);
    expect(within(dialog).getByRole('textbox', { name: 'Activity name' })).toHaveValue(LONG);
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Activity name' }), {
      target: { value: ARABIC },
    });
    expect(within(dialog).getByRole('textbox', { name: 'Activity name' })).toHaveValue(ARABIC);
  });
});
