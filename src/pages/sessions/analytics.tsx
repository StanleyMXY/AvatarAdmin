import { QuestionCircleOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Alert, Button, Flex, Spin, Table, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo, useState } from 'react';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import { LandBar } from '../../components/stat/LandBar';
import { UtcNotice } from '../../components/stat/UtcNotice';
import { fillMissingDays } from '../../services/stats/fillMissingDays';
import { getDaily } from '../../services/stats/reports';
import { useAdminMeta } from '../../session/useSession';
import { DASH, formatCount } from '../../utils/ratio';
import { lastNDaysUtc } from '../../utils/utcDay';
import { brokenDays, type CallDay, emptyCallDay, toCallDay } from './analyticsRows';
import { DayLineChart, type LinePoint } from './charts';
import { formatDecimal } from './format';
import { useStatRead } from './useStatRead';

const METRICS = ['calls', 'callers', 'minutes', 'minutesPerCaller', 'callsPerCaller'] as const;
type Metric = (typeof METRICS)[number];
const LABEL: Record<Metric, string> = {
  calls: 'sessions.analytics.col.calls',
  callers: 'sessions.analytics.col.callers',
  minutes: 'sessions.analytics.col.minutes',
  minutesPerCaller: 'sessions.analytics.col.minutesPerCaller',
  callsPerCaller: 'sessions.analytics.col.callsPerCaller',
};
const TIP: Partial<Record<Metric, string>> = {
  minutesPerCaller: 'sessions.analytics.col.minutesPerCaller.tip',
  callsPerCaller: 'sessions.analytics.col.callsPerCaller.tip',
};

/**
 * 通话分析 (`STATS:VIEW`): calls, callers, call minutes, minutes per caller and calls per caller of
 * each UTC day, from the daily report of platform ALL. One trend chart and one table. Nothing is
 * added up over the days (the callers of two days are not the callers of both), so there is no total row.
 */
export default function CallAnalyticsPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const meta = useAdminMeta();
  const [draft, setDraft] = useState<DayRange>(() => lastNDaysUtc(7));
  const [applied, setApplied] = useState<DayRange>(draft);
  const fetcher = useCallback(
    () => getDaily({ from: applied.from, to: applied.to, platform: 'ALL' }),
    [applied],
  );
  const { data, failure, reload } = useStatRead(fetcher);

  const days = useMemo<CallDay[] | null>(
    () =>
      data
        ? [...data.items]
            .map(toCallDay)
            .sort((a, b) => (a.statDate < b.statDate ? -1 : a.statDate > b.statDate ? 1 : 0))
        : null,
    [data],
  );

  const broken = useMemo(() => (data ? brokenDays(data.items) : []), [data]);

  const chart = ((): LinePoint[] => {
    if (!days) return [];
    const full = fillMissingDays(days, applied.from, applied.to, emptyCallDay);
    return full.flatMap((day) =>
      METRICS.map((metric) => ({
        statDate: day.statDate,
        series: t(LABEL[metric]),
        value: day[metric],
      })),
    );
  })();

  const whole = (value: number | null) => formatCount(value, intl.locale);
  const decimal = (value: number | null) =>
    value === null ? DASH : formatDecimal(value, intl.locale, 1);
  const render: Record<Metric, (value: number | null) => string> = {
    calls: whole,
    callers: whole,
    minutes: decimal,
    minutesPerCaller: decimal,
    callsPerCaller: decimal,
  };

  const columns: ColumnsType<CallDay> = [
    {
      key: 'statDate',
      title: t('sessions.common.date'),
      fixed: 'left',
      render: (_: unknown, day) => day.statDate,
    },
    ...METRICS.map((metric) => {
      const tip = TIP[metric];
      return {
        key: metric,
        align: 'end' as const,
        title: tip ? (
          <span>
            {t(LABEL[metric])}
            <Tooltip title={t(tip)}>
              <QuestionCircleOutlined aria-hidden={false} style={{ marginInlineStart: 4 }} />
            </Tooltip>
          </span>
        ) : (
          t(LABEL[metric])
        ),
        render: (_: unknown, day: CallDay) => render[metric](day[metric]),
      };
    }),
  ];

  return (
    <Flex vertical gap={16}>
      <UtcNotice />
      <Typography.Text type="secondary">{t('sessions.analytics.note')}</Typography.Text>
      <Flex gap={12} wrap align="center">
        <DateRangeUtc
          value={draft}
          onChange={setDraft}
          maxDays={meta.statsMaxRangeDays ?? undefined}
        />
        <Button type="primary" onClick={() => setApplied({ ...draft })}>
          {t('stat.common.query')}
        </Button>
      </Flex>
      <LandBar name="daily-business" onLanded={reload} />
      {failure ? (
        <Alert
          type="error"
          showIcon
          title={t('pages.common.loadFailed', { message: failure })}
          action={
            <Button size="small" onClick={reload}>
              {t('pages.common.retry')}
            </Button>
          }
        />
      ) : null}
      {days === null && !failure ? <Spin /> : null}
      {days && broken.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          data-testid="analytics-invalid-note"
          title={t('sessions.analytics.invalidNote', {
            days:
              broken.slice(0, 5).join(', ') + (broken.length > 5 ? ` +${broken.length - 5}` : ''),
          })}
        />
      ) : null}
      {days ? (
        <>
          <DayLineChart data={chart} yTitle={t('sessions.analytics.chart.y')} />
          <Table<CallDay>
            size="small"
            rowKey="statDate"
            columns={columns}
            dataSource={days}
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        </>
      ) : null}
    </Flex>
  );
}
