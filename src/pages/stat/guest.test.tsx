import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from 'antd';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { daysIn } from '../../../mock/_core/statRange';
import { envelope, jsonResponse, stubFetch, XLSX_TYPE } from '../../../tests/httpStubs';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub, setTestAccess, setTestInitialState } from '../../../tests/stubs/umi-max';
import { withTimeZone } from '../../../tests/withTimeZone';
import access from '../../access';
import { resetChannelsCache } from '../../components/ChannelSelect';
import zhCN from '../../locales/zh-CN';
import { resetSessionState, setToken } from '../../request/session';
import type {
  GuestCohortRow,
  GuestDailyRow,
  GuestQuota,
  RetentionRow,
} from '../../services/stats/types';
import GuestPage from './guest';

const NOW = '2026-10-26T20:00:00Z';

const as = (permissions: string[], superAdmin = false) =>
  setTestAccess(access({ me: { superAdmin, permissions } }) as unknown as Record<string, unknown>);

beforeEach(() => {
  resetUmiStub();
  resetSessionState();
  resetChannelsCache();
  sessionStorage.clear();
  localStorage.clear();
  setToken('tok');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  as(['STATS:VIEW']);
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:x');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const daily = (statDate: string, over: Partial<GuestDailyRow> = {}): GuestDailyRow => ({
  statDate,
  guestDevicesNew: 200,
  guestDevicesConverted: 50,
  ...over,
});
const cohort = (cohortDate: string, over: Partial<GuestCohortRow> = {}): GuestCohortRow => ({
  cohortDate,
  cohortSize: 100,
  d0: 10,
  d1: 15,
  d2: 18,
  d3: 20,
  d5: 24,
  d7: 27,
  d14: 30,
  d30: 33,
  ...over,
});
const retention = (cohortDate: string, over: Partial<RetentionRow> = {}): RetentionRow => ({
  cohortDate,
  platform: 'ALL',
  channelCode: 'ALL',
  cohortSize: 100,
  d1: 40,
  d3: 30,
  d5: 25,
  d7: 20,
  d14: 15,
  d21: 12,
  d30: 10,
  d60: null,
  d90: null,
  ...over,
});
const quotaOf = (over: Partial<GuestQuota> = {}): GuestQuota => ({
  configuredTotalSeconds: 600,
  devices: 1000,
  noGrant: 200,
  neverCalled: 200,
  avgUsedSeconds: 150,
  exhausted: 400,
  buckets: {
    ZERO: { devices: 200, converted: 4 },
    LE_25: { devices: 100, converted: 5 },
    LE_50: { devices: 100, converted: 6 },
    LE_75: { devices: 100, converted: 7 },
    LT_100: { devices: 100, converted: 8 },
    GE_100: { devices: 200, converted: 60 },
  },
  ...over,
});

const sheet = () =>
  new Response(Uint8Array.from([80, 75, 3, 4]), {
    status: 200,
    headers: {
      'content-type': XLSX_TYPE,
      'content-disposition': 'attachment; filename="guest.xlsx"',
    },
  });

type Backend = {
  daily?: (q: URLSearchParams) => GuestDailyRow[];
  cohort?: (q: URLSearchParams) => GuestCohortRow[];
  retention?: (q: URLSearchParams) => RetentionRow[];
  quota?: (q: URLSearchParams) => GuestQuota;
  fail?: { status: number; code: string };
};

const backend = (options: Backend = {}) =>
  stubFetch(async ({ url }) => {
    const u = new URL(url, 'http://localhost');
    const q = u.searchParams;
    const days = () => daysIn(q.get('from') ?? '', q.get('to') ?? '');
    if (u.pathname === '/api/admin/channels')
      return jsonResponse(200, envelope('200', { items: [] }));
    if (options.fail && u.pathname.startsWith('/api/admin/stats/guest/'))
      return jsonResponse(
        options.fail.status,
        envelope(options.fail.code, null, 'raw backend words'),
      );
    if (u.pathname === '/api/admin/stats/guest/daily')
      return jsonResponse(
        200,
        envelope('200', { items: options.daily?.(q) ?? days().map((d) => daily(d)) }),
      );
    if (u.pathname === '/api/admin/stats/guest/cohort')
      return jsonResponse(
        200,
        envelope('200', { items: options.cohort?.(q) ?? days().map((d) => cohort(d)) }),
      );
    if (u.pathname === '/api/admin/stats/guest/retention')
      return jsonResponse(
        200,
        envelope('200', { items: options.retention?.(q) ?? days().map((d) => retention(d)) }),
      );
    if (u.pathname === '/api/admin/stats/guest/quota')
      return jsonResponse(200, envelope('200', options.quota?.(q) ?? quotaOf()));
    if (u.pathname.startsWith('/api/admin/stats/land/'))
      return jsonResponse(200, envelope('200', null));
    if (u.pathname.startsWith('/api/admin/stats/export/')) return sheet();
    return jsonResponse(404, envelope('RESOURCE_NOT_FOUND'));
  });

const callsTo = (calls: { url: string }[], path: string) =>
  calls.filter((c) => c.url.startsWith(`/api/admin/stats/${path}`));
const tab = (name: string) => screen.getByRole('tab', { name });
const panel = () => within(screen.getByRole('tabpanel'));
const bodyRows = () => [
  ...screen.getByRole('tabpanel').querySelectorAll('.ant-table-tbody tr.ant-table-row'),
];
const headerTexts = () =>
  [...screen.getByRole('tabpanel').querySelectorAll('.ant-table-thead th')].map(
    (h) => h.textContent ?? '',
  );
const chartData = (kind: string) =>
  JSON.parse(
    within(screen.getByRole('tabpanel')).getByTestId(`chart-${kind}`).textContent ?? '[]',
  ) as Record<string, unknown>[];

/** Picks the preset "Last 30 days" in the open range picker of the visible tab; nothing is searched yet. */
const chooseLast30Days = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    screen.getByRole('tabpanel').querySelector('.ant-picker-range input') as HTMLElement,
  );
  await user.click(await screen.findByText('Last 30 days'));
};

/** The hint icon in a header of the visible tab (the table draws a header twice, so the first one is taken). */
const tipIcon = (id: string) =>
  screen
    .getByRole('tabpanel')
    .querySelector(`.ant-table-thead [data-testid="${id}"]`) as HTMLElement;

/** Opens the select of the visible tab by its label and picks the option with this text. */
const chooseOptionIn = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  text: string,
) => {
  await user.click(panel().getByRole('combobox', { name: label }));
  const options = await screen.findAllByText(text, { selector: '.ant-select-item-option-content' });
  await user.click(options[options.length - 1]);
};

const openTab = async (name: string) => {
  const user = userEvent.setup();
  await user.click(tab(name));
  return user;
};

describe('the guest page when the language is switched', () => {
  it('keeps the report on screen and asks for nothing again', async () => {
    const calls = backend();
    const { rerender } = renderPage(<GuestPage />);
    await waitFor(() => expect(callsTo(calls, 'guest/daily')).toHaveLength(1));
    await waitFor(() => expect(bodyRows().length).toBeGreaterThan(0));
    rerender(
      <IntlProvider locale="zh-CN" messages={zhCN} onError={() => {}}>
        <App>
          <GuestPage />
        </App>
      </IntlProvider>,
    );
    expect(
      await screen.findByRole('tab', { name: zhCN['stat.guest.tab.cohort'] }),
    ).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 100));
    expect(callsTo(calls, 'guest/daily')).toHaveLength(1);
    expect(bodyRows().length).toBeGreaterThan(0);
  });
});

describe('the first range of each guest tab', () => {
  it.each([
    ['Guest daily', 'guest/daily', 3],
    ['Conversion cohorts', 'guest/cohort', 10],
    ['Guest retention', 'guest/retention', 10],
    ['Allowance use', 'guest/quota', 3],
  ] as const)(
    'on %s is no longer than the backend allows (%s limit %i days), so that the first ask is not refused',
    async (name, path, limit) => {
      setTestInitialState({ meta: { statsMaxRangeDays: limit } });
      const calls = backend();
      renderPage(<GuestPage />);
      if (name !== 'Guest daily') await openTab(name);
      await waitFor(() => expect(callsTo(calls, path)).toHaveLength(1));
      const url = new URL(callsTo(calls, path)[0].url, 'http://x');
      expect(
        daysIn(url.searchParams.get('from') ?? '', url.searchParams.get('to') ?? ''),
      ).toHaveLength(limit);
    },
  );
});

describe('the guest statistics page', () => {
  it('has the four tabs in order, starts on the guest daily report, and says it counts devices and UTC days', async () => {
    backend();
    renderPage(<GuestPage />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Guest daily',
      'Conversion cohorts',
      'Guest retention',
      'Allowance use',
    ]);
    expect(tab('Guest daily')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Statistics days are UTC days/)).toBeInTheDocument();
    expect(screen.getByText(/this page counts devices, not accounts/)).toBeInTheDocument();
  });

  it('is written in Chinese too, with the same four tabs', async () => {
    backend();
    renderPage(<GuestPage />, 'zh-CN');
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      '游客日报',
      '转化进度队列',
      '游客留存',
      '额度使用',
    ]);
  });
});

describe('the guest daily report', () => {
  it('reads the last seven UTC days, also where the local date is already the next day', async () => {
    await withTimeZone('Pacific/Auckland', async () => {
      const calls = backend();
      renderPage(<GuestPage />);
      await waitFor(() => expect(callsTo(calls, 'guest/daily')).toHaveLength(1));
      expect(callsTo(calls, 'guest/daily')[0].url).toBe(
        '/api/admin/stats/guest/daily?from=2026-10-20&to=2026-10-26',
      );
    });
  });

  it('has date, new devices, converted devices and the rate of the day', async () => {
    backend({ daily: () => [daily('2026-10-26')] });
    renderPage(<GuestPage />);
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(headerTexts()).toEqual([
      'Date',
      'New guest devices',
      'Guest devices converted',
      'Conversion rate of the day',
    ]);
  });

  it('computes the rate as converted over new; a dash for no new devices, 0% for a real zero, above 100% as it is', async () => {
    backend({
      daily: () => [
        daily('2026-10-26', { guestDevicesNew: 200, guestDevicesConverted: 50 }),
        daily('2026-10-25', { guestDevicesNew: 0, guestDevicesConverted: 7 }),
        daily('2026-10-24', { guestDevicesNew: 40, guestDevicesConverted: 0 }),
        daily('2026-10-23', { guestDevicesNew: 10, guestDevicesConverted: 15 }),
      ],
    });
    renderPage(<GuestPage />);
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    const rate = (i: number) => bodyRows()[i].querySelectorAll('td')[3].textContent;
    expect([0, 1, 2, 3].map(rate)).toEqual(['25%', '—', '0%', '150%']);
  });

  it('says in the column hints that the rate is not the rate of one batch of devices', async () => {
    backend({ daily: () => [daily('2026-10-26')] });
    const user = userEvent.setup();
    renderPage(<GuestPage />);
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    await user.hover(tipIcon('tip-rate'));
    expect(await screen.findByText(/not the conversion rate of one batch/)).toBeInTheDocument();
    await user.hover(tipIcon('tip-new'));
    expect(
      await screen.findByText(/reinstalling the app creates a new device record/),
    ).toBeInTheDocument();
  });

  it('shows what failed in the words of the error code, never the backend words', async () => {
    backend({ fail: { status: 500, code: 'INTERNAL_ERROR' } });
    renderPage(<GuestPage />);
    const text = await screen.findByText(/Failed to load/);
    expect(text.closest('.ant-alert-error')).not.toBeNull();
    expect(document.body.textContent).not.toContain('raw backend words');
  });

  it('lands daily-business, guest-cohort and guest-retention on the check day, then reads again', async () => {
    as(['STATS:VIEW', 'STATS:LAND']);
    const calls = backend();
    renderPage(<GuestPage />);
    await waitFor(() => expect(callsTo(calls, 'guest/daily')).toHaveLength(1));
    expect(screen.getByText('Check day (UTC)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Re-land this day' }));
    await waitFor(() => expect(callsTo(calls, 'guest/daily')).toHaveLength(2), { timeout: 5000 });
    expect(callsTo(calls, 'land/').map((c) => c.url)).toEqual([
      '/api/admin/stats/land/daily-business?date=2026-10-25',
      '/api/admin/stats/land/guest-cohort?date=2026-10-25',
      '/api/admin/stats/land/guest-retention?date=2026-10-25',
    ]);
  });

  it('reads the conversion tab again too after landing from the daily tab, since that tab stays open behind it', async () => {
    as(['STATS:VIEW', 'STATS:LAND']);
    const calls = backend();
    renderPage(<GuestPage />);
    await waitFor(() => expect(callsTo(calls, 'guest/daily')).toHaveLength(1));
    const user = await openTab('Conversion cohorts');
    await waitFor(() => expect(callsTo(calls, 'guest/cohort')).toHaveLength(1));
    await user.click(tab('Guest daily'));
    fireEvent.click(panel().getByRole('button', { name: 'Re-land this day' }));
    await waitFor(() => expect(callsTo(calls, 'guest/daily')).toHaveLength(2), { timeout: 5000 });
    await waitFor(() => expect(callsTo(calls, 'guest/cohort')).toHaveLength(2), { timeout: 5000 });
  });

  it('does not read a tab that was never opened just because something was landed', async () => {
    as(['STATS:VIEW', 'STATS:LAND']);
    const calls = backend();
    renderPage(<GuestPage />);
    await waitFor(() => expect(callsTo(calls, 'guest/daily')).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Re-land this day' }));
    await waitFor(() => expect(callsTo(calls, 'guest/daily')).toHaveLength(2));
    expect(callsTo(calls, 'guest/cohort')).toHaveLength(0);
    expect(callsTo(calls, 'guest/retention')).toHaveLength(0);
  });

  it('shows no landing bar without STATS:LAND', async () => {
    backend();
    renderPage(<GuestPage />);
    await waitFor(() => expect(bodyRows()).toHaveLength(7));
    expect(screen.queryByRole('button', { name: 'Re-land this day' })).toBeNull();
  });

  it('exports "guest" with exactly the range on screen, not a range that is only being edited', async () => {
    as(['STATS:VIEW', 'STATS:EXPORT']);
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<GuestPage />);
    await waitFor(() => expect(callsTo(calls, 'guest/daily')).toHaveLength(1));
    await chooseLast30Days(user);
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(callsTo(calls, 'export')).toHaveLength(1));
    expect(callsTo(calls, 'export')[0].url).toBe(
      '/api/admin/stats/export/guest?from=2026-10-20&to=2026-10-26',
    );
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(callsTo(calls, 'guest/daily')).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole('button', { name: /Export/ })).not.toBeDisabled());
    await user.click(screen.getByRole('button', { name: /Export/ }));
    await waitFor(() => expect(callsTo(calls, 'export')).toHaveLength(2));
    expect(callsTo(calls, 'export')[1].url).toBe(
      '/api/admin/stats/export/guest?from=2026-09-27&to=2026-10-26',
    );
  });

  it('shows no export without STATS:EXPORT', async () => {
    backend();
    renderPage(<GuestPage />);
    await waitFor(() => expect(bodyRows()).toHaveLength(7));
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
  });
});

describe('the guest daily report: repeated actions and late answers', () => {
  it('lands only once when the button is pressed twice in a row', async () => {
    as(['STATS:VIEW', 'STATS:LAND']);
    const calls = backend();
    renderPage(<GuestPage />);
    await waitFor(() => expect(callsTo(calls, 'guest/daily')).toHaveLength(1));
    const button = screen.getByRole('button', { name: 'Re-land this day' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(callsTo(calls, 'guest/daily')).toHaveLength(2));
    expect(callsTo(calls, 'land/')).toHaveLength(3);
  });

  it('drops an answer that arrives after a newer search was started', async () => {
    let release: (() => void) | undefined;
    let n = 0;
    stubFetch(async ({ url }) => {
      const u = new URL(url, 'http://localhost');
      if (u.pathname === '/api/admin/channels')
        return jsonResponse(200, envelope('200', { items: [] }));
      n += 1;
      if (n === 1) {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return jsonResponse(200, envelope('200', { items: [daily('2026-01-01')] }));
      }
      return jsonResponse(200, envelope('200', { items: [daily('2026-10-26')] }));
    });
    const user = userEvent.setup();
    renderPage(<GuestPage />);
    await waitFor(() => expect(n).toBe(1));
    await chooseLast30Days(user);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    release?.();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(bodyRows()[0].textContent).toContain('2026-10-26');
    expect(document.body.textContent).not.toContain('2026-01-01');
  });
});

describe('the conversion cohorts tab', () => {
  it('reads the last 30 cohort days, with no platform or channel, and no export', async () => {
    as(['STATS:VIEW', 'STATS:EXPORT']);
    const calls = backend();
    renderPage(<GuestPage />);
    await openTab('Conversion cohorts');
    await waitFor(() => expect(callsTo(calls, 'guest/cohort')).toHaveLength(1));
    expect(callsTo(calls, 'guest/cohort')[0].url).toBe(
      '/api/admin/stats/guest/cohort?from=2026-09-27&to=2026-10-26',
    );
    expect(panel().queryByRole('combobox', { name: 'Platform' })).toBeNull();
    expect(panel().queryByRole('combobox', { name: 'Channel package' })).toBeNull();
    expect(panel().queryByRole('button', { name: 'Export' })).toBeNull();
  });

  it('has the matrix: first-seen day, devices in the cohort, D0 D1 D2 D3 D5 D7 D14 D30', async () => {
    backend({ cohort: () => [cohort('2026-10-01')] });
    renderPage(<GuestPage />);
    await openTab('Conversion cohorts');
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(headerTexts()).toEqual([
      'Day the device first appeared',
      'Devices in cohort',
      'Day 0',
      'Day 1',
      'Day 2',
      'Day 3',
      'Day 5',
      'Day 7',
      'Day 14',
      'Day 30',
    ]);
  });

  it('shows the cumulative devices and the share in each cell, with the new devices from D1 on', async () => {
    backend({ cohort: () => [cohort('2026-10-01')] });
    renderPage(<GuestPage />);
    await openTab('Conversion cohorts');
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    const cell = (n: number) => screen.getByTestId(`cohort-cell-2026-10-01-d${n}`).textContent;
    expect(cell(0)).toBe('10 · 10%');
    expect(cell(1)).toBe('15 · 15% (+5)');
    expect(cell(2)).toBe('18 · 18% (+3)');
    expect(cell(5)).toBe('24 · 24% (+4)');
    expect(cell(30)).toBe('33 · 33% (+3)');
  });

  it('puts a green background on a cell that has a share and none on a dash or a 0%', async () => {
    backend({
      cohort: () => [
        cohort('2026-10-25', {
          d0: 0,
          d2: null,
          d3: null,
          d5: null,
          d7: null,
          d14: null,
          d30: null,
        }),
      ],
    });
    renderPage(<GuestPage />);
    await openTab('Conversion cohorts');
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    const background = (n: number) =>
      (screen.getByTestId(`cohort-cell-2026-10-25-d${n}`).closest('td') as HTMLElement).style
        .backgroundColor;
    expect(background(1)).toContain('rgba(');
    expect(background(2)).toBe('');
    expect(background(0)).toBe('');
  });

  it('writes the sign of the change, also when it is negative', async () => {
    backend({ cohort: () => [cohort('2026-10-01', { d1: 8 })] });
    renderPage(<GuestPage />);
    await openTab('Conversion cohorts');
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(screen.getByTestId('cohort-cell-2026-10-01-d1').textContent).toBe('8 · 8% (-2)');
  });

  it('shows a cell that is not due as a dash, with no "new" part, and a cohort of size 0 without a percentage', async () => {
    backend({
      cohort: () => [
        cohort('2026-10-25', { d2: null, d3: null, d5: null, d7: null, d14: null, d30: null }),
        cohort('2026-10-01', { cohortSize: 0, d0: 0, d1: 0 }),
      ],
    });
    renderPage(<GuestPage />);
    await openTab('Conversion cohorts');
    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    expect(screen.getByTestId('cohort-cell-2026-10-25-d2').textContent).toBe('—');
    expect(screen.getByTestId('cohort-cell-2026-10-25-d30').textContent).toBe('—');
    expect(screen.getByTestId('cohort-cell-2026-10-25-d1').textContent).toBe('15 · 15% (+5)');
    expect(screen.getByTestId('cohort-cell-2026-10-01-d0').textContent).toBe('0 · —');
    expect(screen.getByTestId('cohort-cell-2026-10-01-d1').textContent).toBe('0 · — (+0)');
  });

  it('draws the time-to-convert ring from the eight buckets, not counting what is not due', async () => {
    backend({
      cohort: () => [
        cohort('2026-09-01'),
        cohort('2026-10-23', {
          d0: 4,
          d1: 6,
          d2: 7,
          d3: 9,
          d5: null,
          d7: null,
          d14: null,
          d30: null,
        }),
      ],
    });
    renderPage(<GuestPage />);
    await openTab('Conversion cohorts');
    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    expect(chartData('pie').map((d) => [d.label, d.devices])).toEqual([
      ['Same day', 14],
      ['D1', 7],
      ['D2', 4],
      ['D3', 4],
      ['D4–D5', 4],
      ['D6–D7', 3],
      ['D8–D14', 3],
      ['D15–D30', 3],
    ]);
  });

  it('draws one stacked column per cohort: same day, next day, day 2, day 3 and later', async () => {
    backend({ cohort: () => [cohort('2026-09-01')] });
    renderPage(<GuestPage />);
    await openTab('Conversion cohorts');
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(chartData('column').map((d) => [d.cohortDate, d.label, d.devices])).toEqual([
      ['2026-09-01', 'Same day', 10],
      ['2026-09-01', 'Next day', 5],
      ['2026-09-01', 'Day 2', 3],
      ['2026-09-01', 'Day 3 and later', 15],
    ]);
    expect(screen.getByText(/Not split by source/)).toBeInTheDocument();
  });

  it('has the landing bar for daily-business, guest-cohort and guest-retention', async () => {
    as(['STATS:VIEW', 'STATS:LAND']);
    const calls = backend();
    renderPage(<GuestPage />);
    await openTab('Conversion cohorts');
    await waitFor(() => expect(callsTo(calls, 'guest/cohort')).toHaveLength(1));
    fireEvent.click(panel().getByRole('button', { name: 'Re-land this day' }));
    await waitFor(() => expect(callsTo(calls, 'guest/cohort')).toHaveLength(2), { timeout: 5000 });
    expect(callsTo(calls, 'land/').map((c) => c.url)).toEqual([
      '/api/admin/stats/land/daily-business?date=2026-10-25',
      '/api/admin/stats/land/guest-cohort?date=2026-10-25',
      '/api/admin/stats/land/guest-retention?date=2026-10-25',
    ]);
  });

  it('stops after the first landing that fails and still reads again what was landed before it', async () => {
    as(['STATS:VIEW', 'STATS:LAND']);
    const calls = stubFetch(async ({ url }) => {
      const u = new URL(url, 'http://localhost');
      if (u.pathname === '/api/admin/channels')
        return jsonResponse(200, envelope('200', { items: [] }));
      if (u.pathname.endsWith('/land/guest-cohort'))
        return jsonResponse(500, envelope('INTERNAL_ERROR', null, 'raw backend words'));
      if (u.pathname.includes('/land/')) return jsonResponse(200, envelope('200', null));
      return jsonResponse(200, envelope('200', { items: [] }));
    });
    renderPage(<GuestPage />);
    await waitFor(() => expect(callsTo(calls, 'guest/daily')).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Re-land this day' }));
    await waitFor(() => expect(callsTo(calls, 'guest/daily')).toHaveLength(2), { timeout: 5000 });
    expect(callsTo(calls, 'land/').map((c) => c.url)).toEqual([
      '/api/admin/stats/land/daily-business?date=2026-10-25',
      '/api/admin/stats/land/guest-cohort?date=2026-10-25',
    ]);
    expect(document.body.textContent).not.toContain('raw backend words');
  });
});

describe('the guest retention tab', () => {
  it('reads the last 30 cohort days with platform and channel', async () => {
    const calls = backend();
    renderPage(<GuestPage />);
    await openTab('Guest retention');
    await waitFor(() => expect(callsTo(calls, 'guest/retention')).toHaveLength(1));
    expect(callsTo(calls, 'guest/retention')[0].url).toBe(
      '/api/admin/stats/guest/retention?from=2026-09-27&to=2026-10-26&platform=ALL&channel=ALL',
    );
    expect(panel().getByRole('combobox', { name: 'Platform' })).toBeInTheDocument();
    expect(panel().getByRole('combobox', { name: 'Channel package' })).toBeInTheDocument();
  });

  it('says what the cohort is: the day of the first appearance, converted devices counted, unverified devices not', async () => {
    backend();
    renderPage(<GuestPage />);
    await openTab('Guest retention');
    expect(
      await screen.findByText(
        /The cohort is the day a device first appeared\. Devices that have since registered an account are still counted; devices that did not pass device verification are not included/,
      ),
    ).toBeInTheDocument();
  });

  it('shows D1, D7 and D30 by default: one chart with a line for each, and a matrix of devices', async () => {
    backend({ retention: () => [retention('2026-10-01')] });
    renderPage(<GuestPage />);
    await openTab('Guest retention');
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(panel().getAllByTestId('chart-line')).toHaveLength(1);
    expect([...new Set(chartData('line').map((d) => d.series))]).toEqual([
      'Day 1',
      'Day 7',
      'Day 30',
    ]);
    expect(headerTexts()).toEqual([
      'Day the device first appeared',
      'Devices',
      'Day 1',
      'Day 7',
      'Day 30',
    ]);
  });

  it('shows devices and share in each cell, a dash for a day not due, 0 for a real zero', async () => {
    backend({
      retention: () => [
        retention('2026-10-25', { d1: null, d7: null, d30: null }),
        retention('2026-10-01', { d1: 0 }),
      ],
    });
    renderPage(<GuestPage />);
    await openTab('Guest retention');
    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    expect(screen.getByTestId('retention-cell-2026-10-25-d1').textContent).toBe('—');
    expect(screen.getByTestId('retention-cell-2026-10-01-d1').textContent).toBe('0 · 0%');
    expect(screen.getByTestId('retention-cell-2026-10-01-d7').textContent).toBe('20 · 20%');
    expect(screen.getByTestId('retention-cell-2026-10-01-d7').textContent).not.toContain('+');
  });

  it('lets the days be chosen from D1 to D90', async () => {
    backend({ retention: () => [retention('2026-10-01')] });
    const user = userEvent.setup();
    renderPage(<GuestPage />);
    await openTab('Guest retention');
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    await user.click(panel().getByRole('combobox', { name: 'Retention days' }));
    const options = [...document.querySelectorAll('.ant-select-item-option')].map((o) =>
      o.getAttribute('title'),
    );
    expect(options).toEqual([1, 3, 5, 7, 14, 21, 30, 60, 90].map((n) => `Day ${n}`));
  });

  it('keeps the columns and the lines in the order of the days, also when a smaller day is chosen last', async () => {
    backend({ retention: () => [retention('2026-10-01')] });
    const user = userEvent.setup();
    renderPage(<GuestPage />);
    await openTab('Guest retention');
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    await chooseOptionIn(user, 'Retention days', 'Day 3');
    await waitFor(() => expect(headerTexts().filter((h) => /^Day \d+$/.test(h))).toHaveLength(4));
    expect(headerTexts().filter((h) => /^Day \d+$/.test(h))).toEqual([
      'Day 1',
      'Day 3',
      'Day 7',
      'Day 30',
    ]);
    const series = [...new Set(chartData('line').map((d) => d.series))];
    expect(series).toEqual(['Day 1', 'Day 3', 'Day 7', 'Day 30']);
  });

  it('asks for the platform chosen once Search is pressed', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<GuestPage />);
    await openTab('Guest retention');
    await waitFor(() => expect(callsTo(calls, 'guest/retention')).toHaveLength(1));
    await user.click(panel().getByRole('combobox', { name: 'Platform' }));
    await user.click(await screen.findByTitle('iOS'));
    expect(callsTo(calls, 'guest/retention')).toHaveLength(1);
    await user.click(panel().getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(callsTo(calls, 'guest/retention')).toHaveLength(2));
    expect(callsTo(calls, 'guest/retention')[1].url).toContain('platform=IOS');
  });

  it('exports "guest-retention" with exactly the filter on screen', async () => {
    as(['STATS:VIEW', 'STATS:EXPORT']);
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<GuestPage />);
    await openTab('Guest retention');
    await waitFor(() => expect(callsTo(calls, 'guest/retention')).toHaveLength(1));
    await user.click(panel().getByRole('combobox', { name: 'Platform' }));
    await user.click(await screen.findByTitle('Android'));
    await user.click(panel().getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(callsTo(calls, 'guest/retention')).toHaveLength(2));
    await user.click(panel().getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(callsTo(calls, 'export')).toHaveLength(1));
    expect(callsTo(calls, 'export')[0].url).toBe(
      '/api/admin/stats/export/guest-retention?from=2026-09-27&to=2026-10-26&platform=ANDROID&channel=ALL',
    );
  });

  it('exports the filter that was searched, not one that is only being edited', async () => {
    as(['STATS:VIEW', 'STATS:EXPORT']);
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<GuestPage />);
    await openTab('Guest retention');
    await waitFor(() => expect(callsTo(calls, 'guest/retention')).toHaveLength(1));
    await user.click(panel().getByRole('combobox', { name: 'Platform' }));
    await user.click(await screen.findByTitle('Android'));
    await user.click(panel().getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(callsTo(calls, 'export')).toHaveLength(1));
    expect(callsTo(calls, 'export')[0].url).toContain('platform=ALL');
  });

  it('has the landing bar, and no export without STATS:EXPORT', async () => {
    as(['STATS:VIEW', 'STATS:LAND']);
    backend();
    renderPage(<GuestPage />);
    await openTab('Guest retention');
    await screen.findAllByTestId('chart-line');
    expect(panel().getByRole('button', { name: 'Re-land this day' })).toBeInTheDocument();
    expect(panel().queryByRole('button', { name: 'Export' })).toBeNull();
  });
});

describe('the allowance use tab', () => {
  const card = (name: string) => within(screen.getByTestId(`quota-card-${name}`));
  const value = (name: string) => card(name).getByTestId('quota-value').textContent;

  it('reads the last seven UTC days of the devices first seen in them, once', async () => {
    const calls = backend();
    renderPage(<GuestPage />);
    await openTab('Allowance use');
    await waitFor(() => expect(callsTo(calls, 'guest/quota')).toHaveLength(1));
    expect(callsTo(calls, 'guest/quota')[0].url).toBe(
      '/api/admin/stats/guest/quota?from=2026-10-20&to=2026-10-26',
    );
  });

  it('shows the six cards with the formulas of the spec', async () => {
    backend();
    renderPage(<GuestPage />);
    await openTab('Allowance use');
    await screen.findByTestId('quota-card-devices');
    expect(value('configured')).toBe('10 min');
    expect(value('devices')).toBe('1,000');
    expect(value('noGrant')).toBe('200');
    expect(value('neverCalled')).toBe('25%'); // 200 / (1000 - 200)
    expect(value('exhausted')).toBe('50%'); // 400 / (1000 - 200)
    expect(value('avgUsed')).toBe('2.5 min'); // 150 s
  });

  it('shows dashes for both shares and the average when no device has an allowance', async () => {
    backend({
      quota: () =>
        quotaOf({ devices: 50, noGrant: 50, neverCalled: 0, exhausted: 0, avgUsedSeconds: null }),
    });
    renderPage(<GuestPage />);
    await openTab('Allowance use');
    await screen.findByTestId('quota-card-devices');
    expect(value('neverCalled')).toBe('—');
    expect(value('exhausted')).toBe('—');
    expect(value('avgUsed')).toBe('—');
    expect(value('noGrant')).toBe('50');
  });

  it('keeps a real 0% apart from a dash', async () => {
    backend({ quota: () => quotaOf({ neverCalled: 0, exhausted: 0, avgUsedSeconds: 0 }) });
    renderPage(<GuestPage />);
    await openTab('Allowance use');
    await screen.findByTestId('quota-card-devices');
    expect(value('neverCalled')).toBe('0%');
    expect(value('exhausted')).toBe('0%');
    expect(value('avgUsed')).toBe('0 min');
  });

  it('says guests cannot call when the allowance is not configured', async () => {
    backend({ quota: () => quotaOf({ configuredTotalSeconds: null }) });
    renderPage(<GuestPage />);
    await openTab('Allowance use');
    await screen.findByTestId('quota-card-devices');
    expect(value('configured')).toBe('Not configured, guests cannot call');
  });

  it('draws the six buckets and a conversion table with converted over devices', async () => {
    backend();
    renderPage(<GuestPage />);
    await openTab('Allowance use');
    await screen.findByTestId('quota-card-devices');
    expect(chartData('column').map((d) => [d.label, d.devices])).toEqual([
      ['Unused', 200],
      ['0–25%', 100],
      ['25%–50%', 100],
      ['50%–75%', 100],
      ['75%–100% (excl.)', 100],
      ['Used up (≥100%)', 200],
    ]);
    expect(headerTexts()).toEqual(['Bucket', 'Devices', 'Devices converted', 'Conversion rate']);
    const rows = bodyRows().map((r) => [...r.querySelectorAll('td')].map((td) => td.textContent));
    expect(rows[0]).toEqual(['Unused', '200', '4', '2%']);
    expect(rows[5]).toEqual(['Used up (≥100%)', '200', '60', '30%']);
  });

  it('shows a dash as the rate of a bucket without devices', async () => {
    backend({
      quota: () =>
        quotaOf({
          buckets: { ...quotaOf().buckets, LE_25: { devices: 0, converted: 0 } },
        }),
    });
    renderPage(<GuestPage />);
    await openTab('Allowance use');
    await screen.findByTestId('quota-card-devices');
    const row = bodyRows()[1];
    expect([...row.querySelectorAll('td')].map((td) => td.textContent)).toEqual([
      '0–25%',
      '0',
      '0',
      '—',
    ]);
  });

  it('says how the buckets and the converted devices are counted', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<GuestPage />);
    await openTab('Allowance use');
    await screen.findByTestId('quota-card-devices');
    await user.hover(tipIcon('tip-quota-bucket'));
    expect(
      await screen.findByText(/changing the allowance only affects devices issued later/),
    ).toBeInTheDocument();
    await user.hover(tipIcon('tip-quota-converted'));
    expect(
      await screen.findByText(/Converted means the device later registered an account/),
    ).toBeInTheDocument();
  });

  it('gives a hint icon, reachable by touch and keyboard, to each card that has a definition, and none to the cards that have none', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<GuestPage />);
    await openTab('Allowance use');
    await screen.findByTestId('quota-card-devices');
    for (const name of ['configured', 'noGrant', 'neverCalled', 'exhausted', 'avgUsed']) {
      expect(
        within(screen.getByTestId(`quota-card-${name}`)).getByTestId(`tip-quota-card-${name}`),
      ).toBeInTheDocument();
    }
    expect(
      within(screen.getByTestId('quota-card-devices')).queryByTestId('tip-quota-card-devices'),
    ).toBeNull();
    await user.hover(screen.getByTestId('tip-quota-card-neverCalled'));
    expect(await screen.findByText(/used none of it/)).toBeInTheDocument();
  });

  it('says that the range picks devices by the day they first appeared, and that their use counts up to now', async () => {
    backend();
    renderPage(<GuestPage />);
    await openTab('Allowance use');
    await screen.findByTestId('quota-card-devices');
    expect(screen.getByText(/first appeared in the range.*up to now/i)).toBeInTheDocument();
  });

  it('links to the guest call allowance in System settings only with CONFIG:MANAGE', async () => {
    as(['STATS:VIEW', 'CONFIG:MANAGE']);
    backend();
    renderPage(<GuestPage />);
    await openTab('Allowance use');
    await screen.findByTestId('quota-card-devices');
    const link = screen.getByRole('link', { name: /guest call allowance in System settings/ });
    expect(link.getAttribute('href')).toBe('/config#guest.call_minutes_total');
  });

  it('shows no link to System settings without CONFIG:MANAGE', async () => {
    as(['STATS:VIEW', 'STATS:LAND', 'STATS:EXPORT']);
    backend();
    renderPage(<GuestPage />);
    await openTab('Allowance use');
    await screen.findByTestId('quota-card-devices');
    expect(screen.queryByRole('link', { name: /System settings/ })).toBeNull();
  });

  it('has no landing bar and no export, even with STATS:LAND and STATS:EXPORT', async () => {
    as(['STATS:VIEW', 'STATS:LAND', 'STATS:EXPORT']);
    backend();
    renderPage(<GuestPage />);
    await openTab('Allowance use');
    await screen.findByTestId('quota-card-devices');
    expect(panel().queryByRole('button', { name: 'Re-land this day' })).toBeNull();
    expect(panel().queryByRole('button', { name: 'Export' })).toBeNull();
  });

  it('shows what failed in the words of the error code', async () => {
    backend({ fail: { status: 400, code: 'INVALID_REQUEST' } });
    renderPage(<GuestPage />);
    await openTab('Allowance use');
    const text = await panel().findByText(/Failed to load/);
    expect(text.closest('.ant-alert-error')).not.toBeNull();
    expect(document.body.textContent).not.toContain('raw backend words');
  });
});
