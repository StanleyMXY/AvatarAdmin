import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch, XLSX_TYPE } from '../../../tests/httpStubs';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub } from '../../../tests/stubs/umi-max';
import { resetSessionState, setToken } from '../../request/session';
import ReportPage from './report';
import { chooseOption, holds, optionTexts } from './testSetup';

const NOW = '2026-10-26T20:00:00Z';

beforeEach(() => {
  resetUmiStub();
  resetSessionState();
  sessionStorage.clear();
  localStorage.clear();
  setToken('tok');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  holds(['COST:VIEW'], { allowedCurrencies: ['USD', 'EUR'] });
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:x');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Row = Record<string, unknown>;
const row = (over: Row = {}): Row => ({
  statDate: '2026-10-25',
  resourceType: 'LLM',
  provider: 'p',
  model: 'model-a',
  unit: 'TOKENS_1M',
  source: 'CALL',
  tier: 'FREE',
  currency: 'USD',
  requests: 10,
  inputTokens: 1000,
  cachedInputTokens: 400,
  outputTokens: 50,
  quantity: null,
  costAmount: '0.1',
  unpricedRequests: 0,
  ...over,
});

const sheet = () =>
  new Response(Uint8Array.from([80, 75, 3, 4]), {
    status: 200,
    headers: {
      'content-type': XLSX_TYPE,
      'content-disposition': 'attachment; filename="usage-cost.xlsx"',
    },
  });

type Backend = {
  rows?: (n: number, query: URLSearchParams) => Row[] | Promise<Row[]>;
  failWith?: { status: number; code: string };
  models?: Row[];
};

const backend = (options: Backend = {}) => {
  let n = 0;
  return stubFetch(async ({ url }) => {
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/admin/stats/usage-cost') {
      if (options.failWith) {
        return jsonResponse(
          options.failWith.status,
          envelope(options.failWith.code, null, 'raw backend words'),
        );
      }
      n += 1;
      return jsonResponse(
        200,
        envelope('200', { items: await (options.rows?.(n, u.searchParams) ?? []) }),
      );
    }
    if (u.pathname === '/api/admin/usage/models') {
      const items = options.models ?? [];
      return jsonResponse(200, envelope('200', { items, total: items.length }));
    }
    if (u.pathname.startsWith('/api/admin/stats/land/'))
      return jsonResponse(200, envelope('200', null));
    if (u.pathname.startsWith('/api/admin/stats/export/')) return sheet();
    return jsonResponse(404, envelope('RESOURCE_NOT_FOUND'));
  });
};

const costCalls = (calls: { url: string }[]) =>
  calls.filter((c) => c.url.startsWith('/api/admin/stats/usage-cost'));
const lastCost = (calls: { url: string }[]) =>
  new URL(costCalls(calls).at(-1)?.url ?? '', 'http://localhost').searchParams;

const ready = async (rows: Backend['rows'] = () => [row()], extra: Omit<Backend, 'rows'> = {}) => {
  const calls = backend({ rows, ...extra });
  renderPage(<ReportPage />);
  await screen.findByTestId('cost-card-total');
  await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
  return calls;
};

const card = (name: string) => screen.getByTestId(`cost-card-${name}`);
const bodyRows = () => [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')];
const cellsOf = (r: Element) => [...r.querySelectorAll('td')].map((td) => td.textContent ?? '');
const headerTexts = () =>
  [...document.querySelectorAll('.ant-table-thead th')].map((h) => h.textContent ?? '');
const chartData = () =>
  [...document.querySelectorAll('[data-testid="chart-column"]')].map(
    (c) =>
      JSON.parse(c.textContent ?? '[]') as { statDate: string; label: string; value: number }[],
  );

describe('the cost report: what it asks for and what it says', () => {
  it('reads the last seven UTC days from the usage-cost report, says the day is UTC, and sends no filter', async () => {
    const calls = backend({ rows: () => [row()] });
    renderPage(<ReportPage />);
    expect(screen.getByText(/Statistics days are UTC days/)).toBeInTheDocument();
    await waitFor(() => expect(costCalls(calls)).toHaveLength(1));
    expect(costCalls(calls)[0].url).toBe(
      '/api/admin/stats/usage-cost?from=2026-10-20&to=2026-10-26',
    );
  });

  it('writes at the top how the cost is worked out: the LLM cost is a lower bound, reconcile against the cloud vendor bill, self-hosted types use the allocation price', async () => {
    await ready();
    const note = screen.getByTestId('cost-note');
    expect(note.textContent).toMatch(
      /calculated from the usage each component reports and the price table/,
    );
    expect(note.textContent).toMatch(/LLM cost is a lower bound/);
    expect(note.textContent).toMatch(
      /cancelled when the user interrupts a call may have no usage, and the vendor still bills it/,
    );
    expect(note.textContent).toMatch(/reconciliation is against the cloud vendor/);
    expect(note.textContent).toMatch(
      /resource types you host yourself depends on the allocation price that operations enter/,
    );
    expect(note.textContent).toMatch(/Requests without a price are only counted, not costed/);
    expect(note.textContent).toMatch(/never added together/);
  });

  it('says the same in Chinese', async () => {
    backend({ rows: () => [row()] });
    renderPage(<ReportPage />, 'zh-CN');
    const note = await screen.findByTestId('cost-note');
    expect(note.textContent).toContain('费用按各组件上报的用量和价格表计算');
    expect(note.textContent).toContain(
      'LLM 费用是下限：用户打断通话时被取消的 LLM 请求可能没有用量，厂商仍会计费，LLM 对账以云厂商账单为准',
    );
    expect(note.textContent).toContain('自己部署的资源类型的费用取决于运营填的分摊价格');
    expect(note.textContent).toContain('没有价格的请求只计次数');
  });

  it('shows what failed in the words of the error code, never the backend words, with a retry', async () => {
    backend({ failWith: { status: 500, code: 'INTERNAL_ERROR' } });
    renderPage(<ReportPage />);
    const alert = (await screen.findByText(/Failed to load/)).closest(
      '[role="alert"]',
    ) as HTMLElement;
    expect(alert.textContent).not.toContain('raw backend words');
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('only asks again when Search is pressed, and sends the filters that were chosen then', async () => {
    const calls = await ready();
    const user = userEvent.setup();
    await chooseOption(user, 'Resource type', 'Image to video');
    await chooseOption(user, 'Source', 'Text chat');
    await chooseOption(user, 'User type', 'Guest');
    await chooseOption(user, 'Currency', 'No cost');
    await user.type(screen.getByRole('combobox', { name: 'Model' }), '  โมเดล  ');
    expect(costCalls(calls)).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(costCalls(calls)).toHaveLength(2));
    const q = lastCost(calls);
    expect(q.get('resourceType')).toBe('IMAGE_TO_VIDEO');
    expect(q.get('source')).toBe('TEXT');
    expect(q.get('tier')).toBe('GUEST');
    expect(q.get('currency')).toBe('NONE');
    expect(q.get('model')).toBe('โมเดล');
    expect(q.get('from')).toBe('2026-10-20');
  });

  it('offers the allowed currencies and "No cost" in the currency filter, and the five user types', async () => {
    await ready();
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: 'Currency' }));
    expect(optionTexts()).toEqual(expect.arrayContaining(['USD', 'EUR', 'No cost']));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('combobox', { name: 'User type' }));
    expect(optionTexts()).toEqual(
      expect.arrayContaining(['Guest', 'Free', 'Paid', 'System', 'Unknown']),
    );
  });

  it('suggests the models that are registered when typing a model name', async () => {
    await ready(() => [row()], {
      models: [
        {
          id: '1',
          resourceType: 'LLM',
          provider: 'p',
          model: 'model-suggested',
          hasActivePrice: true,
        },
      ],
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: 'Model' }));
    expect(
      await screen.findByText('model-suggested', { selector: '.ant-select-item-option-content' }),
    ).toBeInTheDocument();
  });

  it('never lets an older answer replace a newer one', async () => {
    let releaseFirst: (rows: Row[]) => void = () => {};
    const first = new Promise<Row[]>((resolve) => {
      releaseFirst = resolve;
    });
    const calls = backend({ rows: (n) => (n === 1 ? first : [row({ costAmount: '7' })]) });
    const user = userEvent.setup();
    renderPage(<ReportPage />);
    await waitFor(() => expect(costCalls(calls)).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(within(card('total')).getByTestId('cost-total-USD').textContent).toBe('USD 7.00'),
    );
    releaseFirst([row({ costAmount: '99' })]);
    await new Promise((r) => setTimeout(r, 30));
    expect(within(card('total')).getByTestId('cost-total-USD').textContent).toBe('USD 7.00');
  });
});

describe('the cost report: the cards', () => {
  it('has three cards: total cost, requests, requests without a price', async () => {
    await ready();
    const ids = [...document.querySelectorAll('[data-testid^="cost-card-"]')].map((c) =>
      c.getAttribute('data-testid'),
    );
    expect(ids).toEqual(['cost-card-total', 'cost-card-requests', 'cost-card-unpriced']);
    expect(card('total').textContent).toContain('Total cost');
    expect(card('requests').textContent).toContain('Requests');
    expect(card('unpriced').textContent).toContain('Requests without a price');
  });

  it('shows each currency on its own line and never adds one currency to another', async () => {
    await ready(() => [
      row({ currency: 'USD', costAmount: '1.10' }),
      row({ currency: 'EUR', costAmount: '2.20' }),
      row({ currency: 'USD', costAmount: '0.20', model: 'model-b' }),
    ]);
    expect(within(card('total')).getByTestId('cost-total-USD').textContent).toBe('USD 1.30');
    expect(within(card('total')).getByTestId('cost-total-EUR').textContent).toBe('EUR 2.20');
    expect(card('total').textContent).not.toContain('3.50');
    expect(card('total').textContent).not.toContain('3.5');
  });

  it('adds money exactly (three times 0.1 is 0.30, not 0.30000000000000004) and shows at most six decimals', async () => {
    await ready(() => [
      row({ costAmount: '0.1' }),
      row({ costAmount: '0.1', model: 'b' }),
      row({ costAmount: '0.1', model: 'c' }),
    ]);
    expect(within(card('total')).getByTestId('cost-total-USD').textContent).toBe('USD 0.30');
    expect(card('total').textContent).not.toMatch(/e-|\d{7}/);
  });

  it('shows a very small amount as below one millionth, never as an exponent or as zero', async () => {
    await ready(() => [row({ costAmount: '0.0000000001' })]);
    expect(within(card('total')).getByTestId('cost-total-USD').textContent).toBe('USD <0.000001');
  });

  it('shows a dash for the total when no request had a cost, and 0 for the counts', async () => {
    await ready(() => []);
    expect(within(card('total')).getByTestId('cost-value').textContent).toBe('—');
    expect(within(card('requests')).getByTestId('cost-value').textContent).toBe('0');
    expect(within(card('unpriced')).getByTestId('cost-value').textContent).toBe('0');
  });

  it('shows a real zero total as 0', async () => {
    await ready(() => [row({ costAmount: '0' })]);
    expect(within(card('total')).getByTestId('cost-total-USD').textContent).toBe('USD 0');
  });

  it('counts the requests of every group and the requests without a price', async () => {
    await ready(() => [
      row({ requests: 1200 }),
      row({
        currency: 'NONE',
        costAmount: null,
        requests: 30,
        unpricedRequests: 30,
        model: 'model-b',
      }),
    ]);
    expect(within(card('requests')).getByTestId('cost-value').textContent).toBe('1,230');
    expect(within(card('unpriced')).getByTestId('cost-value').textContent).toBe('30');
  });

  it('sends the click on the unpriced card to the models tab of the price page, filtered to "no price in force"', async () => {
    await ready();
    const link = within(card('unpriced')).getByRole('link');
    expect(link.getAttribute('href')).toBe('/cost/prices?tab=models&hasPrice=false');
  });

  it('never shows a negative figure: a negative cost, count or quantity from the backend is not shown as a number', async () => {
    await ready(() => [
      row({ costAmount: '-5', requests: -4, inputTokens: -1, unpricedRequests: -2 }),
    ]);
    expect(card('total').textContent).not.toContain('-');
    expect(within(card('requests')).getByTestId('cost-value').textContent).toBe('0');
    expect(within(card('unpriced')).getByTestId('cost-value').textContent).toBe('0');
    expect(document.querySelector('.ant-table-tbody')?.textContent).not.toMatch(/-\d/);
  });
});

describe('the cost report: the table', () => {
  it('has the columns of the spec', async () => {
    await ready();
    expect(headerTexts()).toEqual([
      'Resource type',
      'Model',
      'Source',
      'User type',
      'Currency',
      'Requests',
      'Input tokens',
      'Cached input tokens',
      'Output tokens',
      'Quantity and unit',
      'Cost',
      'Without a price',
    ]);
  });

  it('adds the days of one model, source and user type into a single row', async () => {
    await ready(() => [
      row({
        statDate: '2026-10-24',
        requests: 10,
        inputTokens: 100,
        cachedInputTokens: 10,
        outputTokens: 5,
        costAmount: '0.1',
      }),
      row({
        statDate: '2026-10-25',
        requests: 20,
        inputTokens: 200,
        cachedInputTokens: 20,
        outputTokens: 7,
        costAmount: '0.2',
      }),
    ]);
    expect(bodyRows()).toHaveLength(1);
    expect(cellsOf(bodyRows()[0])).toEqual([
      'LLM (per million tokens)',
      'model-a',
      'Call',
      'Free',
      'USD',
      '30',
      '300',
      '30',
      '12',
      '—',
      'USD 0.30',
      '0',
    ]);
  });

  it('shows the quantity and the unit of a type that is not LLM, and dashes in the token columns', async () => {
    await ready(() => [
      row({
        resourceType: 'IMAGE_TO_VIDEO',
        unit: 'SECOND',
        source: 'GENERATION',
        inputTokens: null,
        cachedInputTokens: null,
        outputTokens: null,
        quantity: 12.5,
        costAmount: '1.25',
      }),
    ]);
    expect(cellsOf(bodyRows()[0])).toEqual([
      'Image to video',
      'model-a',
      'Avatar generation',
      'Free',
      'USD',
      '10',
      '—',
      '—',
      '—',
      '12.5 s',
      'USD 1.25',
      '0',
    ]);
  });

  it('shows calls and minutes for the other units', async () => {
    await ready(() => [
      row({
        resourceType: 'MATTING',
        unit: 'CALL',
        model: 'm1',
        quantity: 40,
        inputTokens: null,
        cachedInputTokens: null,
        outputTokens: null,
        costAmount: '0',
      }),
      row({
        resourceType: 'CLOUD_RENDER',
        unit: 'MINUTE',
        model: 'm2',
        quantity: 3,
        inputTokens: null,
        cachedInputTokens: null,
        outputTokens: null,
        costAmount: '0.5',
      }),
    ]);
    const texts = bodyRows().map((r) => cellsOf(r)[9]);
    expect(texts).toEqual(['40 calls', '3 min']);
  });

  it('puts the requests that had no price in a group called "No cost", counted but with a dash for the cost', async () => {
    await ready(() => [
      row({ costAmount: '0.5' }),
      row({ currency: 'NONE', costAmount: null, requests: 25, unpricedRequests: 25 }),
    ]);
    const rows = bodyRows().map(cellsOf);
    const none = rows.find((r) => r[4] === 'No cost') as string[];
    expect(none).toBeTruthy();
    expect(none[5]).toBe('25');
    expect(none[10]).toBe('—');
    expect(none[11]).toBe('25');
    expect(rows.find((r) => r[4] === 'USD')?.[10]).toBe('USD 0.50');
  });

  it('keeps currencies in separate rows', async () => {
    await ready(() => [
      row({ currency: 'USD', costAmount: '1' }),
      row({ currency: 'EUR', costAmount: '2' }),
    ]);
    const rows = bodyRows().map(cellsOf);
    expect(rows.map((r) => r[4]).sort()).toEqual(['EUR', 'USD']);
    expect(rows.map((r) => r[10]).sort()).toEqual(['EUR 2.00', 'USD 1.00']);
  });

  it('shows a real 0 as 0 and a missing value as a dash', async () => {
    await ready(() => [
      row({
        requests: 0,
        inputTokens: 0,
        cachedInputTokens: null,
        outputTokens: 0,
        costAmount: '0',
      }),
    ]);
    expect(cellsOf(bodyRows()[0]).slice(5, 11)).toEqual(['0', '0', '—', '0', '—', 'USD 0']);
  });

  it('says there is no usage when the backend sent nothing', async () => {
    await ready(() => []);
    expect(bodyRows()).toHaveLength(0);
    expect(screen.getByText('No usage in this range.')).toBeInTheDocument();
  });

  it('writes model names of every language, an emoji and 5000 characters without a space as plain text, in a cell that breaks anywhere', async () => {
    const names = [
      'โมเดลภาษาไทย',
      'نموذج-كبير',
      'modelo-grande',
      'mô-hình',
      'model-besar',
      '模型',
      `L${'x'.repeat(5000)}`,
      'emoji-😀',
      '<b>bold</b>',
    ];
    await ready(() => names.map((model) => row({ model })));
    const cells = bodyRows().map((r) => cellsOf(r)[1]);
    for (const name of names) expect(cells.some((c) => c.includes(name.slice(0, 20)))).toBe(true);
    expect(document.querySelector('.ant-table-tbody b')).toBeNull();
    for (const el of document.querySelectorAll('.ant-table-tbody td:nth-child(2) > button')) {
      const style = (el as HTMLElement).style;
      expect(`${style.overflowWrap} ${style.wordBreak}`).toMatch(/anywhere|break-word/);
    }
  });

  it('does not throw on a field of another type: an object or a number as the model', async () => {
    await ready(() => [row({ model: { a: 1 } }), row({ model: 123 })]);
    expect(bodyRows().length).toBe(2);
  });
});

describe('the cost report: the chart of the daily cost by model', () => {
  it('draws one stacked chart for each currency, a point for every day and model', async () => {
    await ready(() => [
      row({ statDate: '2026-10-25', model: 'a', costAmount: '1' }),
      row({ statDate: '2026-10-26', model: 'b', costAmount: '2' }),
      row({ statDate: '2026-10-26', model: 'c', currency: 'EUR', costAmount: '3' }),
    ]);
    const charts = [...document.querySelectorAll('[data-testid="chart-column"]')];
    expect(charts).toHaveLength(2);
    const config = (c: Element) => JSON.parse(c.getAttribute('data-config') ?? '{}');
    for (const chart of charts) {
      expect(config(chart).stack).toBe(true);
      expect(config(chart).xField).toBe('statDate');
    }
    const titles = screen.getAllByTestId('cost-chart-title').map((t) => t.textContent);
    expect(titles).toEqual(['Daily cost by model (EUR)', 'Daily cost by model (USD)']);
    const usd = chartData()[1];
    expect(usd).toHaveLength(7 * 2);
    expect(usd.find((p) => p.statDate === '2026-10-25' && p.label === 'a')?.value).toBe(1);
    expect(usd.find((p) => p.statDate === '2026-10-20' && p.label === 'a')?.value).toBe(0);
  });

  it('writes the unit of the vertical axis, with the currency', async () => {
    await ready();
    const config = JSON.parse(
      document.querySelector('[data-testid="chart-column"]')?.getAttribute('data-config') ?? '{}',
    );
    expect(config.axis.y.title).toBe('Cost (USD)');
    expect(config.axis.x.title).toBe('Date (UTC)');
  });

  it('does not draw the no-cost group and says so when there is no cost at all', async () => {
    await ready(() => [row({ currency: 'NONE', costAmount: null, unpricedRequests: 10 })]);
    expect(document.querySelector('[data-testid="chart-column"]')).toBeNull();
    expect(
      screen.getByText('There is no cost in this range, so there is nothing to draw.'),
    ).toBeInTheDocument();
  });

  it('gives a model with a very long name a short, unique legend entry', async () => {
    const long1 = `${'ก'.repeat(100)}1`;
    const long2 = `${'ก'.repeat(100)}2`;
    await ready(() => [row({ model: long1 }), row({ model: long2, costAmount: '2' })]);
    const labels = [...new Set(chartData()[0].map((p) => p.label))];
    expect(labels).toHaveLength(2);
    for (const label of labels) expect([...label].length).toBeLessThanOrEqual(40);
  });
});

describe('the cost report: export and landing (permissions)', () => {
  it('shows neither button to someone with only COST:VIEW', async () => {
    holds(['COST:VIEW']);
    await ready();
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Re-land this day' })).toBeNull();
  });

  it('export needs STATS:EXPORT together with COST:VIEW (STATS:EXPORT alone, or COST:VIEW alone, is not enough)', async () => {
    holds(['STATS:EXPORT']);
    await ready();
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
  });

  it('export is there with both codes and sends the filters that were applied, under the name usage-cost', async () => {
    holds(['COST:VIEW', 'STATS:EXPORT']);
    const calls = await ready();
    const user = userEvent.setup();
    await chooseOption(user, 'Resource type', 'Matting');
    // not applied yet: the export still uses the range and filters of the last Search
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() =>
      expect(calls.some((c) => c.url.startsWith('/api/admin/stats/export/usage-cost'))).toBe(true),
    );
    expect(calls.find((c) => c.url.startsWith('/api/admin/stats/export/usage-cost'))?.url).toBe(
      '/api/admin/stats/export/usage-cost?from=2026-10-20&to=2026-10-26',
    );
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(costCalls(calls)).toHaveLength(2));
    // the spinner of the finished export keeps its leave animation in happy-dom, so it is in the name
    await user.click(await screen.findByRole('button', { name: /Export$/ }));
    await waitFor(() =>
      expect(
        calls.filter((c) => c.url.startsWith('/api/admin/stats/export/usage-cost')),
      ).toHaveLength(2),
    );
    expect(calls.filter((c) => c.url.startsWith('/api/admin/stats/export/usage-cost'))[1].url).toBe(
      '/api/admin/stats/export/usage-cost?from=2026-10-20&to=2026-10-26&resourceType=MATTING',
    );
  });

  it('re-landing needs STATS:LAND, lands usage-cost for the UTC yesterday, and a second click sends one request', async () => {
    holds(['COST:VIEW', 'STATS:LAND']);
    const calls = await ready();
    const user = userEvent.setup();
    const button = screen.getByRole('button', { name: 'Re-land this day' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() =>
      expect(
        calls.filter((c) => c.url.startsWith('/api/admin/stats/land/')).length,
      ).toBeGreaterThan(0),
    );
    await new Promise((r) => setTimeout(r, 30));
    const lands = calls.filter((c) => c.url.startsWith('/api/admin/stats/land/'));
    expect(lands).toHaveLength(1);
    expect(lands[0].url).toBe('/api/admin/stats/land/usage-cost?date=2026-10-25');
    expect(lands[0].init.method).toBe('POST');
    // and the report is read again
    await waitFor(() => expect(costCalls(calls)).toHaveLength(2));
    expect(user).toBeTruthy();
  });
});
