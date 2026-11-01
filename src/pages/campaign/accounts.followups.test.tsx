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
import AccountsPage from './accounts';
import { chooseOption, NOW, signIn, writesOf } from './testSetup';

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

const dialog = () => screen.findByRole('dialog');
const campaignRow = async (code: string) => {
  await waitFor(() => expect(screen.getByText(code)).toBeInTheDocument());
  return screen.getByText(code).closest('tr') as HTMLTableRowElement;
};
const costReads = (calls: { method: string; url: string }[]) =>
  calls
    .filter((c) => c.method === 'GET' && c.url.startsWith('/api/admin/attribution/costs?'))
    .map((c) => new URL(c.url, 'http://x').searchParams);
const costRows = () => [
  ...document.querySelectorAll<HTMLElement>(
    '.ant-tabs-content-active .ant-table-tbody tr.ant-table-row',
  ),
];

describe('editing a campaign that is switched off', { timeout: 30000 }, () => {
  it('keeps it switched off: the edit sends enabled false and the campaign stays off', async () => {
    const calls = backend();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AccountsPage />);
    const row = await campaignRow('summer_vn');
    expect(campaignState.campaigns.find((c) => c.code === 'summer_vn')?.enabled).toBe(false);
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const box = within(await dialog());
    const name = box.getByLabelText('Display name');
    await user.clear(name);
    await user.type(name, 'Summer renamed');
    await user.click(box.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].method).toBe('PUT');
    expect(writesOf(calls)[0].body).toMatchObject({ enabled: false, name: 'Summer renamed' });
    expect(campaignState.campaigns.find((c) => c.code === 'summer_vn')?.enabled).toBe(false);
  });
});

describe('the filters of a tab are still there when the tab is opened again', {
  timeout: 30000,
}, () => {
  it('keeps the campaign chosen in the costs tab, and reads the costs of that campaign when the tab is opened again', async () => {
    const calls = backend();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AccountsPage />);
    await user.click(await screen.findByRole('tab', { name: 'Costs' }));
    await waitFor(() => expect(costRows().length).toBeGreaterThan(0));
    await chooseOption(user, 'Campaign', /spring_th/);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    const springId = campaignState.campaigns.find((c) => c.code === 'spring_th')?.id;
    await waitFor(() => expect(costReads(calls).at(-1)?.get('campaignId')).toBe(springId));

    await user.click(screen.getByRole('tab', { name: 'Campaigns' }));
    await campaignRow('spring_th');
    await user.click(screen.getByRole('tab', { name: 'Costs' }));
    await waitFor(() => expect(costRows().length).toBeGreaterThan(0));
    expect(costReads(calls).at(-1)?.get('campaignId')).toBe(springId);
    const select = screen.getByRole('combobox', { name: 'Campaign' });
    expect(select.closest('.ant-select')?.textContent).toContain('spring_th');
  });

  it('keeps a choice that was made but not searched for as it was, and still reads with the searched filters', async () => {
    const calls = backend();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AccountsPage />);
    await user.click(await screen.findByRole('tab', { name: 'Costs' }));
    await waitFor(() => expect(costRows().length).toBeGreaterThan(0));
    await chooseOption(user, 'Campaign', /spring_th/);
    await user.click(screen.getByRole('tab', { name: 'Campaigns' }));
    await campaignRow('spring_th');
    await user.click(screen.getByRole('tab', { name: 'Costs' }));
    await waitFor(() => expect(costRows().length).toBeGreaterThan(0));
    expect(
      screen.getByRole('combobox', { name: 'Campaign' }).closest('.ant-select')?.textContent,
    ).toContain('spring_th');
    // It was not searched for, so the list is still the one of all campaigns.
    expect(costReads(calls).at(-1)?.has('campaignId')).toBe(false);
  });
});

describe('the question before a cost is deleted', { timeout: 30000 }, () => {
  it('names a campaign of 5000 characters in a few, so that the buttons stay within reach', async () => {
    const calls = backend();
    campaignState.campaigns[0].name = 'ก'.repeat(5000);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AccountsPage />);
    await user.click(await screen.findByRole('tab', { name: 'Costs' }));
    await waitFor(() => expect(costRows().length).toBeGreaterThan(0));
    const target = costRows().find((r) => (r.textContent ?? '').includes('ก'.repeat(20)));
    expect(target).toBeDefined();
    await user.click(within(target as HTMLElement).getByRole('button', { name: 'Delete' }));
    const bubble = await waitFor(() => {
      const found = document.querySelector('.ant-popover:not(.ant-popover-hidden)');
      if (!found) throw new Error('no question');
      return found as HTMLElement;
    });
    const text = bubble.textContent ?? '';
    expect(text).toContain('ก'.repeat(40));
    expect(text).not.toContain('ก'.repeat(200));
    expect(text.length).toBeLessThan(400);
    expect(within(bubble).getByRole('button', { name: 'OK' })).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });
});

describe('the link dialog says when a UTM value would be dropped', { timeout: 30000 }, () => {
  const open = async () => {
    saved.set('attribution.link_base_url', {
      value: 'https://go.example',
      updatedAt: '',
      updatedBy: '',
      updatedByUsername: '',
    });
    const calls = backend();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AccountsPage />);
    const row = await campaignRow('spring_th');
    await user.click(within(row).getByRole('button', { name: 'Generate link' }));
    await dialog();
    return { calls, user };
  };
  const RULE =
    'Only letters, digits, ".", "_" and "-", up to 64 characters: anything else is left out of the links.';

  it('shows the rule under a field with a character that is not allowed, and not under the others', async () => {
    const { user } = await open();
    const box = within(await dialog());
    expect(box.queryByText(RULE)).toBeNull();
    await user.type(box.getByLabelText('UTM campaign'), 'spring sale');
    expect(await box.findAllByText(RULE)).toHaveLength(1);
    expect(box.getByLabelText('UTM campaign').closest('.ant-form-item')?.textContent).toContain(
      RULE,
    );
    expect(box.getByLabelText('UTM source').closest('.ant-form-item')?.textContent).not.toContain(
      RULE,
    );
  });

  it('shows it for a value longer than 64 characters, and not for an empty field or an allowed one', async () => {
    const { user } = await open();
    const box = within(await dialog());
    fireEvent.change(box.getByLabelText('UTM campaign'), { target: { value: 'a'.repeat(65) } });
    expect(await box.findAllByText(RULE)).toHaveLength(1);
    fireEvent.change(box.getByLabelText('UTM campaign'), { target: { value: 'a.b_c-9' } });
    await waitFor(() => expect(box.queryByText(RULE)).toBeNull());
    fireEvent.change(box.getByLabelText('UTM campaign'), { target: { value: '' } });
    expect(box.queryByText(RULE)).toBeNull();
    await user.click(box.getByRole('radio', { name: 'Google' }));
    expect(box.queryByText(RULE)).toBeNull();
  });

  it('is only a warning: the link is still asked for', async () => {
    const { user, calls } = await open();
    const box = within(await dialog());
    await user.type(box.getByLabelText('UTM campaign'), 'spring sale');
    await user.click(box.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(calls.some((c) => /\/link\?/.test(c.url))).toBe(true));
  });
});

describe('the batch dialog counts a JSON array by its items, not by lines', {
  timeout: 30000,
}, () => {
  const openBatch = async (locale?: 'en-US' | 'zh-CN') => {
    backend();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AccountsPage />, locale);
    await user.click(
      await screen.findByRole('tab', { name: locale === 'zh-CN' ? '投放成本' : 'Costs' }),
    );
    await waitFor(() => expect(costRows().length).toBeGreaterThan(0));
    await user.click(
      screen.getByRole('button', { name: locale === 'zh-CN' ? '批量录入' : 'Batch import' }),
    );
    return { user, box: within(await dialog()) };
  };
  const good = {
    campaignCode: 'spring_th',
    statDate: '2026-09-01',
    amount: 5,
    currency: 'USD',
    remark: '',
  };

  it('says "Item 2" for the second element of an array written on one line, also when it is not an object', async () => {
    const { box } = await openBatch();
    fireEvent.change(box.getByLabelText('Rows as JSON'), {
      target: { value: JSON.stringify([good, 7, { ...good, amount: -1 }]) },
    });
    expect(
      await box.findByText('Item 2: This item of the array is not an object.'),
    ).toBeInTheDocument();
    expect(box.getByText('Item 3: The cost is below 0.')).toBeInTheDocument();
    expect(box.queryByText(/^Line /)).toBeNull();
  });

  it('says "Item" in the reason that names an earlier place too', async () => {
    const { box } = await openBatch();
    fireEvent.change(box.getByLabelText('Rows as JSON'), {
      target: { value: JSON.stringify([good, good]) },
    });
    expect(
      await box.findByText('Item 2: The same campaign and day is in item 1 already.'),
    ).toBeInTheDocument();
  });

  it('says it in Chinese with the word for an item', async () => {
    const { box } = await openBatch('zh-CN');
    fireEvent.change(box.getByLabelText('JSON 内容'), {
      target: { value: JSON.stringify([good, { ...good, amount: -1 }]) },
    });
    expect(await box.findByText(/^第 2 项：/)).toBeInTheDocument();
    expect(box.queryByText(/^第 \d+ 行：/)).toBeNull();
  });
});
