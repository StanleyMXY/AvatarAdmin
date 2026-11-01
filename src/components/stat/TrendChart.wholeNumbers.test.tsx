import { describe, expect, it, vi } from 'vitest';

// The shared stand-in for the chart library prints its settings as JSON, which drops a function.
// This file replaces it with one that keeps what the chart was given.
const seen: { props: Record<string, unknown> | null } = { props: null };
vi.mock('@ant-design/plots', () => ({
  Line: (props: Record<string, unknown>) => {
    seen.props = props;
    return null;
  },
}));

import { renderPage } from '../../../tests/renderPage';
import { TrendChart } from './TrendChart';
import { wholeNumberTicks } from './wholeNumberTicks';

const series = [{ field: 'invitees', label: 'Invitees' }];
const yScale = () =>
  (seen.props?.scale as { y?: { tickMethod?: unknown } } | undefined)?.y ?? undefined;

describe('TrendChart with wholeNumbers', () => {
  it('puts a tick only at whole numbers on the vertical axis for a chart of counts', () => {
    renderPage(
      <TrendChart
        rows={[{ statDate: '2026-10-01', invitees: 2 }]}
        xField="statDate"
        series={series}
        from="2026-10-01"
        to="2026-10-02"
        wholeNumbers
      />,
    );
    expect(yScale()?.tickMethod).toBe(wholeNumberTicks);
  });

  it('leaves the ticks to the library for a chart that is not counts', () => {
    renderPage(
      <TrendChart
        rows={[{ statDate: '2026-10-01', invitees: 2 }]}
        xField="statDate"
        series={series}
        from="2026-10-01"
        to="2026-10-02"
      />,
    );
    expect(yScale()?.tickMethod).toBeUndefined();
  });
});
