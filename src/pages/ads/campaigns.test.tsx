import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import adsMock from '../../../mock/ads.mock';
import configMock from '../../../mock/config.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { must } from '../../../tests/must';
import { renderPage } from '../../../tests/renderPage';
import { withTimeZone } from '../../../tests/withTimeZone';
import CampaignsPage from './campaigns';
import {
  adsState,
  dialogsClosed,
  holdWrites,
  jsonAnswer,
  overrideFetch,
  settled,
  signIn,
  writesOf,
} from './testSetup';

const backend = () => useMockBackend({ default: adsMock }, { default: configMock });

beforeEach(() => {
  signIn('root');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const rows = () => [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')];
const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');
const campaign = (id: string) => {
  const found = adsState.campaigns.get(id);
  if (!found) throw new Error(`no campaign ${id}`);
  return found;
};
const rowOf = async (id: string) => {
  const name = campaign(id).name;
  await waitFor(() =>
    expect(screen.getAllByText(name, { exact: false }).length).toBeGreaterThan(0),
  );
  const hit = rows().find((tr) => (tr.textContent ?? '').includes(name));
  if (!hit) throw new Error(`no row for campaign ${id}`);
  return hit as HTMLTableRowElement;
};
const load = async () => {
  const calls = backend();
  const user = userEvent.setup();
  renderPage(<CampaignsPage />);
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  return { calls, user };
};
// The buttons of the last cell, the one with the actions (the name cell has a button of its own).
const labelsIn = (row: Element) =>
  [...(row.querySelector('td:last-child') as Element).querySelectorAll('button')]
    .map((b) => (b.textContent ?? '').trim())
    .filter(Boolean);
const dialog = () => screen.findByRole('dialog');
const pick = (input: HTMLElement, value: string) => {
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
};

/** Presses an inline action of a row and then OK in the question that opens. */
const confirmInline = async (
  user: ReturnType<typeof userEvent.setup>,
  row: Element,
  label: string,
) => {
  await user.click(within(row as HTMLElement).getByRole('button', { name: label }));
  await user.click(await screen.findByRole('button', { name: 'OK' }));
};
/** Chooses an action from the "More" menu of a row and then OK in the dialog. */
const confirmFromMore = async (
  user: ReturnType<typeof userEvent.setup>,
  row: Element,
  label: string,
) => {
  await user.click(within(row as HTMLElement).getByRole('button', { name: 'More' }));
  await user.click(await screen.findByRole('menuitem', { name: label }));
  const confirm = await screen.findByRole('dialog');
  await user.click(within(confirm).getByRole('button', { name: 'OK' }));
};

describe('the campaign page: reading', { timeout: 30000 }, () => {
  it('opens with the delivery checklist: the five layers in order, the entitlement and the reward limit, and what a guest can get', async () => {
    await load();
    expect(screen.getByText(/Delivery checklist/)).toBeInTheDocument();
    const layers = [...screen.getByTestId('ads-checklist-layers').querySelectorAll('li')].map(
      (li) => li.textContent,
    );
    expect(layers).toHaveLength(5);
    expect(layers[0]).toContain('ads.enabled');
    expect(layers[1]).toMatch(/placement is enabled/i);
    expect(layers[2]).toMatch(/campaign/i);
    expect(layers[2]).toMatch(/Running/);
    expect(layers[3]).toMatch(/unit/i);
    expect(layers[4]).toMatch(/Approved/);
    expect(layers[4]).toMatch(/Running/);
    expect(document.body.textContent).toContain('ads.removed');
    const guest = screen.getByTestId('ads-checklist-guest').textContent ?? '';
    expect(guest).toContain('app_open');
    expect(guest).toContain('call_end');
    expect(guest).toContain('NOT_FOR_GUEST');
  });

  it('can be folded away', async () => {
    const { user } = await load();
    expect(screen.getByTestId('ads-checklist-layers')).toBeVisible();
    await user.click(screen.getByText(/Delivery checklist/));
    await waitFor(() => expect(screen.getByTestId('ads-checklist-layers')).not.toBeVisible());
  });

  it('has the columns of the spec in its order', async () => {
    await load();
    const heads = [...document.querySelectorAll('.ant-table-thead th')].map((h) => h.textContent);
    expect(heads).toEqual([
      'Name',
      'Status',
      'Priority',
      'Start time',
      'End time',
      'Created by',
      'Updated at',
      'Actions',
    ]);
  });

  it('shows the name in any language, the state, the priority, a dash where there is no start or end, the creator and the update time', async () => {
    await load();
    for (const c of adsState.campaigns.values()) {
      expect(document.body.textContent).toContain(c.name.slice(0, 20));
    }
    const never = cellsOf(await rowOf('3'));
    expect(never[1]).toBe('Paused');
    expect(never[2]).toBe('100');
    expect(never[4]).toBe('—');
    expect(never[5]).toBe('root');
    const draft = cellsOf(await rowOf('7'));
    expect(draft[1]).toBe('Draft');
    expect(draft[3]).toBe('—');
    expect(draft[4]).toBe('—');
    const withDates = cellsOf(await rowOf('2'));
    expect(withDates[1]).toBe('Running');
    expect(withDates[2]).toBe('50');
    expect(withDates[3]).not.toBe('—');
    expect(withDates[6]).not.toBe('—');
  });

  it('says that the backend ends a campaign by itself when its end time passes', async () => {
    await load();
    expect(screen.getByText(/ends the campaign by itself/)).toBeInTheDocument();
  });

  it('shows the name of a deleted administrator as the start of the id', async () => {
    backend();
    campaign('2').createdBy = 'deleted-admin-77';
    renderPage(<CampaignsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(cellsOf(await rowOf('2'))[5]).toBe('deleted-');
  });

  it('keeps a name of 300 letters without a space, an Arabic description and an emoji name inside the table', async () => {
    backend();
    campaign('2').name = `Promo ${'🎉'.repeat(30)}`;
    renderPage(<CampaignsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const buttons = [...document.querySelectorAll('.ant-table-tbody button[data-lines]')];
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect((button as HTMLElement).style.overflowWrap).toBe('anywhere');
    }
    expect(document.body.textContent).toContain('A'.repeat(100));
  });

  it('does not break on a row whose fields have the wrong type', async () => {
    backend();
    overrideFetch(async ({ url, method }) => {
      if (method !== 'GET' || url.pathname !== '/api/admin/ads/campaigns') return undefined;
      return jsonAnswer(200, '200', {
        items: [
          {
            id: '1',
            name: 12345,
            status: 'ACTIVE',
            priority: '7',
            startAt: 5,
            endAt: {},
            createdBy: null,
            updatedAt: [],
          },
          { id: '2', name: { x: 1 }, status: 'WEIRD', priority: null, createdByUsername: 9 },
        ],
        total: 2,
      });
    });
    renderPage(<CampaignsPage />);
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(document.body.textContent).toContain('12345');
    expect(document.body.textContent).toContain('WEIRD');
  });

  it('is written in Chinese too', async () => {
    backend();
    renderPage(<CampaignsPage />, 'zh-CN');
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const heads = [...document.querySelectorAll('.ant-table-thead th')].map((h) => h.textContent);
    expect(heads).toEqual([
      '名称',
      '状态',
      '优先级',
      '开始时间',
      '结束时间',
      '创建人',
      '更新时间',
      '操作',
    ]);
    expect(screen.getByText(/投放检查清单/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建计划' })).toBeInTheDocument();
  });

  it('says what is wrong when the list cannot be read, and reads again on Retry', async () => {
    backend();
    let fail = true;
    overrideFetch(async ({ url, method }) => {
      if (method === 'GET' && url.pathname === '/api/admin/ads/campaigns' && fail) {
        return jsonAnswer(500, 'INTERNAL_ERROR', null, 'SECRET BACKEND WORDS');
      }
      return undefined;
    });
    renderPage(<CampaignsPage />);
    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
    fail = false;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  });
});

describe('the filters', { timeout: 30000 }, () => {
  const lastQuery = (calls: { method: string; url: string }[]) => {
    const reads = calls.filter((c) => c.url.startsWith('/api/admin/ads/campaigns?'));
    return new URL(reads[reads.length - 1].url, 'http://x').searchParams;
  };
  const readsOf = (calls: { method: string; url: string }[]) =>
    calls.filter((c) => c.method === 'GET' && c.url.startsWith('/api/admin/ads/campaigns?')).length;

  it('asks for the name and the state that were chosen, and for nothing that is empty', async () => {
    const { calls, user } = await load();
    expect(lastQuery(calls).has('name')).toBe(false);
    expect(lastQuery(calls).has('status')).toBe(false);
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '  สวัสดี{Enter}');
    await waitFor(() => expect(lastQuery(calls).get('name')).toBe('สวัสดี'));
    await waitFor(() => expect(rows().length).toBe(1));
    await user.clear(screen.getByRole('textbox', { name: 'Name' }));
    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    const options = await screen.findAllByText('Ended', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(lastQuery(calls).get('status')).toBe('ENDED'));
    expect(lastQuery(calls).has('name')).toBe(false);
    await waitFor(() => expect(rows().length).toBe(2));
  });

  it('reads the first page again when Search is pressed with the same filters', async () => {
    const { calls, user } = await load();
    const before = readsOf(calls);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(readsOf(calls)).toBe(before + 1));
  });

  it('shows the answer of the newest read even when an older one arrives later', async () => {
    backend();
    const gates: Record<string, () => void> = {};
    let calls = 0;
    overrideFetch(async ({ url, method }) => {
      if (method !== 'GET' || url.pathname !== '/api/admin/ads/campaigns') return undefined;
      const mine = ++calls;
      if (mine === 2) {
        await new Promise<void>((resolve) => {
          gates.old = resolve;
        });
        return jsonAnswer(200, '200', {
          items: [{ id: '99', name: 'OLD ANSWER', status: 'DRAFT', priority: 1 }],
          total: 1,
        });
      }
      return undefined;
    });
    const user = userEvent.setup();
    renderPage(<CampaignsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'x{Enter}');
    await waitFor(() => expect(calls).toBe(2));
    await user.clear(screen.getByRole('textbox', { name: 'Name' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '{Enter}');
    await waitFor(() => expect(calls).toBeGreaterThanOrEqual(3));
    await waitFor(() => expect(rows().length).toBeGreaterThan(1));
    gates.old();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.body.textContent).not.toContain('OLD ANSWER');
  });
});

describe('the buttons of a row by its state', { timeout: 30000 }, () => {
  it('give a draft Edit and Activate, and End and Delete under More', async () => {
    const { user } = await load();
    const row = await rowOf('7');
    expect(labelsIn(row)).toEqual(['Edit', 'Activate', 'More']);
    await user.click(within(row).getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: 'End' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('give a running one Edit, Pause and End, and a paused one Edit, Resume and End, and no Delete', async () => {
    await load();
    expect(labelsIn(await rowOf('2'))).toEqual(['Edit', 'Pause', 'End']);
    expect(labelsIn(await rowOf('3'))).toEqual(['Edit', 'Resume', 'End']);
  });

  it('give an ended one Delete only: it cannot be edited', async () => {
    await load();
    expect(labelsIn(await rowOf('4'))).toEqual(['Delete']);
    expect(labelsIn(await rowOf('5'))).toEqual(['Delete']);
  });

  it('show no button at all to an administrator who lacks ADS:CAMPAIGN (the list is read with ADS:UNIT)', async () => {
    signIn('support', { codes: ['ADS:UNIT'] });
    backend();
    renderPage(<CampaignsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: 'New campaign' })).not.toBeInTheDocument();
    for (const row of rows()) expect(labelsIn(row)).toEqual([]);
  });
});

describe('the state changes and the delete', { timeout: 30000 }, () => {
  it('asks first, then sends the new state once, and shows the new state', async () => {
    const { calls, user } = await load();
    const row = await rowOf('7');
    await user.click(within(row).getByRole('button', { name: 'Activate' }));
    expect(await screen.findByText('Activate this campaign?')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'PUT',
      url: '/api/admin/ads/campaigns/7/status',
      body: { status: 'ACTIVE' },
    });
    await waitFor(() =>
      expect(
        cellsOf(must(rows().find((r) => r.textContent?.includes(campaign('7').name))))[1],
      ).toBe('Running'),
    );
  });

  it('does not change anything when the question is declined', async () => {
    const { calls, user } = await load();
    await user.click(within(await rowOf('2')).getByRole('button', { name: 'Pause' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('sends the pause, the resume and the end with their own states', async () => {
    const { calls, user } = await load();
    await confirmInline(user, await rowOf('2'), 'Pause');
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toEqual({ status: 'PAUSED' });
    await confirmInline(user, await rowOf('3'), 'Resume');
    await waitFor(() => expect(writesOf(calls)).toHaveLength(2));
    expect(writesOf(calls)[1].body).toEqual({ status: 'ACTIVE' });
    await confirmInline(user, await rowOf('6'), 'End');
    await waitFor(() => expect(writesOf(calls)).toHaveLength(3));
    expect(writesOf(calls)[2]).toMatchObject({
      url: '/api/admin/ads/campaigns/6/status',
      body: { status: 'ENDED' },
    });
  });

  it('ends a draft from the More menu, after a question that says an ended campaign is final', async () => {
    const { calls, user } = await load();
    await user.click(within(await rowOf('7')).getByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('menuitem', { name: 'End' }));
    expect(
      (await screen.findAllByText(/An ended campaign cannot be changed or restarted/)).length,
    ).toBeGreaterThan(0);
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toEqual({ status: 'ENDED' });
  });

  it('sends one request when the confirmation is pressed twice', async () => {
    const { calls, user } = await load();
    const gate = holdWrites();
    await user.click(within(await rowOf('2')).getByRole('button', { name: 'Pause' }));
    const ok = await screen.findByRole('button', { name: 'OK' });
    fireEvent.click(ok);
    fireEvent.click(ok);
    await settled();
    expect(gate.started()).toBe(1);
    gate.release();
    await settled();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('shows the words of the error code, never the backend message, when the state does not allow the change', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'PUT' && url.pathname.endsWith('/status')
        ? jsonAnswer(409, 'INVALID_STATE', { status: 'ENDED' }, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<CampaignsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await confirmInline(user, await rowOf('2'), 'Pause');
    expect(
      await screen.findByText('The current state of the item does not allow this action.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });

  it('deletes after a question that says which campaigns can be deleted, and the row goes', async () => {
    const { calls, user } = await load();
    const row = await rowOf('5');
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    expect(
      await screen.findByText(/Only a draft, or an ended one without units, can be deleted/),
    ).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'DELETE',
      url: '/api/admin/ads/campaigns/5',
    });
    await waitFor(() => expect(adsState.campaigns.has('5')).toBe(false));
    await waitFor(() =>
      expect(rows().some((r) => r.textContent?.includes(campaign('4').name))).toBe(true),
    );
  });

  it('does not offer the delete of a campaign that has a unit where the units can be read, and says why', async () => {
    const { calls, user } = await load();
    await waitFor(() =>
      expect(
        within(
          rows().find((r) => r.textContent?.includes(campaign('4').name)) as HTMLElement,
        ).getByRole('button', { name: 'Delete' }),
      ).toBeDisabled(),
    );
    expect(
      within(await rowOf('4')).getByText('This campaign has units; delete them first.'),
    ).toBeInTheDocument();
    expect(
      within(await rowOf('5')).queryByText('This campaign has units; delete them first.'),
    ).toBeNull();
    expect(within(await rowOf('5')).getByRole('button', { name: 'Delete' })).not.toBeDisabled();
    expect(writesOf(calls)).toHaveLength(0);
    // a draft that has a unit is not offered either
    await user.click(within(await rowOf('1')).getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: /Delete/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('leaves the backend to decide where the units cannot be read: the delete is offered, and its refusal is shown in the words of the code', async () => {
    signIn('support', { codes: ['ADS:CAMPAIGN'] });
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<CampaignsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(within(await rowOf('4')).getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText('The current state of the item does not allow this action.'),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(1);
    expect(adsState.campaigns.has('4')).toBe(true);
  });

  it('deletes a draft from the More menu after the question', async () => {
    const { user } = await load();
    await confirmFromMore(user, await rowOf('7'), 'Delete');
    await waitFor(() => expect(adsState.campaigns.has('7')).toBe(false));
  });
});

describe('the form', { timeout: 40000 }, () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'New campaign' }));
    return within(await dialog());
  };

  it('opens empty with the priority 100 and says what the priority means', async () => {
    const { user } = await load();
    const form = await open(user);
    expect(form.getByRole('textbox', { name: 'Name' })).toHaveValue('');
    expect(form.getByRole('spinbutton', { name: 'Priority' })).toHaveValue('100');
    expect(form.getByText(/The smaller the number, the higher the priority/)).toBeInTheDocument();
    expect(form.getByLabelText('Start time')).toBeInTheDocument();
    expect(form.getByLabelText('End time')).toBeInTheDocument();
  });

  it('asks for the name and sends nothing until there is one (a name of blanks is empty)', async () => {
    const { calls, user } = await load();
    const form = await open(user);
    await user.type(form.getByRole('textbox', { name: 'Name' }), '   ');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('Enter a name')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('creates a draft with the trimmed name, the priority, and null where nothing was entered', async () => {
    const { calls, user } = await load();
    const form = await open(user);
    await user.type(form.getByRole('textbox', { name: 'Name' }), '  Khuyến mãi 🚀  ');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({ method: 'POST', url: '/api/admin/ads/campaigns' });
    expect(writesOf(calls)[0].body).toEqual({
      name: 'Khuyến mãi 🚀',
      description: null,
      priority: 100,
      startAt: null,
      endAt: null,
    });
    await dialogsClosed();
    await waitFor(() =>
      expect(rows().some((r) => r.textContent?.includes('Khuyến mãi 🚀'))).toBe(true),
    );
  });

  it('sends the time that was picked as the instant of the clock it shows in the time zone of the browser', async () => {
    await withTimeZone('Asia/Bangkok', async () => {
      const { calls, user } = await load();
      const form = await open(user);
      await user.type(form.getByRole('textbox', { name: 'Name' }), 'Zone');
      pick(form.getByLabelText('Start time'), '2031-03-04 21:45');
      pick(form.getByLabelText('End time'), '2031-04-05 08:00');
      await user.click(form.getByRole('button', { name: 'Submit' }));
      await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
      expect(writesOf(calls)[0].body).toMatchObject({
        startAt: '2031-03-04T14:45:00.000Z',
        endAt: '2031-04-05T01:00:00.000Z',
      });
    });
  });

  it('does not take an end before the start, and says so under the end time', async () => {
    const { calls, user } = await load();
    const form = await open(user);
    await user.type(form.getByRole('textbox', { name: 'Name' }), 'Backwards');
    pick(form.getByLabelText('Start time'), '2031-03-04 21:45');
    pick(form.getByLabelText('End time'), '2031-03-04 21:44');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('The end must not be before the start')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('sends one request when Submit is pressed twice', async () => {
    const { calls, user } = await load();
    const form = await open(user);
    await user.type(form.getByRole('textbox', { name: 'Name' }), 'Twice');
    const gate = holdWrites();
    const submit = form.getByRole('button', { name: 'Submit' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await settled();
    expect(gate.started()).toBe(1);
    // Enter in a field submits the form itself, after its check is over: still one request.
    const formElement = document.querySelector('.ant-modal form') as Element;
    fireEvent.submit(formElement);
    await settled();
    expect(gate.started()).toBe(1);
    gate.release();
    await settled();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('puts the reason of the backend under the field it names, in the words of the reason, and keeps the dialog open', async () => {
    backend();
    overrideFetch(async ({ method }) =>
      method === 'POST'
        ? jsonAnswer(
            400,
            'INVALID_REQUEST',
            { details: [{ ref: 'priority', reason: 'OUT_OF_RANGE' }] },
            'SECRET BACKEND WORDS',
          )
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<CampaignsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await open(user);
    await user.type(form.getByRole('textbox', { name: 'Name' }), 'x');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('The value is outside the allowed range.')).toBeInTheDocument();
    expect(
      form.getByText('Some input is not valid. Please check the fields and try again.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('edits with the form filled in, and sends an explicit null for an end time that was cleared and the other fields as they are', async () => {
    const { calls, user } = await load();
    await user.click(within(await rowOf('2')).getByRole('button', { name: 'Edit' }));
    const form = within(await dialog());
    expect(form.getByRole('textbox', { name: 'Name' })).toHaveValue(campaign('2').name);
    expect(form.getByRole('spinbutton', { name: 'Priority' })).toHaveValue('50');
    const endPicker = form.getByLabelText('End time').closest('.ant-picker') as HTMLElement;
    fireEvent.mouseDown(endPicker.querySelector('.ant-picker-clear') as Element);
    fireEvent.click(endPicker.querySelector('.ant-picker-clear') as Element);
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const write = writesOf(calls)[0];
    expect(write).toMatchObject({ method: 'PUT', url: '/api/admin/ads/campaigns/2' });
    expect(write.body).toMatchObject({
      name: campaign('2').name,
      description: campaign('2').description,
      priority: 50,
      endAt: null,
    });
    expect((write.body as { startAt: string }).startAt).toBe(campaign('2').startAt);
  });
});

describe('a session that ends while a write is on its way', { timeout: 30000 }, () => {
  it('shows that it has ended, in the words of the code, and does not send the write again', async () => {
    backend();
    const taken = overrideFetch(async ({ url, method }) =>
      method === 'PUT' && url.pathname.endsWith('/status')
        ? jsonAnswer(401, 'ADMIN_INVALID_TOKEN', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<CampaignsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await confirmInline(user, await rowOf('2'), 'Pause');
    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeInTheDocument();
    await settled();
    expect(taken).toHaveLength(1);
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });
});

describe('a dialog that is opened again', { timeout: 30000 }, () => {
  it('shows the campaign that is edited, not what was typed in the dialog that was closed before', async () => {
    const { user } = await load();
    await user.click(screen.getByRole('button', { name: 'New campaign' }));
    const first = within(await dialog());
    await user.type(first.getByRole('textbox', { name: 'Name' }), 'Typed and abandoned');
    await user.click(first.getByRole('button', { name: 'Cancel' }));
    await user.click(within(await rowOf('2')).getByRole('button', { name: 'Edit' }));
    const form = within(await dialog());
    expect(form.getByRole('textbox', { name: 'Name' })).toHaveValue(campaign('2').name);
    expect(form.getByRole('spinbutton', { name: 'Priority' })).toHaveValue('50');
    await user.click(form.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'New campaign' }));
    const again = within(await dialog());
    expect(again.getByRole('textbox', { name: 'Name' })).toHaveValue('');
    expect(again.getByRole('spinbutton', { name: 'Priority' })).toHaveValue('100');
  });
});
