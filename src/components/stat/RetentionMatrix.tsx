import { useIntl } from '@umijs/max';
import { Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo } from 'react';
import type { RetentionRow } from '../../services/stats/types';
import { DASH, formatCount, formatPercent, safeRatio } from '../../utils/ratio';

type Props = {
  rows: RetentionRow[];
  /** The days to show (a subset of 1, 3, 5, 7, 14, 21, 30, 60, 90). */
  days: number[];
};

const cellOf = (row: RetentionRow, day: number): number | null => {
  const value = (row as unknown as Record<string, unknown>)[`d${day}`];
  return typeof value === 'number' ? value : null;
};

/**
 * The cohort table: one row per sign-up day, one column per day N, the share of the cohort that
 * came back on that day. A cell with no value (the day has not come yet) is a dash; a cell that is
 * 0 is 0%; a cohort of size 0 has dashes, never a percentage.
 */
export function RetentionMatrix({ rows, days }: Props) {
  const intl = useIntl();
  const locale = intl.locale;
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
        render: (_: unknown, row: RetentionRow) => {
          const ratio = safeRatio(cellOf(row, day), row.cohortSize);
          return (
            <Typography.Text data-testid={`cell-${row.cohortDate}-d${day}`}>
              {ratio === null ? DASH : formatPercent(ratio, locale)}
            </Typography.Text>
          );
        },
      })),
    ],
    [days, intl, locale],
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
