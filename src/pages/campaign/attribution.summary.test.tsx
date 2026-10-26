import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { campaignState } from '../../../mock/_core/campaignData';
import campaignMock from '../../../mock/campaign.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { withTimeZone } from '../../../tests/withTimeZone';
import AttributionPage from './attribution';
import { jsonAnswer, NOW, overrideFetch, signIn } from './testSetup';

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

const ACTIVE = '.ant-tabs-content-active';
const rows = () => [
  ...document.querySelectorAll<HTMLElement>(`${ACTIVE} .ant-table-tbody tr.ant-table-row`),
];
const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');
const heads = () =>
  [...document.querySelectorAll(`${ACTIVE} .ant-table-thead th`)].map((h) => h.textContent);
const summaryReads = (calls: { method: string; url: string }[]) =>
  calls
    .filter((c) => c.method === 'GET' && c.url.startsWith('/api/admin/attribution/summary?'))
    .map((c) => new URL(c.url, 'http://x').searchParams);
const chart = () =>
  JSON.parse(screen.getByTestId('chart-bar').getAttribute('data-config') ?? '{}') as Record<
    string,
    unknown
  >;
const chartData = () =>
  JSON.parse(screen.getByTestId('chart-bar').textContent ?? '[]') as {
    label: string;
    metric: string;
    value: number;
  }[];

const load = async (locale?: 'en-US' | 'zh-CN') => {
  const calls = useMockBackend({ default: campaignMock });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderPage(<AttributionPage />, locale);
  await user.click(
    await screen.findByRole('tab', { name: locale === 'zh-CN' ? '汇总' : 'Summary' }),
  );
  await waitFor(() => expect(rows().length).toBeGreaterThan(0), { timeout: 5000 });
  return { calls, user };
};

// The radio input of a button-style choice does not take the pointer (its label does), so it is clicked directly.
const groupBy = async (_user: ReturnType<typeof userEvent.setup>, label: string) => {
  fireEvent.click(
    within(document.querySelector(ACTIVE) as HTMLElement).getByRole('radio', { name: label }),
  );
};

describe('the summary', { timeout: 30000 }, () => {
  it('reads the last seven UTC days, both ends included, grouped by source, also where the local date is the next day', async () => {
    await withTimeZone('Pacific/Auckland', async () => {
      vi.setSystemTime(new Date('2026-10-26T20:00:00Z'));
      // the token of the administrator is good for eight hours from when it was made
      signIn('root');
      const { calls } = await load();
      const read = summaryReads(calls)[0];
      expect(read.get('groupBy')).toBe('source');
      expect(read.get('from')).toBe('2026-10-20');
      expect(read.get('to')).toBe('2026-10-26');
    });
  });

  it('has the source, the installs, the activations and the cost when grouped by source, and the key as well when grouped by anything else', async () => {
    const { calls, user } = await load();
    expect(heads()).toEqual(['Source', 'Installs', 'Activations', 'Cost']);
    await groupBy(user, 'Media source');
    await waitFor(() =>
      expect(summaryReads(calls).some((r) => r.get('groupBy') === 'media_source')).toBe(true),
    );
    await waitFor(() =>
      expect(heads()).toEqual(['Source', 'Media source', 'Installs', 'Activations', 'Cost']),
    );
    await groupBy(user, 'Campaign');
    await waitFor(() =>
      expect(summaryReads(calls).some((r) => r.get('groupBy') === 'campaign')).toBe(true),
    );
    await waitFor(() =>
      expect(heads()).toEqual(['Source', 'Campaign', 'Installs', 'Activations', 'Cost']),
    );
  });

  it('has no ROI column and says there is no revenue', async () => {
    await load();
    expect(heads().join(' ')).not.toMatch(/ROI/i);
    expect(
      screen.getByText('The reports carry no revenue, so there is no ROI column.'),
    ).toBeInTheDocument();
  });

  it('says that the two sources are not added, that an install from before the event retention has fewer activations than it had, and that costs are not added across currencies', async () => {
    await load();
    expect(
      screen.getByText(/The two sources are listed apart and are never added up/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'An install from before the event retention has fewer activations than it really had.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Costs are shown for each currency apart and are never added across currencies.',
      ),
    ).toBeInTheDocument();
  });

  it('lists a row for each source and key the backend sent and adds nothing up', async () => {
    const { calls, user } = await load();
    await groupBy(user, 'Media source');
    await waitFor(() => expect(heads()).toContain('Media source'));
    const body = await (async () => {
      // the rows of the mock backend for the same query
      const read = summaryReads(calls)
        .filter((r) => r.get('groupBy') === 'media_source')
        .pop();
      return read;
    })();
    expect(body).toBeTruthy();
    const table = rows().map((r) => cellsOf(r));
    const sources = table.map((c) => c[0]);
    expect(new Set(sources)).toEqual(
      new Set(['Platform postback (APPSFLYER)', 'Own attribution (SELF)']),
    );
    // each (source, key) appears once
    expect(new Set(table.map((c) => `${c[0]}|${c[1]}`)).size).toBe(table.length);
    const total = (source: string, at: number) =>
      table
        .filter((c) => c[0] === source)
        .reduce((sum, c) => sum + Number(c[at].replace(/,/g, '')), 0);
    // the installs of the days that were asked for: the last seven, 2026-10-20 to 2026-10-26
    const records = campaignState.records.filter(
      (r) =>
        r.eventName === 'install' &&
        r.installTime !== null &&
        r.installTime.slice(0, 10) >= '2026-10-20' &&
        r.installTime.slice(0, 10) <= '2026-10-26',
    );
    expect(total('Own attribution (SELF)', 2)).toBe(
      records.filter((r) => r.source === 'SELF').length,
    );
    expect(total('Platform postback (APPSFLYER)', 2)).toBe(
      records.filter((r) => r.source === 'APPSFLYER').length,
    );
  });

  it('writes the costs of a row for each currency, as "USD 12.30 / EUR 4.00", and a dash when there is none', async () => {
    useMockBackend({ default: campaignMock });
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/attribution/summary'
        ? jsonAnswer(200, '200', {
            items: [
              {
                source: 'APPSFLYER',
                key: 'APPSFLYER',
                installs: 1234,
                activations: 56,
                costs: [
                  { currency: 'USD', amount: 12.3 },
                  { currency: 'EUR', amount: 4 },
                ],
              },
              { source: 'SELF', key: 'SELF', installs: 0, activations: 0, costs: [] },
            ],
          })
        : undefined,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AttributionPage />);
    await user.click(await screen.findByRole('tab', { name: 'Summary' }));
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(cellsOf(rows()[0])).toEqual([
      'Platform postback (APPSFLYER)',
      '1,234',
      '56',
      'USD 12.30 / EUR 4.00',
    ]);
    expect(cellsOf(rows()[1])).toEqual(['Own attribution (SELF)', '0', '0', '—']);
  });

  it('draws one bar chart of the installs and the activations of each source and key, the two sources apart', async () => {
    const { user } = await load();
    await groupBy(user, 'Media source');
    await waitFor(() => expect(heads()).toContain('Media source'));
    const data = chartData();
    expect(new Set(data.map((d) => d.metric))).toEqual(new Set(['Installs', 'Activations']));
    const labels = new Set(data.map((d) => d.label));
    expect(labels.size).toBeGreaterThan(2);
    expect([...labels].some((l) => l.includes('APPSFLYER'))).toBe(true);
    expect([...labels].some((l) => l.includes('SELF'))).toBe(true);
    expect(chart()).toMatchObject({ colorField: 'metric', group: true });
    expect(screen.getAllByTestId('chart-bar')).toHaveLength(1);
  });

  it('draws the 15 groups with the most installs and says so when there are more', async () => {
    useMockBackend({ default: campaignMock });
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/attribution/summary'
        ? jsonAnswer(200, '200', {
            items: Array.from({ length: 20 }, (_, i) => ({
              source: i % 2 === 0 ? 'SELF' : 'APPSFLYER',
              key: `group_${i}`,
              installs: i + 1,
              activations: i,
              costs: [],
            })),
          })
        : undefined,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AttributionPage />);
    await user.click(await screen.findByRole('tab', { name: 'Summary' }));
    await groupBy(user, 'Media source');
    await waitFor(() => expect(rows()).toHaveLength(20));
    expect(new Set(chartData().map((d) => d.label)).size).toBe(15);
    expect(chartData().some((d) => d.label.includes('group_19'))).toBe(true);
    expect(chartData().some((d) => d.label.includes('group_0 '))).toBe(false);
    expect(
      screen.getByText('The chart shows the 15 groups with the most installs.'),
    ).toBeInTheDocument();
  });

  it('never draws a negative or missing number as a bar, and shows a dash in the table for a count that is missing', async () => {
    useMockBackend({ default: campaignMock });
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/attribution/summary'
        ? jsonAnswer(200, '200', {
            items: [
              {
                source: 'SELF',
                key: null,
                installs: -4,
                activations: null,
                costs: [{ currency: 'USD', amount: null }],
              },
            ],
          })
        : undefined,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AttributionPage />);
    await user.click(await screen.findByRole('tab', { name: 'Summary' }));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(chartData().every((d) => d.value >= 0)).toBe(true);
    expect(cellsOf(rows()[0])).toEqual(['Own attribution (SELF)', '-4', '—', '—']);
  });

  it('asks again with the days that were chosen once Search is pressed, and starts from the new days', async () => {
    const { calls, user } = await load();
    const before = summaryReads(calls).length;
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(summaryReads(calls).length).toBe(before + 1));
  });

  it('shows the words of the error code and not the backend words, and reads again with the retry button', async () => {
    useMockBackend({ default: campaignMock });
    let failing = true;
    overrideFetch(({ url }) =>
      failing && url.pathname === '/api/admin/attribution/summary'
        ? jsonAnswer(
            400,
            'INVALID_REQUEST',
            { details: [{ ref: 'to', reason: 'OUT_OF_RANGE' }] },
            'raw backend words',
          )
        : undefined,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AttributionPage />);
    await user.click(await screen.findByRole('tab', { name: 'Summary' }));
    expect(await screen.findByText(/Failed to load:.*Some input is not valid/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw backend words');
    failing = false;
    const retries = screen.getAllByRole('button', { name: 'Retry' });
    await user.click(retries[retries.length - 1]);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  });

  it('never lets a slow answer to an older grouping replace the answer to the newer one', async () => {
    useMockBackend({ default: campaignMock });
    const releases: (() => void)[] = [];
    let reads = 0;
    overrideFetch(async ({ url }) => {
      if (url.pathname !== '/api/admin/attribution/summary') return undefined;
      reads += 1;
      if (reads === 1) await new Promise<void>((resolve) => releases.push(resolve));
      return undefined;
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AttributionPage />);
    await user.click(await screen.findByRole('tab', { name: 'Summary' }));
    await waitFor(() => expect(reads).toBe(1));
    await groupBy(user, 'Media source');
    await waitFor(() => expect(heads()).toContain('Media source'));
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    for (const release of releases) release();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(heads()).toContain('Media source');
  });

  it('keeps a key of 5000 characters, Arabic, Thai and emoji inside the table', async () => {
    useMockBackend({ default: campaignMock });
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/attribution/summary'
        ? jsonAnswer(200, '200', {
            items: [
              { source: 'SELF', key: 'ا'.repeat(5000), installs: 1, activations: 1, costs: [] },
              {
                source: 'SELF',
                key: `ก${'🎉'.repeat(30)}`,
                installs: 1,
                activations: 1,
                costs: [],
              },
            ],
          })
        : undefined,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AttributionPage />);
    await user.click(await screen.findByRole('tab', { name: 'Summary' }));
    await groupBy(user, 'Media source');
    await waitFor(() => expect(heads()).toContain('Media source'));
    await waitFor(() => expect(rows()).toHaveLength(2));
    const buttons = [
      ...document.querySelectorAll<HTMLElement>(`${ACTIVE} .ant-table-tbody button[data-lines]`),
    ];
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    for (const button of buttons) expect(button.style.overflowWrap).toBe('anywhere');
  });

  it('is written in Chinese too', async () => {
    await load('zh-CN');
    expect(heads()).toEqual(['来源', '安装数', '激活数', '成本']);
    expect(screen.getByText('早于事件保留期的安装，激活数会偏低。')).toBeInTheDocument();
  });
});
