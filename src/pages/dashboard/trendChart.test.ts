import { describe, expect, it } from 'vitest';
import { getChartTheme } from '../../theme/chartTheme';
import { buildTrendChart, type TrendChartInput } from './trendChart';
import type { TrendMetric, TrendPoint } from './trendData';

const TODAY = '2026-10-26';

type Child = {
  type?: string;
  data?: { statDate: string; series: string; value: number | null; provisional?: boolean }[];
  shapeField?: string;
  style?: {
    r?: (d: { provisional: boolean }) => number;
    lineWidth?: unknown;
    fill?: string;
  };
};

const points = (days: [string, number | null][]): TrendPoint[] =>
  days.map(([statDate, value]) => ({ statDate, value, lastWeek: value }));

const build = (over: Partial<TrendChartInput> = {}) => {
  const metrics: TrendMetric[] = over.metrics ?? ['dau'];
  const input: TrendChartInput = {
    metrics,
    points: {
      dau: points([
        ['2026-10-24', 10],
        ['2026-10-25', 20],
        [TODAY, 30],
      ]),
      d1: points([
        ['2026-10-24', 40],
        ['2026-10-25', 50],
        [TODAY, null],
      ]),
    },
    metricLabel: (m) => m,
    lastWeekLabel: (m) => `${m} last week`,
    unitLabel: () => 'unit',
    theme: getChartTheme('light'),
    singleDay: false,
    today: TODAY,
    ...over,
  };
  return buildTrendChart(input).children as Child[];
};
const hollow = (children: Child[]) => children.filter((c) => c.shapeField === 'hollowCircle');
const drawn = (child: Child) => (child.data ?? []).filter((d) => d.provisional);

describe('buildTrendChart: the values of a day that is not over', () => {
  it('draws only today as a hollow point, on the same rows as the solid line so both share one scale', () => {
    const [mark] = hollow(build());
    expect(mark.type).toBe('point');
    expect(drawn(mark).map((d) => [d.series, d.statDate, d.value])).toEqual([['dau', TODAY, 30]]);
    const solid = build().find((c) => c.type === 'line' && c.data?.[0]?.series === 'dau');
    expect(mark.data?.map((d) => d.statDate)).toEqual(solid?.data?.map((d) => d.statDate));
  });

  it('gives the hollow point a radius and an outline, and the days that are over none', () => {
    const [mark] = hollow(build());
    const radius = mark.style?.r as (d: { provisional: boolean }) => number;
    expect(radius({ provisional: true })).toBe(5);
    expect(radius({ provisional: false })).toBe(0);
    const width = mark.style?.lineWidth as (d: { provisional: boolean }) => number;
    expect(width({ provisional: true })).toBe(2);
    expect(width({ provisional: false })).toBe(0);
    expect(mark.style?.fill).toBe(getChartTheme('light').background);
  });

  it('draws no hollow point when no value of the range is provisional', () => {
    const old = {
      dau: points([
        ['2026-10-23', 1],
        ['2026-10-24', 2],
      ]),
    };
    expect(hollow(build({ points: old }))).toEqual([]);
  });

  it('does not draw a hollow point for a gap (a value that is not known)', () => {
    const gap = { dau: points([[TODAY, null]]) };
    expect(hollow(build({ points: gap })).flatMap(drawn)).toEqual([]);
  });

  it('keeps D1 provisional one day longer: the cohort of yesterday is hollow, today has no value', () => {
    const marks = hollow(build({ metrics: ['d1'] })).flatMap(drawn);
    expect(marks.map((d) => [d.statDate, d.value])).toEqual([['2026-10-25', 50]]);
  });

  it('puts the hollow points of the left and the right axis in their own marks', () => {
    const marks = hollow(build({ metrics: ['dau', 'd1'] }));
    expect(marks).toHaveLength(2);
    expect(marks.map((m) => drawn(m).map((d) => d.series))).toEqual([['dau'], ['d1']]);
  });

  it('does not draw a solid marker for the provisional value of a single day, only the hollow one', () => {
    const children = build({
      singleDay: true,
      points: { dau: points([[TODAY, 30]]) },
    });
    const filled = children.filter((c) => c.type === 'point' && c.shapeField !== 'hollowCircle');
    const filledSolid = filled.flatMap((c) => c.data ?? []).filter((d) => d.series === 'dau');
    expect(filledSolid).toEqual([]);
    expect(
      hollow(children)
        .flatMap(drawn)
        .map((d) => d.value),
    ).toEqual([30]);
  });

  it('draws nothing hollow for the dashed lines of last week', () => {
    for (const mark of hollow(build())) {
      expect((mark.data ?? []).some((d) => d.series.includes('last week'))).toBe(false);
    }
  });
});

describe('buildTrendChart: the tooltip of the percentage axis', () => {
  type WithTooltip = Child & {
    tooltip?: { items?: { channel?: string; valueFormatter?: (v: number) => string }[] };
  };
  const tooltipOf = (children: Child[]) =>
    (children as WithTooltip[]).find((c) => c.type === 'line' && c.tooltip)?.tooltip;

  it('writes the D1 values as percentages with one decimal and a percent sign', () => {
    const tip = tooltipOf(build({ metrics: ['d1'] }));
    const format = tip?.items?.[0]?.valueFormatter as (v: number) => string;
    expect(format(30)).toBe('30%');
    expect(format(30.123456)).toBe('30.1%');
    expect(format(0)).toBe('0%');
    expect(format(99.96)).toBe('100%');
  });

  it('has no such tooltip on the count axis', () => {
    expect(tooltipOf(build({ metrics: ['dau'] }))).toBeUndefined();
  });
});
