import { Line } from '@ant-design/plots';
import { useMemo } from 'react';
import { fillMissingDays } from '../../services/stats/fillMissingDays';
import { getChartTheme } from '../../theme/chartTheme';
import { useThemeMode } from '../../theme/modes';

export type TrendSeries = { field: string; label: string; dashed?: boolean };

type Props<T extends { statDate: string }> = {
  rows: T[];
  xField: 'statDate';
  series: TrendSeries[];
  from: string;
  to: string;
};

/**
 * A line chart of daily numbers. Every day of the range is on the axis; a day the backend sent no
 * row for is 0. The chart follows the theme mode and is drawn again when the mode changes.
 */
export function TrendChart<T extends { statDate: string }>({ rows, series, from, to }: Props<T>) {
  const [mode] = useThemeMode();
  const theme = getChartTheme(mode);

  const data = useMemo(() => {
    const zero = (statDate: string) =>
      ({ statDate, ...Object.fromEntries(series.map((s) => [s.field, 0])) }) as unknown as T;
    const full = fillMissingDays(rows, from, to, zero);
    return full.flatMap((row) =>
      series.map((s) => {
        const raw = (row as unknown as Record<string, unknown>)[s.field];
        return {
          statDate: row.statDate,
          series: s.label,
          value: typeof raw === 'number' ? raw : 0,
        };
      }),
    );
  }, [rows, series, from, to]);

  const dashed = series.filter((s) => s.dashed).map((s) => s.label);
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
      axis={{
        x: { labelFill: theme.textColor },
        y: { labelFill: theme.textColor, gridStroke: theme.gridColor },
      }}
      height={300}
    />
  );
}
