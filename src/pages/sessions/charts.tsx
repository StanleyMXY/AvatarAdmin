import { Column, Line } from '@ant-design/plots';
import { useIntl } from '@umijs/max';
import {
  hollowPointsMark,
  provisionalColumnStyle,
  provisionalPoints,
  SOLID_MARKER,
} from '../../components/stat/provisionalChart';
import { getChartTheme } from '../../theme/chartTheme';
import { useThemeMode } from '../../theme/modes';
import { formatPercent } from '../../utils/ratio';
import { isProvisionalDay } from '../../utils/settledDay';

/** `2026-10-24` as `10-24`. */
const shortDay = (day: string) => String(day).slice(5);

export type LinePoint = { statDate: string; series: string; value: number | null };
export type ColumnPoint = { statDate: string; bucket: string; value: number };

/**
 * A line chart of daily figures, one line per series, the unit of the vertical axis written on it.
 * A null value is a gap in the line (a day the figure is not known), never a 0. With `percent` the
 * values are ratios shown as percentages. The shared trend chart has no axis title, so the call
 * pages draw their own. With `today` (the UTC day), the marker of a day that is not over is
 * hollow, the others solid.
 */
export function DayLineChart({
  data,
  yTitle,
  percent = false,
  today,
}: {
  data: LinePoint[];
  yTitle: string;
  percent?: boolean;
  today?: string;
}) {
  const intl = useIntl();
  const [mode] = useThemeMode();
  const theme = getChartTheme(mode);
  const single = new Set(data.map((d) => d.series)).size <= 1;
  const axisText = { labelFill: theme.textColor, titleFill: theme.textColor };
  // The solid marker stays on every day; the hollow one is drawn over the days that are not over.
  const hollow = today === undefined ? [] : provisionalPoints(data, today);
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
      point={{
        shapeField: SOLID_MARKER,
        sizeField: 3,
      }}
      annotations={hollow.length > 0 ? [hollowPointsMark(hollow, theme.background)] : undefined}
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
                  valueFormatter: (value: number) => formatPercent(value, intl.locale, 2),
                },
              ],
            }
          : undefined
      }
      height={300}
    />
  );
}

/**
 * Stacked columns of daily counts, one colour per bucket, the unit of the vertical axis written on
 * it. With `today` (the UTC day), the columns of a day that is not over are paler with a dashed
 * border.
 */
export function StackedDayChart({
  data,
  yTitle,
  today,
}: {
  data: ColumnPoint[];
  yTitle: string;
  today?: string;
}) {
  const intl = useIntl();
  const [mode] = useThemeMode();
  const theme = getChartTheme(mode);
  const axisText = { labelFill: theme.textColor, titleFill: theme.textColor };
  const rows =
    today === undefined
      ? data
      : data.map((point) => ({ ...point, provisional: isProvisionalDay(point.statDate, today) }));
  return (
    <Column
      data={rows}
      xField="statDate"
      yField="value"
      colorField="bucket"
      stack
      theme={theme.g2Theme}
      scale={{ color: { range: theme.palette } }}
      style={today === undefined ? undefined : provisionalColumnStyle(theme.textColor)}
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
