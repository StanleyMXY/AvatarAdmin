import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPage } from '../../../tests/renderPage';
import { resetThemeModeForTests } from '../../theme/modes';
import { ReactivationCharts } from './ReactivationCharts';

type Item = { channel?: string; name?: string; valueFormatter?: (v: number) => string };
type ChartProps = {
  tooltip?: { items?: Item[] };
  axis?: { y?: { labelFormatter?: (v: number) => string } };
};
const plots: { line: ChartProps | null; column: ChartProps | null } = { line: null, column: null };

vi.mock('@ant-design/plots', async () => {
  const stub = await import('../../../tests/stubs/plots');
  return {
    ...stub,
    Line: (props: ChartProps) => {
      plots.line = props;
      return stub.Line(props as never);
    },
    Column: (props: ChartProps) => {
      plots.column = props;
      return stub.Column(props as never);
    },
  };
});

beforeEach(() => {
  plots.line = null;
  plots.column = null;
  resetThemeModeForTests();
});

const rows = [
  { statDate: '2026-10-01', silenceDays: 7, silentUsers: 200, reactivated: 50 },
  { statDate: '2026-10-02', silenceDays: 7, silentUsers: 0, reactivated: 0 },
];

describe('the reactivation charts: what the tooltip says', () => {
  it('names the rate and writes it as a percentage, like the axis; the count has its own name and the digits grouped', () => {
    renderPage(<ReactivationCharts rows={rows} from="2026-10-01" to="2026-10-02" />);
    expect(screen.getByTestId('chart-line')).toBeInTheDocument();
    const rate = plots.line?.tooltip?.items?.[0];
    expect(rate?.channel).toBe('y');
    expect(rate?.name).toBe('Reactivation rate');
    expect(rate?.valueFormatter?.(0.25)).toBe('25%');
    expect(plots.line?.axis?.y?.labelFormatter?.(0.25)).toBe('25%');
    const count = plots.column?.tooltip?.items?.[0];
    expect(count?.channel).toBe('y');
    expect(count?.name).toBe('Reactivated users');
    expect(count?.valueFormatter?.(12345)).toBe('12,345');
  });

  it('says the same in Chinese', () => {
    renderPage(<ReactivationCharts rows={rows} from="2026-10-01" to="2026-10-02" />, 'zh-CN');
    expect(plots.line?.tooltip?.items?.[0]?.name).toBe('回流率');
    expect(plots.column?.tooltip?.items?.[0]?.name).toBe('回流用户数');
  });
});
