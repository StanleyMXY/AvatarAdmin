import { Line } from '@ant-design/plots';
import { useIntl } from '@umijs/max';
import { useMemo } from 'react';
import type { RetentionRow } from '../../services/stats/types';
import { getChartTheme } from '../../theme/chartTheme';
import { useThemeMode } from '../../theme/modes';
import { formatPercent, safeRatio } from '../../utils/ratio';

/**
 * The share of each cohort that came back on day `day` (or on each of `days`, one line per day);
 * cohorts without a value for a day are left out of that line, not drawn as 0.
 */
export function RetentionTrendChart({
  rows,
  day,
  days,
}: {
  rows: RetentionRow[];
  day?: number;
  days?: number[];
}) {
  const intl = useIntl();
  const [mode] = useThemeMode();
  const theme = getChartTheme(mode);
  const data = useMemo(
    () =>
      (days ?? (day === undefined ? [] : [day])).flatMap((n) =>
        rows.flatMap((row) => {
          const value = (row as unknown as Record<string, unknown>)[`d${n}`];
          const ratio = typeof value === 'number' ? safeRatio(value, row.cohortSize) : null;
          return ratio === null
            ? []
            : [
                {
                  cohortDate: row.cohortDate,
                  rate: ratio,
                  series: intl.formatMessage({ id: 'stat.common.dayN' }, { n }),
                },
              ];
        }),
      ),
    [rows, day, days, intl],
  );
  return (
    <Line
      data={data}
      xField="cohortDate"
      yField="rate"
      colorField="series"
      theme={theme.g2Theme}
      scale={{ color: { range: theme.palette }, y: { domainMin: 0 } }}
      axis={{
        x: { labelFill: theme.textColor },
        y: {
          labelFill: theme.textColor,
          gridStroke: theme.gridColor,
          labelFormatter: (value: number) => formatPercent(value, intl.locale),
        },
      }}
      tooltip={{
        items: [
          { channel: 'y', valueFormatter: (value: number) => formatPercent(value, intl.locale) },
        ],
      }}
      height={260}
    />
  );
}
