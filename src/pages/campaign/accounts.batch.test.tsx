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
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { BATCH_REASONS, parseCostBatch } from '../../services/campaign';
import AccountsPage from './accounts';
import { buildCostTemplate, TEMPLATE_FILE_NAME } from './costTemplate';
import { holdWrites, jsonAnswer, NOW, overrideFetch, signIn, writesOf } from './testSetup';

const BOM = String.fromCharCode(0xfeff);

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
const setConfig = (key: string, value: unknown) =>
  saved.set(key, { value, updatedAt: '', updatedBy: '', updatedByUsername: '' });

const open = async () => {
  const calls = useMockBackend(
    { default: campaignMock },
    { default: configMock },
    { default: channelsMock },
  );
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderPage(<AccountsPage />);
  await user.click(await screen.findByRole('tab', { name: 'Costs' }));
  await waitFor(() =>
    expect(
      document.querySelectorAll('.ant-tabs-content-active tbody tr.ant-table-row').length,
    ).toBeGreaterThan(0),
  );
  await user.click(screen.getByRole('button', { name: 'Batch import' }));
  await dialog();
  return { calls, user };
};

const jsonRows = (rows: Record<string, unknown>[]) => JSON.stringify(rows);
const row = (over: Record<string, unknown> = {}) => ({
  campaignCode: 'spring_th',
  statDate: '2026-09-01',
  amount: 5,
  currency: 'USD',
  remark: '',
  ...over,
});

/** Puts text into the JSON box (typing braces needs escapes, and a thousand characters take long). */
const putJson = async (text: string) => {
  const box = within(await dialog()).getByLabelText('Rows as JSON');
  fireEvent.change(box, { target: { value: text } });
};
const importButton = async () => within(await dialog()).getByRole('button', { name: 'Import' });
const messagesIn = async () => (await dialog()).textContent ?? '';

describe('the batch dialog: before anything is entered', { timeout: 30000 }, () => {
  it('has a JSON tab and a CSV tab, is 720 wide, and cannot import yet', async () => {
    await open();
    const box = within(await dialog());
    expect(box.getByRole('tab', { name: 'JSON' })).toBeInTheDocument();
    expect(box.getByRole('tab', { name: 'CSV' })).toBeInTheDocument();
    expect((await dialog()).closest('.ant-modal')?.getAttribute('style') ?? '').toContain('720');
    expect(await importButton()).toBeDisabled();
  });

  it('says that a campaign and day that has a cost is overwritten, before the person presses Import', async () => {
    await open();
    expect(
      within(await dialog()).getByText(
        'A campaign and day that has a cost already is overwritten by the row of this import.',
      ),
    ).toBeInTheDocument();
  });

  it('says the limit of rows and the currency that were read from the setting, and that the file stays in the browser', async () => {
    await open();
    const box = within(await dialog());
    expect(await box.findByText('At most 1000 rows in a batch.')).toBeInTheDocument();
    expect(box.getByText('Costs are in USD.')).toBeInTheDocument();
    expect(
      box.getByText(
        'The file is read in this browser. Only the rows are sent, when you press Import.',
      ),
    ).toBeInTheDocument();
  });
});

describe('the batch dialog: JSON', { timeout: 30000 }, () => {
  it('says how many rows are ready, for how many campaigns and from which day to which, and then imports the rows as they were read', async () => {
    const { calls, user } = await open();
    await putJson(
      jsonRows([
        row({ statDate: '2026/09/02', amount: '7.50', remark: 'โปรโมชั่น ก ع 中 🎉' }),
        row({ statDate: '2026.09.01', amount: 5.25 }),
        row({ campaignCode: 'promo_id', statDate: '2026-09-03', amount: 0 }),
      ]),
    );
    expect(
      await within(await dialog()).findByText(
        '3 rows for 2 campaigns, from 2026-09-01 to 2026-09-03, are ready to import.',
      ),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(await importButton());
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const [write] = writesOf(calls);
    expect(write.method).toBe('POST');
    expect(write.url).toBe('/api/admin/attribution/costs/batch');
    expect(write.body).toEqual([
      {
        campaignCode: 'spring_th',
        statDate: '2026-09-02',
        amount: 7.5,
        currency: 'USD',
        remark: 'โปรโมชั่น ก ع 中 🎉',
      },
      {
        campaignCode: 'spring_th',
        statDate: '2026-09-01',
        amount: 5.25,
        currency: 'USD',
        remark: null,
      },
      {
        campaignCode: 'promo_id',
        statDate: '2026-09-03',
        amount: 0,
        currency: 'USD',
        remark: null,
      },
    ]);
    expect(await screen.findByText('Imported 3 rows')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(
      campaignState.costs.filter((c) => c.statDate >= '2026-09-01' && c.statDate <= '2026-09-03'),
    ).toHaveLength(3);
  });

  it('overwrites the cost of a campaign and day that has one, as the backend does, and the dialog said so', async () => {
    const { calls, user } = await open();
    const existing = campaignState.costs[0];
    const code = campaignState.campaigns.find((c) => c.id === existing.campaignId)?.code;
    await putJson(
      jsonRows([row({ campaignCode: code, statDate: existing.statDate, amount: 777.77 })]),
    );
    await user.click(await importButton());
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    await waitFor(() =>
      expect(campaignState.costs.find((c) => c.id === existing.id)?.amount).toBe(777.77),
    );
  });

  it('lists each bad row with its line and the reason in words, imports nothing, and keeps the button off', async () => {
    const { calls, user } = await open();
    await putJson(
      jsonRows([
        row(),
        row({ statDate: '2026-09-02', amount: -3 }),
        row({ statDate: '2026-02-30' }),
        row({ statDate: '2026-09-04', amount: 'abc' }),
        row({ statDate: '2026-09-05', campaignCode: '' }),
      ]),
    );
    const box = within(await dialog());
    expect(await box.findByText(/Nothing can be imported: 4 problems/)).toBeInTheDocument();
    expect(box.getByText('Line 2: The cost is below 0.')).toBeInTheDocument();
    expect(box.getByText('Line 3: There is no such day.')).toBeInTheDocument();
    expect(box.getByText('Line 4: The cost is not a number.')).toBeInTheDocument();
    expect(box.getByText('Line 5: The campaign ID is missing.')).toBeInTheDocument();
    expect(await importButton()).toBeDisabled();
    await user.click(await importButton());
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('refuses more rows than attribution.cost_batch_max, and a currency that is not attribution.cost_currency', async () => {
    setConfig('attribution.cost_batch_max', 2);
    await open();
    await putJson(
      jsonRows([row(), row({ statDate: '2026-09-02' }), row({ statDate: '2026-09-03' })]),
    );
    expect(
      await within(await dialog()).findByText('There are 3 rows, and a batch has at most 2.'),
    ).toBeInTheDocument();
    await putJson(jsonRows([row({ currency: 'EUR' })]));
    expect(
      await within(await dialog()).findByText('Line 1: The currency is EUR, and costs are in USD.'),
    ).toBeInTheDocument();
    expect(await importButton()).toBeDisabled();
  });

  it('refuses the same campaign and day twice, naming the line of the first', async () => {
    await open();
    await putJson(jsonRows([row(), row({ statDate: '2026/09/01', amount: 9 })]));
    expect(
      await within(await dialog()).findByText(
        'Line 2: The same campaign and day is on line 1 already.',
      ),
    ).toBeInTheDocument();
  });

  it('says a text that is not JSON is not JSON, and an empty list has no rows', async () => {
    await open();
    await putJson('[{"campaignCode": ');
    expect(await within(await dialog()).findByText('This is not valid JSON.')).toBeInTheDocument();
    await putJson('[]');
    expect(await within(await dialog()).findByText('There are no rows.')).toBeInTheDocument();
  });

  it('shows no more than 50 problems and says how many more there are', async () => {
    await open();
    await putJson(
      jsonRows(
        Array.from({ length: 80 }, (_, i) =>
          row({ statDate: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`, amount: -1 }),
        ),
      ),
    );
    const box = within(await dialog());
    expect(await box.findByText(/Nothing can be imported: 80 problems/)).toBeInTheDocument();
    expect(box.getByText('And 30 more problems.')).toBeInTheDocument();
  });

  it('keeps the dialog and shows what the backend refused, row by row, in words, when it refuses a batch the page let through', async () => {
    const { calls, user } = await open();
    await putJson(jsonRows([row(), row({ campaignCode: 'no_such_code', statDate: '2026-09-02' })]));
    await user.click(await importButton());
    const box = within(await dialog());
    expect(
      await box.findByText('The backend refused the batch, and nothing was imported:'),
    ).toBeInTheDocument();
    expect(
      box.getByText('1.campaignCode: The value is outside the allowed range.'),
    ).toBeInTheDocument();
    expect(await messagesIn()).not.toContain('some rows are not valid');
    expect(writesOf(calls)).toHaveLength(1);
    expect(campaignState.costs.some((c) => c.statDate === '2026-09-01')).toBe(false);
    // the text is still there: the person can correct it
    expect(within(await dialog()).getByLabelText('Rows as JSON')).toHaveValue(
      jsonRows([row(), row({ campaignCode: 'no_such_code', statDate: '2026-09-02' })]),
    );
  });

  it('shows the words of the error code and not the backend words for a refusal without details', async () => {
    const { user } = await open();
    overrideFetch(({ method }) =>
      method === 'POST' ? jsonAnswer(429, 'RATE_LIMITED', null, 'raw backend words') : undefined,
    );
    await putJson(jsonRows([row()]));
    await user.click(await importButton());
    expect(
      await within(await dialog()).findByText('Too many requests. Please try again later.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw backend words');
  });

  it('sends one request when Import is pressed twice while the first is on its way', async () => {
    const { calls } = await open();
    await putJson(jsonRows([row()]));
    await within(await dialog()).findByText(/ready to import/);
    const hold = holdWrites();
    const button = await importButton();
    fireEvent.click(button);
    fireEvent.click(button);
    hold.release();
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(hold.started()).toBe(1);
  });

  it('does not send anything while the person is typing, and nothing at all when the dialog is cancelled', async () => {
    const { calls, user } = await open();
    await putJson(jsonRows([row()]));
    await within(await dialog()).findByText(/ready to import/);
    await user.click(within(await dialog()).getByRole('button', { name: 'Cancel' }));
    expect(writesOf(calls)).toHaveLength(0);
  });
});

describe('the batch dialog: CSV', { timeout: 30000 }, () => {
  const toCsv = async () => {
    const result = await open();
    await result.user.click(within(await dialog()).getByRole('tab', { name: 'CSV' }));
    return result;
  };
  const fileInput = async () =>
    (await dialog()).querySelector('input[type="file"]') as HTMLInputElement;
  const csvFile = (text: string, name = 'costs.csv') =>
    new File([text], name, { type: 'text/csv' });

  it('shows the header of the template and a button to download it, with a note on the days', async () => {
    await toCsv();
    const box = within(await dialog());
    expect(box.getByTestId('csv-header').textContent).toBe(
      'campaign_code,stat_date,cost,currency,remark',
    );
    expect(box.getByRole('button', { name: 'Download the template' })).toBeInTheDocument();
    expect(
      box.getByText('A day is written YYYY-MM-DD, YYYY/MM/DD or YYYY.MM.DD.'),
    ).toBeInTheDocument();
  });

  it('downloads attribution-cost-template.csv with the header and two example rows, in the currency of the system, that the page itself reads', async () => {
    const { user } = await toCsv();
    const blobs: Blob[] = [];
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:template';
    });
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    await user.click(within(await dialog()).getByRole('button', { name: 'Download the template' }));
    expect(names).toEqual(['attribution-cost-template.csv']);
    expect(TEMPLATE_FILE_NAME).toBe('attribution-cost-template.csv');
    const text = await blobs[0].text();
    const lines = text.replace(BOM, '').split('\r\n');
    expect(lines[0]).toBe('campaign_code,stat_date,cost,currency,remark');
    expect(lines).toHaveLength(4); // the header, two rows and the end of the last line
    expect(lines[1]).toBe('example_campaign,2026-01-15,123.45,USD,First example row');
    expect(lines[2]).toBe(
      'example_campaign,2026/01/16,98.00,USD,"Second example row, with a comma"',
    );
    const read = parseCostBatch({ kind: 'csv', text }, { currency: 'USD' });
    expect(read.errors).toEqual([]);
    expect(read.rows).toHaveLength(2);
    expect(read.rows[1].remark).toBe('Second example row, with a comma');
  });

  it('builds the template in the language of the page too', () => {
    const text = buildCostTemplate({
      currency: 'EUR',
      remarks: ['示例第一行', '示例第二行，备注里有逗号'],
    });
    expect(text.startsWith(BOM)).toBe(true);
    expect(parseCostBatch({ kind: 'csv', text }, { currency: 'EUR' }).errors).toEqual([]);
  });

  it('reads a file in the browser, with a byte order mark, CRLF, quoted commas and Thai and Arabic remarks, and sends nothing until Import is pressed', async () => {
    const { calls, user } = await toCsv();
    const text = `${BOM}${[
      'campaign_code,stat_date,cost,currency,remark',
      'spring_th,2026-09-01,10.50,USD,"แคมเปญ, ฤดูใบไม้ผลิ"',
      'ramadan_ar,2026/09-01,3,USD,x',
      'ramadan_ar,2026.09.01,3,USD,"حملة, رمضان 🌙"',
    ].join('\r\n')}\r\n`;
    // the second line has a day that mixes two ways of writing it: the file is refused as a whole
    await user.upload(await fileInput(), csvFile(text));
    const box = within(await dialog());
    expect(
      await box.findByText('Line 3: The day must be written YYYY-MM-DD, YYYY/MM/DD or YYYY.MM.DD.'),
    ).toBeInTheDocument();
    expect(await importButton()).toBeDisabled();
    expect(writesOf(calls)).toHaveLength(0);

    const good = `${BOM}${[
      'campaign_code,stat_date,cost,currency,remark',
      'spring_th,2026-09-01,10.50,USD,"แคมเปญ, ฤดูใบไม้ผลิ"',
      'ramadan_ar,2026.09.01,3,USD,"حملة, رمضان 🌙"',
    ].join('\r\n')}\r\n`;
    await user.upload(await fileInput(), csvFile(good, 'good.csv'));
    expect(
      await box.findByText(
        '2 rows for 2 campaigns, from 2026-09-01 to 2026-09-01, are ready to import.',
      ),
    ).toBeInTheDocument();
    expect(box.getByText(/File: good\.csv \(/)).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(await importButton());
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toEqual([
      {
        campaignCode: 'spring_th',
        statDate: '2026-09-01',
        amount: 10.5,
        currency: 'USD',
        remark: 'แคมเปญ, ฤดูใบไม้ผลิ',
      },
      {
        campaignCode: 'ramadan_ar',
        statDate: '2026-09-01',
        amount: 3,
        currency: 'USD',
        remark: 'حملة, رمضان 🌙',
      },
    ]);
  });

  it('numbers the problems of a file by the line in the file, the header being line 1', async () => {
    const { user } = await toCsv();
    await user.upload(
      await fileInput(),
      csvFile(
        [
          'campaign_code,stat_date,cost,currency,remark',
          'spring_th,2026-09-01,1,USD,',
          'spring_th,2026-09-02,-1,USD,',
        ].join('\n'),
      ),
    );
    expect(
      await within(await dialog()).findByText('Line 3: The cost is below 0.'),
    ).toBeInTheDocument();
  });

  it('says what is wrong with the header', async () => {
    const { user } = await toCsv();
    await user.upload(
      await fileInput(),
      csvFile('campaign_code,stat_date,currency\nspring_th,2026-09-01,USD'),
    );
    expect(
      await within(await dialog()).findByText('Line 1: The header has no column "cost".'),
    ).toBeInTheDocument();
  });

  it('does not read a file larger than 5 MB, and says so', async () => {
    const { user } = await toCsv();
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.csv', { type: 'text/csv' });
    const read = vi.spyOn(big, 'text');
    await user.upload(await fileInput(), big);
    expect(
      await within(await dialog()).findByText(
        'The file is larger than 5 MB. Split it into several files.',
      ),
    ).toBeInTheDocument();
    expect(read).not.toHaveBeenCalled();
    expect(await importButton()).toBeDisabled();
  });

  it('says when a file cannot be read', async () => {
    const { user } = await toCsv();
    const broken = csvFile('x');
    vi.spyOn(broken, 'text').mockRejectedValue(new Error('disk'));
    await user.upload(await fileInput(), broken);
    expect(
      await within(await dialog()).findByText('The file could not be read.'),
    ).toBeInTheDocument();
  });

  it('keeps what was entered in each tab, and imports what the tab that is showing has', async () => {
    const { calls, user } = await toCsv();
    const box = within(await dialog());
    expect(await importButton()).toBeDisabled();
    await user.click(box.getByRole('tab', { name: 'JSON' }));
    await putJson(jsonRows([row()]));
    expect(await box.findByText(/ready to import/)).toBeInTheDocument();
    await user.click(box.getByRole('tab', { name: 'CSV' }));
    expect(box.queryByText(/ready to import/)).not.toBeInTheDocument();
    expect(await importButton()).toBeDisabled();
    await user.click(box.getByRole('tab', { name: 'JSON' }));
    expect(await box.findByText(/ready to import/)).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });
});

describe('the texts of the batch dialog', () => {
  it('has a text in both languages for every reason of the reader, with the same blanks', () => {
    for (const reason of BATCH_REASONS) {
      const key = `campaign.batch.reason.${reason}`;
      expect(enUS[key], key).toBeTruthy();
      expect(zhCN[key], key).toBeTruthy();
      const blanks = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(blanks(zhCN[key]), key).toEqual(blanks(enUS[key]));
    }
  });

  it('is written in Chinese too', async () => {
    useMockBackend({ default: campaignMock }, { default: configMock }, { default: channelsMock });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AccountsPage />, 'zh-CN');
    await user.click(await screen.findByRole('tab', { name: '投放成本' }));
    await waitFor(() =>
      expect(
        document.querySelectorAll('.ant-tabs-content-active tbody tr.ant-table-row').length,
      ).toBeGreaterThan(0),
    );
    await user.click(screen.getByRole('button', { name: '批量录入' }));
    await dialog();
    expect(
      within(await dialog()).getByText('这次导入里的行会覆盖已经有成本的投放账户和日期。'),
    ).toBeInTheDocument();
    fireEvent.change(within(await dialog()).getByLabelText('JSON 内容'), {
      target: { value: jsonRows([row(), row({ statDate: '2026-09-02', amount: -3 })]) },
    });
    expect(await within(await dialog()).findByText('第 2 行：花费小于 0。')).toBeInTheDocument();
  });
});
