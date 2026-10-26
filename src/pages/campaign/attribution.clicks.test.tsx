import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { campaignState } from '../../../mock/_core/campaignData';
import campaignMock from '../../../mock/campaign.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { withTimeZone } from '../../../tests/withTimeZone';
import AttributionPage from './attribution';
import { chooseOption, jsonAnswer, META, NOW, overrideFetch, signIn } from './testSetup';

beforeEach(() => {
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
const clickReads = (calls: { method: string; url: string }[]) =>
  calls
    .filter((c) => c.method === 'GET' && c.url.startsWith('/api/admin/attribution/clicks?'))
    .map((c) => new URL(c.url, 'http://x').searchParams);

const load = async (options: { locale?: 'en-US' | 'zh-CN' } = {}) => {
  const calls = useMockBackend({ default: campaignMock });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderPage(<AttributionPage />, options.locale);
  await waitFor(() => expect(rows().length).toBeGreaterThan(0), { timeout: 5000 });
  return { calls, user };
};

describe('the click details', { timeout: 30000 }, () => {
  beforeEach(() => signIn('root'));

  it('has three tabs: the clicks, the installs and registrations, and the summary', async () => {
    await load();
    expect(screen.getByRole('tab', { name: 'Clicks' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Installs and registrations' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Summary' })).toBeInTheDocument();
  });

  it('says that the days are UTC days', async () => {
    await load();
    expect(screen.getByText(/Statistics days are UTC days/)).toBeInTheDocument();
  });

  it('says how many days the click records are kept, from the setting of the backend', async () => {
    await load();
    expect(screen.getByText('Click records are kept for 30 days.')).toBeInTheDocument();
  });

  it('does not give a number of days when the backend has not said it', async () => {
    signIn('root', { meta: { ...META, attributionClickRetentionDays: null } });
    await load();
    expect(
      screen.getByText(
        'Click records are kept only for a limited number of days (set in the attribution parameters).',
      ),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/kept for \d+ days/);
  });

  it('says that a download click of a device that is not Android on a direct-install channel is not recorded', async () => {
    await load();
    expect(
      screen.getByText(/direct-install channel from a device that is not Android is not recorded/),
    ).toBeInTheDocument();
  });

  it('has the columns of the spec in its order', async () => {
    await load();
    expect(heads()).toEqual([
      'ID',
      'Clicked at',
      'Campaign',
      'Status',
      'Client IP',
      'Channel',
      'UTM source',
      'UTM medium',
      'UTM campaign',
      'Claimed at',
    ]);
  });

  it('reads the last seven UTC days as instants, the end being the start of the day after, newest first, 20 to a page, also where the local date is the next day', async () => {
    await withTimeZone('Pacific/Auckland', async () => {
      vi.setSystemTime(new Date('2026-10-26T20:00:00Z'));
      // the token of the administrator is good for eight hours from when it was made
      signIn('root');
      const { calls } = await load();
      const read = clickReads(calls)[0];
      expect(read.get('from')).toBe('2026-10-20T00:00:00Z');
      expect(read.get('to')).toBe('2026-10-27T00:00:00Z');
      expect(read.get('page')).toBe('1');
      expect(read.get('pageSize')).toBe('20');
      for (const key of ['campaignId', 'status', 'keyword']) expect(read.has(key), key).toBe(false);
    });
  });

  it('shows the campaign name, the status as a tag, the channel in words, the claim time only where there is one, and a dash for what is missing', async () => {
    await load();
    const all = rows().map((r) => cellsOf(r));
    const statuses = new Set(all.map((c) => c[3]));
    expect(statuses).toEqual(new Set(['Pending', 'Matched', 'Expired']));
    expect(new Set(all.map((c) => c[5]))).toEqual(new Set(['Store redirect', 'APK download']));
    for (const cells of all) {
      expect(campaignState.campaigns.some((c) => c.name === cells[2])).toBe(true);
      expect(cells[9] === '—', cells.join('|')).toBe(cells[3] !== 'Matched');
    }
    expect(
      within(rows()[0])
        .getAllByText(/Pending|Matched|Expired/)[0]
        .closest('.ant-tag'),
    ).not.toBeNull();
  });

  it('shows the IP address exactly as the backend gave it: masked for an administrator without ANALYTICS:IP_VIEW, with a note, and never more', async () => {
    signIn('support', { codes: ['ATTRIBUTION:VIEW'] });
    await load();
    const ips = rows().map((r) => cellsOf(r)[4]);
    expect(ips.length).toBeGreaterThan(0);
    for (const ip of ips) expect(ip).toMatch(/\*/);
    expect(
      screen.getByText(
        'IP addresses are masked. The permission "View full IP addresses" shows them in full and lets the keyword match a whole address.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the whole address to an administrator who may see it, and says the keyword matches it', async () => {
    await load();
    const ips = rows().map((r) => cellsOf(r)[4]);
    for (const ip of ips) expect(ip).not.toMatch(/\*/);
    expect(
      screen.getByText('The keyword matches the UTM values and a whole IP address.'),
    ).toBeInTheDocument();
  });

  it('does not change an address the backend sent: a mask in a form the page does not know stays as it is', async () => {
    useMockBackend({ default: campaignMock });
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/attribution/clicks'
        ? jsonAnswer(200, '200', {
            items: [
              {
                id: '1',
                clickedAt: '2026-10-25T10:00:00Z',
                campaignId: '1',
                campaignName: 'x',
                status: 'PENDING',
                channel: 'APK_DOWNLOAD',
                utmSource: 'a',
                utmMedium: 'b',
                utmCampaign: 'c',
                ip: '2001:db8:••••',
                claimedAt: null,
              },
              {
                id: '2',
                clickedAt: '2026-10-25T09:00:00Z',
                campaignId: '1',
                campaignName: 'x',
                status: 'PENDING',
                channel: 'APK_DOWNLOAD',
                utmSource: 'a',
                utmMedium: 'b',
                utmCampaign: 'c',
                ip: null,
                claimedAt: null,
              },
            ],
            total: 2,
          })
        : undefined,
    );
    renderPage(<AttributionPage />);
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(cellsOf(rows()[0])[4]).toBe('2001:db8:••••');
    expect(cellsOf(rows()[1])[4]).toBe('—');
  });

  it('asks again, from page 1, with the campaign, the state and the keyword that were chosen, once Search is pressed, and cleans the ends of the keyword', async () => {
    const { calls, user } = await load();
    const before = clickReads(calls).length;
    await chooseOption(user, 'Campaign', /spring_th/);
    await chooseOption(user, 'Status', 'Matched');
    await user.type(screen.getByRole('textbox', { name: 'Keyword' }), '  facebook ');
    expect(clickReads(calls)).toHaveLength(before);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(clickReads(calls).length).toBe(before + 1));
    const read = clickReads(calls)[before];
    expect(read.get('campaignId')).toBe(
      campaignState.campaigns.find((c) => c.code === 'spring_th')?.id,
    );
    expect(read.get('status')).toBe('MATCHED');
    expect(read.get('keyword')).toBe('facebook');
    expect(read.get('page')).toBe('1');
    await waitFor(() => expect(rows().every((r) => cellsOf(r)[3] === 'Matched')).toBe(true));
  });

  it('reads the first page again when Search is pressed with the filters that are already in force', async () => {
    const { calls, user } = await load();
    await user.click(document.querySelector('.ant-pagination-item-2') as HTMLElement);
    await waitFor(() => expect(clickReads(calls).some((r) => r.get('page') === '2')).toBe(true));
    const before = clickReads(calls).length;
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(clickReads(calls).length).toBe(before + 1));
    expect(clickReads(calls)[before].get('page')).toBe('1');
  });

  it('offers the three states and no other', async () => {
    const { user } = await load();
    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    const options = [...document.querySelectorAll('.ant-select-item-option-content')].map(
      (o) => o.textContent,
    );
    expect(options).toEqual(['All', 'Pending', 'Matched', 'Expired']);
  });

  it('goes to the next page with the same filters', async () => {
    const { calls, user } = await load();
    await user.click(document.querySelector('.ant-pagination-item-2') as HTMLElement);
    await waitFor(() => expect(clickReads(calls).some((r) => r.get('page') === '2')).toBe(true));
    const second = clickReads(calls).find((r) => r.get('page') === '2') as URLSearchParams;
    expect(second.get('from')).toBe('2026-10-20T00:00:00Z');
  });

  it('disables the campaign filter and says which permission is missing when the list of campaigns is refused (403), and still shows the clicks with the campaign name from the click', async () => {
    signIn('support', { codes: ['ATTRIBUTION:VIEW'] });
    useMockBackend({ default: campaignMock });
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/attribution/campaigns'
        ? jsonAnswer(403, 'ADMIN_FORBIDDEN', null, 'raw words')
        : undefined,
    );
    renderPage(<AttributionPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(await screen.findByTestId('campaign-select-forbidden')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Campaign' })).toBeDisabled();
    expect(campaignState.campaigns.some((c) => c.name === cellsOf(rows()[0])[2])).toBe(true);
  });

  it('shows the words of the error code and not the backend words, and reads again with the retry button', async () => {
    useMockBackend({ default: campaignMock });
    let failing = true;
    overrideFetch(({ url }) =>
      failing && url.pathname === '/api/admin/attribution/clicks'
        ? jsonAnswer(429, 'RATE_LIMITED', null, 'raw backend words')
        : undefined,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AttributionPage />);
    expect(await screen.findByText(/Failed to load:.*Too many requests/)).toBeInTheDocument();
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
      if (url.pathname !== '/api/admin/attribution/clicks') return undefined;
      reads += 1;
      if (reads === 1) await new Promise<void>((resolve) => releases.push(resolve));
      return undefined;
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<AttributionPage />);
    await waitFor(() => expect(reads).toBe(1));
    await chooseOption(user, 'Status', 'Matched');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(rows().every((r) => cellsOf(r)[3] === 'Matched')).toBe(true);
    for (const release of releases) release();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(rows().every((r) => cellsOf(r)[3] === 'Matched')).toBe(true);
  });

  it('keeps a campaign name of 5000 characters, Arabic, Thai and emoji values and values that are not text inside the table', async () => {
    useMockBackend({ default: campaignMock });
    overrideFetch(({ url }) =>
      url.pathname === '/api/admin/attribution/clicks'
        ? jsonAnswer(200, '200', {
            items: [
              {
                id: 1,
                clickedAt: '2026-10-25T10:00:00Z',
                campaignId: 1,
                campaignName: 'ا'.repeat(5000),
                status: 'PENDING',
                channel: 'APK_DOWNLOAD',
                utmSource: 'ก'.repeat(300),
                utmMedium: { odd: true },
                utmCampaign: `x${'🎉'.repeat(40)}`,
                ip: '203.0.*.*',
                claimedAt: null,
              },
              {
                id: 2,
                clickedAt: 'not a time',
                campaignId: null,
                campaignName: null,
                status: 'SOMETHING_NEW',
                channel: 'NEW_CHANNEL',
                utmSource: null,
                utmMedium: 5,
                utmCampaign: undefined,
                ip: '203.0.*.*',
                claimedAt: 12,
              },
            ],
            total: 2,
          })
        : undefined,
    );
    renderPage(<AttributionPage />);
    await waitFor(() => expect(rows()).toHaveLength(2));
    const buttons = [
      ...document.querySelectorAll<HTMLElement>(`${ACTIVE} .ant-table-tbody button[data-lines]`),
    ];
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    for (const button of buttons) expect(button.style.overflowWrap).toBe('anywhere');
    const second = cellsOf(rows()[1]);
    // an unknown status and channel are shown as they are; a number is text; a value of no use is a dash
    expect(second[3]).toBe('SOMETHING_NEW');
    expect(second[5]).toBe('NEW_CHANNEL');
    expect(second[7]).toBe('5');
    expect(second[8]).toBe('—');
  });

  it('is written in Chinese too', async () => {
    await load({ locale: 'zh-CN' });
    expect(heads()).toEqual([
      'ID',
      '点击时间',
      '投放账户',
      '状态',
      '客户端 IP',
      '渠道',
      'UTM 来源',
      'UTM 媒介',
      'UTM 活动',
      '认领时间',
    ]);
    expect(screen.getByText('点击记录只保留 30 天。')).toBeInTheDocument();
    expect(screen.getAllByText('待认领').length).toBeGreaterThan(0);
  });
});
