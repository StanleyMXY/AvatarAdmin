import { QuestionCircleOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Alert, Button, Flex, Select, Spin, Table, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExportButton } from '../../components/ExportButton';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import { LandBar } from '../../components/stat/LandBar';
import { TrendChart } from '../../components/stat/TrendChart';
import { UtcNotice } from '../../components/stat/UtcNotice';
import { useFailure } from '../../hooks/useFailure';
import { useLatestCall } from '../../hooks/useLatestCall';
import { TRIGGER_REASONS } from '../../services/push';
import { getPushStats } from '../../services/stats/reports';
import type { PushStatRow } from '../../services/stats/types';
import { useAdminMeta } from '../../session/useSession';
import { codeText, countText } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';
import { DASH, formatPercent } from '../../utils/ratio';
import { lastNDaysUtc } from '../../utils/utcDay';
import { openRate, sumByDay } from './pushStats';

type Filter = { range: DayRange; reason: string };

const ALL = '';
const initialFilter = (): Filter => ({ range: lastNDaysUtc(7), reason: ALL });

/** A column title with a hint icon; the tip text is the language key `<id>.tip`. */
function HeaderTip({ id, testId }: { id: string; testId: string }) {
  const intl = useIntl();
  return (
    <span>
      {intl.formatMessage({ id })}
      <Tooltip title={intl.formatMessage({ id: `${id}.tip` })}>
        <QuestionCircleOutlined
          data-testid={testId}
          aria-hidden={false}
          style={{ marginInlineStart: 4 }}
        />
      </Tooltip>
    </span>
  );
}

/**
 * 推送效果 (`STATS:VIEW`): for each UTC day and trigger reason, how many pushes were sent, how many
 * tokens accepted or failed, how many were opened, and the open rate. One line chart of the four
 * counts (the reasons of a day added up) above the table of every day and reason.
 */
export default function PushStatsPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const meta = useAdminMeta();
  // What is being edited, and what was asked for with Search (the report, the chart and the export).
  const [draft, setDraft] = useState<Filter>(initialFilter);
  const [applied, setApplied] = useState<Filter>(initialFilter);
  const [rows, setRows] = useState<PushStatRow[] | null>(null);
  const { text: failure, fail, clear } = useFailure();
  const begin = useLatestCall();

  const load = useCallback(async () => {
    const isCurrent = begin();
    setRows(null);
    clear();
    try {
      const { items } = await getPushStats({
        from: applied.range.from,
        to: applied.range.to,
        triggerReason: applied.reason === ALL ? undefined : applied.reason,
      });
      if (isCurrent()) setRows(items);
    } catch (error) {
      if (isCurrent()) fail(error);
    }
  }, [applied, begin, fail, clear]);

  useEffect(() => {
    void load();
  }, [load]);

  const days = useMemo(() => sumByDay(rows ?? []), [rows]);
  const series = [
    { field: 'pushesSent', label: t('push.stats.col.sent') },
    { field: 'deliveriesOk', label: t('push.stats.col.ok') },
    { field: 'deliveriesFailed', label: t('push.stats.col.failed') },
    { field: 'pushesOpened', label: t('push.stats.col.opened') },
  ];

  const columns: ColumnsType<PushStatRow & { __key: string }> = [
    {
      title: t('push.stats.col.date'),
      dataIndex: 'statDate',
      fixed: 'left',
      render: (value: unknown) => plainText(value) || DASH,
    },
    {
      title: t('push.stats.col.reason'),
      dataIndex: 'triggerReason',
      render: (value: unknown) => codeText(intl, 'push.reason', value) || plainText(value) || DASH,
    },
    {
      title: <HeaderTip id="push.stats.col.sent" testId="tip-sent" />,
      dataIndex: 'pushesSent',
      align: 'end',
      render: (value: unknown) => countText(intl.locale, value),
    },
    {
      title: <HeaderTip id="push.stats.col.ok" testId="tip-ok" />,
      dataIndex: 'deliveriesOk',
      align: 'end',
      render: (value: unknown) => countText(intl.locale, value),
    },
    {
      title: <HeaderTip id="push.stats.col.failed" testId="tip-failed" />,
      dataIndex: 'deliveriesFailed',
      align: 'end',
      render: (value: unknown) => countText(intl.locale, value),
    },
    {
      title: <HeaderTip id="push.stats.col.opened" testId="tip-opened" />,
      dataIndex: 'pushesOpened',
      align: 'end',
      render: (value: unknown) => countText(intl.locale, value),
    },
    {
      title: <HeaderTip id="push.stats.col.rate" testId="tip-rate" />,
      key: 'rate',
      align: 'end',
      render: (_: unknown, row) => formatPercent(openRate(row), intl.locale),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <UtcNotice />
      <Flex gap={12} wrap align="center">
        <DateRangeUtc
          value={draft.range}
          onChange={(range) => setDraft((d) => ({ ...d, range }))}
          maxDays={meta.statsMaxRangeDays ?? undefined}
        />
        <Flex gap={8} align="center">
          <Typography.Text>{t('push.stats.reason')}</Typography.Text>
          <Select
            style={{ minWidth: 200 }}
            aria-label={t('push.stats.reason')}
            value={draft.reason}
            options={[
              { value: ALL, label: t('push.stats.allReasons') },
              ...TRIGGER_REASONS.map((r) => ({
                value: r,
                label: codeText(intl, 'push.reason', r),
              })),
            ]}
            onChange={(reason) => setDraft((d) => ({ ...d, reason }))}
          />
        </Flex>
        <Button type="primary" onClick={() => setApplied({ ...draft })}>
          {t('stat.common.query')}
        </Button>
        <ExportButton
          name="push"
          viewCode="STATS:VIEW"
          params={{
            from: applied.range.from,
            to: applied.range.to,
            triggerReason: applied.reason === ALL ? undefined : applied.reason,
          }}
        />
      </Flex>
      <LandBar name="push" onLanded={() => void load()} />
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
        <>
          <Typography.Text strong>{t('push.stats.chartTitle')}</Typography.Text>
          <TrendChart
            rows={days}
            xField="statDate"
            series={series}
            from={applied.range.from}
            to={applied.range.to}
          />
          <Table<PushStatRow & { __key: string }>
            size="small"
            rowKey="__key"
            columns={columns}
            dataSource={rows.map((r, i) => ({
              ...r,
              __key: `${plainText(r.statDate)}|${plainText(r.triggerReason)}|${i}`,
            }))}
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: t('push.stats.empty') }}
          />
        </>
      ) : null}
    </Flex>
  );
}
