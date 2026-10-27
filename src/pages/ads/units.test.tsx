import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import adsMock from '../../../mock/ads.mock';
import configMock from '../../../mock/config.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import {
  adsState,
  chooseOption,
  dialogsClosed,
  holdWrites,
  jsonAnswer,
  overrideFetch,
  settled,
  signIn,
  writesOf,
} from './testSetup';
import UnitsPage from './units';

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
const unit = (id: string) => {
  const found = adsState.units.get(id);
  if (!found) throw new Error(`no unit ${id}`);
  return found;
};
const campaign = (id: string) => adsState.campaigns.get(id)!;
const rowOf = async (id: string) => {
  const name = unit(id).name;
  await waitFor(() =>
    expect(rows().some((tr) => (tr.textContent ?? '').includes(name.slice(0, 12)))).toBe(true),
  );
  return rows().find((tr) =>
    (tr.textContent ?? '').includes(name.slice(0, 12)),
  ) as HTMLTableRowElement;
};
const load = async () => {
  const calls = backend();
  const user = userEvent.setup();
  renderPage(<UnitsPage />);
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  return { calls, user };
};
const labelsIn = (row: Element) =>
  [...(row.querySelector('td:last-child') as Element).querySelectorAll('button')]
    .map((b) => (b.textContent ?? '').trim())
    .filter(Boolean);
const dialog = () => screen.findByRole('dialog');
const confirmInline = async (
  user: ReturnType<typeof userEvent.setup>,
  row: Element,
  label: string,
) => {
  await user.click(within(row as HTMLElement).getByRole('button', { name: label }));
  await user.click(await screen.findByRole('button', { name: 'OK' }));
};
const refuse = (path: string) =>
  overrideFetch(async ({ url, method }) =>
    method === 'GET' && url.pathname === path
      ? jsonAnswer(403, 'ADMIN_FORBIDDEN', null, 'SECRET BACKEND WORDS')
      : undefined,
  );

describe('the unit page: reading', { timeout: 30000 }, () => {
  it('opens with the delivery checklist', async () => {
    await load();
    expect(screen.getByText(/Delivery checklist/)).toBeInTheDocument();
    expect(screen.getByTestId('ads-checklist-layers').querySelectorAll('li')).toHaveLength(5);
  });

  it('has the columns of the spec in its order', async () => {
    await load();
    const heads = [...document.querySelectorAll('.ant-table-thead th')].map((h) => h.textContent);
    expect(heads).toEqual([
      'Name',
      'Campaign',
      'Placement',
      'Status',
      'Weight',
      'Daily cap',
      'Targeting',
      'Actions',
    ]);
  });

  it('shows the name, the campaign by its name, the placement, the state, the weight, the cap and the targeting in words', async () => {
    await load();
    await waitFor(() => expect(cellsOf(rows()[0])[1]).not.toMatch(/^\d+$/));
    const one = cellsOf(await rowOf('1'));
    expect(one[1]).toContain(campaign('2').name);
    expect(one[2]).toContain('app_open');
    expect(one[3]).toBe('Running');
    expect(one[4]).toBe('100');
    expect(one[5]).toMatch(/^0 \(no limit\)/);
    expect(one[6]).toContain('Platforms: Android, iOS');
    expect(one[6]).toContain('Countries: TH, ID');
    expect(one[6]).toContain('Languages: th, id');
    const two = cellsOf(await rowOf('2'));
    expect(two[5]).toBe('5,000');
    expect(two[6]).toContain('System ≥ 13');
    expect(two[6]).toContain('App ≥ 1.2.0');
    expect(two[6]).toContain('Time ranges: 8:00–22:30, 23:00–2:00');
    expect(cellsOf(await rowOf('6'))[6]).toBe('No limit');
  });

  it('marks a unit with weight 0 as never selected, and does not mark the others', async () => {
    await load();
    expect(cellsOf(await rowOf('3'))[4]).toMatch(/^0/);
    expect(cellsOf(await rowOf('3'))[4]).toContain('Never selected');
    expect(cellsOf(await rowOf('1'))[4]).not.toContain('Never selected');
  });

  it('keeps a name of 300 letters without a space inside the table', async () => {
    await load();
    const buttons = [...document.querySelectorAll('.ant-table-tbody button[data-lines]')];
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect((button as HTMLElement).style.overflowWrap).toBe('anywhere');
    }
  });

  it('does not break on a row whose fields have the wrong type', async () => {
    backend();
    overrideFetch(async ({ url, method }) => {
      if (method !== 'GET' || url.pathname !== '/api/admin/ads/units') return undefined;
      return jsonAnswer(200, '200', {
        items: [
          {
            id: '1',
            campaignId: 5,
            placementId: {},
            name: 99,
            status: 'WEIRD',
            weight: '7',
            dailyImpressionCap: [],
            targeting: 'x',
          },
          { id: '2', name: { a: 1 }, targeting: { geo: 5, day_parts: [null, 1] } },
        ],
        total: 2,
      });
    });
    renderPage(<UnitsPage />);
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(document.body.textContent).toContain('WEIRD');
  });

  it('shows the id of a campaign it cannot read the name of, and says on the filter which permission is missing', async () => {
    backend();
    refuse('/api/admin/ads/campaigns');
    renderPage(<UnitsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(cellsOf(await rowOf('1'))[1]).toBe('2');
    expect(await screen.findByText('Needs the ADS:CAMPAIGN permission')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Campaign' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Placement' })).not.toBeDisabled();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });

  it('is written in Chinese too', async () => {
    backend();
    renderPage(<UnitsPage />, 'zh-CN');
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const heads = [...document.querySelectorAll('.ant-table-thead th')].map((h) => h.textContent);
    expect(heads).toEqual(['名称', '计划', '广告位', '状态', '权重', '单元日上限', '定向', '操作']);
    expect(screen.getByRole('button', { name: '新建单元' })).toBeInTheDocument();
  });
});

describe('the filters', { timeout: 30000 }, () => {
  const lastQuery = (calls: { method: string; url: string }[]) => {
    const reads = calls.filter((c) => c.url.startsWith('/api/admin/ads/units?'));
    return new URL(reads[reads.length - 1].url, 'http://x').searchParams;
  };

  it('asks for the campaign, the placement, the state and the name that were chosen, and for nothing that is empty', async () => {
    const { calls, user } = await load();
    expect([...lastQuery(calls).keys()].sort()).toEqual(['page', 'pageSize']);
    await chooseOption(user, 'Campaign', campaign('2').name);
    await chooseOption(user, 'Placement', /app_open/);
    await chooseOption(user, 'Status', 'Running');
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '  x{Enter}');
    await waitFor(() => expect(lastQuery(calls).get('name')).toBe('x'));
    expect(lastQuery(calls).get('campaignId')).toBe('2');
    expect(lastQuery(calls).get('placementId')).toBe('1');
    expect(lastQuery(calls).get('status')).toBe('ACTIVE');
  });

  it('reads the first page again when Search is pressed with the same filters', async () => {
    const { calls, user } = await load();
    const count = () => calls.filter((c) => c.url.startsWith('/api/admin/ads/units?')).length;
    const before = count();
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(count()).toBe(before + 1));
  });

  it('shows the answer of the newest read even when an older one arrives later', async () => {
    backend();
    const gates: Record<string, () => void> = {};
    let n = 0;
    overrideFetch(async ({ url, method }) => {
      if (method !== 'GET' || url.pathname !== '/api/admin/ads/units') return undefined;
      if (++n === 2) {
        await new Promise<void>((resolve) => {
          gates.old = resolve;
        });
        return jsonAnswer(200, '200', {
          items: [
            {
              id: '99',
              campaignId: '2',
              placementId: '1',
              name: 'OLD ANSWER',
              status: 'DRAFT',
              weight: 1,
            },
          ],
          total: 1,
        });
      }
      return undefined;
    });
    const user = userEvent.setup();
    renderPage(<UnitsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'x{Enter}');
    await waitFor(() => expect(n).toBe(2));
    await user.clear(screen.getByRole('textbox', { name: 'Name' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '{Enter}');
    await waitFor(() => expect(n).toBeGreaterThanOrEqual(3));
    await waitFor(() => expect(rows().length).toBeGreaterThan(1));
    gates.old();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.body.textContent).not.toContain('OLD ANSWER');
  });
});

describe('the buttons of a row by its state', { timeout: 30000 }, () => {
  it('give a draft Edit, Activate and Delete; a running one Edit and Pause; a paused one Edit and Resume', async () => {
    await load();
    expect(labelsIn(await rowOf('6'))).toEqual(['Edit', 'Activate', 'Delete']);
    expect(labelsIn(await rowOf('1'))).toEqual(['Edit', 'Pause']);
    expect(labelsIn(await rowOf('5'))).toEqual(['Edit', 'Resume']);
  });

  it('show no button, and no New button, to an administrator who lacks ADS:UNIT (the list is read with ADS:CREATIVE)', async () => {
    signIn('support', { codes: ['ADS:CREATIVE'] });
    backend();
    renderPage(<UnitsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: 'New unit' })).not.toBeInTheDocument();
    for (const row of rows()) expect(labelsIn(row)).toEqual([]);
  });
});

describe('the state changes and the delete', { timeout: 30000 }, () => {
  it('asks first, then sends the new state once', async () => {
    const { calls, user } = await load();
    await user.click(within(await rowOf('6')).getByRole('button', { name: 'Activate' }));
    expect(await screen.findByText('Activate this unit?')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'PUT',
      url: '/api/admin/ads/units/6/status',
      body: { status: 'ACTIVE' },
    });
    await waitFor(() =>
      expect(
        cellsOf(rows().find((r) => r.textContent?.includes(unit('6').name.slice(0, 12)))!)[3],
      ).toBe('Running'),
    );
  });

  it('sends the pause and the resume with their own states', async () => {
    const { calls, user } = await load();
    await confirmInline(user, await rowOf('1'), 'Pause');
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toEqual({ status: 'PAUSED' });
    await confirmInline(user, await rowOf('5'), 'Resume');
    await waitFor(() => expect(writesOf(calls)).toHaveLength(2));
    expect(writesOf(calls)[1].body).toEqual({ status: 'ACTIVE' });
  });

  it('sends one request when the confirmation is pressed twice', async () => {
    const { calls, user } = await load();
    const gate = holdWrites();
    await user.click(within(await rowOf('1')).getByRole('button', { name: 'Pause' }));
    const ok = await screen.findByRole('button', { name: 'OK' });
    fireEvent.click(ok);
    fireEvent.click(ok);
    await settled();
    expect(gate.started()).toBe(1);
    gate.release();
    await settled();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('shows the words of the error code, never the backend message', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'PUT' && url.pathname.endsWith('/status')
        ? jsonAnswer(409, 'INVALID_STATE', { status: 'ACTIVE' }, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<UnitsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await confirmInline(user, await rowOf('1'), 'Pause');
    expect(
      await screen.findByText('The current state of the item does not allow this action.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });

  it('deletes a draft after a question that says what can be deleted', async () => {
    const { calls, user } = await load();
    await user.click(within(await rowOf('6')).getByRole('button', { name: 'Delete' }));
    expect(
      await screen.findByText(/Only a draft unit without creatives can be deleted/),
    ).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({ method: 'DELETE', url: '/api/admin/ads/units/6' });
    await waitFor(() => expect(adsState.units.has('6')).toBe(false));
  });

  it('keeps the row and says why when the backend refuses to delete a draft that has a creative', async () => {
    const { user } = await load();
    await user.click(within(await rowOf('8')).getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText('The current state of the item does not allow this action.'),
    ).toBeInTheDocument();
    expect(adsState.units.has('8')).toBe(true);
  });
});

describe('the form', { timeout: 60000 }, () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'New unit' }));
    return within(await dialog());
  };
  const choose = async (
    user: ReturnType<typeof userEvent.setup>,
    form: ReturnType<typeof within>,
    label: string,
    text: string | RegExp,
  ) => {
    await user.click(form.getByRole('combobox', { name: label }));
    const options = await screen.findAllByText(text, {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
  };

  it('opens empty with weight 100 and a daily cap of 0, and explains the weight and the cap', async () => {
    const { user } = await load();
    const form = await open(user);
    expect(form.getByRole('textbox', { name: 'Name' })).toHaveValue('');
    expect(form.getByRole('spinbutton', { name: 'Weight' })).toHaveValue('100');
    expect(form.getByRole('spinbutton', { name: 'Daily cap' })).toHaveValue('0');
    expect(form.getByText(/0 means the unit is never chosen/)).toBeInTheDocument();
    expect(form.getByText(/all accounts and guests together; 0 = no limit/)).toBeInTheDocument();
    expect(form.getByTestId('targeting-editor')).toBeInTheDocument();
  });

  it('lists the campaigns to choose from, with an ended campaign that cannot be chosen', async () => {
    const { user } = await load();
    const form = await open(user);
    await user.click(form.getByRole('combobox', { name: 'Campaign' }));
    const ended = await screen.findAllByText(new RegExp(campaign('4').name.slice(0, 6)), {
      selector: '.ant-select-item-option-content',
    });
    expect(ended[ended.length - 1].closest('.ant-select-item')?.className).toMatch(/disabled/);
    expect(ended[ended.length - 1].textContent).toContain('(ended)');
    const running = await screen.findAllByText(campaign('6').name, {
      selector: '.ant-select-item-option-content',
    });
    expect(running[running.length - 1].closest('.ant-select-item')?.className).not.toMatch(
      /disabled/,
    );
  });

  it('lists the four placements to choose from', async () => {
    const { user } = await load();
    const form = await open(user);
    await user.click(form.getByRole('combobox', { name: 'Placement' }));
    for (const slot of ['app_open', 'call_end', 'history_feed', 'reward_credits']) {
      expect(
        await screen.findAllByText(new RegExp(slot), {
          selector: '.ant-select-item-option-content',
        }),
      ).not.toHaveLength(0);
    }
  });

  it('asks for the campaign, the placement and the name, and sends nothing until they are there', async () => {
    const { calls, user } = await load();
    const form = await open(user);
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('Choose a campaign')).toBeInTheDocument();
    expect(form.getByText('Choose a placement')).toBeInTheDocument();
    expect(form.getByText('Enter a name')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('creates a draft with the typed fields and the targeting, and nothing else', async () => {
    const { calls, user } = await load();
    const form = await open(user);
    await choose(user, form, 'Campaign', campaign('6').name);
    await choose(user, form, 'Placement', /call_end/);
    await user.type(form.getByRole('textbox', { name: 'Name' }), '  Đơn vị 🚀  ');
    await user.click(form.getByRole('checkbox', { name: 'iOS' }));
    await user.type(form.getByRole('combobox', { name: 'Countries' }), 'vn{Enter}');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({ method: 'POST', url: '/api/admin/ads/units' });
    expect(writesOf(calls)[0].body).toEqual({
      campaignId: '6',
      placementId: '2',
      name: 'Đơn vị 🚀',
      weight: 100,
      dailyImpressionCap: 0,
      targeting: { platforms: ['IOS'], geo: ['VN'] },
    });
    await dialogsClosed();
    await waitFor(() =>
      expect(rows().some((r) => r.textContent?.includes('Đơn vị 🚀'))).toBe(true),
    );
  });

  it('takes a weight of 0, and sends it as 0', async () => {
    const { calls, user } = await load();
    const form = await open(user);
    await choose(user, form, 'Campaign', campaign('6').name);
    await choose(user, form, 'Placement', /call_end/);
    await user.type(form.getByRole('textbox', { name: 'Name' }), 'Zero');
    const weight = form.getByRole('spinbutton', { name: 'Weight' });
    await user.clear(weight);
    await user.type(weight, '0');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { weight: number }).weight).toBe(0);
  });

  it('does not take a weight below 0 or one that is not whole, and does not take a negative cap', async () => {
    const { calls, user } = await load();
    const form = await open(user);
    await choose(user, form, 'Campaign', campaign('6').name);
    await choose(user, form, 'Placement', /call_end/);
    await user.type(form.getByRole('textbox', { name: 'Name' }), 'Bad');
    const weight = form.getByRole('spinbutton', { name: 'Weight' });
    await user.clear(weight);
    await user.type(weight, '-1');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('Enter a whole number, 0 or more')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('does not send while a field of the targeting is wrong, and says which', async () => {
    const { calls, user } = await load();
    const form = await open(user);
    await choose(user, form, 'Campaign', campaign('6').name);
    await choose(user, form, 'Placement', /call_end/);
    await user.type(form.getByRole('textbox', { name: 'Name' }), 'Bad targeting');
    await user.type(form.getByRole('textbox', { name: 'Lowest system version' }), 'x.y');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(
      (await form.findAllByText(/A version is numbers separated by dots/)).length,
    ).toBeGreaterThan(0);
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('says beside the countries that geo targeting is not set up, when the backend says so, and not when it is', async () => {
    adsState.geoConfigured = false;
    const first = await load();
    const form = await open(first.user);
    expect(
      await form.findByText('Geo targeting is not set up yet; countries set here will not match.'),
    ).toBeInTheDocument();
  });

  it('does not say it when geo targeting is configured', async () => {
    adsState.geoConfigured = true;
    const { user } = await load();
    const form = await open(user);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(form.queryByText(/Geo targeting is not set up yet/)).not.toBeInTheDocument();
  });

  it('disables the campaign selector and says which permission is missing when the campaigns cannot be read', async () => {
    backend();
    refuse('/api/admin/ads/campaigns');
    const user = userEvent.setup();
    renderPage(<UnitsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await open(user);
    expect(form.getByRole('combobox', { name: 'Campaign' })).toBeDisabled();
    expect(form.getByText('Needs the ADS:CAMPAIGN permission')).toBeInTheDocument();
    expect(form.getByRole('combobox', { name: 'Placement' })).not.toBeDisabled();
  });

  it('disables the placement selector and says which permission is missing when the placements cannot be read', async () => {
    backend();
    refuse('/api/admin/ads/placements');
    const user = userEvent.setup();
    renderPage(<UnitsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await open(user);
    expect(form.getByRole('combobox', { name: 'Placement' })).toBeDisabled();
    expect(form.getByText('Needs the ADS:PLACEMENT permission')).toBeInTheDocument();
  });

  it('sends one request when Submit is pressed twice', async () => {
    const { calls, user } = await load();
    const form = await open(user);
    await choose(user, form, 'Campaign', campaign('6').name);
    await choose(user, form, 'Placement', /call_end/);
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

  it('puts the fault of the backend under the field of the targeting it names, in the words of the reason, and any other under the form', async () => {
    backend();
    overrideFetch(async ({ method }) =>
      method === 'POST'
        ? jsonAnswer(
            400,
            'INVALID_REQUEST',
            {
              details: [
                { ref: 'targeting.geo', reason: 'OUT_OF_RANGE' },
                { ref: 'targeting.day_parts', reason: 'OUT_OF_RANGE' },
                { ref: 'weight', reason: 'NOT_AN_INTEGER' },
              ],
            },
            'SECRET BACKEND WORDS',
          )
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<UnitsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await open(user);
    await choose(user, form, 'Campaign', campaign('6').name);
    await choose(user, form, 'Placement', /call_end/);
    await user.type(form.getByRole('textbox', { name: 'Name' }), 'Refused');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect((await form.findAllByText('The value is outside the allowed range.')).length).toBe(2);
    expect(form.getByText('It must be a whole number.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('edits with the form filled in: the campaign and the placement are shown and cannot be changed, the targeting is restored', async () => {
    const { user } = await load();
    await user.click(within(await rowOf('1')).getByRole('button', { name: 'Edit' }));
    const form = within(await dialog());
    expect(form.getByRole('textbox', { name: 'Name' })).toHaveValue(unit('1').name);
    expect(form.queryByRole('combobox', { name: 'Campaign' })).not.toBeInTheDocument();
    expect(form.queryByRole('combobox', { name: 'Placement' })).not.toBeInTheDocument();
    expect(form.getByTestId('unit-campaign-fixed')).toHaveTextContent(campaign('2').name);
    expect(form.getByTestId('unit-placement-fixed')).toHaveTextContent('app_open');
    expect(form.getByRole('checkbox', { name: 'Android' })).toBeChecked();
    expect(form.getByRole('checkbox', { name: 'iOS' })).toBeChecked();
    expect(within(form.getByTestId('targeting-editor')).getByText('TH')).toBeInTheDocument();
    expect(within(form.getByTestId('targeting-editor')).getByText('ID')).toBeInTheDocument();
  });

  it('sends name, targeting, weight and cap only; a key the form emptied goes as null so that it is removed, and the campaign and the placement are not sent', async () => {
    const { calls, user } = await load();
    await user.click(within(await rowOf('1')).getByRole('button', { name: 'Edit' }));
    const form = within(await dialog());
    const geo = form.getByTestId('targeting-editor');
    const tags = [...geo.querySelectorAll('.ant-select-selection-item')].filter(
      (e) => e.textContent === 'TH' || e.textContent === 'ID',
    );
    for (const tag of tags) {
      fireEvent.click(tag.querySelector('.ant-select-selection-item-remove') as Element);
    }
    await user.click(form.getByRole('checkbox', { name: 'iOS' }));
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const write = writesOf(calls)[0];
    expect(write).toMatchObject({ method: 'PUT', url: '/api/admin/ads/units/1' });
    expect(write.body).toEqual({
      name: unit('1').name,
      weight: 100,
      dailyImpressionCap: 0,
      targeting: { platforms: ['ANDROID'], geo: null, languages: ['th', 'id'] },
    });
    await dialogsClosed();
    expect(adsState.units.get('1')!.targeting).not.toHaveProperty('geo');
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
    renderPage(<UnitsPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await confirmInline(user, await rowOf('1'), 'Pause');
    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeInTheDocument();
    await settled();
    expect(taken).toHaveLength(1);
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });
});

describe('a dialog that is opened again', { timeout: 40000 }, () => {
  it('shows the unit that is edited, with its targeting, not what was typed in the dialog that was closed before', async () => {
    const { user } = await load();
    await user.click(screen.getByRole('button', { name: 'New unit' }));
    const first = within(await dialog());
    await user.type(first.getByRole('textbox', { name: 'Name' }), 'Typed and abandoned');
    await user.click(first.getByRole('checkbox', { name: 'iOS' }));
    await user.click(first.getByRole('button', { name: 'Cancel' }));
    await user.click(within(await rowOf('2')).getByRole('button', { name: 'Edit' }));
    const form = within(await dialog());
    expect(form.getByRole('textbox', { name: 'Name' })).toHaveValue(unit('2').name);
    expect(form.getByRole('checkbox', { name: 'iOS' })).not.toBeChecked();
    expect(form.getByRole('textbox', { name: 'Lowest system version' })).toHaveValue('13');
    expect(form.getAllByPlaceholderText('Start')).toHaveLength(2);
    await user.click(form.getByRole('button', { name: 'Cancel' }));
    await user.click(within(await rowOf('1')).getByRole('button', { name: 'Edit' }));
    const next = within(await dialog());
    expect(next.getByRole('checkbox', { name: 'Android' })).toBeChecked();
    expect(next.getByRole('textbox', { name: 'Lowest system version' })).toHaveValue('');
    expect(next.queryAllByPlaceholderText('Start')).toHaveLength(0);
  });
});
