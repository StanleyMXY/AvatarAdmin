import { Line } from '@ant-design/plots';
import { useMemo } from 'react';
import type { RetentionRow } from '../../services/stats/types';
import { getChartTheme } from '../../theme/chartTheme';
import { useThemeMode } from '../../theme/modes';
import { safeRatio } from '../../utils/ratio';

/** The share of each cohort that came back on day `day`; cohorts without a value for it are left out, not drawn as 0. */
export function RetentionTrendChart({ rows, day }: { rows: RetentionRow[]; day: number }) {
  const [mode] = useThemeMode();
  const theme = getChartTheme(mode);
  const data = useMemo(
    () =>
      rows.flatMap((row) => {
        const value = (row as unknown as Record<string, unknown>)[`d${day}`];
        const ratio = typeof value === 'number' ? safeRatio(value, row.cohortSize) : null;
        return ratio === null ? [] : [{ cohortDate: row.cohortDate, rate: ratio }];
      }),
    [rows, day],
  );
  return (
    <Line
      data={data}
      xField="cohortDate"
      yField="rate"
      theme={theme.g2Theme}
      scale={{ color: { range: theme.palette }, y: { domainMin: 0 } }}
      axis={{
        x: { labelFill: theme.textColor },
        y: { labelFill: theme.textColor, gridStroke: theme.gridColor },
      }}
      height={260}
    />
  );
}
