import { Column } from '@ant-design/plots';
import { useIntl } from '@umijs/max';
import { Flex, Table, Tabs, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo, useState } from 'react';
import { ExportButton } from '../../components/ExportButton';
import { ReadState } from '../../components/ReadState';
import { LandBar } from '../../components/stat/LandBar';
import { TrendChart } from '../../components/stat/TrendChart';
import { useLatestRead } from '../../hooks/useLatestRead';
import { getCheckinDailyUsers, getCheckinStreakBuckets } from '../../services/stats/reports';
import type { CheckinDailyUsersRow, StreakBucketRow } from '../../services/stats/types';
import { getChartTheme } from '../../theme/chartTheme';
import { useThemeMode } from '../../theme/modes';
import { DASH } from '../../utils/ratio';
import { StatsBar, useAppliedRange } from './StatsBar';
import { countText, plainOrDash } from './texts';

type TabKey = 'daily' | 'streak';

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * 签到统计 (`STATS:VIEW`): how many users checked in on each local day (a line and a table) and how
 * the check-ins spread over the streak length (columns and a table). The days are the users' local
 * days, not UTC days, and the page says so. Landing is `checkin-daily`; the export follows the tab.
 */
export default function SigninStatsPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [mode] = useThemeMode();
  const theme = getChartTheme(mode);
  const { draft, setDraft, applied, apply } = useAppliedRange();
  const [tab, setTab] = useState<TabKey>('daily');

  const readDaily = useCallback(() => getCheckinDailyUsers(applied), [applied]);
  const readStreak = useCallback(() => getCheckinStreakBuckets(applied), [applied]);
  const daily = useLatestRead(readDaily);
  const streak = useLatestRead(readStreak);

  const dailyRows = useMemo(
    () =>
      [...(daily.data?.items ?? [])].sort((a, b) =>
        String(a.statDate).localeCompare(String(b.statDate)),
      ),
    [daily.data],
  );
  const streakRows = useMemo(
    () =>
      [...(streak.data?.items ?? [])].sort(
        (a, b) => (num(a.consecutiveDays) ?? 0) - (num(b.consecutiveDays) ?? 0),
      ),
    [streak.data],
  );
  const chart = streakRows.map((row) => ({
    label:
      num(row.consecutiveDays) === null
        ? DASH
        : t('activity.signinStats.nDays', { n: row.consecutiveDays }),
    count: num(row.checkinCount),
  }));

  const dailyColumns: ColumnsType<CheckinDailyUsersRow & { __key: string }> = [
    {
      title: t('activity.signinStats.col.date'),
      dataIndex: 'statDate',
      render: (value: unknown) => plainOrDash(value),
    },
    {
      title: t('activity.signinStats.col.users'),
      dataIndex: 'userCount',
      align: 'end',
      render: (value: unknown) => countText(intl.locale, value),
    },
  ];
  const streakColumns: ColumnsType<StreakBucketRow & { __key: string }> = [
    {
      title: t('activity.signinStats.col.streak'),
      dataIndex: 'consecutiveDays',
      render: (value: unknown) => countText(intl.locale, value),
    },
    {
      title: t('activity.signinStats.col.count'),
      dataIndex: 'checkinCount',
      align: 'end',
      render: (value: unknown) => countText(intl.locale, value),
    },
  ];

  const reloadAll = () => {
    daily.reload();
    streak.reload();
  };

  return (
    <Flex vertical gap={16}>
      <StatsBar
        draft={draft}
        onDraft={setDraft}
        onQuery={apply}
        exportButton={
          <ExportButton
            name={tab === 'daily' ? 'checkin-daily-users' : 'checkin-streaks'}
            viewCode="STATS:VIEW"
            params={{ from: applied.from, to: applied.to }}
          />
        }
      />
      <LandBar
        name="checkin-daily"
        onLanded={reloadAll}
        dateLabelId="activity.stats.land.date"
        hintId="activity.stats.land.hint"
      />
      <Tabs
        activeKey={tab}
        onChange={(key) => setTab(key as TabKey)}
        items={[
          {
            key: 'daily',
            label: t('activity.signinStats.tab.daily'),
            children: (
              <Flex vertical gap={16}>
                <ReadState failure={daily.failure} loading={daily.loading} onRetry={daily.reload} />
                {daily.data ? (
                  <>
                    <Typography.Text strong>
                      {t('activity.signinStats.chart.daily')}
                    </Typography.Text>
                    <TrendChart
                      rows={dailyRows}
                      xField="statDate"
                      series={[{ field: 'userCount', label: t('activity.signinStats.col.users') }]}
                      from={applied.from}
                      to={applied.to}
                    />
                    <Table<CheckinDailyUsersRow & { __key: string }>
                      size="small"
                      rowKey="__key"
                      columns={dailyColumns}
                      dataSource={dailyRows.map((r, i) => ({
                        ...r,
                        __key: `${plainOrDash(r.statDate)}|${i}`,
                      }))}
                      pagination={false}
                      scroll={{ x: 'max-content' }}
                      locale={{ emptyText: t('activity.stats.empty') }}
                    />
                  </>
                ) : null}
              </Flex>
            ),
          },
          {
            key: 'streak',
            label: t('activity.signinStats.tab.streak'),
            children: (
              <Flex vertical gap={16}>
                <ReadState
                  failure={streak.failure}
                  loading={streak.loading}
                  onRetry={streak.reload}
                />
                {streak.data ? (
                  <>
                    <Typography.Text strong>
                      {t('activity.signinStats.chart.streak')}
                    </Typography.Text>
                    <Column
                      data={chart}
                      xField="label"
                      yField="count"
                      theme={theme.g2Theme}
                      scale={{ color: { range: theme.palette } }}
                      axis={{
                        x: { labelFill: theme.textColor },
                        y: { labelFill: theme.textColor, gridStroke: theme.gridColor },
                      }}
                      height={280}
                    />
                    <Table<StreakBucketRow & { __key: string }>
                      size="small"
                      rowKey="__key"
                      columns={streakColumns}
                      dataSource={streakRows.map((r, i) => ({
                        ...r,
                        __key: `${plainOrDash(r.consecutiveDays)}|${i}`,
                      }))}
                      pagination={false}
                      scroll={{ x: 'max-content' }}
                      locale={{ emptyText: t('activity.stats.empty') }}
                    />
                  </>
                ) : null}
              </Flex>
            ),
          },
        ]}
      />
    </Flex>
  );
}
