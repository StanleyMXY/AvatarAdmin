import { Column, Line } from '@ant-design/plots';
import { useIntl } from '@umijs/max';
import { getChartTheme } from '../../theme/chartTheme';
import { useThemeMode } from '../../theme/modes';
import { formatPercent } from '../../utils/ratio';

/** `2026-10-24` as `10-24`. */
const shortDay = (day: string) => String(day).slice(5);

export type LinePoint = { statDate: string; series: string; value: number | null };
export type ColumnPoint = { statDate: string; bucket: string; value: number };

/**
 * A line chart of daily figures, one line per series, the unit of the vertical axis written on it.
 * A null value is a gap in the line (a day the figure is not known), never a 0. With `percent` the
 * values are ratios shown as percentages. The shared trend chart has no axis title, so the call
 * pages draw their own.
 */
export function DayLineChart({
  data,
  yTitle,
  percent = false,
}: {
  data: LinePoint[];
  yTitle: string;
  percent?: boolean;
}) {
  const intl = useIntl();
  const [mode] = useThemeMode();
  const theme = getChartTheme(mode);
  const single = new Set(data.map((d) => d.series)).size <= 1;
  const axisText = { labelFill: theme.textColor, titleFill: theme.textColor };
  return (
    <Line
      data={data}
      xField="statDate"
      yField="value"
      colorField="series"
      theme={theme.g2Theme}
      scale={{
        color: { range: theme.palette },
        // A rate cannot pass 100%; the axis starts where the data does, and its labels say so.
        y: percent ? { domainMax: 1 } : { domainMin: 0 },
      }}
      // A marker on every point, so that a day between two gaps is seen too.
      point={{ shapeField: 'circle', sizeField: 3 }}
      legend={single ? false : undefined}
      axis={{
        x: {
          ...axisText,
          title: intl.formatMessage({ id: 'sessions.common.date' }),
          // Month and day only (the tooltip has the whole date): whole dates run into each other.
          labelFormatter: shortDay,
          labelAutoHide: true,
        },
        y: {
          ...axisText,
          gridStroke: theme.gridColor,
          title: yTitle,
          ...(percent
            ? { labelFormatter: (value: number) => formatPercent(value, intl.locale, 0) }
            : {}),
        },
      }}
      tooltip={
        percent
          ? {
              items: [
                {
                  channel: 'y',
                  valueFormatter: (value: number) => formatPercent(value, intl.locale, 1),
                },
              ],
            }
          : undefined
      }
      height={300}
    />
  );
}

/** Stacked columns of daily counts, one colour per bucket, the unit of the vertical axis written on it. */
export function StackedDayChart({ data, yTitle }: { data: ColumnPoint[]; yTitle: string }) {
  const intl = useIntl();
  const [mode] = useThemeMode();
  const theme = getChartTheme(mode);
  const axisText = { labelFill: theme.textColor, titleFill: theme.textColor };
  return (
    <Column
      data={data}
      xField="statDate"
      yField="value"
      colorField="bucket"
      stack
      theme={theme.g2Theme}
      scale={{ color: { range: theme.palette } }}
      axis={{
        x: {
          ...axisText,
          title: intl.formatMessage({ id: 'sessions.common.date' }),
          labelFormatter: shortDay,
          labelAutoHide: true,
        },
        y: { ...axisText, gridStroke: theme.gridColor, title: yTitle },
      }}
      height={300}
    />
  );
}
