import { useIntl } from '@umijs/max';
import { Flex, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { ExportButton } from '../../components/ExportButton';
import { LandBar } from '../../components/stat/LandBar';
import { TrendChart } from '../../components/stat/TrendChart';
import { getTasksDaily, getTasksSummary } from '../../services/stats/reports';
import type { TaskSummaryRow } from '../../services/stats/types';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { ReportState } from '../stat/guest/ReportState';
import { useReport } from '../stat/guest/useReport';
import { StatsBar, useAppliedRange } from './StatsBar';
import { countText, plainOrDash } from './texts';

/** A share with one decimal (`50.0%`), or a dash when the backend has none (no records that day: the denominator was 0). */
const rateText = (value: unknown, locale: string): string =>
  typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value)
    : DASH;

/**
 * 任务统计 (`STATS:VIEW`): records, completions and claims for each local day (a line chart; a day
 * without a row is 0) and a table of every task with its completion rate. The days are the users'
 * local days, and a reward claimed on the next day counts for the day the task belongs to. Landing
 * is `task-daily`, the export is `task-summary`.
 */
export default function TaskStatsPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { draft, setDraft, applied, apply } = useAppliedRange();

  const readDaily = useCallback(() => getTasksDaily(applied), [applied]);
  const readSummary = useCallback(() => getTasksSummary(applied), [applied]);
  const daily = useReport(readDaily);
  const summary = useReport(readSummary);

  const days = useMemo(
    () =>
      [...(daily.data?.items ?? [])].sort((a, b) =>
        String(a.statDate).localeCompare(String(b.statDate)),
      ),
    [daily.data],
  );

  const columns: ColumnsType<TaskSummaryRow & { __key: string }> = [
    {
      title: t('activity.taskStats.col.name'),
      dataIndex: 'taskName',
      render: (value: unknown) => (
        <EllipsisPopoverText text={plainText(value)} lines={2} width={240} />
      ),
    },
    {
      title: t('activity.taskStats.col.total'),
      dataIndex: 'totalRecords',
      align: 'end',
      render: (value: unknown) => countText(intl.locale, value),
    },
    {
      title: t('activity.taskStats.col.completed'),
      dataIndex: 'completedCount',
      align: 'end',
      render: (value: unknown) => countText(intl.locale, value),
    },
    {
      title: t('activity.taskStats.col.rewarded'),
      dataIndex: 'rewardedCount',
      align: 'end',
      render: (value: unknown) => countText(intl.locale, value),
    },
    {
      title: t('activity.taskStats.col.rate'),
      dataIndex: 'completionRate',
      align: 'end',
      render: (value: unknown) => rateText(value, intl.locale),
    },
    {
      title: t('activity.taskStats.col.credits'),
      dataIndex: 'creditsIssued',
      align: 'end',
      render: (value: unknown) => countText(intl.locale, value),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <StatsBar
        draft={draft}
        onDraft={setDraft}
        onQuery={apply}
        exportButton={
          <ExportButton
            name="task-summary"
            viewCode="STATS:VIEW"
            params={{ from: applied.from, to: applied.to }}
          />
        }
      />
      <Typography.Text type="secondary">{t('activity.stats.taskNote')}</Typography.Text>
      <LandBar
        dateLabelId="activity.stats.land.date"
        hintId="activity.stats.land.hint"
        name="task-daily"
        onLanded={() => {
          daily.reload();
          summary.reload();
        }}
      />
      <ReportState failure={daily.failure} loading={daily.data === null} onRetry={daily.reload} />
      {daily.data ? (
        <>
          <Typography.Text strong>{t('activity.taskStats.chart')}</Typography.Text>
          <TrendChart
            rows={days}
            xField="statDate"
            series={[
              { field: 'totalRecords', label: t('activity.taskStats.series.total') },
              { field: 'completedCount', label: t('activity.taskStats.series.completed') },
              { field: 'rewardedCount', label: t('activity.taskStats.series.rewarded') },
            ]}
            from={applied.from}
            to={applied.to}
          />
        </>
      ) : null}
      <ReportState
        failure={summary.failure}
        loading={summary.data === null}
        onRetry={summary.reload}
      />
      {summary.data ? (
        <>
          <Typography.Text strong>{t('activity.taskStats.table')}</Typography.Text>
          <Table<TaskSummaryRow & { __key: string }>
            size="small"
            rowKey="__key"
            columns={columns}
            dataSource={summary.data.items.map((r, i) => ({
              ...r,
              __key: `${plainOrDash(r.taskId)}|${i}`,
            }))}
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: t('activity.stats.empty') }}
          />
        </>
      ) : null}
    </Flex>
  );
}
