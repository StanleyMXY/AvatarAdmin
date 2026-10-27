import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import adsMock from '../../../mock/ads.mock';
import channelsMock from '../../../mock/channels.mock';
import configMock from '../../../mock/config.mock';
import exportMock from '../../../mock/export.mock';
import statsMock from '../../../mock/stats.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { withTimeZone } from '../../../tests/withTimeZone';
import enUS from '../../locales/en-US';
import zhCN from '../../locales/zh-CN';
import { NO_FILL_REASONS } from '../../services/ads';
import ReportPage from './report';
import {
  adsState,
  chooseOption,
  jsonAnswer,
  NOW,
  overrideFetch,
  settled,
  sheetAnswer,
  signIn,
} from './testSetup';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:x');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  signIn('root');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const backend = () =>
  useMockBackend(
    { default: adsMock },
    { default: configMock },
    { default: channelsMock },
    { default: statsMock },
    { default: exportMock },
  );

const REPORT_PATH = '/api/admin/ads/report/';
const reads = (calls: { method: string; url: string }[], name?: string) =>
  calls
    .filter((c) => c.method === 'GET' && c.url.startsWith(`${REPORT_PATH}${name ?? ''}`))
    .map((c) => ({
      name: new URL(c.url, 'http://x').pathname.slice(REPORT_PATH.length),
      query: new URL(c.url, 'http://x').searchParams,
    }));
const tables = () => [...document.querySelectorAll('.ant-table')];
const rowsOf = (table: Element) => [...table.querySelectorAll('tbody tr.ant-table-row')];
const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');
const headsOf = (table: Element) =>
  [...table.querySelectorAll('thead th')].map((th) => th.textContent ?? '');
const card = (name: string) => screen.getByTestId(`ads-card-${name}`);
const cardValue = (name: string) => within(card(name)).getByTestId('ads-card-value').textContent;
const chartData = () =>
  JSON.parse(screen.getByTestId('chart-line').textContent ?? '[]') as {
    statDate: string;
    series: string;
    value: number | null;
  }[];
/** The three tables of the page: the days, the drill-down, the no-ad reasons. */
const ready = async () => {
  await waitFor(() => expect(tables()).toHaveLength(3));
  await waitFor(() => expect(rowsOf(tables()[0]).length).toBeGreaterThan(0));
  await waitFor(() => expect(rowsOf(tables()[1]).length).toBeGreaterThan(0));
  await waitFor(() => expect(rowsOf(tables()[2]).length).toBeGreaterThan(0));
};
const load = async () => {
  const calls = backend();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderPage(<ReportPage />);
  await ready();
  return { calls, user };
};
const TOTALS = {
  impressions: 1000,
  guestImpressions: 100,
  starts: 400,
  viewableImpressions: 600,
  nonViewableImpressions: 300,
  undeterminedImpressions: 100,
  clicks: 40,
  completions: 200,
  skips: 80,
  errors: 5,
  totalWatchSeconds: 3000,
  ctr: 0.04,
  completionRate: 0.5,
  viewableRate: 600 / 900,
  measurableRate: 0.9,
  avgWatchSeconds: 7.5,
};
const answerOverview = (totals: Record<string, unknown>, daily: unknown[] = []) =>
  overrideFetch(async ({ url, method }) =>
    method === 'GET' && url.pathname === `${REPORT_PATH}overview`
      ? jsonAnswer(200, '200', { totals, daily })
      : undefined,
  );

describe('the ad report: the top of the page', { timeout: 40000 }, () => {
  it('opens with the delivery checklist, says that the days are UTC days, and has the landing bar and the export', async () => {
    await load();
    expect(screen.getByText(/Delivery checklist/)).toBeInTheDocument();
    expect(screen.getByText(/Statistics days are UTC days/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Re-land this day' })).toBeInTheDocument();
    expect([...document.querySelectorAll('button')].some((b) => b.textContent === 'Export')).toBe(
      true,
    );
  });

  it('reads the last seven UTC days, also where the local date is the next day, with no platform and no channel, and the first drill-down tab only', async () => {
    await withTimeZone('Pacific/Auckland', async () => {
      const { calls } = await load();
      const all = reads(calls);
      expect(all.map((r) => r.name).sort()).toEqual(['by-placement', 'nofill', 'overview']);
      for (const read of all) {
        expect(read.query.get('from')).toBe('2026-10-20');
        expect(read.query.get('to')).toBe('2026-10-26');
        expect(read.query.has('platform')).toBe(false);
        expect(read.query.has('channelCode')).toBe(false);
      }
    });
  });

  it('has no "unique users" anywhere: no card, no column, no text', async () => {
    await load();
    expect(document.body.textContent).not.toMatch(/unique/i);
    expect(document.body.innerHTML).not.toMatch(/uniqueUsers/);
    expect(screen.queryByTestId('ads-card-uniqueUsers')).toBeNull();
    expect(zhCN['ads.report.card.impressions']).toBeTruthy();
    expect(
      Object.values(zhCN).filter(
        (v) => String(v).includes('独立用户') && String(v).startsWith('独立用户'),
      ).length,
    ).toBe(0);
  });
});

describe('the cards', { timeout: 40000 }, () => {
  const ORDER = [
    ['impressions', 'Impressions'],
    ['guestImpressions', 'Guest impressions'],
    ['starts', 'Video starts'],
    ['clicks', 'Clicks'],
    ['completions', 'Video completions'],
    ['skips', 'Video skips'],
    ['viewableImpressions', 'Viewable impressions'],
    ['nonViewableImpressions', 'Not viewable impressions'],
    ['undeterminedImpressions', 'Undetermined viewability'],
    ['ctr', 'Click rate'],
    ['completionRate', 'Completion rate'],
    ['viewableRate', 'Viewable rate'],
    ['measurableRate', 'Measurable rate'],
    ['avgWatchSeconds', 'Average watch time'],
  ] as const;

  it('are fourteen, in the order of the spec, including the guest impressions and not the unique users', async () => {
    await load();
    const cards = [...document.querySelectorAll('[data-testid^="ads-card-"]')].filter(
      (e) => e.getAttribute('data-testid') !== 'ads-card-value',
    );
    expect(cards.map((c) => c.getAttribute('data-testid'))).toEqual(
      ORDER.map(([name]) => `ads-card-${name}`),
    );
    for (const [name, title] of ORDER) expect(card(name).textContent).toContain(title);
  });

  it('show the totals of the overview: the counts with separators and the ratios as percentages with two decimals', async () => {
    backend();
    answerOverview(TOTALS);
    renderPage(<ReportPage />);
    await waitFor(() => expect(cardValue('impressions')).toBe('1,000'));
    expect(cardValue('guestImpressions')).toBe('100');
    expect(cardValue('starts')).toBe('400');
    expect(cardValue('clicks')).toBe('40');
    expect(cardValue('completions')).toBe('200');
    expect(cardValue('skips')).toBe('80');
    expect(cardValue('viewableImpressions')).toBe('600');
    expect(cardValue('nonViewableImpressions')).toBe('300');
    expect(cardValue('undeterminedImpressions')).toBe('100');
    expect(cardValue('ctr')).toBe('4.00%');
    expect(cardValue('completionRate')).toBe('50.00%');
    expect(cardValue('viewableRate')).toBe('66.67%');
    expect(cardValue('measurableRate')).toBe('90.00%');
    expect(cardValue('avgWatchSeconds')).toBe('7.50 s');
  });

  it('show a dash for every ratio whose denominator is 0, and 0 for a count that is 0, whatever the server sent for the ratio', async () => {
    backend();
    answerOverview({
      ...Object.fromEntries(Object.keys(TOTALS).map((k) => [k, 0])),
      ctr: 0.5,
      completionRate: 0.5,
      viewableRate: 0.5,
      measurableRate: 0.5,
      avgWatchSeconds: 3,
    });
    renderPage(<ReportPage />);
    await waitFor(() => expect(cardValue('impressions')).toBe('0'));
    for (const name of [
      'guestImpressions',
      'starts',
      'clicks',
      'completions',
      'skips',
      'viewableImpressions',
      'nonViewableImpressions',
      'undeterminedImpressions',
    ]) {
      expect(cardValue(name), name).toBe('0');
    }
    for (const name of [
      'ctr',
      'completionRate',
      'viewableRate',
      'measurableRate',
      'avgWatchSeconds',
    ]) {
      expect(cardValue(name), name).toBe('—');
    }
  });

  it('show a dash for a ratio the server sent as null, and for a number that is missing, and never null%, NaN or a negative number', async () => {
    backend();
    answerOverview({
      ...TOTALS,
      ctr: null,
      completionRate: -0.2,
      viewableRate: 'x',
      clicks: null,
      skips: -3,
      undeterminedImpressions: -5,
    });
    renderPage(<ReportPage />);
    await waitFor(() => expect(cardValue('impressions')).toBe('1,000'));
    expect(cardValue('ctr')).toBe('—');
    expect(cardValue('completionRate')).toBe('—');
    expect(cardValue('viewableRate')).toBe('—');
    expect(cardValue('clicks')).toBe('—');
    expect(cardValue('skips')).toBe('—');
    expect(cardValue('undeterminedImpressions')).toBe('0');
    expect(document.body.textContent).not.toMatch(/NaN|null%|undefined/);
    for (const [name] of ORDER) expect(cardValue(name), name).not.toMatch(/^-/);
  });

  it('each have an icon with the formula in words, and the guest impressions say that they are included in the impressions', async () => {
    const { user } = await load();
    for (const [name] of ORDER) {
      expect(
        within(card(name)).getByRole('img', { name: 'question-circle' }),
        name,
      ).toBeInTheDocument();
    }
    await user.hover(within(card('ctr')).getByRole('img', { name: 'question-circle' }));
    expect(await screen.findByText('Click rate = clicks ÷ impressions.')).toBeInTheDocument();
    await user.hover(
      within(card('guestImpressions')).getByRole('img', { name: 'question-circle' }),
    );
    expect(await screen.findByText(/already included in the impressions/)).toBeInTheDocument();
    await user.hover(within(card('avgWatchSeconds')).getByRole('img', { name: 'question-circle' }));
    expect(
      await screen.findByText('Average watch time = total watch seconds ÷ video starts.'),
    ).toBeInTheDocument();
  });
});

describe('the trend', { timeout: 40000 }, () => {
  it('draws one chart with two lines, impressions and clicks, with a point for every day of the range', async () => {
    await load();
    expect(screen.getAllByTestId('chart-line')).toHaveLength(1);
    const points = chartData();
    expect(new Set(points.map((p) => p.series))).toEqual(new Set(['Impressions', 'Clicks']));
    expect(new Set(points.map((p) => p.statDate)).size).toBe(7);
    expect(points).toHaveLength(14);
    expect(points.every((p) => p.value === null || p.value >= 0)).toBe(true);
  });

  it('says what the axis counts and that the days are UTC days', async () => {
    await load();
    expect(screen.getByText('Impressions and clicks per UTC day (counts)')).toBeInTheDocument();
  });

  it('has a daily table with the date, impressions, clicks, the click rate and the completions, and a dash where there are no impressions', async () => {
    backend();
    answerOverview(TOTALS, [
      { statDate: '2026-10-21', impressions: 200, clicks: 10, completions: 5 },
      { statDate: '2026-10-22', impressions: 0, clicks: 0, completions: 0 },
    ]);
    renderPage(<ReportPage />);
    await waitFor(() => expect(tables().length).toBeGreaterThan(0));
    await waitFor(() => expect(rowsOf(tables()[0])).toHaveLength(2));
    expect(headsOf(tables()[0])).toEqual([
      'Date (UTC)',
      'Impressions',
      'Clicks',
      'Click rate',
      'Video completions',
    ]);
    expect(cellsOf(rowsOf(tables()[0])[0])).toEqual(['2026-10-21', '200', '10', '5.00%', '5']);
    expect(cellsOf(rowsOf(tables()[0])[1])).toEqual(['2026-10-22', '0', '0', '—', '0']);
  });

  it('fills the days without a row with 0 in the chart', async () => {
    backend();
    answerOverview(TOTALS, [
      { statDate: '2026-10-21', impressions: 200, clicks: 10, completions: 5 },
    ]);
    renderPage(<ReportPage />);
    await waitFor(() => expect(chartData().some((p) => p.value === 200)).toBe(true));
    const days = chartData().filter((p) => p.series === 'Impressions');
    expect(days).toHaveLength(7);
    expect(days.find((p) => p.statDate === '2026-10-23')?.value).toBe(0);
  });
});

describe('the drill-down tabs', { timeout: 40000 }, () => {
  const tabs = () => screen.getAllByRole('tab').map((t) => t.textContent);

  it('are four, by placement, campaign, creative and country, and share one table', async () => {
    await load();
    expect(tabs()).toEqual(['By placement', 'By campaign', 'By creative', 'By country']);
    expect(tables()).toHaveLength(3);
  });

  it('has the placement in the first tab, with the name and the slot key, and every metric of the spec as a column and no unique users', async () => {
    await load();
    const table = tables()[1];
    expect(headsOf(table)).toEqual([
      'Placement',
      'Impressions',
      'Guest impressions',
      'Video starts',
      'Clicks',
      'Click rate',
      'Video completions',
      'Completion rate',
      'Video skips',
      'Errors',
      'Viewable impressions',
      'Not viewable impressions',
      'Undetermined viewability',
      'Viewable rate',
      'Measurable rate',
      'Average watch time',
    ]);
    const text = rowsOf(table)
      .map((r) => cellsOf(r)[0])
      .join(' ');
    for (const slot of ['app_open', 'call_end', 'history_feed', 'reward_credits'])
      expect(text).toContain(slot);
  });

  it('reads the campaigns, the creatives and the countries only when their tab is opened, with the same filters, into the same table', async () => {
    const { calls, user } = await load();
    expect(reads(calls, 'by-campaign')).toHaveLength(0);
    await user.click(screen.getByRole('tab', { name: 'By campaign' }));
    await waitFor(() => expect(reads(calls, 'by-campaign')).toHaveLength(1));
    await waitFor(() => expect(headsOf(tables()[1])[0]).toBe('Campaign'));
    await user.click(screen.getByRole('tab', { name: 'By creative' }));
    await waitFor(() => expect(reads(calls, 'by-creative')).toHaveLength(1));
    await waitFor(() => expect(headsOf(tables()[1])[0]).toBe('Creative'));
    await user.click(screen.getByRole('tab', { name: 'By country' }));
    await waitFor(() => expect(reads(calls, 'by-country')).toHaveLength(1));
    await waitFor(() => expect(headsOf(tables()[1])[0]).toBe('Country'));
    expect(tables()).toHaveLength(3);
    for (const name of ['by-campaign', 'by-creative', 'by-country']) {
      const query = reads(calls, name)[0].query;
      expect(query.get('from')).toBe('2026-10-20');
      expect(query.get('to')).toBe('2026-10-26');
    }
  });

  it('shows the name of a campaign in any language, the title of a creative or a dash, and an unknown country as "Unknown"', async () => {
    const { user } = await load();
    await user.click(screen.getByRole('tab', { name: 'By campaign' }));
    await waitFor(() => expect(headsOf(tables()[1])[0]).toBe('Campaign'));
    await waitFor(() => expect(rowsOf(tables()[1]).length).toBeGreaterThan(0));
    const campaigns = rowsOf(tables()[1])
      .map((r) => cellsOf(r)[0])
      .join(' ');
    expect(campaigns).toContain(adsState.campaigns.get('2')!.name);
    await user.click(screen.getByRole('tab', { name: 'By creative' }));
    await waitFor(() => expect(headsOf(tables()[1])[0]).toBe('Creative'));
    await waitFor(() => expect(rowsOf(tables()[1]).length).toBeGreaterThan(0));
    const creatives = rowsOf(tables()[1]).map((r) => cellsOf(r)[0]);
    expect(creatives.some((c) => c.startsWith('—'))).toBe(true);
    await user.click(screen.getByRole('tab', { name: 'By country' }));
    await waitFor(() => expect(headsOf(tables()[1])[0]).toBe('Country'));
    await waitFor(() => expect(rowsOf(tables()[1]).length).toBeGreaterThan(0));
    const countries = rowsOf(tables()[1]).map((r) => cellsOf(r)[0]);
    expect(countries).toContain('Unknown');
    expect(countries).toContain('TH');
  });

  it('shows a dash for every ratio of a row whose denominator is 0, and 0 for a count that is 0', async () => {
    const { user } = await load();
    await user.click(screen.getByRole('tab', { name: 'By creative' }));
    await waitFor(() => expect(headsOf(tables()[1])[0]).toBe('Creative'));
    await waitFor(() => expect(rowsOf(tables()[1]).length).toBeGreaterThan(5));
    const idle = rowsOf(tables()[1])
      .map(cellsOf)
      .find((c) => c[1] === '0');
    expect(idle).toBeDefined();
    const cells = idle as string[];
    expect(cells[2]).toBe('0');
    for (const at of [5, 7, 13, 14, 15]) expect(cells[at], `column ${at}`).toBe('—');
  });

  it('keeps names of 5000 letters, Arabic, Thai and emoji inside the table', async () => {
    backend();
    adsState.campaigns.get('2')!.name = 'ก'.repeat(5000);
    adsState.campaigns.get('6')!.name = `عرض ${'🎉'.repeat(30)}`;
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<ReportPage />);
    await ready();
    await user.click(screen.getByRole('tab', { name: 'By campaign' }));
    await waitFor(() => expect(headsOf(tables()[1])[0]).toBe('Campaign'));
    await waitFor(() => expect(rowsOf(tables()[1]).length).toBeGreaterThan(0));
    const buttons = [...tables()[1].querySelectorAll('button[data-lines]')];
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons)
      expect((button as HTMLElement).style.overflowWrap).toBe('anywhere');
  });

  it('does not break on rows whose fields have the wrong type', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'GET' && url.pathname === `${REPORT_PATH}by-placement`
        ? jsonAnswer(200, '200', [
            {
              placementId: 1,
              slotKey: { a: 1 },
              placementName: 55,
              impressions: '9',
              clicks: null,
              ctr: 'x',
            },
            { slotKey: 'ok', impressions: 10, clicks: 1 },
          ])
        : undefined,
    );
    renderPage(<ReportPage />);
    await waitFor(() => expect(tables().length).toBe(3));
    await waitFor(() => expect(rowsOf(tables()[1])).toHaveLength(2));
  });
});

describe('the no-ad reasons', { timeout: 40000 }, () => {
  it('is a table of four columns, the date, the slot, the reason and the count, with no platform and no channel', async () => {
    await load();
    expect(headsOf(tables()[2])).toEqual(['Date (UTC)', 'Slot', 'Reason', 'Count']);
    expect(headsOf(tables()[2]).join(' ')).not.toMatch(/platform|channel/i);
  });

  it('says that the table is the total of all platforms and channels, or of the filter, and that the filter above is the way to split it', async () => {
    await load();
    const note = screen.getByTestId('ads-nofill-note').textContent ?? '';
    expect(note).toMatch(/total of all platforms and all channels/i);
    expect(note).toMatch(/use the platform and channel filters above/i);
  });

  it('explains each of the eleven reasons in words, with the code beside it', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'GET' && url.pathname === `${REPORT_PATH}nofill`
        ? jsonAnswer(
            200,
            '200',
            NO_FILL_REASONS.map((reason, i) => ({
              statDate: '2026-10-21',
              slotKey: 'app_open',
              reason,
              cnt: i + 1,
            })),
          )
        : undefined,
    );
    renderPage(<ReportPage />);
    await waitFor(() => expect(tables().length).toBe(3));
    await waitFor(() => expect(rowsOf(tables()[2])).toHaveLength(11));
    const reasons = rowsOf(tables()[2]).map((r) => cellsOf(r)[2]);
    NO_FILL_REASONS.forEach((code, i) => {
      expect(reasons[i], code).toContain(code);
      expect(reasons[i].length, code).toBeGreaterThan(code.length + 10);
    });
    expect(reasons.join(' ')).toMatch(/NOT_FOR_GUEST/);
    expect(cellsOf(rowsOf(tables()[2])[10])[3]).toBe('11');
  });

  it('has a text for every reason in both languages', () => {
    for (const code of NO_FILL_REASONS) {
      expect(enUS[`ads.report.reason.${code}`], code).toBeTruthy();
      expect(zhCN[`ads.report.reason.${code}`], code).toBeTruthy();
      expect(String(enUS[`ads.report.reason.${code}`])).not.toMatch(
        /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/,
      );
    }
  });

  it('shows a reason that is not known as it is, never as an object', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'GET' && url.pathname === `${REPORT_PATH}nofill`
        ? jsonAnswer(200, '200', [
            { statDate: '2026-10-21', slotKey: 'app_open', reason: 'BRAND_NEW', cnt: 3 },
            { statDate: 5, slotKey: {}, reason: [], cnt: 'x' },
          ])
        : undefined,
    );
    renderPage(<ReportPage />);
    await waitFor(() => expect(tables().length).toBe(3));
    await waitFor(() => expect(rowsOf(tables()[2])).toHaveLength(2));
    expect(cellsOf(rowsOf(tables()[2])[0])[2]).toBe('BRAND_NEW');
    expect(document.body.textContent).not.toContain('[object Object]');
  });
});

describe('the filters', { timeout: 50000 }, () => {
  const lastOf = (calls: { method: string; url: string }[], name: string) => {
    const found = reads(calls, name);
    return found[found.length - 1].query;
  };

  it('has the platform (all, Android, iOS) and the channel (all, the channel codes of GET /channels, unknown) and reads again with them on all six reports', async () => {
    const { calls, user } = await load();
    await chooseOption(user, 'Platform', 'Android');
    await user.click(screen.getByRole('combobox', { name: 'Channel package' }));
    for (const label of [/^play ·/, /^direct ·/, /^appstore ·/, 'Unknown']) {
      expect(
        await screen.findAllByText(label, { selector: '.ant-select-item-option-content' }),
      ).not.toHaveLength(0);
    }
    const options = await screen.findAllByText('Unknown', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(lastOf(calls, 'overview').get('channelCode')).toBe('unknown'));
    for (const name of ['overview', 'by-placement', 'nofill']) {
      const query = lastOf(calls, name);
      expect(query.get('platform'), name).toBe('ANDROID');
      expect(query.get('channelCode'), name).toBe('unknown');
    }
    await user.click(screen.getByRole('tab', { name: 'By country' }));
    await waitFor(() => expect(reads(calls, 'by-country')).toHaveLength(1));
    expect(lastOf(calls, 'by-country').get('channelCode')).toBe('unknown');
    expect(lastOf(calls, 'by-country').get('platform')).toBe('ANDROID');
  });

  it('sends a channel code that was chosen, and does not send "all" for the platform or the channel', async () => {
    const { calls, user } = await load();
    await user.click(screen.getByRole('combobox', { name: 'Channel package' }));
    const options = await screen.findAllByText(/^play ·/, {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(lastOf(calls, 'overview').get('channelCode')).toBe('play'));
    await chooseOption(user, 'Channel package', 'All');
    await chooseOption(user, 'Platform', 'All');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(lastOf(calls, 'overview').has('channelCode')).toBe(false));
    expect(lastOf(calls, 'overview').has('platform')).toBe(false);
  });

  it('does not read until Search is pressed, and reads again when it is pressed with the same filters', async () => {
    const { calls, user } = await load();
    const before = reads(calls, 'overview').length;
    await chooseOption(user, 'Platform', 'iOS');
    expect(reads(calls, 'overview')).toHaveLength(before);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(reads(calls, 'overview')).toHaveLength(before + 1));
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(reads(calls, 'overview')).toHaveLength(before + 2));
  });

  it('shows the answer of the newest read even when an older one arrives later', async () => {
    backend();
    const gates: Record<string, () => void> = {};
    let n = 0;
    overrideFetch(async ({ url, method }) => {
      if (method !== 'GET' || url.pathname !== `${REPORT_PATH}overview`) return undefined;
      if (++n === 2) {
        await new Promise<void>((resolve) => {
          gates.old = resolve;
        });
        return jsonAnswer(200, '200', { totals: { ...TOTALS, impressions: 424242 }, daily: [] });
      }
      return undefined;
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<ReportPage />);
    await ready();
    await chooseOption(user, 'Platform', 'Android');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(n).toBe(2));
    await chooseOption(user, 'Platform', 'iOS');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(n).toBeGreaterThanOrEqual(3));
    await waitFor(() => expect(cardValue('impressions')).not.toBe('—'));
    gates.old();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.body.textContent).not.toContain('424,242');
  });

  it('says what is wrong when a report cannot be read, with a retry, and never with the backend words', async () => {
    backend();
    let fail = true;
    overrideFetch(async ({ url, method }) =>
      method === 'GET' && url.pathname === `${REPORT_PATH}overview` && fail
        ? jsonAnswer(500, 'INTERNAL_ERROR', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    renderPage(<ReportPage />);
    expect((await screen.findAllByText(/Failed to load/)).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
    fail = false;
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(screen.getAllByRole('button', { name: 'Retry' })[0]);
    await waitFor(() => expect(cardValue('impressions')).not.toBe('—'));
  });

  it('says the reason of a refused channel code in the words of the reason', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'GET' && url.pathname.startsWith(REPORT_PATH)
        ? jsonAnswer(
            400,
            'INVALID_REQUEST',
            { details: [{ ref: 'channelCode', reason: 'OUT_OF_RANGE' }] },
            'SECRET BACKEND WORDS',
          )
        : undefined,
    );
    renderPage(<ReportPage />);
    expect((await screen.findAllByText(/Some input is not valid/)).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });
});

describe('the export and the landing bar', { timeout: 50000 }, () => {
  const exportButton = () =>
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'Export') ?? null;

  it('exports ads-report with the filters that were searched: from, to, platform and channelCode, and saves the file', async () => {
    const { user } = await load();
    const taken = overrideFetch(({ url }) =>
      url.pathname.startsWith('/api/admin/stats/export/') ? sheetAnswer('ads-report') : undefined,
    );
    await user.click(exportButton() as HTMLElement);
    await waitFor(() => expect(taken).toHaveLength(1));
    const first = new URL(taken[0].url, 'http://x');
    expect(first.pathname).toBe('/api/admin/stats/export/ads-report');
    expect(first.searchParams.get('from')).toBe('2026-10-20');
    expect(first.searchParams.get('to')).toBe('2026-10-26');
    expect(first.searchParams.has('platform')).toBe(false);
    expect(first.searchParams.has('channelCode')).toBe(false);
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1));
    await chooseOption(user, 'Platform', 'iOS');
    await user.click(screen.getByRole('combobox', { name: 'Channel package' }));
    const options = await screen.findAllByText('Unknown', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    // the filter that was only chosen is not the filter of the export
    await user.click(exportButton() as HTMLElement);
    await waitFor(() => expect(taken).toHaveLength(2));
    expect(new URL(taken[1].url, 'http://x').searchParams.has('channelCode')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(exportButton() as HTMLElement);
    await waitFor(() => expect(taken).toHaveLength(3));
    const last = new URL(taken[2].url, 'http://x').searchParams;
    expect(last.get('platform')).toBe('IOS');
    expect(last.get('channelCode')).toBe('unknown');
  });

  it('has no export button without STATS:EXPORT, and no landing bar without STATS:LAND', async () => {
    signIn('support', { codes: ['ADS:REPORT'] });
    backend();
    renderPage(<ReportPage />);
    await ready();
    expect(exportButton()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Re-land this day' })).toBeNull();
  });

  it('shows the words of the error code, saves no file, when the export is refused', async () => {
    const { user } = await load();
    overrideFetch(({ url }) =>
      url.pathname.startsWith('/api/admin/stats/export/')
        ? jsonAnswer(400, 'INVALID_REQUEST', null, 'raw words about rows')
        : undefined,
    );
    await user.click(exportButton() as HTMLElement);
    await waitFor(() => expect(document.body.textContent).toContain('narrow the date range'));
    expect(document.body.textContent).not.toContain('raw words about rows');
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });

  it('re-lands ad-daily for the day before today in UTC, once for two presses, and reads the page again', async () => {
    const { calls } = await load();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const taken = overrideFetch(async ({ url, method }) => {
      if (method !== 'POST' || !url.pathname.startsWith('/api/admin/stats/land/')) return undefined;
      await gate;
      return jsonAnswer(200, '200', null);
    });
    const before = reads(calls, 'overview').length;
    const button = screen.getByRole('button', { name: 'Re-land this day' });
    fireEvent.click(button);
    fireEvent.click(button);
    await settled();
    release();
    await waitFor(() => expect(taken).toHaveLength(1));
    await settled();
    expect(taken).toHaveLength(1);
    expect(taken[0].url).toBe('/api/admin/stats/land/ad-daily?date=2026-10-25');
    await waitFor(() => expect(reads(calls, 'overview').length).toBe(before + 1));
  });
});

describe('the ad report: Chinese', { timeout: 40000 }, () => {
  it('is written in Chinese too: the cards, the tabs, the reasons and the notes', async () => {
    backend();
    renderPage(<ReportPage />, 'zh-CN');
    await ready();
    expect(card('guestImpressions').textContent).toContain('游客展示');
    expect(card('avgWatchSeconds').textContent).toContain('视频平均观看时长');
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      '按广告位',
      '按计划',
      '按素材',
      '按国家',
    ]);
    expect(headsOf(tables()[2])).toEqual(['日期（UTC）', '广告位', '原因', '次数']);
    expect(document.body.textContent).not.toContain('独立用户');
  });
});
