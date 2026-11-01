import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, jsonResponse, stubFetch, XLSX_TYPE } from '../../../tests/httpStubs';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub, setTestAccess } from '../../../tests/stubs/umi-max';
import access from '../../access';
import { resetSessionState, setToken } from '../../request/session';
import type { SessionQualityRow } from '../../services/stats/types';
import QualityPage from './quality';

// The limits of the red frame come from the build; a test changes them to see the result change.
const vars = vi.hoisted(() => ({ qualityMinSuccessRate: 0.95, qualityMaxSlowShare: 0.05 }));
vi.mock('../../buildVars', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../buildVars')>();
  // The theme reads the colours from the same object: keep them, and make the two limits changeable.
  const live = { ...original.buildVars };
  for (const name of ['qualityMinSuccessRate', 'qualityMaxSlowShare'] as const) {
    Object.defineProperty(live, name, { get: () => vars[name], enumerable: true });
  }
  return { buildVars: live };
});

// The chart stand-in prints only what survives JSON; the formatters are functions, so the last
// props the line chart was given are kept here.
const plots = vi.hoisted(() => ({
  line: null as null | {
    axis?: { y?: { labelFormatter?: (v: number) => string } };
    tooltip?: { items?: { valueFormatter?: (v: number) => string }[] };
  },
}));
vi.mock('@ant-design/plots', async () => {
  const stub = await import('../../../tests/stubs/plots');
  return {
    ...stub,
    Line: (props: NonNullable<typeof plots.line>) => {
      plots.line = props;
      return stub.Line(props as never);
    },
  };
});

const NOW = '2026-10-26T20:00:00Z';

const as = (permissions: string[]) =>
  setTestAccess(
    access({ me: { superAdmin: false, permissions } }) as unknown as Record<string, unknown>,
  );

beforeEach(() => {
  resetUmiStub();
  resetSessionState();
  sessionStorage.clear();
  localStorage.clear();
  setToken('tok');
  vars.qualityMinSuccessRate = 0.95;
  vars.qualityMaxSlowShare = 0.05;
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

const qrow = (statDate: string, over: Partial<SessionQualityRow> = {}): SessionQualityRow => ({
  statDate,
  connected: 100,
  agentUnavailable: 0,
  limitReached: 0,
  discardedUserNotJoined: 0,
  joinLe2s: 100,
  joinLe5s: 0,
  joinLe10s: 0,
  joinGt10s: 0,
  joinMsSum: 100000,
  ...over,
});

type Backend = {
  /** The rows to answer with; gets the number of the call (from 1) and the query. */
  rows?: (n: number, query: URLSearchParams) => SessionQualityRow[] | Promise<SessionQualityRow[]>;
  failWith?: { status: number; code: string };
};

const sheet = () =>
  new Response(Uint8Array.from([80, 75, 3, 4]), {
    status: 200,
    headers: {
      'content-type': XLSX_TYPE,
      'content-disposition': 'attachment; filename="session-quality.xlsx"',
    },
  });

const backend = (options: Backend = {}) => {
  let n = 0;
  return stubFetch(async ({ url }) => {
    const u = new URL(url, 'http://localhost');
    if (u.pathname === '/api/admin/stats/session-quality') {
      if (options.failWith) {
        return jsonResponse(
          options.failWith.status,
          envelope(options.failWith.code, null, 'raw backend words'),
        );
      }
      n += 1;
      const rows = await (options.rows?.(n, u.searchParams) ?? []);
      return jsonResponse(200, envelope('200', { items: rows }));
    }
    if (u.pathname.startsWith('/api/admin/stats/land/'))
      return jsonResponse(200, envelope('200', null));
    if (u.pathname.startsWith('/api/admin/stats/export/')) return sheet();
    return jsonResponse(404, envelope('RESOURCE_NOT_FOUND'));
  });
};

const qualityCalls = (calls: { url: string }[]) =>
  calls.filter((c) => c.url.startsWith('/api/admin/stats/session-quality'));

const card = (name: string) => screen.getByTestId(`quality-card-${name}`);
const cardValue = (name: string) => within(card(name)).getByTestId('quality-value').textContent;
const framed = (name: string) => card(name).getAttribute('data-alert') === 'true';

const lineData = () =>
  JSON.parse(screen.getByTestId('chart-line').textContent ?? '[]') as {
    statDate: string;
    series?: string;
    value: number | null;
  }[];
const columnData = () =>
  JSON.parse(screen.getByTestId('chart-column').textContent ?? '[]') as {
    statDate: string;
    bucket: string;
    value: number;
  }[];
const chartConfig = (id: string) =>
  JSON.parse(screen.getByTestId(id).getAttribute('data-config') ?? '{}') as {
    stack?: boolean;
    colorField?: string;
    axis?: { x?: { title?: string }; y?: { title?: string } };
  };

const bodyRows = () => document.querySelectorAll('.ant-table-tbody tr.ant-table-row');
const headerTexts = () =>
  [...document.querySelectorAll('.ant-table-thead th')].map((h) => h.textContent ?? '');
const cellsOf = (r: Element) => [...r.querySelectorAll('td')].map((td) => td.textContent);

// Two days: 90 connected and 10 failures, then 10 connected and no failure.
const TWO_DAYS = (): SessionQualityRow[] => [
  qrow('2026-10-25', {
    connected: 90,
    agentUnavailable: 10,
    limitReached: 3,
    discardedUserNotJoined: 2,
    joinLe2s: 60,
    joinLe5s: 20,
    joinLe10s: 6,
    joinGt10s: 4,
    joinMsSum: 270000,
  }),
  qrow('2026-10-26', {
    connected: 10,
    agentUnavailable: 0,
    limitReached: 1,
    discardedUserNotJoined: 0,
    joinLe2s: 10,
    joinLe5s: 0,
    joinLe10s: 0,
    joinGt10s: 0,
    joinMsSum: 30000,
  }),
];

const ready = async (rows: Backend['rows'] = TWO_DAYS) => {
  const calls = backend({ rows });
  renderPage(<QualityPage />);
  await screen.findByTestId('quality-card-successRate');
  return calls;
};

describe('the call quality page: what it asks for', () => {
  it('says the statistics day is UTC and reads the last seven UTC days, with no platform and no channel', async () => {
    const calls = backend({ rows: TWO_DAYS });
    renderPage(<QualityPage />);
    expect(screen.getByText(/Statistics days are UTC days/)).toBeInTheDocument();
    await waitFor(() => expect(qualityCalls(calls)).toHaveLength(1));
    expect(qualityCalls(calls)[0].url).toBe(
      '/api/admin/stats/session-quality?from=2026-10-20&to=2026-10-26',
    );
    expect(screen.queryByRole('combobox', { name: 'Platform' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Channel package' })).toBeNull();
  });

  it('shows what failed in the words of the error code, never the backend words', async () => {
    backend({ failWith: { status: 500, code: 'INTERNAL_ERROR' } });
    renderPage(<QualityPage />);
    const alert = (await screen.findByText(/Failed to load/)).closest(
      '[role="alert"]',
    ) as HTMLElement;
    expect(alert.textContent).not.toContain('raw backend words');
    expect(alert.textContent).toMatch(/Failed to load/);
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('only asks again when Search is pressed', async () => {
    const calls = await ready();
    const user = userEvent.setup();
    expect(qualityCalls(calls)).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(qualityCalls(calls)).toHaveLength(2));
  });

  it('never lets an older answer replace a newer one', async () => {
    let releaseFirst: (rows: SessionQualityRow[]) => void = () => {};
    const first = new Promise<SessionQualityRow[]>((resolve) => {
      releaseFirst = resolve;
    });
    const calls = backend({
      rows: (n) =>
        n === 1 ? first : [qrow('2026-10-26', { connected: 70, agentUnavailable: 30 })],
    });
    const user = userEvent.setup();
    renderPage(<QualityPage />);
    await waitFor(() => expect(qualityCalls(calls)).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(cardValue('successRate')).toBe('70%'));
    // the slow first answer arrives last and must be ignored
    releaseFirst([qrow('2026-10-26', { connected: 10, agentUnavailable: 90 })]);
    await new Promise((r) => setTimeout(r, 30));
    expect(cardValue('successRate')).toBe('70%');
  });
});

describe('the call quality page: the six cards', () => {
  it('are the six of the spec, in order', async () => {
    await ready();
    const ids = [...document.querySelectorAll('[data-testid^="quality-card-"]')].map((c) =>
      c.getAttribute('data-testid'),
    );
    expect(ids).toEqual([
      'quality-card-successRate',
      'quality-card-avgJoin',
      'quality-card-le2',
      'quality-card-gt10',
      'quality-card-limitReached',
      'quality-card-notJoined',
    ]);
    const titles = ids.map(
      (id) => screen.getByTestId(id as string).querySelector('.ant-statistic-title')?.textContent,
    );
    expect(titles).toEqual([
      'Connect success rate',
      'Average connect time',
      'Connected within 2 s',
      'Connected after more than 10 s',
      'Calls blocked by a limit',
      'Users who never joined',
    ]);
  });

  it('are made from the totals of the range: connected / (connected + agent unavailable), joinMsSum / connected', async () => {
    await ready();
    expect(cardValue('successRate')).toBe('90.9%'); // 100 / 110
    expect(cardValue('avgJoin')).toBe('3 s'); // 300000 ms / 100 connected
    expect(cardValue('le2')).toBe('70%'); // 70 / 100
    expect(cardValue('gt10')).toBe('4%'); // 4 / 100
    expect(cardValue('limitReached')).toBe('4');
    expect(cardValue('notJoined')).toBe('2');
  });

  it('show a dash when the denominator is 0, and a 0 as 0', async () => {
    await ready(() => [
      qrow('2026-10-26', {
        connected: 0,
        agentUnavailable: 0,
        limitReached: 0,
        discardedUserNotJoined: 0,
        joinLe2s: 0,
        joinLe5s: 0,
        joinLe10s: 0,
        joinGt10s: 0,
        joinMsSum: 0,
      }),
    ]);
    expect(cardValue('successRate')).toBe('—');
    expect(cardValue('avgJoin')).toBe('—');
    expect(cardValue('le2')).toBe('—');
    expect(cardValue('gt10')).toBe('—');
    expect(cardValue('limitReached')).toBe('0');
    expect(cardValue('notJoined')).toBe('0');
    for (const name of ['successRate', 'avgJoin', 'le2', 'gt10']) expect(framed(name)).toBe(false);
  });

  it('show dashes for every card when the backend sent no day at all', async () => {
    await ready(() => []);
    for (const name of ['successRate', 'avgJoin', 'le2', 'gt10', 'limitReached', 'notJoined']) {
      expect(cardValue(name), name).toBe('—');
    }
  });

  it('show 0% (not a dash) when there were attempts and nothing connected, and frame it', async () => {
    await ready(() => [
      qrow('2026-10-26', {
        connected: 0,
        agentUnavailable: 4,
        joinLe2s: 0,
        joinMsSum: 0,
      }),
    ]);
    expect(cardValue('successRate')).toBe('0%');
    expect(cardValue('avgJoin')).toBe('—');
    expect(framed('successRate')).toBe(true);
  });
});

describe('the call quality page: the red frame and the limits of the build', () => {
  it('frames the success rate below the limit and the slow share above it, with the default limits', async () => {
    await ready(() => [
      qrow('2026-10-26', {
        connected: 90,
        agentUnavailable: 10, // 90%: below 95%
        joinLe2s: 80,
        joinLe5s: 0,
        joinLe10s: 0,
        joinGt10s: 10, // 11.1%: above 5%
      }),
    ]);
    expect(framed('successRate')).toBe(true);
    expect(framed('gt10')).toBe(true);
    for (const name of ['avgJoin', 'le2', 'limitReached', 'notJoined']) {
      expect(framed(name), name).toBe(false);
    }
  });

  it('frames only the card whose own figure is past its limit: a slow share does not frame the success rate, and the other way round', async () => {
    await ready(() => [
      qrow('2026-10-26', { connected: 100, agentUnavailable: 0, joinLe2s: 90, joinGt10s: 10 }),
    ]);
    expect(framed('gt10')).toBe(true);
    expect(framed('successRate')).toBe(false);
  });

  it('frames the success rate alone when the connect times are fine', async () => {
    await ready(() => [qrow('2026-10-26', { connected: 80, agentUnavailable: 20 })]);
    expect(framed('successRate')).toBe(true);
    expect(framed('gt10')).toBe(false);
  });

  it('draws no frame for a healthy day', async () => {
    await ready(() => [qrow('2026-10-26', { connected: 99, agentUnavailable: 1 })]);
    expect(cardValue('successRate')).toBe('99%');
    expect(framed('successRate')).toBe(false);
    expect(framed('gt10')).toBe(false);
  });

  it('draws no frame exactly at the limits (below and above are the rule, not at or below)', async () => {
    await ready(() => [qrow('2026-10-26', { connected: 95, agentUnavailable: 5 })]);
    expect(cardValue('successRate')).toBe('95%');
    expect(framed('successRate')).toBe(false);
  });

  it('draws no frame for a slow share exactly at its limit', async () => {
    await ready(() => [qrow('2026-10-26', { connected: 100, joinLe2s: 95, joinGt10s: 5 })]);
    expect(cardValue('gt10')).toBe('5%');
    expect(framed('gt10')).toBe(false);
  });

  it('follows a lower success-rate limit: the same numbers, no frame', async () => {
    vars.qualityMinSuccessRate = 0.9;
    await ready(() => [qrow('2026-10-26', { connected: 92, agentUnavailable: 8 })]);
    expect(cardValue('successRate')).toBe('92%');
    expect(framed('successRate')).toBe(false);
  });

  it('follows a higher success-rate limit: the same numbers, now a frame', async () => {
    vars.qualityMinSuccessRate = 0.99;
    await ready(() => [qrow('2026-10-26', { connected: 97, agentUnavailable: 3 })]);
    expect(cardValue('successRate')).toBe('97%');
    expect(framed('successRate')).toBe(true);
  });

  it('follows a higher slow-share limit: the same numbers, no frame', async () => {
    vars.qualityMaxSlowShare = 0.1;
    await ready(() => [qrow('2026-10-26', { connected: 100, joinLe2s: 92, joinGt10s: 8 })]);
    expect(cardValue('gt10')).toBe('8%');
    expect(framed('gt10')).toBe(false);
  });

  it('follows a lower slow-share limit with a frame', async () => {
    vars.qualityMaxSlowShare = 0.07;
    await ready(() => [qrow('2026-10-26', { connected: 100, joinLe2s: 92, joinGt10s: 8 })]);
    expect(cardValue('gt10')).toBe('8%');
    expect(framed('gt10')).toBe(true);
  });

  it('draws the frame as a red border, so it can be seen', async () => {
    await ready(() => [qrow('2026-10-26', { connected: 50, agentUnavailable: 50 })]);
    expect(framed('successRate')).toBe(true);
    const style = card('successRate').querySelector('.ant-card')?.getAttribute('style') ?? '';
    expect(style + (card('successRate').getAttribute('style') ?? '')).toMatch(/border/i);
  });
});

describe('the call quality page: a figure next to its limit tells which side it is on', () => {
  it('shows the success rate with the digits that tell it from the limit: 94.96% is not written 95%', async () => {
    await ready(() => [qrow('2026-10-26', { connected: 9496, agentUnavailable: 504 })]);
    expect(cardValue('successRate')).toBe('94.96%');
    expect(framed('successRate')).toBe(true);
    // the limit itself keeps the digits it has
    expect(within(card('successRate')).getByText(/95%/)).toBeInTheDocument();
  });

  it('shows the slow share the same way: 5.04% is not written 5%', async () => {
    await ready(() => [
      qrow('2026-10-26', { connected: 10000, joinLe2s: 9496, joinGt10s: 504, agentUnavailable: 0 }),
    ]);
    expect(cardValue('gt10')).toBe('5.04%');
    expect(framed('gt10')).toBe(true);
  });

  it('keeps one digit when the figure is clearly on one side of the limit', async () => {
    await ready(() => [qrow('2026-10-26', { connected: 99, agentUnavailable: 1 })]);
    expect(cardValue('successRate')).toBe('99%');
  });

  it('writes a limit that has more digits with all of them', async () => {
    vars.qualityMinSuccessRate = 0.9525;
    await ready(() => [qrow('2026-10-26', { connected: 90, agentUnavailable: 10 })]);
    expect(within(card('successRate')).getByText(/95\.25%/)).toBeInTheDocument();
  });
});

describe('the call quality page: a day whose figure cannot be right', () => {
  const badDays = () => [
    qrow('2026-10-25', { connected: -50, agentUnavailable: 0 }),
    qrow('2026-10-26', { connected: 90, agentUnavailable: 10 }),
  ];

  it('shows the figure as it is in the table and a dash for the day rate', async () => {
    await ready(badDays);
    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    const cells = cellsOf(bodyRows()[0]);
    expect(cells[1]).toBe('-50');
    expect(cells[3]).toBe('—');
  });

  it('does not add the day up as 0: the totals that need it are dashes, with no frame', async () => {
    await ready(badDays);
    expect(cardValue('successRate')).toBe('—');
    expect(cardValue('avgJoin')).toBe('—');
    expect(cardValue('le2')).toBe('—');
    expect(framed('successRate')).toBe(false);
  });

  it('names the day that has a figure that is not valid', async () => {
    await ready(badDays);
    const note = screen.getByTestId('quality-invalid-note');
    expect(note.textContent).toContain('2026-10-25');
    expect(note.textContent).not.toContain('2026-10-26');
  });

  it('says nothing about invalid figures for good data', async () => {
    await ready();
    expect(screen.queryByTestId('quality-invalid-note')).toBeNull();
  });
});

describe('the call quality page: the charts', () => {
  it('draws the success rate of each day on one line chart with a gap for a day without a row', async () => {
    await ready(() => [
      qrow('2026-10-22', { connected: 90, agentUnavailable: 10 }),
      qrow('2026-10-24', { connected: 0, agentUnavailable: 0, joinLe2s: 0, joinMsSum: 0 }),
      qrow('2026-10-25', { connected: 3, agentUnavailable: 1, joinLe2s: 3, joinMsSum: 3000 }),
    ]);
    expect(screen.getAllByTestId('chart-line')).toHaveLength(1);
    const data = lineData();
    expect(data.map((d) => d.statDate)).toEqual([
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ]);
    // no row, a row without a denominator: not known (a gap), never 0%
    expect(data.map((d) => d.value)).toEqual([null, null, 0.9, null, null, 0.75, null]);
  });

  it('writes the success rate line as percentages: on the axis and in the tooltip, not as 0.9496', async () => {
    await ready(() => [qrow('2026-10-26', { connected: 9496, agentUnavailable: 504 })]);
    const axisLabel = plots.line?.axis?.y?.labelFormatter;
    const tip = plots.line?.tooltip?.items?.[0]?.valueFormatter;
    expect(axisLabel?.(0.9)).toBe('90%');
    expect(tip?.(0.9496)).toBe('94.96%');
  });

  it('names the units on the axes', async () => {
    await ready();
    expect(chartConfig('chart-line').axis?.y?.title).toBe('Success rate (%)');
    expect(chartConfig('chart-line').axis?.x?.title).toBe('Date (UTC)');
    expect(chartConfig('chart-column').axis?.y?.title).toBe('Connected calls (count)');
    expect(chartConfig('chart-column').axis?.x?.title).toBe('Date (UTC)');
  });

  it('stacks the four connect-time buckets, which are exclusive and add up to the connected calls', async () => {
    await ready();
    expect(chartConfig('chart-column')).toMatchObject({ stack: true, colorField: 'bucket' });
    const data = columnData();
    const buckets = [...new Set(data.map((d) => d.bucket))];
    expect(buckets).toEqual(['≤2 s', '2–5 s', '5–10 s', '>10 s']);
    const day = (d: string) => data.filter((x) => x.statDate === d);
    expect(day('2026-10-25').map((x) => x.value)).toEqual([60, 20, 6, 4]);
    expect(day('2026-10-26').map((x) => x.value)).toEqual([10, 0, 0, 0]);
    // each of those days: the four buckets are the 90 and the 10 connected calls
    expect(day('2026-10-25').reduce((s, x) => s + x.value, 0)).toBe(90);
    expect(day('2026-10-26').reduce((s, x) => s + x.value, 0)).toBe(10);
  });

  it('has every day of the range on the stacked chart, 0 for a day without a row', async () => {
    await ready();
    const data = columnData();
    expect(new Set(data.map((d) => d.statDate)).size).toBe(7);
    expect(data.filter((d) => d.statDate === '2026-10-21').every((d) => d.value === 0)).toBe(true);
  });
});

describe('the call quality page: the figures of today are provisional', () => {
  const CARDS = ['successRate', 'avgJoin', 'le2', 'gt10', 'limitReached', 'notJoined'];
  const tagOf = (name: string) => screen.queryByTestId(`quality-provisional-${name}`);

  it('marks every card whose total includes a row of today as provisional', async () => {
    await ready(); // TWO_DAYS: 10-25 and 10-26
    for (const name of CARDS) expect(tagOf(name), name).toHaveTextContent('Provisional');
  });

  it('keeps the mark of the day that was today when the data was read, after midnight passes while the page stays open and nothing is read again', async () => {
    vi.setSystemTime(new Date('2026-10-25T23:58:00Z'));
    await ready(() => [qrow('2026-10-24'), qrow('2026-10-25')]);
    for (const name of CARDS) expect(tagOf(name), name).toHaveTextContent('Provisional');
    // midnight (UTC) passes; the page is drawn again by a change of the dates being edited, no new read
    vi.setSystemTime(new Date('2026-10-26T00:02:00Z'));
    const user = userEvent.setup();
    const [start] = [...document.querySelectorAll<HTMLInputElement>('.ant-picker-input input')];
    await user.click(start);
    await user.click(await screen.findByText('Yesterday (UTC)'));
    // the presets were made when the page opened (23:58 of the 25th), so "yesterday" is the 24th
    await waitFor(() =>
      expect(document.querySelectorAll('.ant-picker-input input')[0]).toHaveValue('2026-10-24'),
    );
    for (const name of CARDS) expect(tagOf(name), name).toHaveTextContent('Provisional');
    expect(screen.getByTestId('provisional-chart-note')).toBeInTheDocument();
  });

  it('marks no card when every row is of a day that is over', async () => {
    await ready(() => [qrow('2026-10-24'), qrow('2026-10-25')]);
    for (const name of CARDS) expect(tagOf(name), name).not.toBeInTheDocument();
    expect(screen.queryByTestId('provisional-chart-note')).not.toBeInTheDocument();
    expect(screen.queryByTestId('provisional-row')).not.toBeInTheDocument();
  });

  it('marks the row of today in the table and no other row', async () => {
    await ready();
    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    const rows = [...bodyRows()];
    expect(within(rows[0] as HTMLElement).queryByTestId('provisional-row')).toBeNull();
    expect(within(rows[1] as HTMLElement).getByTestId('provisional-row')).toHaveTextContent(
      'Provisional',
    );
    expect(cellsOf(rows[1])[0]).toContain('2026-10-26');
  });

  it('draws a hollow point over the marker of today on the line chart, and over no other day', async () => {
    await ready();
    const config = chartConfig('chart-line') as {
      annotations?: { type?: string; shapeField?: string; data?: { statDate: string }[] }[];
      point?: { shapeField?: string };
    };
    expect(config.point?.shapeField).toBe('circle');
    expect(config.annotations).toHaveLength(1);
    expect(config.annotations?.[0]).toMatchObject({ type: 'point', shapeField: 'hollowCircle' });
    expect(config.annotations?.[0].data?.map((d) => d.statDate)).toEqual(['2026-10-26']);
  });

  it('draws no hollow point on the line chart when the day of today has no success rate', async () => {
    await ready(() => [qrow('2026-10-25'), qrow('2026-10-26', { connected: 0, joinLe2s: 0 })]);
    const config = chartConfig('chart-line') as { annotations?: unknown[] };
    expect(config.annotations).toBeUndefined();
  });

  it('flags the columns of today on the stacked chart, and no other column', async () => {
    await ready();
    const data = columnData() as { statDate: string; provisional?: boolean }[];
    expect(data.filter((d) => d.provisional).map((d) => d.statDate)).toEqual(
      Array(4).fill('2026-10-26'),
    );
    expect(data.filter((d) => !d.provisional)).toHaveLength(24);
  });

  it('gives the stacked chart the dashed border style, which is what draws the flagged columns', async () => {
    await ready();
    const config = chartConfig('chart-column') as { style?: { stroke?: string } };
    expect(config.style?.stroke).toBeTruthy();
  });

  it('explains the hollow point and the dashed column under the charts', async () => {
    await ready();
    expect(screen.getByTestId('provisional-chart-note')).toHaveTextContent(
      'A hollow point (a column with a dashed border) is a provisional value',
    );
  });

  it('writes the mark in Chinese when the language is Chinese', async () => {
    backend({ rows: TWO_DAYS });
    renderPage(<QualityPage />, 'zh-CN');
    await screen.findByTestId('quality-card-successRate');
    expect(tagOf('successRate')).toHaveTextContent('临时值');
    expect(screen.getByTestId('provisional-chart-note')).toHaveTextContent('空心点');
  });
});

describe('the call quality page: the detail table', () => {
  it('is one row per day with no paging, the date column fixed on the left', async () => {
    await ready();
    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    expect(document.querySelector('.ant-pagination')).toBeNull();
    expect(
      document.querySelector('.ant-table-thead th.ant-table-cell-fix-start')?.textContent,
    ).toBe('Date (UTC)');
  });

  it('has the columns of the spec', async () => {
    await ready();
    expect(headerTexts()).toEqual([
      'Date (UTC)',
      'Connected',
      'Agent unavailable',
      'Success rate',
      'Average connect time',
      '≤2 s',
      '2–5 s',
      '5–10 s',
      '>10 s',
      'Blocked by a limit',
      'Never joined',
    ]);
  });

  it('shows the figures of each day, and a dash where the denominator is 0', async () => {
    await ready(() => [
      qrow('2026-10-25', {
        connected: 90,
        agentUnavailable: 10,
        limitReached: 3,
        discardedUserNotJoined: 2,
        joinLe2s: 60,
        joinLe5s: 20,
        joinLe10s: 6,
        joinGt10s: 4,
        joinMsSum: 225000,
      }),
      qrow('2026-10-26', {
        connected: 0,
        agentUnavailable: 0,
        joinLe2s: 0,
        joinMsSum: 0,
        limitReached: 0,
      }),
    ]);
    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    expect(cellsOf(bodyRows()[0])).toEqual([
      '2026-10-25',
      '90',
      '10',
      '90%',
      '2.5 s',
      '60',
      '20',
      '6',
      '4',
      '3',
      '2',
    ]);
    expect(cellsOf(bodyRows()[1])).toEqual([
      '2026-10-26Provisional', // the row of today carries the mark after its date
      '0',
      '0',
      '—',
      '—',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
    ]);
  });
});

describe('the call quality page: the hints of the table columns', () => {
  const icon = (id: string) =>
    document.querySelector(`.ant-table-thead [data-testid="${id}"]`) as HTMLElement;

  it('says in the table too that a call blocked by a limit and a user who never joined are not a failure of the service', async () => {
    await ready();
    const user = userEvent.setup();
    await user.hover(icon('tip-limitReached'));
    expect(
      await screen.findByText(/Start attempts refused because the call allowance was used up/),
    ).toBeInTheDocument();
    await user.unhover(icon('tip-limitReached'));
    await user.hover(icon('tip-notJoined'));
    expect(
      await screen.findByText(/Calls dropped because the user never entered the room/),
    ).toBeInTheDocument();
  });

  it('keeps the hints of the success rate and the average connect time', async () => {
    await ready();
    expect(icon('tip-successRate')).toBeTruthy();
    expect(icon('tip-avgJoin')).toBeTruthy();
  });
});

describe('the call quality page: the explanation', () => {
  it('shows how to read the report, and stays closed after it is closed', async () => {
    const user = userEvent.setup();
    await ready();
    expect(screen.getByText('How to read this report')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByText('How to read this report')).toBeNull();
    expect(localStorage.getItem('reportHelper:sessionQuality')).toBe('1');
  });

  it('explains the success rate and the buckets', async () => {
    await ready();
    expect(screen.getByText(/connected \/ \(connected \+ agent unavailable\)/)).toBeInTheDocument();
  });
});

describe('the call quality page: landing and export', () => {
  it('shows no landing bar without STATS:LAND, and no export without STATS:EXPORT', async () => {
    await ready();
    expect(screen.queryByRole('button', { name: 'Re-land this day' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
  });

  it('lands session-quality for the chosen day (yesterday in UTC), then reads again; a second click sends nothing', async () => {
    as(['STATS:VIEW', 'STATS:LAND']);
    const calls = await ready();
    await waitFor(() => expect(qualityCalls(calls)).toHaveLength(1));
    const button = screen.getByRole('button', { name: 'Re-land this day' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(qualityCalls(calls)).toHaveLength(2));
    const lands = calls.filter((c) => c.url.includes('/stats/land/'));
    expect(lands.map((c) => c.url)).toEqual([
      '/api/admin/stats/land/session-quality?date=2026-10-25',
    ]);
  });

  it('exports as "session-quality" with the dates on screen, and a second click sends nothing', async () => {
    as(['STATS:VIEW', 'STATS:EXPORT']);
    const calls = await ready();
    const button = screen.getByRole('button', { name: 'Export' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(calls.some((c) => c.url.includes('/stats/export/'))).toBe(true));
    await new Promise((r) => setTimeout(r, 30));
    const exports = calls.filter((c) => c.url.includes('/stats/export/'));
    expect(exports.map((c) => c.url)).toEqual([
      '/api/admin/stats/export/session-quality?from=2026-10-20&to=2026-10-26',
    ]);
  });

  it('exports the dates on screen, not the ones that are being edited and not searched yet', async () => {
    as(['STATS:VIEW', 'STATS:EXPORT']);
    const calls = await ready();
    const user = userEvent.setup();
    const [start] = [...document.querySelectorAll<HTMLInputElement>('.ant-picker-input input')];
    await user.click(start);
    await user.click(await screen.findByText('Yesterday (UTC)'));
    await waitFor(() =>
      expect(document.querySelectorAll('.ant-picker-input input')[0]).toHaveValue('2026-10-25'),
    );
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/stats/export/'))).toBe(true));
    expect(calls.find((c) => c.url.includes('/stats/export/'))?.url).toBe(
      '/api/admin/stats/export/session-quality?from=2026-10-20&to=2026-10-26',
    );
    // after Search the new dates are the ones asked for
    await waitFor(() => expect(screen.getByRole('button', { name: /Export/ })).not.toBeDisabled());
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(qualityCalls(calls)).toHaveLength(2));
    expect(qualityCalls(calls)[1].url).toBe(
      '/api/admin/stats/session-quality?from=2026-10-25&to=2026-10-25',
    );
  });

  it('needs STATS:VIEW as well as STATS:EXPORT for the export', async () => {
    as(['STATS:EXPORT']);
    backend({ rows: TWO_DAYS });
    renderPage(<QualityPage />);
    await screen.findByTestId('quality-card-successRate');
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
  });
});

describe('the call quality page in Chinese', () => {
  it('has the six card titles in Chinese', async () => {
    backend({ rows: TWO_DAYS });
    renderPage(<QualityPage />, 'zh-CN');
    await screen.findByTestId('quality-card-successRate');
    const titles = [...document.querySelectorAll('.ant-statistic-title')].map(
      (el) => el.textContent,
    );
    expect(titles).toEqual([
      '接通成功率',
      '平均接通耗时',
      '接通耗时 ≤2 秒占比',
      '接通耗时 >10 秒占比',
      '额度限制次数',
      '用户未进入次数',
    ]);
  });
});
