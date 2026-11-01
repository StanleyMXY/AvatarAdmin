import { Bar } from '@ant-design/plots';
import { useIntl } from '@umijs/max';
import { Button, Empty, Flex, Radio, Spin, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import { type Kept, useKeptState } from '../../hooks/useKeptState';
import { useLatestRead } from '../../hooks/useLatestRead';
import {
  getSummary,
  SUMMARY_GROUPS,
  type SummaryGroup,
  type SummaryRow,
} from '../../services/campaign';
import { getChartTheme } from '../../theme/chartTheme';
import { useThemeMode } from '../../theme/modes';
import { codeText, countText } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { lastNDaysUtc } from '../../utils/utcDay';
import { FailureBar } from './FailureBar';
import { costsText, numberOf } from './figures';

type Row = SummaryRow & { rowKey: string };

/** The groups the chart draws: the ones with the most installs. */
const CHART_GROUPS = 15;

const count = (value: unknown): number => {
  const n = numberOf(value);
  return n === null ? 0 : Math.max(0, n);
};

/**
 * 汇总 (`ATTRIBUTION:VIEW`): installs, activations and cost by source, media source or campaign,
 * from the first to the last UTC day. The two sources are listed apart, a cost is shown for each
 * currency and never added across currencies, and there is no revenue and so no ROI.
 */
export function SummaryTab({ kept }: { kept: Kept }) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [mode] = useThemeMode();
  const theme = getChartTheme(mode);

  const [groupBy, setGroupBy] = useKeptState<SummaryGroup>(kept, 'summary.groupBy', 'source');
  const [draft, setDraft] = useKeptState<DayRange>(kept, 'summary.draft', () => lastNDaysUtc(7));
  // A new object for each search, so that a search with the same days asks again.
  const [applied, setApplied] = useKeptState<DayRange>(kept, 'summary.applied', draft);

  const fetcher = useCallback(
    () => getSummary({ groupBy, from: applied.from, to: applied.to }),
    [groupBy, applied],
  );
  const read = useLatestRead(fetcher);

  const items = useMemo<Row[]>(
    () =>
      (read.data?.items ?? []).map((row, i) => ({
        ...row,
        rowKey: `${plainText(row.source)}|${plainText(row.key)}|${i}`,
      })),
    [read.data],
  );

  const sourceLabel = (source: unknown) =>
    codeText(intl, 'campaign.records.source', source) || DASH;

  const chart = (() => {
    const ranked = [...items]
      .sort((a, b) => count(b.installs) - count(a.installs))
      .slice(0, CHART_GROUPS);
    const data = ranked.flatMap((row) => {
      const label =
        groupBy === 'source'
          ? sourceLabel(row.source)
          : `${plainText(row.key) || DASH} · ${sourceLabel(row.source)}`;
      return [
        { label, metric: t('campaign.summary.col.installs'), value: count(row.installs) },
        { label, metric: t('campaign.summary.col.activations'), value: count(row.activations) },
      ];
    });
    return { data, truncated: items.length > CHART_GROUPS };
  })();

  const columns: ColumnsType<Row> = [
    {
      title: t('campaign.summary.col.source'),
      dataIndex: 'source',
      render: (value: unknown) => sourceLabel(value),
    },
    ...(groupBy === 'source'
      ? []
      : [
          {
            title: t(`campaign.summary.col.key.${groupBy}`),
            dataIndex: 'key',
            render: (value: unknown) => <EllipsisPopoverText text={plainText(value)} width={260} />,
          },
        ]),
    {
      title: t('campaign.summary.col.installs'),
      dataIndex: 'installs',
      align: 'end',
      render: (value: unknown) => countText(intl.locale, value),
    },
    {
      title: t('campaign.summary.col.activations'),
      dataIndex: 'activations',
      align: 'end',
      render: (value: unknown) => countText(intl.locale, value),
    },
    {
      title: t('campaign.summary.col.cost'),
      dataIndex: 'costs',
      render: (value: unknown) => costsText(value, intl.locale),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex vertical gap={4}>
        <Typography.Text type="secondary">{t('campaign.summary.note.sources')}</Typography.Text>
        <Typography.Text type="secondary">{t('campaign.summary.note.retention')}</Typography.Text>
        <Typography.Text type="secondary">{t('campaign.summary.note.cost')}</Typography.Text>
        <Typography.Text type="secondary">{t('campaign.summary.note.noRoi')}</Typography.Text>
      </Flex>
      <Flex gap={12} wrap align="center">
        <Flex gap={8} align="center" wrap>
          <Typography.Text>{t('campaign.summary.groupBy')}</Typography.Text>
          <Radio.Group
            optionType="button"
            value={groupBy}
            onChange={(event) => setGroupBy(event.target.value as SummaryGroup)}
            options={SUMMARY_GROUPS.map((g) => ({
              value: g,
              label: t(`campaign.summary.group.${g}`),
            }))}
          />
        </Flex>
        <Flex gap={8} align="center" wrap>
          <Typography.Text>{t('campaign.summary.time')}</Typography.Text>
          <DateRangeUtc value={draft} onChange={setDraft} />
        </Flex>
        <Button type="primary" onClick={() => setApplied({ ...draft })}>
          {t('stat.common.query')}
        </Button>
      </Flex>
      {read.failure ? <FailureBar failure={read.failure} onRetry={read.reload} /> : null}
      {read.loading ? <Spin /> : null}
      {read.data ? (
        <>
          {chart.data.length > 0 ? (
            <Flex vertical gap={8}>
              <Typography.Text strong>{t('campaign.summary.chartTitle')}</Typography.Text>
              <Bar
                data={chart.data}
                xField="label"
                yField="value"
                colorField="metric"
                group
                theme={theme.g2Theme}
                scale={{ color: { range: theme.palette } }}
                axis={{
                  x: { labelFill: theme.textColor },
                  y: { labelFill: theme.textColor, gridStroke: theme.gridColor },
                }}
                height={Math.max(240, 28 * chart.data.length)}
              />
              {chart.truncated ? (
                <Typography.Text type="secondary">
                  {t('campaign.summary.chartTruncated', { count: CHART_GROUPS })}
                </Typography.Text>
              ) : null}
            </Flex>
          ) : (
            <Empty description={t('campaign.summary.empty')} />
          )}
          <Table<Row>
            size="small"
            rowKey="rowKey"
            columns={columns}
            dataSource={items}
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: t('campaign.summary.empty') }}
          />
        </>
      ) : null}
    </Flex>
  );
}
