import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { monitorStore } from '../../../mock/_core/monitorData';
import * as monitorMock from '../../../mock/monitor.mock';
import { envelope, jsonResponse, stubFetch } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import PipelinePage from './pipeline';
import { signIn } from './testSetup';

const VIEW = ['MONITOR:VIEW'];

beforeEach(() => signIn('reviewer', VIEW));
afterEach(() => vi.unstubAllGlobals());

const T1 = '2026-10-26T01:00:00.000Z';
const T2 = '2026-10-26T01:05:00.000Z';
const point = (
  source: string,
  at: string,
  gpu: number | null,
  count: number | null,
  rate: number | null,
) => ({
  reportedAt: at,
  effectiveAt: at,
  source,
  gpuUtilization: gpu,
  errorCount: count,
  errorRate: rate,
});
const SAMPLE = [
  point('agent-server-1', T1, 0.5, 1, 0.01),
  point('agent-server-1', T2, null, 2, null),
  point('agent-server-2', T2, 0.7, null, null),
];
const fixed = (items: unknown[], truncated = false) =>
  stubFetch(async () => jsonResponse(200, envelope('200', { items, truncated })));

type ChartPoint = { at: number; source: string; value: number | null };
const charts = (): ChartPoint[][] =>
  screen.queryAllByTestId('chart-line').map((c) => JSON.parse(c.textContent ?? '[]'));

describe('the pipeline charts', { timeout: 30000 }, () => {
  it('asks for the last 24 hours when it opens, as instants', async () => {
    const calls = useMockBackend(monitorMock);
    renderPage(<PipelinePage />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    const query = new URL(calls[0].url, 'http://x').searchParams;
    const from = Date.parse(query.get('from') ?? '');
    const to = Date.parse(query.get('to') ?? '');
    expect(to - from).toBe(24 * 3600_000);
    expect(Math.abs(Date.now() - to)).toBeLessThan(5000);
    expect(query.get('source')).toBeNull();
  });

  it('draws GPU utilization, error count and error rate as three charts, and no chart of cost', async () => {
    fixed(SAMPLE);
    renderPage(<PipelinePage />);
    await waitFor(() => expect(screen.getAllByTestId('chart-line')).toHaveLength(3));
    expect(screen.getByText('GPU utilization (%)')).toBeInTheDocument();
    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Error rate (%)')).toBeInTheDocument();
    expect(screen.queryByText(/cost/i, { selector: '.ant-card-head-title' })).toBeNull();
    expect(screen.queryAllByTestId(/chart-/)).toHaveLength(3);
  });

  it('leaves a missing figure out of the chart instead of drawing it as zero', async () => {
    fixed(SAMPLE);
    renderPage(<PipelinePage />);
    await waitFor(() => expect(screen.getAllByTestId('chart-line')).toHaveLength(3));
    const [gpu, count, rate] = charts();
    expect(gpu.map((p) => [p.source, p.value])).toEqual([
      ['agent-server-1', 50],
      ['agent-server-2', 70],
    ]);
    expect(count.map((p) => [p.source, p.value])).toEqual([
      ['agent-server-1', 1],
      ['agent-server-1', 2],
    ]);
    expect(rate.map((p) => [p.source, p.value])).toEqual([['agent-server-1', 1]]);
    for (const series of [gpu, count, rate]) for (const p of series) expect(p.value).not.toBeNull();
  });

  it('shows "No data yet" for a series without any value, not an error, and draws the others', async () => {
    fixed([
      point('agent-server-3', T1, 0.4, null, null),
      point('agent-server-3', T2, 0.5, null, null),
    ]);
    renderPage(<PipelinePage />);
    await waitFor(() => expect(screen.getAllByTestId('chart-line')).toHaveLength(1));
    expect(screen.getAllByText('No data yet')).toHaveLength(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows "No data yet" in place of every chart when nothing has been reported, and no error', async () => {
    monitorStore.pipelineEmpty = true;
    useMockBackend(monitorMock);
    renderPage(<PipelinePage />);
    await waitFor(() => expect(screen.getAllByText('No data yet')).toHaveLength(3));
    expect(screen.queryAllByTestId('chart-line')).toHaveLength(0);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says so when the backend cut the answer at its limit', async () => {
    fixed(SAMPLE, true);
    renderPage(<PipelinePage />);
    expect(await screen.findByText(/too many points in this time range/)).toBeInTheDocument();
  });

  it('does not say so when the answer is whole', async () => {
    fixed(SAMPLE, false);
    renderPage(<PipelinePage />);
    await waitFor(() => expect(screen.getAllByTestId('chart-line')).toHaveLength(3));
    expect(screen.queryByText(/too many points/)).toBeNull();
  });

  it('has a link to the cost report for an administrator who may open it, and says where cost is', async () => {
    signIn('reviewer', [...VIEW, 'COST:VIEW']);
    fixed(SAMPLE);
    renderPage(<PipelinePage />);
    const link = await screen.findByRole('link', { name: /open the cost report/ });
    expect(link).toHaveAttribute('href', '/cost/report');
  });

  it('shows the pointer to the cost report as text, without a link, when the administrator may not open it', async () => {
    fixed(SAMPLE);
    renderPage(<PipelinePage />);
    expect(await screen.findByText(/see the cost report/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /cost report/ })).toBeNull();
  });

  it('draws the series in the language and the time zone of the browser', async () => {
    fixed(SAMPLE);
    renderPage(<PipelinePage />, 'zh-CN');
    expect(await screen.findByText('GPU 利用率（%）')).toBeInTheDocument();
    expect(screen.getByText('报错数')).toBeInTheDocument();
    expect(screen.getByText('时间按浏览器所在时区显示。')).toBeInTheDocument();
  });
});

describe('the range and the source', { timeout: 30000 }, () => {
  it('asks again for the range that is picked', async () => {
    const calls = useMockBackend(monitorMock);
    const user = userEvent.setup();
    renderPage(<PipelinePage />);
    await waitFor(() => expect(screen.getAllByTestId('chart-line').length).toBeGreaterThan(0));
    for (const [label, hours] of [
      ['Last hour', 1],
      ['Last 6 hours', 6],
      ['Last 3 days', 72],
      ['Last 7 days', 168],
    ] as const) {
      const before = calls.length;
      await user.click(screen.getByText(label));
      await waitFor(() => expect(calls.length).toBeGreaterThan(before));
      const query = new URL(calls.at(-1)?.url ?? '', 'http://x').searchParams;
      expect(Date.parse(query.get('to') ?? '') - Date.parse(query.get('from') ?? '')).toBe(
        hours * 3600_000,
      );
    }
  });

  it('keeps the sources it has seen in the list when one is chosen, and sends the choice', async () => {
    const calls = useMockBackend(monitorMock);
    const user = userEvent.setup();
    renderPage(<PipelinePage />);
    await waitFor(() => expect(screen.getAllByTestId('chart-line').length).toBeGreaterThan(0));
    await user.click(screen.getByRole('combobox', { name: 'Source' }));
    const choose = async (name: string) => {
      const options = await screen.findAllByText(name, {
        selector: '.ant-select-item-option-content',
      });
      await user.click(options[options.length - 1]);
    };
    await choose('agent-server-2');
    await waitFor(() => expect(calls.at(-1)?.url).toContain('source=agent-server-2'));
    await waitFor(() => {
      const [gpu] = charts();
      expect(new Set(gpu.map((p) => p.source))).toEqual(new Set(['agent-server-2']));
    });
    // the other sources are still on offer
    await user.click(screen.getByRole('combobox', { name: 'Source' }));
    expect(
      (
        await screen.findAllByText('agent-server-3', {
          selector: '.ant-select-item-option-content',
        })
      ).length,
    ).toBeGreaterThan(0);
  });

  it('reads the data again when "Refresh" is pressed', async () => {
    const calls = useMockBackend(monitorMock);
    renderPage(<PipelinePage />);
    await waitFor(() => expect(screen.getAllByTestId('chart-line').length).toBeGreaterThan(0));
    const before = calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(calls.length).toBe(before + 1));
  });
});

describe('when the answer is a failure', { timeout: 30000 }, () => {
  it('shows the text of the failure with a retry, not a blank page', async () => {
    stubFetch(async () => jsonResponse(403, envelope('ADMIN_FORBIDDEN')));
    renderPage(<PipelinePage />);
    expect(await screen.findByText(/You do not have permission to do this/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('alert')).getByRole('button', { name: 'Retry' }),
    ).toBeInTheDocument();
  });

  it('shows the refusal of a range that is too long as a failure, and keeps the page', async () => {
    stubFetch(async () =>
      jsonResponse(
        400,
        envelope('INVALID_REQUEST', { details: [{ ref: 'from', reason: 'OUT_OF_RANGE' }] }),
      ),
    );
    renderPage(<PipelinePage />);
    expect(await screen.findByText(/Some input is not valid/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Last 24 hours' })).toBeInTheDocument();
  });
});
