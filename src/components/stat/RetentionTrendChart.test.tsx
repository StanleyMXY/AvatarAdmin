import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPage } from '../../../tests/renderPage';
import type { RetentionRow } from '../../services/stats/types';
import { resetThemeModeForTests } from '../../theme/modes';
import { RetentionTrendChart } from './RetentionTrendChart';

// The chart stand-in prints only what survives JSON; the formatters are functions, so the last
// props the line chart was given are kept here.
const plots = vi.hoisted(() => ({
  line: null as null | {
    axis?: { y?: { labelFormatter?: (v: number) => string } };
    tooltip?: { items?: { channel?: string; valueFormatter?: (v: number) => string }[] };
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

beforeEach(() => {
  plots.line = null;
  resetThemeModeForTests();
});

const rows: RetentionRow[] = [
  {
    cohortDate: '2026-10-01',
    cohortSize: 8,
    d1: 2,
    d3: null,
    d5: null,
    d7: null,
    d14: null,
    d21: null,
    d30: null,
    d60: null,
    d90: null,
  },
];

describe('RetentionTrendChart: the share is written as a percentage wherever it is read, as in the matrix', () => {
  it('on the vertical axis and in the tooltip, with the number format of the language', () => {
    renderPage(<RetentionTrendChart rows={rows} day={1} />);
    const axis = plots.line?.axis?.y?.labelFormatter;
    const tip = plots.line?.tooltip?.items?.[0];
    expect(axis?.(0.25)).toBe('25%');
    expect(tip?.channel).toBe('y');
    // 2 of 8 = 25%; 1 of 3 shows its decimal place instead of being rounded away
    expect(tip?.valueFormatter?.(0.25)).toBe('25%');
    expect(tip?.valueFormatter?.(1 / 3)).toBe('33.3%');
  });

  it('does the same on a Chinese page', () => {
    renderPage(<RetentionTrendChart rows={rows} day={1} />, 'zh-CN');
    expect(plots.line?.tooltip?.items?.[0]?.valueFormatter?.(0.25)).toBe('25%');
  });
});
