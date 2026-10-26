import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { campaignState } from '../../../mock/_core/campaignData';
import campaignMock from '../../../mock/campaign.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { withTimeZone } from '../../../tests/withTimeZone';
import AttributionPage from './attribution';
import { chooseOption, jsonAnswer, NOW, overrideFetch, signIn } from './testSetup';

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
const recordReads = (calls: { method: string; url: string }[]) =>
  calls
    .filter((c) => c.method === 'GET' && c.url.startsWith('/api/admin/attribution/records?'))
    .map((c) => new URL(c.url, 'http://x').searchParams);

const load = async (locale?: 'en-US' | 'zh-CN') => {
  const calls = useMockBackend({ default: campaignMock });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderPage(<AttributionPage />, locale);
  await user.click(
    await screen.findByRole('tab', {
      name: locale === 'zh-CN' ? '安装与注册' : 'Installs and registrations',
    }),
  );
  await waitFor(() => expect(rows().length).toBeGreaterThan(0), { timeout: 5000 });
  return { calls, user };
};

const HEADS = [
  'ID',
  'Source',
  'Event',
  'Event time',
  'Conversion type',
  'Ad type',
  'Media source',
  'Campaign',
  'Ad set',
  'Ad',
  'Install time',
  'Retargeting',
  'Platform',
  'Country',
  'App version',
  'Cost',
  'Cost model',
  'Cost in selected currency',
  'Account ID',
  'Registered at',
  'Match type',
  'Campaign (own attribution)',
];
const col = (name: string) => HEADS.indexOf(name);

describe('the installs and registrations', { timeout: 30000 }, () => {
  it('has the fields of the backend as columns, in the order of the reply, and no column for a device or a platform identifier', async () => {
    await load();
    expect(heads()).toEqual(HEADS);
    for (const head of heads()) expect(head).not.toMatch(/device|advertis|appsflyer id|idfa|gaid/i);
  });

  it('reads the last seven UTC days as instants, the end not included, from page 1 with 20 rows, also where the local date is the next day', async () => {
    await withTimeZone('Pacific/Auckland', async () => {
      vi.setSystemTime(new Date('2026-10-26T20:00:00Z'));
      // the token of the administrator is good for eight hours from when it was made
      signIn('root');
      const { calls } = await load();
      const read = recordReads(calls)[0];
      expect(read.get('from')).toBe('2026-10-20T00:00:00Z');
      expect(read.get('to')).toBe('2026-10-27T00:00:00Z');
      expect(read.get('page')).toBe('1');
      expect(read.get('pageSize')).toBe('20');
      expect(read.has('source')).toBe(false);
      expect(read.has('matchType')).toBe(false);
    });
  });

  it('shows the source and the match type in words, and a dash for the match type of the other source', async () => {
    await load();
    const all = rows().map((r) => cellsOf(r));
    for (const cells of all) {
      const own = cells[col('Source')] === 'Own attribution (SELF)';
      expect(cells[col('Match type')] === '—', cells.join('|')).toBe(!own);
    }
    expect(new Set(all.map((c) => c[col('Source')]))).toEqual(
      new Set(['Platform postback (APPSFLYER)', 'Own attribution (SELF)']),
    );
  });

  it('says in the head and at the fingerprint that the fingerprint is less reliable', async () => {
    const { user } = await load();
    // the head is drawn twice by the table (the fixed head and the measuring row)
    expect(screen.getAllByTestId('tip-matchType').length).toBeGreaterThan(0);
    await user.hover(screen.getAllByTestId('tip-matchType')[0]);
    expect(await screen.findByText(/The fingerprint is a last resort/)).toBeInTheDocument();
    const fingerprint = rows()
      .map((r) => cellsOf(r))
      .find((c) => c[col('Match type')].startsWith('Fingerprint'));
    expect(fingerprint?.[col('Match type')]).toContain('Less reliable');
    const exact = rows()
      .map((r) => cellsOf(r))
      .find((c) => c[col('Match type')].startsWith('Package'));
    expect(exact?.[col('Match type')]).not.toContain('Less reliable');
  });

  it('writes a cost with two decimals and its currency, a cost in the selected currency with two decimals, and a dash where there is none', async () => {
    await load();
    const withCost = rows()
      .map((r) => cellsOf(r))
      .find((c) => c[col('Cost')] !== '—') as string[];
    expect(withCost[col('Cost')]).toMatch(/^[\d,]+\.\d{2} (USD|EUR)$/);
    expect(withCost[col('Cost in selected currency')]).toMatch(/^[\d,]+\.\d{2}$/);
    expect(withCost[col('Cost model')]).toBe('CPI');
    const without = rows()
      .map((r) => cellsOf(r))
      .find((c) => c[col('Cost')] === '—') as string[];
    expect(without[col('Cost model')]).toBe('—');
    expect(without[col('Cost in selected currency')]).toBe('—');
  });

  it('links the account to its detail, and shows a dash for a record that has no account', async () => {
    await load();
    const linked = rows().find((r) => r.querySelector('a[href^="/users/"]')) as HTMLElement;
    const link = linked.querySelector('a[href^="/users/"]') as HTMLAnchorElement;
    expect(link.textContent).toMatch(/^\d+$/);
    expect(link.getAttribute('href')).toBe(`/users/${link.textContent}`);
    expect(rows().some((r) => cellsOf(r)[col('Account ID')] === '—')).toBe(true);
    expect(rows().some((r) => cellsOf(r)[col('Registered at')] === '—')).toBe(true);
  });

  it('shows Yes, No or a dash for whether the install is a retargeting one', async () => {
    useMockBackend({ default: campaignMock });
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/attribution/records'
        ? jsonAnswer(200, '200', {
            items: [true, false, null].map((isRetargeting, i) => ({
              id: String(i),
              source: 'SELF',
              eventName: 'install',
              eventTime: '2026-10-25T10:00:00Z',
              isRetargeting,
            })),
            total: 3,
          })
        : undefined,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AttributionPage />);
    await user.click(await screen.findByRole('tab', { name: 'Installs and registrations' }));
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(rows().map((r) => cellsOf(r)[col('Retargeting')])).toEqual(['Yes', 'No', '—']);
  });

  it('names the campaign of the own attribution from the list of campaigns, and keeps the id for one that is not in it', async () => {
    await load();
    const own = rows()
      .map((r) => cellsOf(r))
      .filter((c) => c[col('Source')] === 'Own attribution (SELF)');
    for (const cells of own) {
      expect(
        campaignState.campaigns.some((c) => c.name === cells[col('Campaign (own attribution)')]),
      ).toBe(true);
    }
    const other = rows()
      .map((r) => cellsOf(r))
      .filter((c) => c[col('Source')] !== 'Own attribution (SELF)');
    for (const cells of other) expect(cells[col('Campaign (own attribution)')]).toBe('—');
  });

  it('asks for the source and the match type that were chosen, once Search is pressed, and offers only the values of the backend', async () => {
    const { calls, user } = await load();
    const before = recordReads(calls).length;
    // the options of the select that is open, and a click on one of them
    const open = async (label: string) => {
      await user.click(screen.getByRole('combobox', { name: label }));
      // the last dropdown is the one that was just opened; a closed one stays in the page
      const dropdowns = document.querySelectorAll('.ant-select-dropdown');
      return [
        ...dropdowns[dropdowns.length - 1].querySelectorAll<HTMLElement>(
          '.ant-select-item-option-content',
        ),
      ];
    };
    const sources = await open('Source');
    expect(sources.map((o) => o.textContent)).toEqual([
      'All',
      'Platform postback (APPSFLYER)',
      'Own attribution (SELF)',
    ]);
    await user.click(sources[2]);
    const types = await open('Match type');
    expect(types.map((o) => o.textContent)).toEqual([
      'All',
      'Package signature block (APK_BLOCK)',
      'Store referrer (REFERRER)',
      'Fingerprint (FINGERPRINT)',
    ]);
    await user.click(types[3]);
    expect(recordReads(calls)).toHaveLength(before);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(recordReads(calls).length).toBe(before + 1));
    const read = recordReads(calls)[before];
    expect(read.get('source')).toBe('SELF');
    expect(read.get('matchType')).toBe('FINGERPRINT');
    await waitFor(() =>
      expect(rows().every((r) => cellsOf(r)[col('Match type')].startsWith('Fingerprint'))).toBe(
        true,
      ),
    );
  });

  it('shows the words of the error code and not the backend words, and reads again with the retry button', async () => {
    useMockBackend({ default: campaignMock });
    let failing = true;
    overrideFetch(({ url }) =>
      failing && url.pathname === '/api/admin/attribution/records'
        ? jsonAnswer(
            400,
            'INVALID_REQUEST',
            { details: [{ ref: 'source', reason: 'OUT_OF_RANGE' }] },
            'raw backend words',
          )
        : undefined,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AttributionPage />);
    await user.click(await screen.findByRole('tab', { name: 'Installs and registrations' }));
    expect(await screen.findByText(/Failed to load:.*Some input is not valid/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw backend words');
    failing = false;
    const retries = screen.getAllByRole('button', { name: 'Retry' });
    await user.click(retries[retries.length - 1]);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  });

  it('never lets a slow answer to an older search replace the answer to the newer one', async () => {
    useMockBackend({ default: campaignMock });
    const releases: (() => void)[] = [];
    let reads = 0;
    overrideFetch(async ({ url }) => {
      if (url.pathname !== '/api/admin/attribution/records') return undefined;
      reads += 1;
      if (reads === 1) await new Promise<void>((resolve) => releases.push(resolve));
      return undefined;
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AttributionPage />);
    await user.click(await screen.findByRole('tab', { name: 'Installs and registrations' }));
    await waitFor(() => expect(reads).toBe(1));
    await chooseOption(user, 'Source', 'Own attribution (SELF)');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    for (const release of releases) release();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(rows().every((r) => cellsOf(r)[col('Source')] === 'Own attribution (SELF)')).toBe(true);
  });

  it('keeps long, right-to-left, emoji and non-text values inside the table, and a value that is missing is a dash', async () => {
    useMockBackend({ default: campaignMock });
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/attribution/records'
        ? jsonAnswer(200, '200', {
            items: [
              {
                id: 7,
                source: 'APPSFLYER',
                eventName: 'ا'.repeat(5000),
                eventTime: '2026-10-25T10:00:00Z',
                campaign: `ก${'🎉'.repeat(40)}`,
                adset: { odd: 1 },
                ad: 12,
                cost: 'abc',
                costCurrency: 'USD',
                accountId: 55,
                matchType: 'NEW_KIND',
              },
            ],
            total: 1,
          })
        : undefined,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AttributionPage />);
    await user.click(await screen.findByRole('tab', { name: 'Installs and registrations' }));
    await waitFor(() => expect(rows()).toHaveLength(1));
    const buttons = [
      ...document.querySelectorAll<HTMLElement>(`${ACTIVE} .ant-table-tbody button[data-lines]`),
    ];
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    for (const button of buttons) expect(button.style.overflowWrap).toBe('anywhere');
    const cells = cellsOf(rows()[0]);
    expect(cells[col('Ad set')]).toBe('{"odd":1}');
    expect(cells[col('Ad')]).toBe('12');
    expect(cells[col('Cost')]).toBe('—');
    expect(cells[col('Account ID')]).toBe('55');
    expect(cells[col('Match type')]).toBe('NEW_KIND');
  });

  it('is written in Chinese too', async () => {
    await load('zh-CN');
    expect(heads().slice(0, 5)).toEqual(['ID', '来源', '事件名', '事件时间', '转化类型']);
    expect(heads().slice(-3)).toEqual(['注册时间', '匹配方式', '投放账户']);
  });
});
