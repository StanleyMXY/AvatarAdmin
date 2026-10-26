import { useIntl } from '@umijs/max';
import { Table, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo } from 'react';
import type { RetentionRow } from '../../services/stats/types';
import { DASH, formatCount, formatPercent, safeRatio } from '../../utils/ratio';

type Props = {
  rows: RetentionRow[];
  /** The days to show (a subset of 1, 3, 5, 7, 14, 21, 30, 60, 90). */
  days: number[];
};

/** A colour as `#rrggbb` with an opacity, or null when the colour is written another way. */
function withOpacity(color: string, opacity: number): string | null {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!match) return null;
  const [r, g, b] = match.slice(1).map((part) => Number.parseInt(part, 16));
  return `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(2)})`;
}

const cellOf = (row: RetentionRow, day: number): number | null => {
  const value = (row as unknown as Record<string, unknown>)[`d${day}`];
  return typeof value === 'number' ? value : null;
};

/**
 * The cohort table: one row per sign-up day, one column per day N, the share of the cohort that
 * came back on that day. A cell with no value (the day has not come yet) is a dash; a cell that is
 * 0 is 0%; a cohort of size 0 has dashes, never a percentage. Each cell shows the number of people
 * and the share, on a green background that is stronger the larger the share is.
 */
export function RetentionMatrix({ rows, days }: Props) {
  const intl = useIntl();
  const locale = intl.locale;
  const { token } = theme.useToken();
  const columns = useMemo<ColumnsType<RetentionRow>>(
    () => [
      {
        title: intl.formatMessage({ id: 'stat.common.cohortDate' }),
        dataIndex: 'cohortDate',
        fixed: 'left',
      },
      {
        title: intl.formatMessage({ id: 'stat.common.cohortSize' }),
        dataIndex: 'cohortSize',
        align: 'end',
        render: (n: number) => formatCount(n, locale),
      },
      ...days.map((day) => ({
        title: intl.formatMessage({ id: 'stat.common.dayN' }, { n: day }),
        key: `d${day}`,
        align: 'end' as const,
        onCell: (row: RetentionRow) => {
          const ratio = safeRatio(cellOf(row, day), row.cohortSize);
          if (ratio === null || ratio <= 0) return {};
          const tint = withOpacity(token.colorSuccess, 0.1 + 0.5 * Math.min(ratio, 1));
          return tint ? { style: { backgroundColor: tint } } : {};
        },
        render: (_: unknown, row: RetentionRow) => {
          const count = cellOf(row, day);
          const ratio = safeRatio(count, row.cohortSize);
          return (
            <Typography.Text data-testid={`cell-${row.cohortDate}-d${day}`}>
              {ratio === null || count === null
                ? DASH
                : `${formatCount(count, locale)} · ${formatPercent(ratio, locale)}`}
            </Typography.Text>
          );
        },
      })),
    ],
    [days, intl, locale, token.colorSuccess],
  );
  return (
    <Table<RetentionRow>
      size="small"
      rowKey={(row) =>
        `${row.cohortDate}|${row.platform ?? ''}|${row.channelCode ?? ''}|${row.retentionType ?? ''}`
      }
      columns={columns}
      dataSource={rows}
      pagination={false}
      scroll={{ x: 'max-content' }}
    />
  );
}
