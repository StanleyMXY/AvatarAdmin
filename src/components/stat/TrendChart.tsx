import { Line } from '@ant-design/plots';
import { useMemo } from 'react';
import { fillMissingDays } from '../../services/stats/fillMissingDays';
import { getChartTheme } from '../../theme/chartTheme';
import { useThemeMode } from '../../theme/modes';
import { hollowPointsMark, provisionalPoints } from './provisionalChart';

export type TrendSeries = { field: string; label: string; dashed?: boolean };

type Props<T extends { statDate: string }> = {
  rows: T[];
  xField: 'statDate';
  series: TrendSeries[];
  from: string;
  to: string;
  /**
   * The UTC day of today. When given, the value of a day that is not over is drawn as a hollow
   * point (the line itself is not cut). Leave it out for a chart without that distinction.
   */
  today?: string;
};

/**
 * A line chart of daily numbers. Every day of the range is on the axis; a day the backend sent no
 * row for is 0. The chart follows the theme mode and is drawn again when the mode changes.
 */
export function TrendChart<T extends { statDate: string }>({
  rows,
  series,
  from,
  to,
  today,
}: Props<T>) {
  const [mode] = useThemeMode();
  const theme = getChartTheme(mode);

  const data = useMemo(() => {
    const zero = (statDate: string) =>
      ({ statDate, ...Object.fromEntries(series.map((s) => [s.field, 0])) }) as unknown as T;
    const full = fillMissingDays(rows, from, to, zero);
    const sent = new Set(rows.map((row) => row.statDate));
    return full.flatMap((row) =>
      series.map((s) => {
        const raw = (row as unknown as Record<string, unknown>)[s.field];
        // A day the backend sent no row for is 0; a row whose column is null is "not known" and is
        // left as a gap, so that "no snapshot yet" is not read as "everything went to 0".
        const known = typeof raw === 'number' ? raw : sent.has(row.statDate) ? null : 0;
        return { statDate: row.statDate, series: s.label, value: known };
      }),
    );
  }, [rows, series, from, to]);

  const dashed = series.filter((s) => s.dashed).map((s) => s.label);
  const hollow = today === undefined ? [] : provisionalPoints(data, today);
  return (
    <Line
      data={data}
      xField="statDate"
      yField="value"
      colorField="series"
      theme={theme.g2Theme}
      scale={{ color: { range: theme.palette } }}
      style={{
        lineDash: (d: unknown) =>
          dashed.includes((Array.isArray(d) ? d[0] : d)?.series) ? [4, 4] : [],
      }}
      annotations={hollow.length > 0 ? [hollowPointsMark(hollow, theme.background)] : undefined}
      axis={{
        x: { labelFill: theme.textColor },
        y: { labelFill: theme.textColor, gridStroke: theme.gridColor },
      }}
      height={300}
    />
  );
}
