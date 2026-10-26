import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { campaignState } from '../../../mock/_core/campaignData';
import { saved } from '../../../mock/_core/configStore';
import campaignMock from '../../../mock/campaign.mock';
import channelsMock from '../../../mock/channels.mock';
import configMock from '../../../mock/config.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { withTimeZone } from '../../../tests/withTimeZone';
import AccountsPage from './accounts';
import {
  chooseOption,
  dialogsClosed,
  holdWrites,
  jsonAnswer,
  NOW,
  overrideFetch,
  signIn,
  writesOf,
} from './testSetup';

const backend = () =>
  useMockBackend({ default: campaignMock }, { default: configMock }, { default: channelsMock });

beforeEach(() => {
  signIn('root');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// The pane that shows: the page keeps only the pane of the tab that is open.
const ACTIVE = '.ant-tabs-content-active';
const costRows = () => [
  ...document.querySelectorAll<HTMLElement>(`${ACTIVE} .ant-table-tbody tr.ant-table-row`),
];
const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');
const dialog = () => screen.findByRole('dialog');
const costReads = (calls: { method: string; url: string }[]) =>
  calls
    .filter((c) => c.method === 'GET' && c.url.startsWith('/api/admin/attribution/costs?'))
    .map((c) => new URL(c.url, 'http://x').searchParams);

const openCosts = async () => {
  const calls = backend();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderPage(<AccountsPage />);
  await user.click(await screen.findByRole('tab', { name: 'Costs' }));
  await waitFor(() => expect(costRows().length).toBeGreaterThan(0));
  return { calls, user };
};

describe('the cost list', { timeout: 30000 }, () => {
  it('has the columns of the spec in its order', async () => {
    await openCosts();
    const heads = [...document.querySelectorAll(`${ACTIVE} .ant-table-thead th`)].map(
      (h) => h.textContent,
    );
    expect(heads).toEqual([
      'Name',
      'Date (UTC)',
      'Cost',
      'Currency',
      'Remark',
      'Entered by',
      'Created at',
      'Actions',
    ]);
  });

  it('shows the name of the campaign, the day, the amount with two decimals, the currency, the remark and who entered it', async () => {
    await openCosts();
    const cost = campaignState.costs
      .slice()
      .sort((a, b) => b.statDate.localeCompare(a.statDate) || Number(b.id) - Number(a.id))[0];
    const campaign = campaignState.campaigns.find((c) => c.id === cost.campaignId);
    const cells = cellsOf(costRows()[0]);
    expect(cells[0]).toBe(campaign?.name);
    expect(cells[1]).toBe(cost.statDate);
    expect(cells[2]).toMatch(/^[\d,]+\.\d{2}$/);
    expect(cells[2]).toBe(
      new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        cost.amount,
      ),
    );
    expect(cells[3]).toBe('USD');
    expect(cells[5]).toBe('root');
    expect(within(costRows()[0]).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(costRows()[0]).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('shows 0 as 0.00, and a dash for who entered it once that administrator has been deleted', async () => {
    backend();
    // the newest rows (the highest ids) are on the first page
    const last = campaignState.costs[campaignState.costs.length - 1];
    last.amount = 0;
    last.createdBy = 'gone';
    campaignState.costs.forEach((c) => {
      c.statDate = '2026-10-26';
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AccountsPage />);
    await user.click(await screen.findByRole('tab', { name: 'Costs' }));
    await waitFor(() => expect(costRows().length).toBeGreaterThan(0));
    const texts = costRows().map((r) => cellsOf(r));
    expect(texts.some((c) => c[2] === '0.00')).toBe(true);
    expect(texts.some((c) => c[5] === '—')).toBe(true);
  });

  it('reads the last 30 UTC days, for all campaigns, 20 rows to a page, also where the local date is the next day', async () => {
    await withTimeZone('Pacific/Auckland', async () => {
      vi.setSystemTime(new Date('2026-10-26T20:00:00Z'));
      // the token of the administrator is good for eight hours from when it was made
      signIn('root');
      const { calls } = await openCosts();
      const read = costReads(calls)[0];
      expect(read.get('from')).toBe('2026-09-27');
      expect(read.get('to')).toBe('2026-10-26');
      expect(read.has('campaignId')).toBe(false);
      expect(read.get('page')).toBe('1');
      expect(read.get('pageSize')).toBe('20');
    });
  });

  it('asks again, from page 1, with the campaign that was chosen once Search is pressed', async () => {
    const { calls, user } = await openCosts();
    const before = costReads(calls).length;
    await chooseOption(user, 'Campaign', /spring_th/);
    expect(costReads(calls)).toHaveLength(before);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(costReads(calls).length).toBe(before + 1));
    const last = costReads(calls)[costReads(calls).length - 1];
    expect(last.get('campaignId')).toBe(
      campaignState.campaigns.find((c) => c.code === 'spring_th')?.id,
    );
    expect(last.get('page')).toBe('1');
    await waitFor(() =>
      expect(costRows().every((r) => cellsOf(r)[0] === campaignState.campaigns[0].name)).toBe(true),
    );
  });

  it('shows the words of the error code, not the backend words, and reads again with the retry button', async () => {
    backend();
    let failing = true;
    overrideFetch(({ url }) =>
      failing && url.pathname === '/api/admin/attribution/costs'
        ? jsonAnswer(429, 'RATE_LIMITED', null, 'raw backend words')
        : undefined,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AccountsPage />);
    await user.click(await screen.findByRole('tab', { name: 'Costs' }));
    expect(await screen.findByText(/Failed to load:.*Too many requests/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw backend words');
    failing = false;
    const retries = screen.getAllByRole('button', { name: 'Retry' });
    await user.click(retries[retries.length - 1]);
    await waitFor(() => expect(costRows().length).toBeGreaterThan(0));
  });

  it('keeps a remark of 5000 characters and Thai, Arabic and emoji remarks inside the table', async () => {
    backend();
    campaignState.costs[campaignState.costs.length - 1].remark = 'ا'.repeat(5000);
    campaignState.costs[campaignState.costs.length - 2].remark = `โปรโมชั่น ${'🎉'.repeat(30)}`;
    campaignState.costs.forEach((c) => {
      c.statDate = '2026-10-26';
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AccountsPage />);
    await user.click(await screen.findByRole('tab', { name: 'Costs' }));
    await waitFor(() => expect(costRows().length).toBeGreaterThan(0));
    const buttons = [...document.querySelectorAll(`${ACTIVE} .ant-table-tbody button[data-lines]`)];
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    for (const button of buttons)
      expect((button as HTMLElement).style.overflowWrap).toBe('anywhere');
  });

  it('is written in Chinese too', async () => {
    backend();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AccountsPage />, 'zh-CN');
    await user.click(await screen.findByRole('tab', { name: '投放成本' }));
    await waitFor(() => expect(costRows().length).toBeGreaterThan(0));
    const heads = [...document.querySelectorAll(`${ACTIVE} .ant-table-thead th`)].map(
      (h) => h.textContent,
    );
    expect(heads).toEqual([
      '显示名称',
      '日期（UTC）',
      '花费',
      '币种',
      '备注',
      '录入者',
      '创建时间',
      '操作',
    ]);
  });
});

const submit = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(within(await dialog()).getByRole('button', { name: 'Submit' }));
};

describe('entering a cost', { timeout: 30000 }, () => {
  const open = async () => {
    const result = await openCosts();
    await result.user.click(screen.getByRole('button', { name: 'Enter cost' }));
    await dialog();
    return result;
  };

  it('has the campaign, the day (today in UTC), the amount, the currency that is only shown, and the remark, in a dialog 480 wide', async () => {
    await open();
    const box = within(await dialog());
    expect(box.getByLabelText('Campaign')).toBeInTheDocument();
    expect(box.getByLabelText('Date (UTC)')).toHaveValue('2026-10-26');
    expect(box.getByLabelText('Cost')).toHaveValue('');
    expect(box.getByText('USD', { selector: '[data-testid="cost-currency"]' })).toBeInTheDocument();
    expect(box.queryByRole('textbox', { name: 'Currency' })).not.toBeInTheDocument();
    expect(box.getByLabelText('Remark')).toBeInTheDocument();
    expect((await dialog()).closest('.ant-modal')?.getAttribute('style') ?? '').toContain('480');
  });

  it('takes the UTC day for today where the local date is already the next day', async () => {
    await withTimeZone('Pacific/Auckland', async () => {
      vi.setSystemTime(new Date('2026-10-26T20:00:00Z'));
      // the token of the administrator is good for eight hours from when it was made
      signIn('root');
      await open();
      expect(within(await dialog()).getByLabelText('Date (UTC)')).toHaveValue('2026-10-26');
    });
  });

  it('asks for the campaign and the amount, and sends nothing without them', async () => {
    const { calls, user } = await open();
    await submit(user);
    const box = within(await dialog());
    expect(await box.findByText('Choose a campaign.')).toBeInTheDocument();
    expect(box.getByText('Enter the cost.')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('refuses an amount below 0, with more than two decimals, or that is not a number, and says how it is written', async () => {
    const { calls, user } = await open();
    await chooseOption(user, 'Campaign', /spring_th/, await dialog());
    const box = within(await dialog());
    for (const bad of ['-1', '1.234', 'abc', '1e3', '1,5', '12345678901234']) {
      await user.clear(box.getByLabelText('Cost'));
      await user.type(box.getByLabelText('Cost'), bad);
      await submit(user);
      expect(
        await box.findByText(
          'Enter an amount of 0 or more with at most two decimals, for example 12.50.',
        ),
        bad,
      ).toBeInTheDocument();
      expect(writesOf(calls), bad).toHaveLength(0);
    }
  });

  it('sends the campaign, the UTC day, the amount as a number, the currency and the remark, and shows the new cost', async () => {
    const { calls, user } = await open();
    await chooseOption(user, 'Campaign', /summer_vn/, await dialog());
    const box = within(await dialog());
    await user.type(box.getByLabelText('Cost'), ' 12.5 ');
    await user.type(box.getByLabelText('Remark'), 'โปรโมชั่น ก ع 中 🎉');
    await submit(user);
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const [write] = writesOf(calls);
    expect(write.method).toBe('POST');
    expect(write.url).toBe('/api/admin/attribution/costs');
    expect(write.body).toEqual({
      campaignId: campaignState.campaigns.find((c) => c.code === 'summer_vn')?.id,
      statDate: '2026-10-26',
      amount: 12.5,
      currency: 'USD',
      remark: 'โปรโมชั่น ก ع 中 🎉',
    });
    await dialogsClosed();
    expect(
      campaignState.costs.some(
        (c) => c.statDate === '2026-10-26' && c.amount === 12.5 && c.remark === 'โปรโมชั่น ก ع 中 🎉',
      ),
    ).toBe(true);
  });

  it('sends the amount 0 as 0, and no remark as null', async () => {
    const { calls, user } = await open();
    await chooseOption(user, 'Campaign', /summer_vn/, await dialog());
    await user.type(within(await dialog()).getByLabelText('Cost'), '0');
    await submit(user);
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toMatchObject({ amount: 0, remark: null });
  });

  it('says to edit instead, in the words of the code and not the backend words, when the campaign has a cost on that day (409 COST_EXISTS), and keeps the dialog and the amount', async () => {
    const { calls, user } = await open();
    // the sample has a cost of spring_th today
    const existing = campaignState.costs.find(
      (c) => c.campaignId === '1' && c.statDate === '2026-10-26',
    );
    expect(existing).toBeTruthy();
    await chooseOption(user, 'Campaign', /spring_th/, await dialog());
    await user.type(within(await dialog()).getByLabelText('Cost'), '99.00');
    await submit(user);
    expect(
      await within(await dialog()).findByText(
        'A cost already exists for this campaign on this day. Edit it instead.',
      ),
    ).toBeInTheDocument();
    expect(within(await dialog()).getByLabelText('Cost')).toHaveValue('99.00');
    expect(writesOf(calls)).toHaveLength(1);
    expect(campaignState.costs.find((c) => c.id === existing?.id)?.amount).toBe(existing?.amount);
  });

  it('says what the key of a cost is, so that the person knows a second entry is refused', async () => {
    await open();
    expect(
      within(await dialog()).getByText(/The campaign and the day are the key of a cost/),
    ).toBeInTheDocument();
  });

  it('sends one request when the button is pressed twice while the first is on its way', async () => {
    const { calls, user } = await open();
    await chooseOption(user, 'Campaign', /summer_vn/, await dialog());
    await user.type(within(await dialog()).getByLabelText('Cost'), '5');
    const hold = holdWrites();
    const button = within(await dialog()).getByRole('button', { name: 'Submit' });
    fireEvent.click(button);
    fireEvent.click(button);
    hold.release();
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(hold.started()).toBe(1);
  });

  it('shows a refused field under the field in words of the language', async () => {
    const { user } = await open();
    overrideFetch(({ method }) =>
      method === 'POST'
        ? jsonAnswer(
            400,
            'INVALID_REQUEST',
            { details: [{ ref: 'amount', reason: 'OUT_OF_RANGE' }] },
            'raw words',
          )
        : undefined,
    );
    await chooseOption(user, 'Campaign', /summer_vn/, await dialog());
    await user.type(within(await dialog()).getByLabelText('Cost'), '5');
    await submit(user);
    expect(
      await within(await dialog()).findByText('The value is outside the allowed range.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw words');
  });

  it('shows no currency when the setting cannot be read, and then sends none', async () => {
    const calls = backend();
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/config' ? jsonAnswer(500, 'INTERNAL_ERROR') : undefined,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AccountsPage />);
    await user.click(await screen.findByRole('tab', { name: 'Costs' }));
    await waitFor(() => expect(costRows().length).toBeGreaterThan(0));
    await user.click(screen.getByRole('button', { name: 'Enter cost' }));
    await dialog();
    await chooseOption(user, 'Campaign', /summer_vn/, await dialog());
    await user.type(within(await dialog()).getByLabelText('Cost'), '5');
    expect(
      within(await dialog()).getByText('—', { selector: '[data-testid="cost-currency"]' }),
    ).toBeInTheDocument();
    await submit(user);
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).not.toHaveProperty('currency');
  });
});

describe('changing a cost', { timeout: 30000 }, () => {
  const open = async () => {
    const result = await openCosts();
    await result.user.click(within(costRows()[0]).getByRole('button', { name: 'Edit' }));
    await dialog();
    return result;
  };
  const first = () =>
    campaignState.costs
      .slice()
      .sort((a, b) => b.statDate.localeCompare(a.statDate) || Number(b.id) - Number(a.id))[0];

  it('is filled with the cost, and the campaign and the day can only be read', async () => {
    await open();
    const box = within(await dialog());
    const cost = first();
    const campaign = campaignState.campaigns.find((c) => c.id === cost.campaignId);
    expect(box.getByLabelText('Cost')).toHaveValue(cost.amount.toFixed(2));
    expect(
      box.getByText(campaign?.name ?? '', { selector: '[data-testid="cost-campaign"]' }),
    ).toBeInTheDocument();
    expect(
      box.getByText(cost.statDate, { selector: '[data-testid="cost-day"]' }),
    ).toBeInTheDocument();
    expect(box.queryByRole('combobox')).not.toBeInTheDocument();
    expect(box.queryByLabelText('Date (UTC)')).not.toBeInTheDocument();
  });

  it('sends the change to the cost with the same campaign and day', async () => {
    const { calls, user } = await open();
    const cost = first();
    const box = within(await dialog());
    await user.clear(box.getByLabelText('Cost'));
    await user.type(box.getByLabelText('Cost'), '321.09');
    await submit(user);
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const [write] = writesOf(calls);
    expect(write.method).toBe('PUT');
    expect(write.url).toBe(`/api/admin/attribution/costs/${cost.id}`);
    expect(write.body).toMatchObject({
      campaignId: cost.campaignId,
      statDate: cost.statDate,
      amount: 321.09,
      currency: 'USD',
    });
    await dialogsClosed();
    expect(campaignState.costs.find((c) => c.id === cost.id)?.amount).toBe(321.09);
    expect(await screen.findByText('321.09')).toBeInTheDocument();
  });

  it('sends one request when the button is pressed twice while the first is on its way', async () => {
    const { calls, user } = await open();
    const box = within(await dialog());
    await user.clear(box.getByLabelText('Cost'));
    await user.type(box.getByLabelText('Cost'), '55.55');
    const hold = holdWrites();
    const button = box.getByRole('button', { name: 'Submit' });
    fireEvent.click(button);
    fireEvent.click(button);
    hold.release();
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(hold.started()).toBe(1);
  });

  it('refuses the same amounts as a new cost', async () => {
    const { calls, user } = await open();
    const box = within(await dialog());
    await user.clear(box.getByLabelText('Cost'));
    await user.type(box.getByLabelText('Cost'), '-5');
    await submit(user);
    expect(await box.findByText(/Enter an amount of 0 or more/)).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });
});

describe('deleting a cost', { timeout: 30000 }, () => {
  it('asks in the row first, and sends the delete when it is confirmed, once for two presses', async () => {
    const { calls, user } = await openCosts();
    const row = costRows()[0];
    const id = (() => {
      const sorted = campaignState.costs
        .slice()
        .sort((a, b) => b.statDate.localeCompare(a.statDate) || Number(b.id) - Number(a.id));
      return sorted[0].id;
    })();
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    expect(writesOf(calls)).toHaveLength(0);
    const popover = await screen.findByRole('tooltip');
    expect(
      within(popover).getByText(/^Delete the cost of .* on \d{4}-\d{2}-\d{2}\?$/),
    ).toBeInTheDocument();
    const hold = holdWrites();
    const confirm = within(popover).getByRole('button', { name: 'OK' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    hold.release();
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'DELETE',
      url: `/api/admin/attribution/costs/${id}`,
    });
    expect(hold.started()).toBe(1);
    await waitFor(() => expect(campaignState.costs.some((c) => c.id === id)).toBe(false));
  });

  it('sends nothing when the question is answered with Cancel', async () => {
    const { calls, user } = await openCosts();
    await user.click(within(costRows()[0]).getByRole('button', { name: 'Delete' }));
    const popover = await screen.findByRole('tooltip');
    await user.click(within(popover).getByRole('button', { name: 'Cancel' }));
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('shows the words of the error code when the cost is gone already, and reads the list again', async () => {
    const { user } = await openCosts();
    overrideFetch(({ method }) =>
      method === 'DELETE'
        ? jsonAnswer(404, 'RESOURCE_NOT_FOUND', null, 'raw backend words')
        : undefined,
    );
    await user.click(within(costRows()[0]).getByRole('button', { name: 'Delete' }));
    const popover = await screen.findByRole('tooltip');
    await user.click(within(popover).getByRole('button', { name: 'OK' }));
    expect(await screen.findByText('The item was not found.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw backend words');
  });
});

describe('the costs are in the one currency of the system', () => {
  it('writes the currency of the setting in the dialog', async () => {
    saved.set('attribution.cost_currency', {
      value: 'EUR',
      updatedAt: '',
      updatedBy: '',
      updatedByUsername: '',
    });
    const { user } = await openCosts();
    await user.click(screen.getByRole('button', { name: 'Enter cost' }));
    expect(
      within(await dialog()).getByText('EUR', { selector: '[data-testid="cost-currency"]' }),
    ).toBeInTheDocument();
  });
});
