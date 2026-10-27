import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderPage } from '../../../tests/renderPage';
import type { RetentionRow } from '../../services/stats/types';
import { resetThemeModeForTests, setThemeMode } from '../../theme/modes';
import { RetentionTrendChart } from './RetentionTrendChart';
import { TrendChart } from './TrendChart';

beforeEach(() => resetThemeModeForTests());

const dataOf = () =>
  JSON.parse(screen.getByTestId('chart-line').textContent ?? '[]') as Record<string, unknown>[];
const configOf = () =>
  JSON.parse(screen.getByTestId('chart-line').getAttribute('data-config') ?? '{}');

describe('TrendChart', () => {
  const series = [
    { field: 'dau', label: 'DAU' },
    { field: 'wau', label: 'WAU', dashed: true },
  ];

  it('has a point for every day of the range, with 0 for a day that has no row', () => {
    renderPage(
      <TrendChart
        rows={[{ statDate: '2026-10-02', dau: 5, wau: 9 }]}
        xField="statDate"
        series={series}
        from="2026-10-01"
        to="2026-10-03"
      />,
    );
    const data = dataOf();
    expect(data.filter((d) => d.series === 'DAU').map((d) => [d.statDate, d.value])).toEqual([
      ['2026-10-01', 0],
      ['2026-10-02', 5],
      ['2026-10-03', 0],
    ]);
    expect(data).toHaveLength(6);
  });

  it('leaves a column that is null as a gap (not known), not as 0 and not as NaN', () => {
    renderPage(
      <TrendChart
        rows={[{ statDate: '2026-10-01', dau: null, wau: 3 }]}
        xField="statDate"
        series={series}
        from="2026-10-01"
        to="2026-10-01"
      />,
    );
    expect(dataOf().find((d) => d.series === 'DAU')?.value).toBeNull();
    expect(dataOf().find((d) => d.series === 'WAU')?.value).toBe(3);
  });

  it('is drawn again with the new theme when the mode changes', () => {
    renderPage(
      <TrendChart rows={[]} xField="statDate" series={series} from="2026-10-01" to="2026-10-02" />,
    );
    const first = configOf();
    expect(first.theme).toBe('classicDark');
    act(() => setThemeMode('light'));
    expect(configOf().theme).toBe('classic');
    expect(configOf().axis).not.toEqual(first.axis);
  });

  it('gives the colours of the palette', () => {
    renderPage(
      <TrendChart rows={[]} xField="statDate" series={series} from="2026-10-01" to="2026-10-02" />,
    );
    expect(configOf().scale.color.range[0]).toBe('#0ABAB5');
  });
});

describe('RetentionTrendChart', () => {
  const row = (cohortDate: string, cohortSize: number, d7: number | null): RetentionRow => ({
    cohortDate,
    cohortSize,
    d1: null,
    d3: null,
    d5: null,
    d7,
    d14: null,
    d21: null,
    d30: null,
    d60: null,
    d90: null,
  });

  it('leaves out cohorts that have no value yet or no members, and does not draw them as 0', () => {
    renderPage(
      <RetentionTrendChart
        day={7}
        rows={[
          row('2026-10-01', 100, 20),
          row('2026-10-02', 100, null),
          row('2026-10-03', 0, 0),
          row('2026-10-04', 50, 0),
        ]}
      />,
    );
    expect(dataOf()).toEqual([
      { cohortDate: '2026-10-01', rate: 0.2, series: 'Day 7' },
      { cohortDate: '2026-10-04', rate: 0, series: 'Day 7' },
    ]);
  });

  it('draws several days as lines of one chart, one series per day, each leaving out its own gaps', () => {
    renderPage(
      <RetentionTrendChart
        days={[1, 7]}
        rows={[
          { ...row('2026-10-01', 100, 20), d1: 50 },
          { ...row('2026-10-02', 100, null), d1: 40 },
        ]}
      />,
    );
    expect(dataOf()).toEqual([
      { cohortDate: '2026-10-01', rate: 0.5, series: 'Day 1' },
      { cohortDate: '2026-10-02', rate: 0.4, series: 'Day 1' },
      { cohortDate: '2026-10-01', rate: 0.2, series: 'Day 7' },
    ]);
    expect(configOf().colorField).toBe('series');
    expect(screen.getAllByTestId('chart-line')).toHaveLength(1);
  });
});
