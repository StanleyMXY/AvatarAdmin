import { QuestionCircleOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Alert, Button, Flex, Select, Spin, Table, Tabs, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExportButton } from '../../components/ExportButton';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import { LandBar } from '../../components/stat/LandBar';
import {
  PlatformChannelFilter,
  type PlatformChannelValue,
} from '../../components/stat/PlatformChannelFilter';
import { ProvisionalTag } from '../../components/stat/ProvisionalTag';
import { TrendChart } from '../../components/stat/TrendChart';
import { UtcNotice } from '../../components/stat/UtcNotice';
import { useFailure } from '../../hooks/useFailure';
import { useLatestCall } from '../../hooks/useLatestCall';
import { getDaily } from '../../services/stats/reports';
import type { StatDailyRow } from '../../services/stats/types';
import { useAdminMeta } from '../../session/useSession';
import { hasProvisionalDay, isProvisionalDay } from '../../utils/settledDay';
import { daysBetween, todayUtc } from '../../utils/utcDay';
import { defaultRange } from '../analytics/defaultRange';
import {
  buildDailyColumns,
  type ColumnDef,
  chartRow,
  type DailyViewRow,
  formatDailyCell,
  isBackfilledCell,
  toViewRow,
} from './dailyColumns';

type Filter = { range: DayRange } & PlatformChannelValue;

const DEFAULT_METRICS = ['dau', 'newAccountsRegistered'];

// The first range is 7 days, or fewer when the backend allows fewer, so that the first ask is not refused.
const initialFilter = (maxDays: number | null | undefined): Filter => ({
  range: defaultRange(maxDays, 7),
  platform: 'ALL',
  channel: 'ALL',
});

/**
 * 日报 (`STATS:VIEW`): the daily numbers, one row per UTC day. A trend chart of the chosen metrics
 * and a table of every metric; nothing is added up over the days (weekly and monthly actives are
 * distinct counts), so there is no total row and no total card.
 */
export default function DailyReportPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const meta = useAdminMeta();
  // What is being edited, and what was asked for with Search (the report, the chart and the export).
  const [draft, setDraft] = useState<Filter>(() => initialFilter(meta.statsMaxRangeDays));
  const [applied, setApplied] = useState<Filter>(draft);
  const [metrics, setMetrics] = useState<string[]>(DEFAULT_METRICS);
  const [tab, setTab] = useState('trend');
  const [rows, setRows] = useState<StatDailyRow[] | null>(null);
  // The UTC day that was today when the rows were read: the rows are as they were then, so what is
  // marked provisional follows that day and not the clock of every later drawing of the page.
  const [today, setToday] = useState<string>(() => todayUtc());
  const { text: failure, fail, clear } = useFailure();
  const begin = useLatestCall();

  const load = useCallback(async () => {
    const isCurrent = begin();
    const askedOn = todayUtc();
    setRows(null);
    clear();
    try {
      const { items } = await getDaily({
        from: applied.range.from,
        to: applied.range.to,
        platform: applied.platform,
        channel: applied.channel,
      });
      if (isCurrent()) {
        setToday(askedOn);
        setRows(items);
      }
    } catch (error) {
      if (isCurrent()) fail(error);
    }
  }, [applied, begin, fail, clear]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo(() => buildDailyColumns(applied.platform), [applied.platform]);
  const viewRows = useMemo<DailyViewRow[]>(() => (rows ?? []).map(toViewRow), [rows]);
  const chartRows = useMemo(() => viewRows.map(chartRow), [viewRows]);
  const title = (def: ColumnDef) =>
    def.kind === 'date' ? t('stat.daily.date') : t(`stat.daily.col.${def.key}`);

  const tableColumns: ColumnsType<DailyViewRow> = columns.map((def) => ({
    key: def.key,
    fixed: def.fixed,
    align: def.kind === 'date' ? 'start' : 'end',
    title: def.tip ? (
      <span>
        {title(def)}
        <Tooltip title={t(`stat.daily.col.${def.key}.tip`)}>
          <QuestionCircleOutlined
            data-testid={`tip-${def.key}`}
            aria-hidden={false}
            style={{ marginInlineStart: 4 }}
          />
        </Tooltip>
      </span>
    ) : (
      title(def)
    ),
    render: (_: unknown, row: DailyViewRow) => (
      <>
        {formatDailyCell(def, row, intl.locale)}
        {def.kind === 'date' && isProvisionalDay(row.statDate, today) ? (
          <ProvisionalTag testId="provisional-row" style={{ marginInlineStart: 4 }} />
        ) : null}
        {isBackfilledCell(def, row) ? (
          <Tag style={{ marginInlineStart: 4 }} title={t('stat.common.backfilled')}>
            {t('stat.daily.backfilled')}
          </Tag>
        ) : null}
      </>
    ),
  }));

  // A metric without a platform cannot be drawn for another platform: it is not offered then.
  const metricOptions = columns
    .filter((def) => def.kind !== 'date')
    .map((def) => ({
      value: def.key,
      label: def.noPlatformDimension
        ? `${title(def)} (${t('stat.daily.noPlatformOption')})`
        : title(def),
      title: title(def),
      disabled: def.noPlatformDimension,
    }));
  const series = columns
    .filter((def) => def.kind !== 'date' && !def.noPlatformDimension && metrics.includes(def.key))
    .map((def) => ({ field: def.field, label: title(def) }));

  const platformNote = columns.some((def) => def.noPlatformDimension) ? (
    <Alert type="info" showIcon title={t('stat.daily.noPlatformNote')} />
  ) : null;

  const detail = (
    <Table<DailyViewRow>
      size="small"
      rowKey="statDate"
      columns={tableColumns}
      dataSource={viewRows}
      pagination={false}
      scroll={{ x: 'max-content' }}
      title={platformNote ? () => platformNote : undefined}
    />
  );

  return (
    <Flex vertical gap={16}>
      <UtcNotice />
      <Flex gap={12} wrap align="center">
        <DateRangeUtc
          value={draft.range}
          onChange={(range) => setDraft((d) => ({ ...d, range }))}
          maxDays={meta.statsMaxRangeDays ?? undefined}
        />
        <PlatformChannelFilter
          value={{ platform: draft.platform, channel: draft.channel }}
          onChange={(value) => setDraft((d) => ({ ...d, ...value }))}
        />
        <Button type="primary" onClick={() => setApplied({ ...draft })}>
          {t('stat.common.query')}
        </Button>
        <ExportButton
          name="daily"
          viewCode="STATS:VIEW"
          params={{
            from: applied.range.from,
            to: applied.range.to,
            platform: applied.platform,
            channel: applied.channel,
          }}
        />
      </Flex>
      <LandBar name={['daily-event', 'daily-business']} onLanded={() => void load()} />
      {failure ? (
        <Alert
          type="error"
          showIcon
          title={t('pages.common.loadFailed', { message: failure })}
          action={
            <Button size="small" onClick={() => void load()}>
              {t('pages.common.retry')}
            </Button>
          }
        />
      ) : null}
      {rows === null && !failure ? <Spin /> : null}
      {rows ? (
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: 'trend',
              label: t('stat.daily.tab.trend'),
              children: (
                <Flex vertical gap={12}>
                  <Select
                    mode="multiple"
                    virtual={false}
                    allowClear
                    style={{ maxWidth: 640 }}
                    aria-label={t('stat.daily.metrics')}
                    placeholder={t('stat.daily.metricsPlaceholder')}
                    value={metrics}
                    options={metricOptions}
                    optionFilterProp="title"
                    onChange={setMetrics}
                  />
                  <TrendChart
                    rows={chartRows}
                    xField="statDate"
                    series={series}
                    from={applied.range.from}
                    to={applied.range.to}
                    today={today}
                  />
                  {series.length > 0 &&
                  hasProvisionalDay(daysBetween(applied.range.from, applied.range.to), today) ? (
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: 12 }}
                      data-testid="provisional-chart-note"
                    >
                      {t('stat.common.provisional.chartNote')}
                    </Typography.Text>
                  ) : null}
                </Flex>
              ),
            },
            { key: 'detail', label: t('stat.daily.tab.detail'), children: detail },
          ]}
        />
      ) : null}
    </Flex>
  );
}
