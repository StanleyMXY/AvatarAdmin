import type { ChartThemeConfig } from '../../theme/chartTheme';
import { axisGroupOf, TREND_METRICS, type TrendMetric, type TrendPoint } from './trendData';

type Row = { statDate: string; series: string; value: number | null };
type Group = 'count' | 'percent';

export type TrendChartInput = {
  /** The chosen metrics, in the order of `TREND_METRICS`. */
  metrics: TrendMetric[];
  points: Partial<Record<TrendMetric, TrendPoint[]>>;
  metricLabel: (metric: TrendMetric) => string;
  lastWeekLabel: (metric: TrendMetric) => string;
  /** The unit written on the axis for a metric ("Accounts", "Minutes", "%"). */
  unitLabel: (metric: TrendMetric) => string;
  theme: ChartThemeConfig;
  /** A single day has no line to draw, so its values are written beside the points. */
  singleDay: boolean;
};

const DASH_PATTERN = [4, 4];

/** One decimal is all a label or a tooltip needs (call minutes come as seconds over 60). */
const oneDecimal = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 10) / 10;

/**
 * The chart of the chosen metrics as one chart: a line for each, and for each a dashed line of the
 * same colour for the same days one week earlier. Numbers of people and minutes share the left
 * axis, a percentage has the right axis (or the left one when it is alone); every axis carries its
 * unit. The solid and the dashed lines of one axis share its scale.
 */
export function buildTrendChart(input: TrendChartInput) {
  const { metrics, points, theme } = input;
  const color = (metric: TrendMetric) =>
    theme.palette[TREND_METRICS.indexOf(metric) % theme.palette.length];

  const groups = (['count', 'percent'] as Group[])
    .map((group) => ({ group, metrics: metrics.filter((m) => axisGroupOf(m) === group) }))
    .filter((g) => g.metrics.length > 0);

  const domain: string[] = [];
  const range: string[] = [];
  const children: Record<string, unknown>[] = [];

  groups.forEach(({ group, metrics: members }, index) => {
    const solid: Row[] = [];
    const dashed: Row[] = [];
    for (const metric of members) {
      domain.push(input.metricLabel(metric), input.lastWeekLabel(metric));
      range.push(color(metric), color(metric));
      for (const point of points[metric] ?? []) {
        solid.push({
          statDate: point.statDate,
          series: input.metricLabel(metric),
          value: oneDecimal(point.value),
        });
        dashed.push({
          statDate: point.statDate,
          series: input.lastWeekLabel(metric),
          value: oneDecimal(point.lastWeek),
        });
      }
    }
    const units = [...new Set(members.map(input.unitLabel))];
    const base = {
      type: 'line',
      xField: 'statDate',
      yField: 'value',
      colorField: 'series',
      scale: { y: { key: group, domainMin: 0, nice: true } },
      ...(input.singleDay
        ? {
            labels: [
              {
                text: 'value',
                style: { fill: theme.textColor, dy: -8 },
                transform: [{ type: 'overlapDodgeY' }],
              },
            ],
          }
        : {}),
      ...(group === 'percent'
        ? {
            tooltip: {
              items: [
                {
                  channel: 'y',
                  valueFormatter: (v: number) => `${Math.round(v * 10) / 10}%`,
                },
              ],
            },
          }
        : {}),
    };
    children.push({
      ...base,
      data: solid,
      style: { lineWidth: 2 },
      axis: {
        x: index === 0 ? { labelFill: theme.textColor } : false,
        y: {
          title: units.join(' / '),
          position: index === 0 ? 'left' : 'right',
          titleFill: theme.textColor,
          labelFill: theme.textColor,
          grid: index === 0,
          gridStroke: theme.gridColor,
        },
      },
    });
    children.push({
      ...base,
      data: dashed,
      style: { lineWidth: 2, lineDash: DASH_PATTERN },
      axis: false,
    });
    if (input.singleDay) {
      // A line needs two days: for one day the values are drawn as markers, the week before paler.
      for (const [data, fillOpacity] of [
        [solid, 1],
        [dashed, 0.45],
      ] as const) {
        children.push({
          type: 'point',
          data,
          xField: 'statDate',
          yField: 'value',
          colorField: 'series',
          scale: { y: { key: group, domainMin: 0, nice: true } },
          style: { r: 5, fillOpacity },
          axis: false,
        });
      }
    }
  });

  return {
    children,
    theme: theme.g2Theme,
    scale: { color: { domain, range } },
    legend: { color: { itemLabelFill: theme.textColor } },
    height: 320,
  };
}
