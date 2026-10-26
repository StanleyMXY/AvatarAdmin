import { Column, Line } from '@ant-design/plots';
import { useIntl } from '@umijs/max';
import { Flex, Typography } from 'antd';
import { useMemo } from 'react';
import { fillMissingDays } from '../../services/stats/fillMissingDays';
import type { ReactivationRow } from '../../services/stats/types';
import { getChartTheme } from '../../theme/chartTheme';
import { useThemeMode } from '../../theme/modes';
import { formatPercent, safeRatio } from '../../utils/ratio';

type Props = { rows: ReactivationRow[]; from: string; to: string };

/**
 * The line of the reactivation rate and the columns of the reactivated users. Every day of the range
 * is on the axis. A day with no silent users has no rate: the line has a gap there, not a 0.
 */
export function ReactivationCharts({ rows, from, to }: Props) {
  const intl = useIntl();
  const [mode] = useThemeMode();
  const theme = getChartTheme(mode);

  const days = useMemo(
    () =>
      fillMissingDays(rows, from, to, (statDate) => ({
        statDate,
        silenceDays: 0,
        silentUsers: 0,
        reactivated: 0,
      })),
    [rows, from, to],
  );
  const rate = useMemo(
    () =>
      days.map((d) => ({ statDate: d.statDate, rate: safeRatio(d.reactivated, d.silentUsers) })),
    [days],
  );
  const count = useMemo(
    () => days.map((d) => ({ statDate: d.statDate, reactivated: d.reactivated })),
    [days],
  );
  const axis = {
    x: { labelFill: theme.textColor },
    y: { labelFill: theme.textColor, gridStroke: theme.gridColor },
  };

  return (
    <Flex gap={24} wrap>
      <div style={{ flex: '1 1 420px', minWidth: 0 }}>
        <Typography.Text strong>
          {intl.formatMessage({ id: 'stat.reactivation.chart.rate' })}
        </Typography.Text>
        <Line
          data={rate}
          xField="statDate"
          yField="rate"
          theme={theme.g2Theme}
          scale={{ color: { range: theme.palette }, y: { domainMin: 0 } }}
          axis={{
            ...axis,
            y: {
              ...axis.y,
              labelFormatter: (value: number) => formatPercent(value, intl.locale, 0),
            },
          }}
          height={260}
        />
      </div>
      <div style={{ flex: '1 1 420px', minWidth: 0 }}>
        <Typography.Text strong>
          {intl.formatMessage({ id: 'stat.reactivation.chart.count' })}
        </Typography.Text>
        <Column
          data={count}
          xField="statDate"
          yField="reactivated"
          theme={theme.g2Theme}
          scale={{ color: { range: theme.palette } }}
          axis={axis}
          height={260}
        />
      </div>
    </Flex>
  );
}
