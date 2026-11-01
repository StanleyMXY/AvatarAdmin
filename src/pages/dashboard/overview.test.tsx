import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dailyRow, retentionRow } from '../../../mock/_core/statData';
import { daysIn } from '../../../mock/_core/statRange';
import { envelope, type FetchCall, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { renderPage } from '../../../tests/renderPage';
import {
  history,
  resetUmiStub,
  setTestAccess,
  setTestInitialState,
} from '../../../tests/stubs/umi-max';
import { withTimeZone } from '../../../tests/withTimeZone';
import access from '../../access';
import { resetSessionState, setToken } from '../../request/session';
import type { RetentionRow, StatDailyRow } from '../../services/stats/types';
import Overview from './overview';

const NOW = '2026-10-26T20:00:00Z';
const TODAY = '2026-10-26';
const WINDOW_FROM = '2026-07-29';

const as = (permissions: string[], superAdmin = false) =>
  setTestAccess(access({ me: { superAdmin, permissions } }) as unknown as Record<string, unknown>);

beforeEach(() => {
  resetUmiStub();
  resetSessionState();
  sessionStorage.clear();
  localStorage.clear();
  setToken('tok');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  as(['STATS:VIEW']);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Numbers chosen so that every comparison has a different answer.
const DAILY: Record<string, Partial<StatDailyRow>> = {
  '2026-10-26': {
    dau: 120,
    newAccountsRegistered: 36,
    callSecondsTotal: 6000,
    newSubscriptions: 5,
    guestDevicesConverted: 12,
  },
  '2026-10-25': {
    dau: 100,
    newAccountsRegistered: 40,
    callSecondsTotal: 4800,
    newSubscriptions: 0,
    guestDevicesConverted: 10,
  },
  '2026-10-19': {
    dau: 80,
    newAccountsRegistered: 36,
    callSecondsTotal: 12000,
    newSubscriptions: 4,
    guestDevicesConverted: 0,
  },
};
const PLATFORM_DAU: Record<string, number> = { ANDROID: 700, IOS: 300 };
const COHORTS: Record<string, Partial<RetentionRow>> = {
  '2026-10-24': { cohortSize: 200, d1: 60 },
  '2026-10-23': { cohortSize: 200, d1: 50 },
  '2026-10-17': { cohortSize: 200, d1: 40 },
};

type Backend = {
  daily?: Record<string, Partial<StatDailyRow>>;
  /** Answer with a row only for these days of platform ALL (the default is a row for every day asked). */
  onlyDays?: string[];
  platformDau?: Record<string, number>;
  cohorts?: Record<string, Partial<RetentionRow>>;
  /** Requests that answer with an error: a name, or `daily:ANDROID` for one platform. */
  fail?: string[];
  alertsTotal?: unknown;
  oldestPendingSeconds?: number | null;
};

const failure = () =>
  jsonResponse(500, envelope('INTERNAL_ERROR', null, 'raw backend words that must not show'));

const backend = (options: Backend = {}) => {
  const fail = new Set(options.fail ?? []);
  return stubFetch(async (call) => {
    const u = new URL(call.url, 'http://localhost');
    const q = u.searchParams;
    if (u.pathname === '/api/admin/stats/daily') {
      const platform = q.get('platform') ?? 'ALL';
      if (fail.has('daily') && platform === 'ALL') return failure();
      if (fail.has(`daily:${platform}`)) return failure();
      const dau = options.platformDau ?? PLATFORM_DAU;
      const rows = daysIn(q.get('from') ?? '', q.get('to') ?? '')
        .filter((day) => platform !== 'ALL' || !options.onlyDays || options.onlyDays.includes(day))
        .map((day) => {
          const base = dailyRow(day, platform, 'ALL', TODAY) as unknown as StatDailyRow;
          if (platform === 'ALL') return { ...base, ...(options.daily ?? DAILY)[day] };
          return dau[platform] !== undefined && day === TODAY
            ? { ...base, dau: dau[platform] }
            : base;
        });
      return jsonResponse(200, envelope('200', { items: rows }));
    }
    if (u.pathname === '/api/admin/stats/retention') {
      if (fail.has('retention')) return failure();
      const rows = daysIn(q.get('from') ?? '', q.get('to') ?? '').map((day) => ({
        ...(retentionRow(day, 'ACTIVE', 'ALL', 'ALL', TODAY) as unknown as RetentionRow),
        ...(options.cohorts ?? COHORTS)[day],
      }));
      return jsonResponse(200, envelope('200', { items: rows }));
    }
    if (u.pathname === '/api/admin/moderation/stats') {
      if (fail.has('moderation')) return failure();
      return jsonResponse(
        200,
        envelope('200', {
          items: [],
          avgHandleSeconds: null,
          oldestPendingSeconds:
            options.oldestPendingSeconds === undefined ? 273_600 : options.oldestPendingSeconds,
        }),
      );
    }
    if (u.pathname === '/api/admin/alerts') {
      if (fail.has('alerts')) return failure();
      return jsonResponse(
        200,
        envelope('200', {
          items: [],
          total: options.alertsTotal === undefined ? 7 : options.alertsTotal,
        }),
      );
    }
    return jsonResponse(404, envelope('RESOURCE_NOT_FOUND'));
  });
};

const pathOf = (call: FetchCall) => new URL(call.url, 'http://localhost').pathname;
const queryOf = (call: FetchCall) => new URL(call.url, 'http://localhost').searchParams;
const callsTo = (calls: FetchCall[], path: string) =>
  calls.filter((c) => pathOf(c) === `/api/admin${path}`);
const dailyCalls = (calls: FetchCall[], platform: string) =>
  callsTo(calls, '/stats/daily').filter((c) => (queryOf(c).get('platform') ?? 'ALL') === platform);

const card = (key: string) => screen.queryByTestId(`dashboard-card-${key}`);
const text = (id: string) => screen.getByTestId(id).textContent ?? '';
const waitForValue = async (key: string) =>
  waitFor(() => expect(screen.getByTestId(`dashboard-value-${key}`)).toBeInTheDocument());
const ALL_PERMISSIONS = ['STATS:VIEW', 'MODERATION:VIEW', 'MONITOR:VIEW'];
const ALL_CARDS = [
  'newAccounts',
  'dau',
  'd1',
  'callMinutes',
  'newSubscriptions',
  'guestConverted',
  'moderation',
  'alerts',
];

const optionOf = (title: string) =>
  [...document.querySelectorAll('.ant-select-item-option')].find(
    (o) => o.getAttribute('title') === title,
  ) as HTMLElement | undefined;

type Child = {
  type?: string;
  data: { statDate: string; series: string; value: number | null }[];
  style?: { lineDash?: number[] };
  shapeField?: string;
  axis?: { y?: { title?: string; position?: string } | false; x?: unknown };
};
const chartConfig = () =>
  JSON.parse(screen.getByTestId('chart-dual-axes').getAttribute('data-config') ?? '{}') as {
    children: Child[];
  };
const lines = () => chartConfig().children.filter((c) => c.type === 'line');
const solid = () => lines().filter((c) => !c.style?.lineDash?.length);
const dashed = () => lines().filter((c) => c.style?.lineDash?.length);
const points = () => chartConfig().children.filter((c) => c.type === 'point');
const markers = () => points().filter((c) => c.shapeField !== 'hollowCircle');
const hollowChildren = () => points().filter((c) => c.shapeField === 'hollowCircle');
// The hollow marker child holds every row of the solid line (radius 0 for the days that are over);
// the rows with `provisional` are the points that are drawn.
const hollow = () =>
  hollowChildren().map((c) => ({
    ...c,
    data: c.data.filter((d) => (d as { provisional?: boolean }).provisional),
  }));
const rowsOf = (children: Child[]) => children.flatMap((c) => c.data);
const seriesIn = (children: Child[]) => [...new Set(rowsOf(children).map((d) => d.series))];

describe('the overview: which requests are made, and which cards show', () => {
  it('asks for exactly four statistics requests with STATS:VIEW, and for nothing else', async () => {
    const calls = backend();
    renderPage(<Overview />);
    await waitForValue('dau');
    await waitFor(() => expect(screen.getByTestId('dashboard-platform')).toBeInTheDocument());
    await waitFor(() => expect(dailyCalls(calls, 'IOS')).toHaveLength(1));
    expect(calls).toHaveLength(4);

    const [all] = dailyCalls(calls, 'ALL');
    expect(dailyCalls(calls, 'ALL')).toHaveLength(1);
    expect(Object.fromEntries(queryOf(all))).toEqual({
      from: WINDOW_FROM,
      to: TODAY,
      platform: 'ALL',
    });
    const [retention] = callsTo(calls, '/stats/retention');
    expect(callsTo(calls, '/stats/retention')).toHaveLength(1);
    expect(Object.fromEntries(queryOf(retention))).toMatchObject({
      from: WINDOW_FROM,
      to: TODAY,
      type: 'ACTIVE',
    });
    for (const platform of ['ANDROID', 'IOS']) {
      expect(dailyCalls(calls, platform)).toHaveLength(1);
      expect(Object.fromEntries(queryOf(dailyCalls(calls, platform)[0]))).toEqual({
        from: TODAY,
        to: TODAY,
        platform,
      });
    }
    expect(callsTo(calls, '/moderation/stats')).toHaveLength(0);
    expect(callsTo(calls, '/alerts')).toHaveLength(0);
  });

  it('reads fewer than 90 days when the backend allows a shorter range, so that the cards do not all fail on a refused range', async () => {
    setTestInitialState({ meta: { statsMaxRangeDays: 31 } });
    const calls = backend();
    renderPage(<Overview />);
    await waitForValue('dau');
    const from = '2026-09-26'; // 31 days up to and including 2026-10-26
    expect(queryOf(dailyCalls(calls, 'ALL')[0]).get('from')).toBe(from);
    expect(queryOf(callsTo(calls, '/stats/retention')[0]).get('from')).toBe(from);
    expect(queryOf(dailyCalls(calls, 'ALL')[0]).get('to')).toBe(TODAY);
  });

  it('keeps 90 days when the backend allows more, and when it does not say', async () => {
    setTestInitialState({ meta: { statsMaxRangeDays: 366 } });
    const calls = backend();
    renderPage(<Overview />);
    await waitForValue('dau');
    expect(queryOf(dailyCalls(calls, 'ALL')[0]).get('from')).toBe(WINDOW_FROM);
  });

  it('adds one request for MODERATION:VIEW and one for MONITOR:VIEW, and sends none without them', async () => {
    as(ALL_PERMISSIONS);
    const calls = backend();
    renderPage(<Overview />);
    await waitForValue('moderation');
    await waitForValue('alerts');
    await waitFor(() => expect(dailyCalls(calls, 'IOS')).toHaveLength(1));
    expect(calls).toHaveLength(6);
    expect(callsTo(calls, '/moderation/stats')).toHaveLength(1);
    expect(callsTo(calls, '/alerts')).toHaveLength(1);
    expect(Object.fromEntries(queryOf(callsTo(calls, '/alerts')[0]))).toEqual({
      status: 'OPEN',
      page: '1',
      pageSize: '1',
    });
    expect(Object.fromEntries(queryOf(callsTo(calls, '/moderation/stats')[0]))).toEqual({
      from: TODAY,
      to: TODAY,
    });
  });

  it('sends only the moderation request for MODERATION:VIEW alone, only the alert request for MONITOR:VIEW alone, and nothing without a code', async () => {
    as(['MODERATION:VIEW']);
    const first = backend();
    const view = renderPage(<Overview />);
    await waitForValue('moderation');
    expect(first.map(pathOf)).toEqual(['/api/admin/moderation/stats']);
    view.unmount();

    as(['MONITOR:VIEW']);
    const second = backend();
    const view2 = renderPage(<Overview />);
    await waitForValue('alerts');
    expect(second.map(pathOf)).toEqual(['/api/admin/alerts']);
    view2.unmount();

    as([]);
    const third = backend();
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('dashboard-empty')).toBeInTheDocument());
    expect(third).toHaveLength(0);
  });

  it('shows the six statistics cards, the trend chart and the platform ring only with STATS:VIEW', async () => {
    backend();
    renderPage(<Overview />);
    await waitForValue('dau');
    for (const key of ALL_CARDS.slice(0, 6)) expect(card(key), key).toBeInTheDocument();
    expect(card('moderation')).not.toBeInTheDocument();
    expect(card('alerts')).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-trend')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-platform')).toBeInTheDocument();
  });

  it('shows no statistics card, chart or ring without STATS:VIEW, and only the card of the other code it has', async () => {
    as(['MODERATION:VIEW']);
    backend();
    renderPage(<Overview />);
    await waitForValue('moderation');
    for (const key of ALL_CARDS.filter((k) => k !== 'moderation')) {
      expect(card(key), key).not.toBeInTheDocument();
    }
    expect(screen.queryByTestId('dashboard-trend')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-platform')).not.toBeInTheDocument();
  });

  it('shows the alert card only with MONITOR:VIEW and the moderation card only with MODERATION:VIEW', async () => {
    as(['MONITOR:VIEW']);
    backend();
    renderPage(<Overview />);
    await waitForValue('alerts');
    expect(card('moderation')).not.toBeInTheDocument();
    for (const key of ALL_CARDS.slice(0, 6)) expect(card(key), key).not.toBeInTheDocument();
  });

  it('shows everything to a super administrator', async () => {
    as([], true);
    const calls = backend();
    renderPage(<Overview />);
    await waitForValue('alerts');
    await waitForValue('moderation');
    await waitForValue('dau');
    for (const key of ALL_CARDS) expect(card(key), key).toBeInTheDocument();
    await waitFor(() => expect(calls).toHaveLength(6));
  });

  it('shows a page, not a blank, to an administrator with no code at all: it says that nothing is available and has no card', async () => {
    as([]);
    backend();
    renderPage(<Overview />);
    expect(await screen.findByTestId('dashboard-empty')).toHaveTextContent(
      'No overview card is available for your account.',
    );
    for (const key of ALL_CARDS) expect(card(key), key).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-quick')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-explain')).not.toBeInTheDocument();
  });

  it('does not show the empty page to someone who has a quick link only', async () => {
    as(['FINANCE:VIEW']);
    backend();
    renderPage(<Overview />);
    await screen.findByTestId('dashboard-quick');
    expect(screen.queryByTestId('dashboard-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-explain')).not.toBeInTheDocument();
  });
});

describe('the overview: the numbers on the cards', () => {
  it('shows the value of today with the change against yesterday and against 7 days ago, in percent', async () => {
    backend();
    renderPage(<Overview />);
    await waitForValue('dau');
    expect(text('dashboard-value-dau')).toBe('120');
    expect(text('dashboard-vs-yesterday-dau')).toBe('+20%');
    expect(text('dashboard-vs-7d-dau')).toBe('+50%');
    expect(text('dashboard-value-newAccounts')).toBe('36');
    expect(text('dashboard-vs-yesterday-newAccounts')).toBe('-10%');
    expect(text('dashboard-vs-7d-newAccounts')).toBe('0%');
    // call seconds over 60: 6000 s is 100 min; 4800 s is 80 min; 12000 s is 200 min
    expect(text('dashboard-value-callMinutes')).toBe('100');
    expect(text('dashboard-vs-yesterday-callMinutes')).toBe('+25%');
    expect(text('dashboard-vs-7d-callMinutes')).toBe('-50%');
  });

  it('colours the rise and the fall of a complete day, and leaves a change of 0 uncoloured', async () => {
    backend({
      cohorts: {
        '2026-10-24': { cohortSize: 200, d1: 60 },
        '2026-10-23': { cohortSize: 200, d1: 50 },
        '2026-10-17': { cohortSize: 200, d1: 80 },
      },
    });
    renderPage(<Overview />);
    await waitForValue('d1');
    // the D1 of cohort 10-24 was counted on 10-25: a complete day, so its changes are judged
    expect(screen.getByTestId('dashboard-vs-yesterday-d1')).toHaveStyle({ color: '#22C55E' });
    expect(text('dashboard-vs-7d-d1')).toBe('-10 pp');
    expect(screen.getByTestId('dashboard-vs-7d-d1')).toHaveStyle({ color: '#EF4444' });
  });

  it('leaves the change of a complete day with no change at all uncoloured', async () => {
    backend({
      cohorts: {
        '2026-10-24': { cohortSize: 200, d1: 60 },
        '2026-10-23': { cohortSize: 200, d1: 60 },
        '2026-10-17': { cohortSize: 200, d1: 60 },
      },
    });
    renderPage(<Overview />);
    await waitForValue('d1');
    expect(text('dashboard-vs-yesterday-d1')).toBe('0 pp');
    expect(screen.getByTestId('dashboard-vs-yesterday-d1').getAttribute('style')).toBeNull();
  });

  it('writes the change of today in neutral grey, with its figure, because today is not over: no green, no red', async () => {
    backend();
    renderPage(<Overview />);
    await waitForValue('dau');
    // +20% and -10% would be green and red if 10-26 were a complete day
    for (const id of ['dashboard-vs-yesterday-dau', 'dashboard-vs-yesterday-newAccounts']) {
      expect(screen.getByTestId(id).getAttribute('style'), id).toBeNull();
      expect(screen.getByTestId(id)).toHaveAttribute('data-tone', 'provisional');
    }
    expect(text('dashboard-vs-yesterday-dau')).toBe('+20%');
    expect(text('dashboard-vs-yesterday-newAccounts')).toBe('-10%');
    expect(screen.getByTestId('dashboard-vs-7d-dau').getAttribute('style')).toBeNull();
  });

  const WHY =
    'One of the two days is not over yet (UTC), so this change is shown in grey and is not judged as a rise or a fall.';

  it('explains the grey in a tooltip that a mouse hover opens, and not in a title attribute that opens for neither a finger nor a keyboard', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<Overview />);
    await waitForValue('dau');
    const change = screen.getByTestId('dashboard-vs-yesterday-dau');
    expect(change).not.toHaveAttribute('title');
    expect(change).toHaveAttribute('tabindex', '0');
    await user.hover(change);
    expect(await screen.findByText(WHY)).toBeInTheDocument();
  });

  it('opens the same tooltip when the keyboard focus reaches the grey change', async () => {
    backend();
    renderPage(<Overview />);
    await waitForValue('dau');
    fireEvent.focus(screen.getByTestId('dashboard-vs-yesterday-dau'));
    expect(await screen.findByText(WHY)).toBeInTheDocument();
  });

  it('gives a change of complete days neither the tooltip nor a stop in the tab order', async () => {
    backend({
      cohorts: {
        '2026-10-24': { cohortSize: 200, d1: 60 },
        '2026-10-23': { cohortSize: 200, d1: 50 },
        '2026-10-17': { cohortSize: 200, d1: 40 },
      },
    });
    renderPage(<Overview />);
    await waitForValue('d1');
    const settled = screen.getByTestId('dashboard-vs-yesterday-d1');
    expect(settled).not.toHaveAttribute('data-tone', 'provisional');
    expect(settled).not.toHaveAttribute('tabindex');
  });

  it('writes the change of a D1 that is still being counted in grey too, and says so in Chinese', async () => {
    backend({
      cohorts: {
        '2026-10-25': { cohortSize: 200, d1: 70 },
        '2026-10-24': { cohortSize: 200, d1: 60 },
      },
    });
    renderPage(<Overview />, 'zh-CN');
    await waitForValue('d1');
    expect(text('dashboard-vs-yesterday-d1')).toBe('+5 个百分点');
    expect(screen.getByTestId('dashboard-vs-yesterday-d1').getAttribute('style')).toBeNull();
    const change = screen.getByTestId('dashboard-vs-yesterday-d1');
    await userEvent.hover(change);
    expect(
      await screen.findByText('其中一天（UTC）还没结束，涨跌只作参考，用灰色显示，不判断好坏。'),
    ).toBeInTheDocument();
  });

  it('does not say anything about provisional values on a change that cannot be told', async () => {
    backend();
    renderPage(<Overview />);
    await waitForValue('newSubscriptions');
    expect(text('dashboard-vs-yesterday-newSubscriptions')).toBe('—');
    expect(screen.getByTestId('dashboard-vs-yesterday-newSubscriptions')).not.toHaveAttribute(
      'title',
    );
  });

  it('shows a dash for a change whose earlier day is 0 or missing, and keeps the value', async () => {
    backend();
    renderPage(<Overview />);
    await waitForValue('newSubscriptions');
    expect(text('dashboard-value-newSubscriptions')).toBe('5');
    expect(text('dashboard-vs-yesterday-newSubscriptions')).toBe('—'); // yesterday 0
    expect(text('dashboard-vs-7d-newSubscriptions')).toBe('+25%');
    expect(text('dashboard-value-guestConverted')).toBe('12');
    expect(text('dashboard-vs-yesterday-guestConverted')).toBe('+20%');
    expect(text('dashboard-vs-7d-guestConverted')).toBe('—'); // 7 days ago 0
  });

  it('shows 0 for a value of 0 and a dash for a value that is not there, never NaN or null', async () => {
    backend({
      daily: {
        '2026-10-26': { dau: 0, newAccountsRegistered: null, callSecondsTotal: null },
        '2026-10-25': { dau: 100 },
      },
    });
    renderPage(<Overview />);
    await waitForValue('dau');
    expect(text('dashboard-value-dau')).toBe('0');
    expect(text('dashboard-vs-yesterday-dau')).toBe('-100%');
    expect(text('dashboard-value-newAccounts')).toBe('—');
    expect(text('dashboard-vs-yesterday-newAccounts')).toBe('—');
    expect(text('dashboard-value-callMinutes')).toBe('—');
    expect(screen.getByTestId('dashboard-card-newAccounts').textContent).not.toMatch(
      /NaN|null|undefined/,
    );
  });

  it('shows a dash for every number of today when the backend has no row for today yet', async () => {
    backend({ daily: { '2026-10-25': { dau: 100 } }, onlyDays: ['2026-10-25'] });
    renderPage(<Overview />);
    await waitForValue('dau');
    expect(text('dashboard-value-dau')).toBe('—');
    expect(text('dashboard-vs-yesterday-dau')).toBe('—');
    expect(screen.queryByTestId('dashboard-temp-dau')).not.toBeInTheDocument();
  });

  it('marks the value of today as temporary on the five daily cards', async () => {
    backend();
    renderPage(<Overview />);
    await waitForValue('dau');
    for (const key of ['newAccounts', 'dau', 'callMinutes', 'newSubscriptions', 'guestConverted']) {
      expect(text(`dashboard-temp-${key}`), key).toBe('Provisional');
    }
  });

  it('takes the D1 retention of the newest ACTIVE cohort that has a d1, with its date, and compares in percentage points', async () => {
    backend();
    renderPage(<Overview />);
    await waitForValue('d1');
    // cohort 2026-10-24: 60 of 200 = 30%; the cohort before: 25%; 7 days before: 20%
    expect(text('dashboard-value-d1')).toBe('30%');
    expect(text('dashboard-vs-yesterday-d1')).toBe('+5 pp');
    expect(text('dashboard-vs-7d-d1')).toBe('+10 pp');
    expect(text('dashboard-card-d1')).toContain('2026-10-24');
    // that d1 was counted on 2026-10-25, so it is not today's value
    expect(screen.queryByTestId('dashboard-temp-d1')).not.toBeInTheDocument();
  });

  it('marks a D1 that was counted today as temporary', async () => {
    backend({
      cohorts: {
        '2026-10-25': { cohortSize: 200, d1: 70 },
        '2026-10-24': { cohortSize: 200, d1: 60 },
      },
    });
    renderPage(<Overview />);
    await waitForValue('d1');
    expect(text('dashboard-value-d1')).toBe('35%');
    expect(text('dashboard-vs-yesterday-d1')).toBe('+5 pp');
    expect(text('dashboard-temp-d1')).toBe('Provisional');
  });

  it('shows a dash for D1 when no cohort has a d1 yet', async () => {
    backend({
      cohorts: Object.fromEntries(daysIn('2026-07-29', TODAY).map((d) => [d, { d1: null }])),
    });
    renderPage(<Overview />);
    await waitForValue('d1');
    expect(text('dashboard-value-d1')).toBe('—');
    expect(text('dashboard-vs-yesterday-d1')).toBe('—');
  });

  it('shows the longest wait of the moderation queue, and the alert count', async () => {
    as(ALL_PERMISSIONS);
    backend({ oldestPendingSeconds: 3 * 86_400 + 4 * 3_600, alertsTotal: 7 });
    renderPage(<Overview />);
    await waitForValue('moderation');
    await waitForValue('alerts');
    expect(text('dashboard-value-moderation')).toBe('3 d 4 h');
    expect(text('dashboard-value-alerts')).toBe('7');
  });

  it('shows a dash and says nothing is waiting when the moderation queue is empty, and 0 for no open alert', async () => {
    as(ALL_PERMISSIONS);
    backend({ oldestPendingSeconds: null, alertsTotal: 0 });
    renderPage(<Overview />);
    await waitForValue('moderation');
    await waitForValue('alerts');
    expect(text('dashboard-value-moderation')).toBe('—');
    expect(text('dashboard-card-moderation')).toMatch(/Nothing is waiting/);
    expect(text('dashboard-value-alerts')).toBe('0');
  });

  it('shows a dash, not a made-up number, when the alert count is not a number', async () => {
    as(['MONITOR:VIEW']);
    backend({ alertsTotal: 'many' });
    renderPage(<Overview />);
    await waitForValue('alerts');
    expect(text('dashboard-value-alerts')).toBe('—');
  });

  it('shows a dash, not a negative number, when the alert count is below 0', async () => {
    as(['MONITOR:VIEW']);
    backend({ alertsTotal: -3 });
    renderPage(<Overview />);
    await waitForValue('alerts');
    expect(text('dashboard-value-alerts')).toBe('—');
  });

  it('goes to the alert page from the alert card and to the queue from the moderation card', async () => {
    as(ALL_PERMISSIONS);
    backend();
    const user = userEvent.setup();
    renderPage(<Overview />);
    await waitForValue('alerts');
    const alerts = within(screen.getByTestId('dashboard-card-alerts')).getByRole('link');
    expect(alerts).toHaveAttribute('href', '/monitor/alerts');
    await user.click(alerts);
    expect(history.push).toHaveBeenCalledWith('/monitor/alerts');
    const queue = within(screen.getByTestId('dashboard-card-moderation')).getByRole('link');
    expect(queue).toHaveAttribute('href', '/moderation/queue');
  });

  it('goes to the page when the card itself is pressed, once, and not twice when the link inside is pressed', async () => {
    as(ALL_PERMISSIONS);
    backend();
    const user = userEvent.setup();
    renderPage(<Overview />);
    await waitForValue('alerts');
    await user.click(within(screen.getByTestId('dashboard-card-alerts')).getByText('Open alerts'));
    expect(history.push).toHaveBeenCalledTimes(1);
    expect(history.push).toHaveBeenLastCalledWith('/monitor/alerts');
    await user.click(screen.getByTestId('dashboard-value-moderation'));
    expect(history.push).toHaveBeenLastCalledWith('/moderation/queue');
    expect(history.push).toHaveBeenCalledTimes(2);
    await user.click(within(screen.getByTestId('dashboard-card-alerts')).getByRole('link'));
    expect(history.push).toHaveBeenCalledTimes(3);
  });

  it('does not make a card a link when it has no page to go to', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<Overview />);
    await waitForValue('dau');
    await user.click(screen.getByTestId('dashboard-value-dau'));
    expect(history.push).not.toHaveBeenCalled();
  });

  it('writes the cards in Chinese when the language is Chinese', async () => {
    backend();
    renderPage(<Overview />, 'zh-CN');
    await waitForValue('dau');
    expect(text('dashboard-card-dau')).toContain('日活');
    expect(text('dashboard-card-dau')).toContain('较昨日');
    expect(text('dashboard-card-dau')).toContain('较 7 天前');
    expect(text('dashboard-temp-dau')).toBe('临时值');
    expect(text('dashboard-card-d1')).toContain('个百分点');
  });
});

describe('the overview: what is said about today being temporary', () => {
  it('writes the number of minutes when the backend says how often the summaries are refreshed', async () => {
    setTestInitialState({ meta: { landIntervalMinutes: 15 } });
    backend();
    renderPage(<Overview />);
    expect(await screen.findByTestId('dashboard-explain')).toHaveTextContent(
      "Today's figures are provisional and are refreshed every 15 minutes.",
    );
  });

  it('writes the number that the backend gave, not a fixed one', async () => {
    setTestInitialState({ meta: { landIntervalMinutes: 7 } });
    backend();
    renderPage(<Overview />);
    expect(await screen.findByTestId('dashboard-explain')).toHaveTextContent(
      "Today's figures are provisional and are refreshed every 7 minutes.",
    );
  });

  it('says only that the figures are provisional, with no number, when the value is not there', async () => {
    backend();
    renderPage(<Overview />);
    const explain = await screen.findByTestId('dashboard-explain');
    expect(explain).toHaveTextContent("Today's figures are provisional.");
    expect(explain.textContent).not.toMatch(/\d/);
  });

  it('does not write a number that is null, 0, negative or not a number', async () => {
    for (const value of [null, 0, -5, 'soon']) {
      setTestInitialState({ meta: { landIntervalMinutes: value } });
      backend();
      const view = renderPage(<Overview />);
      const explain = await screen.findByTestId('dashboard-explain');
      expect(explain.textContent, String(value)).not.toMatch(/\d/);
      view.unmount();
    }
  });

  it('writes the minutes in Chinese too, and says the days are UTC days', async () => {
    setTestInitialState({ meta: { landIntervalMinutes: 15 } });
    backend();
    renderPage(<Overview />, 'zh-CN');
    expect(await screen.findByTestId('dashboard-explain')).toHaveTextContent(
      '今日数据是临时值，每隔 15 分钟刷新一次。',
    );
    expect(screen.getByText(/UTC/)).toBeInTheDocument();
  });
});

describe('the overview: a card that fails does not break the others', () => {
  it('shows the failed daily cards with the words of the error code and a retry, while the other cards show their numbers', async () => {
    as(ALL_PERMISSIONS);
    backend({ fail: ['daily'] });
    renderPage(<Overview />);
    await waitForValue('d1');
    await waitForValue('alerts');
    await waitForValue('moderation');
    for (const key of ['newAccounts', 'dau', 'callMinutes', 'newSubscriptions', 'guestConverted']) {
      const error = screen.getByTestId(`dashboard-error-${key}`);
      expect(error.textContent).toContain('Server error');
      expect(error.textContent).not.toContain('raw backend words');
      expect(within(error).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    }
    expect(text('dashboard-value-d1')).toBe('30%');
    expect(text('dashboard-value-alerts')).toBe('7');
    expect(text('dashboard-value-moderation')).toBe('3 d 4 h');
    // the ring has its own requests and still draws
    await waitFor(() => expect(screen.getByTestId('chart-pie')).toBeInTheDocument());
  });

  it('asks again only for the request that failed when Retry is pressed, and then shows the numbers', async () => {
    as(ALL_PERMISSIONS);
    const calls = backend({ fail: ['daily'] });
    const user = userEvent.setup();
    renderPage(<Overview />);
    const error = await screen.findByTestId('dashboard-error-dau');
    await waitFor(() => expect(calls).toHaveLength(6));
    // the backend is healthy again
    const again = backend();
    await user.click(within(error).getByRole('button', { name: 'Retry' }));
    await waitForValue('dau');
    expect(text('dashboard-value-dau')).toBe('120');
    expect(text('dashboard-value-newAccounts')).toBe('36');
    expect(again.map((c) => [pathOf(c), queryOf(c).get('platform')])).toEqual([
      ['/api/admin/stats/daily', 'ALL'],
    ]);
  });

  it('shows only the D1 card as failed when the retention request fails', async () => {
    backend({ fail: ['retention'] });
    renderPage(<Overview />);
    await waitForValue('dau');
    expect(screen.getByTestId('dashboard-error-d1')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-error-dau')).not.toBeInTheDocument();
    expect(text('dashboard-value-dau')).toBe('120');
  });

  it('shows only the moderation card as failed when its request fails, and only the alert card when that fails', async () => {
    as(ALL_PERMISSIONS);
    backend({ fail: ['moderation'] });
    const view = renderPage(<Overview />);
    await waitForValue('alerts');
    await waitForValue('dau');
    expect(screen.getByTestId('dashboard-error-moderation')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-error-alerts')).not.toBeInTheDocument();
    view.unmount();

    backend({ fail: ['alerts'] });
    renderPage(<Overview />);
    await waitForValue('moderation');
    await waitForValue('dau');
    expect(screen.getByTestId('dashboard-error-alerts')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-error-moderation')).not.toBeInTheDocument();
  });
});

describe('the overview: the trend chart', () => {
  it('has the five range presets, the last seven days chosen at the start', async () => {
    backend();
    renderPage(<Overview />);
    await waitForValue('dau');
    const names = ['Today', 'Last 7 days', 'Last 14 days', 'Last 30 days', 'Custom'];
    for (const name of names) expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Last 7 days' })).toBeChecked();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('draws DAU and new accounts at the start, each with a dashed line for the same days one week before', async () => {
    backend();
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('chart-dual-axes')).toBeInTheDocument());
    expect(seriesIn(solid())).toEqual(['Daily active users', 'New accounts']);
    expect(seriesIn(dashed())).toEqual([
      'Daily active users (same period last week)',
      'New accounts (same period last week)',
    ]);
    const dau = rowsOf(solid()).filter((d) => d.series === 'Daily active users');
    expect(dau.map((d) => d.statDate)).toEqual(daysIn('2026-10-20', TODAY));
    expect(dau.at(-1)?.value).toBe(120);
    const last = rowsOf(dashed()).filter(
      (d) => d.series === 'Daily active users (same period last week)',
    );
    // the dashed point of 2026-10-26 is the value of 2026-10-19
    expect(last.at(-1)).toMatchObject({ statDate: '2026-10-26', value: 80 });
    expect(last).toHaveLength(7);
  });

  it('draws the dashed lines dashed and the solid ones solid', async () => {
    backend();
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('chart-dual-axes')).toBeInTheDocument());
    expect(dashed().length).toBeGreaterThan(0);
    for (const child of dashed()) expect(child.style?.lineDash).toEqual([4, 4]);
    expect(solid().length).toBeGreaterThan(0);
  });

  it('draws the point of today hollow, and only that one: the days that are over keep the plain line', async () => {
    backend();
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('chart-dual-axes')).toBeInTheDocument());
    const rows = rowsOf(hollow());
    expect(rows.map((d) => [d.series, d.statDate, d.value]).sort()).toEqual([
      ['Daily active users', TODAY, 120],
      ['New accounts', TODAY, 36],
    ]);
    // the dashed lines of last week hold no provisional value: last week is over
    expect(rowsOf(hollow()).some((d) => d.series.includes('last week'))).toBe(false);
    // the solid line still has the point of today, so the line itself is not cut
    expect(rowsOf(solid()).filter((d) => d.statDate === TODAY)).toHaveLength(2);
  });

  it('draws no hollow point when today has no number yet', async () => {
    backend({ daily: { '2026-10-25': { dau: 100 } }, onlyDays: ['2026-10-25'] });
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('chart-dual-axes')).toBeInTheDocument());
    expect(rowsOf(hollow())).toEqual([]);
  });

  it('draws the D1 of the cohort of yesterday hollow (it is counted today) and the cohort before it solid', async () => {
    backend({ cohorts: { '2026-10-25': { cohortSize: 200, d1: 70 } } });
    const user = userEvent.setup();
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('chart-dual-axes')).toBeInTheDocument());
    await user.click(screen.getByRole('combobox', { name: 'Metrics' }));
    await waitFor(() => expect(optionOf('D1 retention')).toBeDefined());
    await user.click(optionOf('D1 retention') as HTMLElement);
    await waitFor(() => expect(seriesIn(solid())).toContain('D1 retention'));
    const d1 = rowsOf(hollow()).filter((d) => d.series === 'D1 retention');
    expect(d1.map((d) => [d.statDate, d.value])).toEqual([['2026-10-25', 35]]);
  });

  it('puts the unit on the axis: accounts for DAU and new accounts', async () => {
    backend();
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('chart-dual-axes')).toBeInTheDocument());
    const axes = solid().map((c) => c.axis?.y);
    expect(axes).toHaveLength(1);
    expect(axes[0]).toMatchObject({ title: 'Accounts', position: 'left' });
  });

  it('gives a percentage its own axis on the right when D1 retention is chosen with a count', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('chart-dual-axes')).toBeInTheDocument());
    await user.click(screen.getByRole('combobox', { name: 'Metrics' }));
    await waitFor(() => expect(optionOf('D1 retention')).toBeDefined());
    await user.click(optionOf('D1 retention') as HTMLElement);
    await waitFor(() => expect(seriesIn(solid())).toContain('D1 retention'));
    const axes = solid().map((c) => c.axis?.y);
    expect(axes).toEqual([
      expect.objectContaining({ title: 'Accounts', position: 'left' }),
      expect.objectContaining({ title: '%', position: 'right' }),
    ]);
    // percent values, not ratios: 25 means 25%
    const d1 = rowsOf(solid()).filter((d) => d.series === 'D1 retention');
    expect(d1.find((d) => d.statDate === '2026-10-24')?.value).toBe(30);
    expect(d1.find((d) => d.statDate === '2026-10-23')?.value).toBe(25);
    // and the same cohort one week earlier is its dashed line
    const week = rowsOf(dashed()).filter(
      (d) => d.series === 'D1 retention (same period last week)',
    );
    expect(week.find((d) => d.statDate === '2026-10-24')?.value).toBe(20);
  });

  it('names both units on the left axis when call minutes join the counts', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('chart-dual-axes')).toBeInTheDocument());
    await user.click(screen.getByRole('combobox', { name: 'Metrics' }));
    await waitFor(() => expect(optionOf('Call minutes')).toBeDefined());
    await user.click(optionOf('Call minutes') as HTMLElement);
    await waitFor(() => expect(seriesIn(solid())).toContain('Call minutes'));
    expect(solid()[0].axis?.y).toMatchObject({ title: 'Accounts / Minutes' });
    const call = rowsOf(solid()).filter((d) => d.series === 'Call minutes');
    expect(call.at(-1)?.value).toBe(100);
  });

  it('gives the chart one decimal at most, so labels and tooltips do not show 100.16666666666667', async () => {
    backend({
      daily: { ...DAILY, '2026-10-26': { ...DAILY['2026-10-26'], callSecondsTotal: 6010 } },
    });
    const user = userEvent.setup();
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('chart-dual-axes')).toBeInTheDocument());
    await user.click(screen.getByRole('combobox', { name: 'Metrics' }));
    await waitFor(() => expect(optionOf('Call minutes')).toBeDefined());
    await user.click(optionOf('Call minutes') as HTMLElement);
    await waitFor(() => expect(seriesIn(solid())).toContain('Call minutes'));
    const call = rowsOf(solid()).filter((d) => d.series === 'Call minutes');
    expect(call.at(-1)?.value).toBe(100.2);
  });

  it('always keeps one metric: the last one cannot be removed', async () => {
    backend();
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('chart-dual-axes')).toBeInTheDocument());
    const remove = (title: string) => {
      const tag = [...document.querySelectorAll('.ant-select-selection-item')].find(
        (el) => el.getAttribute('title') === title,
      ) as HTMLElement;
      fireEvent.click(tag.querySelector('.ant-select-selection-item-remove') as HTMLElement);
    };
    remove('Daily active users');
    await waitFor(() => expect(seriesIn(solid())).toEqual(['New accounts']));
    remove('New accounts');
    await new Promise((r) => setTimeout(r, 20));
    expect(seriesIn(solid())).toEqual(['New accounts']);
    expect(document.querySelectorAll('.ant-select-selection-item')).toHaveLength(1);
  });

  it('changes the days drawn with the preset, without asking the backend again', async () => {
    const calls = backend();
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('chart-dual-axes')).toBeInTheDocument());
    await waitFor(() => expect(calls).toHaveLength(4));
    const days = () =>
      rowsOf(solid())
        .filter((d) => d.series === 'Daily active users')
        .map((d) => d.statDate);
    fireEvent.click(screen.getByRole('radio', { name: 'Last 14 days' }));
    await waitFor(() => expect(days()).toEqual(daysIn('2026-10-13', TODAY)));
    fireEvent.click(screen.getByRole('radio', { name: 'Last 30 days' }));
    await waitFor(() => expect(days()).toEqual(daysIn('2026-09-27', TODAY)));
    fireEvent.click(screen.getByRole('radio', { name: 'Today' }));
    await waitFor(() => expect(days()).toEqual([TODAY]));
    expect(calls).toHaveLength(4);
    // one day has no line to draw: the values are drawn as markers, and written beside them
    expect(markers().length).toBeGreaterThan(0);
    expect(rowsOf(markers()).every((d) => d.statDate === TODAY)).toBe(true);
    // the value of today is not over: its marker is the hollow one, and not also a filled one
    expect(rowsOf(markers()).some((d) => !d.series.includes('last week'))).toBe(false);
    expect(rowsOf(hollow()).map((d) => d.series)).toEqual(['Daily active users', 'New accounts']);
    fireEvent.click(screen.getByRole('radio', { name: 'Last 7 days' }));
    await waitFor(() => expect(days()).toHaveLength(7));
    expect(markers()).toHaveLength(0);
    expect(rowsOf(hollow())).toHaveLength(2);
  });

  it('shows a day of 0 for a day without a row, and a gap for today before its row is there', async () => {
    backend({ daily: { '2026-10-22': { dau: 700 } }, onlyDays: ['2026-10-22'] });
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('chart-dual-axes')).toBeInTheDocument());
    const dau = rowsOf(solid()).filter((d) => d.series === 'Daily active users');
    expect(dau.map((d) => d.value)).toEqual([0, 0, 700, 0, 0, 0, null]);
  });

  it('offers a calendar for the custom range, limited to the 90 days that were loaded', async () => {
    backend();
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('chart-dual-axes')).toBeInTheDocument());
    expect(document.querySelector('.ant-picker-range')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
    expect(document.querySelector('.ant-picker-range')).not.toBeNull();
    // choosing it changes nothing until days are picked
    const days = rowsOf(solid()).filter((d) => d.series === 'Daily active users');
    expect(days).toHaveLength(7);
  });

  it('gives the chart library a new chart when the metrics or one day against many change, because it keeps the old marks otherwise', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('chart-dual-axes')).toBeInTheDocument());
    const first = screen.getByTestId('chart-dual-axes');
    fireEvent.click(screen.getByRole('radio', { name: 'Today' }));
    await waitFor(() => expect(screen.getByTestId('chart-dual-axes')).not.toBe(first));
    const second = screen.getByTestId('chart-dual-axes');
    await user.click(screen.getByRole('combobox', { name: 'Metrics' }));
    await waitFor(() => expect(optionOf('Call minutes')).toBeDefined());
    await user.click(optionOf('Call minutes') as HTMLElement);
    await waitFor(() => expect(screen.getByTestId('chart-dual-axes')).not.toBe(second));
  });

  it('keeps the chosen metrics in the order of the spec, whatever order they were chosen in', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('chart-dual-axes')).toBeInTheDocument());
    for (const title of ['D1 retention', 'Call minutes']) {
      await user.click(screen.getByRole('combobox', { name: 'Metrics' }));
      await waitFor(() => expect(optionOf(title)).toBeDefined());
      await user.click(optionOf(title) as HTMLElement);
    }
    await waitFor(() => expect(seriesIn(solid())).toContain('Call minutes'));
    const tags = [...document.querySelectorAll('.ant-select-selection-item')].map((el) =>
      el.getAttribute('title'),
    );
    expect(tags).toEqual(['Daily active users', 'New accounts', 'Call minutes', 'D1 retention']);
  });

  it('does not let the custom range reach days that were not loaded: later than today and earlier than 90 days back are disabled', async () => {
    backend();
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('chart-dual-axes')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
    const input = document.querySelector('.ant-picker-range input') as HTMLElement;
    fireEvent.mouseDown(input);
    fireEvent.click(input);
    await waitFor(() => expect(document.querySelector('.ant-picker-cell')).not.toBeNull());
    const cell = (day: string) =>
      document.querySelector(`.ant-picker-cell[title="${day}"]`) as HTMLElement | null;
    expect(cell('2026-10-25')?.className).not.toContain('ant-picker-cell-disabled');
    expect(cell(TODAY)?.className).not.toContain('ant-picker-cell-disabled');
    expect(cell('2026-10-27')?.className).toContain('ant-picker-cell-disabled');
  });

  it('shows the failure on the chart, and keeps the other cards, when the daily request fails', async () => {
    backend({ fail: ['daily'] });
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('dashboard-error-trend')).toBeInTheDocument());
    expect(text('dashboard-error-trend')).toContain('Server error');
    expect(text('dashboard-error-trend')).not.toContain('raw backend words');
    expect(screen.queryByTestId('chart-dual-axes')).not.toBeInTheDocument();
    await waitForValue('d1');
  });

  it('draws the metrics that were read when another one could not be: D1 fails, the daily metrics are drawn, and what failed is named with a retry', async () => {
    const calls = backend({ fail: ['retention'] });
    const user = userEvent.setup();
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('chart-dual-axes')).toBeInTheDocument());
    await user.click(screen.getByRole('combobox', { name: 'Metrics' }));
    await waitFor(() => expect(optionOf('D1 retention')).toBeDefined());
    await user.click(optionOf('D1 retention') as HTMLElement);
    const note = await screen.findByTestId('dashboard-trend-partial');
    expect(note.textContent).toContain('D1 retention');
    expect(note.textContent).toContain('Server error');
    expect(note.textContent).not.toContain('raw backend words');
    // the chart is still there, with the daily metrics and without D1
    expect(screen.queryByTestId('dashboard-error-trend')).toBeNull();
    expect(seriesIn(solid())).toEqual(
      expect.arrayContaining(['Daily active users', 'New accounts']),
    );
    expect(seriesIn(solid())).not.toContain('D1 retention');
    // Retry asks again for the retention only
    const before = callsTo(calls, '/stats/retention').length;
    await user.click(within(note).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(callsTo(calls, '/stats/retention').length).toBe(before + 1));
  });

  it('shows the failure in place of the chart when every chosen metric needs the request that failed', async () => {
    backend({ fail: ['retention'] });
    const user = userEvent.setup();
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('chart-dual-axes')).toBeInTheDocument());
    await user.click(screen.getByRole('combobox', { name: 'Metrics' }));
    await waitFor(() => expect(optionOf('D1 retention')).toBeDefined());
    await user.click(optionOf('D1 retention') as HTMLElement);
    await screen.findByTestId('dashboard-trend-partial');
    for (const title of ['Daily active users', 'New accounts']) {
      await user.click(screen.getByRole('combobox', { name: 'Metrics' }));
      await waitFor(() => expect(optionOf(title)).toBeDefined());
      await user.click(optionOf(title) as HTMLElement);
    }
    await waitFor(() => expect(screen.getByTestId('dashboard-error-trend')).toBeInTheDocument());
    expect(screen.queryByTestId('chart-dual-axes')).toBeNull();
  });

  it('shows the failure of the daily request on the chart when D1 is not chosen, as before', async () => {
    backend({ fail: ['daily'] });
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('dashboard-error-trend')).toBeInTheDocument());
    expect(screen.queryByTestId('dashboard-trend-partial')).toBeNull();
  });
});

describe('the overview: the platform ring', () => {
  it('draws the DAU of today for Android and iOS from two requests of today only, marked temporary', async () => {
    const calls = backend();
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('chart-pie')).toBeInTheDocument());
    const data = JSON.parse(screen.getByTestId('chart-pie').textContent ?? '[]') as {
      platform: string;
      value: number;
    }[];
    expect(data).toEqual([
      { platform: 'Android', value: 700 },
      { platform: 'iOS', value: 300 },
    ]);
    expect(text('dashboard-platform-ANDROID')).toContain('700');
    expect(text('dashboard-platform-ANDROID')).toContain('70%');
    expect(text('dashboard-platform-IOS')).toContain('30%');
    expect(text('dashboard-temp-platform')).toBe('Provisional');
    expect(dailyCalls(calls, 'ANDROID')).toHaveLength(1);
    expect(dailyCalls(calls, 'IOS')).toHaveLength(1);
  });

  it('says there is nothing to draw when neither platform has a number, never an empty or all-zero ring', async () => {
    backend({ platformDau: { ANDROID: 0, IOS: 0 } });
    renderPage(<Overview />);
    await waitFor(() => expect(screen.getByTestId('dashboard-platform-empty')).toBeInTheDocument());
    expect(screen.queryByTestId('chart-pie')).not.toBeInTheDocument();
  });

  it('shows the failure of the ring on the ring only, and asks again only for the platform that failed', async () => {
    const calls = backend({ fail: ['daily:IOS'] });
    const user = userEvent.setup();
    renderPage(<Overview />);
    const error = await screen.findByTestId('dashboard-error-platform');
    expect(error.textContent).not.toContain('raw backend words');
    await waitForValue('dau');
    await waitFor(() => expect(calls).toHaveLength(4));
    const again = backend();
    await user.click(within(error).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByTestId('chart-pie')).toBeInTheDocument());
    expect(text('dashboard-platform-IOS')).toContain('300');
    expect(again.map((c) => [pathOf(c), queryOf(c).get('platform')])).toEqual([
      ['/api/admin/stats/daily', 'IOS'],
    ]);
  });
});

describe('the overview: the quick links', () => {
  const linkNames = () =>
    within(screen.getByTestId('dashboard-quick'))
      .getAllByRole('link')
      .map((a) => [a.textContent, a.getAttribute('href')]);

  it('shows the daily report, retention, guest statistics and call quality with STATS:VIEW', async () => {
    backend();
    renderPage(<Overview />);
    await screen.findByTestId('dashboard-quick');
    expect(linkNames()).toEqual([
      ['Daily report', '/stat/daily'],
      ['Retention', '/stat/retention'],
      ['Guest statistics', '/stat/guest'],
      ['Call quality', '/sessions/quality'],
    ]);
  });

  it('shows the subscription statistics with FINANCE:VIEW only, and nothing else for that code', async () => {
    as(['FINANCE:VIEW']);
    backend();
    renderPage(<Overview />);
    await screen.findByTestId('dashboard-quick');
    expect(linkNames()).toEqual([['Subscription statistics', '/subscriptions/stats']]);
  });

  it('shows all five to a super administrator and none to someone with no code', async () => {
    as([], true);
    backend();
    const view = renderPage(<Overview />);
    await screen.findByTestId('dashboard-quick');
    expect(linkNames().map(([, href]) => href)).toEqual([
      '/stat/daily',
      '/stat/retention',
      '/stat/guest',
      '/sessions/quality',
      '/subscriptions/stats',
    ]);
    view.unmount();
    as(['MODERATION:VIEW']);
    renderPage(<Overview />);
    await waitForValue('moderation');
    expect(screen.queryByTestId('dashboard-quick')).not.toBeInTheDocument();
  });

  it('goes to the page inside the app when a link is pressed', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<Overview />);
    await screen.findByTestId('dashboard-quick');
    await user.click(
      within(screen.getByTestId('dashboard-quick')).getByRole('link', { name: 'Daily report' }),
    );
    expect(history.push).toHaveBeenCalledWith('/stat/daily');
  });
});

describe('the overview: UTC days', () => {
  it('asks for the UTC day, not the day of the browser', async () => {
    // 20:00 UTC on 2026-10-26 is already the 27th in Auckland.
    await withTimeZone('Pacific/Auckland', async () => {
      as(ALL_PERMISSIONS);
      const calls = backend();
      renderPage(<Overview />);
      await waitForValue('dau');
      await waitForValue('moderation');
      await waitForValue('alerts');
      await waitFor(() => expect(calls).toHaveLength(6));
      expect(Object.fromEntries(queryOf(dailyCalls(calls, 'ALL')[0]))).toMatchObject({ to: TODAY });
      for (const platform of ['ANDROID', 'IOS']) {
        expect(Object.fromEntries(queryOf(dailyCalls(calls, platform)[0]))).toMatchObject({
          from: TODAY,
          to: TODAY,
        });
      }
      expect(Object.fromEntries(queryOf(callsTo(calls, '/moderation/stats')[0]))).toEqual({
        from: TODAY,
        to: TODAY,
      });
      expect(text('dashboard-value-dau')).toBe('120');
    });
  });

  it('says that the days are UTC days', async () => {
    backend();
    renderPage(<Overview />);
    await waitForValue('dau');
    expect(screen.getByText(/UTC/)).toBeInTheDocument();
  });
});
