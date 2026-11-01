import { useIntl } from '@umijs/max';
import { Table, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo } from 'react';
import { cellTint } from '../../../components/stat/cellTint';
import { DASH, formatCount, formatPercent, safeRatio } from '../../../utils/ratio';

export type DeviceCohortRow = {
  cohortDate: string;
  cohortSize: number;
  platform?: string;
  channelCode?: string;
};

type Props = {
  rows: DeviceCohortRow[];
  /** The columns to show, each `dN` of the row. */
  days: number[];
  /** Prefix of the cell test ids, so two matrices on one page do not share them. */
  idPrefix: string;
  /** Header of the date column and of the size column. */
  dateLabel: string;
  sizeLabel: string;
  /** Conversion (cumulative) matrix: from the second column on, each cell also shows how many devices were added since the one before. */
  withDelta?: boolean;
};

const cellOf = (row: DeviceCohortRow, day: number): number | null => {
  const value = (row as unknown as Record<string, unknown>)[`d${day}`];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

/**
 * A cohort table of devices: one row per day devices first appeared, one column per day N. A cell
 * shows the number of devices and its share of the cohort, on a green background that grows with
 * the share (none for a dash or 0%). A day that has not come yet is a dash; a real 0 is 0; a cohort of size 0 has no share.
 */
export function DeviceCohortMatrix({
  rows,
  days,
  idPrefix,
  dateLabel,
  sizeLabel,
  withDelta,
}: Props) {
  const intl = useIntl();
  const locale = intl.locale;
  const { token } = theme.useToken();
  const columns = useMemo<ColumnsType<DeviceCohortRow>>(
    () => [
      { title: dateLabel, dataIndex: 'cohortDate', fixed: 'left' },
      {
        title: sizeLabel,
        dataIndex: 'cohortSize',
        align: 'end',
        render: (n: number) => formatCount(n, locale),
      },
      ...days.map((day, index) => {
        const ratioOf = (row: DeviceCohortRow) => safeRatio(cellOf(row, day), row.cohortSize);
        return {
          title: intl.formatMessage({ id: 'stat.common.dayN' }, { n: day }),
          key: `d${day}`,
          align: 'end' as const,
          onCell: (row: DeviceCohortRow) => {
            const tint = cellTint(token.colorSuccess, ratioOf(row));
            return tint ? { style: tint } : {};
          },
          render: (_: unknown, row: DeviceCohortRow) => {
            const count = cellOf(row, day);
            const testId = `${idPrefix}-cell-${row.cohortDate}-d${day}`;
            if (count === null) return <span data-testid={testId}>{DASH}</span>;
            const percent = formatPercent(ratioOf(row), locale);
            const before = index > 0 ? cellOf(row, days[index - 1]) : null;
            const text =
              withDelta && before !== null
                ? intl.formatMessage(
                    { id: 'stat.guest.cohort.cellDelta' },
                    {
                      count: formatCount(count, locale),
                      percent,
                      delta: new Intl.NumberFormat(locale, { signDisplay: 'always' }).format(
                        count - before,
                      ),
                    },
                  )
                : intl.formatMessage(
                    { id: 'stat.guest.cohort.cell' },
                    { count: formatCount(count, locale), percent },
                  );
            return <span data-testid={testId}>{text}</span>;
          },
        };
      }),
    ],
    [days, dateLabel, sizeLabel, idPrefix, withDelta, intl, locale, token.colorSuccess],
  );
  return (
    <Table<DeviceCohortRow>
      size="small"
      rowKey={(row) => `${row.cohortDate}|${row.platform ?? ''}|${row.channelCode ?? ''}`}
      columns={columns}
      dataSource={rows}
      pagination={false}
      scroll={{ x: 'max-content' }}
    />
  );
}
