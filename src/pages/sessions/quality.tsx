import { QuestionCircleOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Flex,
  Spin,
  Statistic,
  Table,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo, useState } from 'react';
import { buildVars } from '../../buildVars';
import { ExportButton } from '../../components/ExportButton';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import { LandBar } from '../../components/stat/LandBar';
import { ProvisionalTag } from '../../components/stat/ProvisionalTag';
import { ReportHelper } from '../../components/stat/ReportHelper';
import { UtcNotice } from '../../components/stat/UtcNotice';
import { getSessionQuality } from '../../services/stats/reports';
import type { SessionQualityRow } from '../../services/stats/types';
import { useAdminMeta } from '../../session/useSession';
import { DASH, formatCount, formatPercent } from '../../utils/ratio';
import { hasProvisionalDay, isProvisionalDay } from '../../utils/settledDay';
import { daysBetween, lastNDaysUtc, todayUtc } from '../../utils/utcDay';
import { type ColumnPoint, DayLineChart, type LinePoint, StackedDayChart } from './charts';
import { formatDecimal } from './format';
import {
  averageJoinSeconds,
  bucketShare,
  JOIN_BUCKETS,
  qualityFlags,
  successRate,
  sumRows,
} from './qualityMetrics';
import { useStatRead } from './useStatRead';

/** A column title with the hint icon beside it (the definition of the figure). */
const headerWithTip = (title: string, tip: string) => (
  <span>
    {title}
    <Tooltip title={tip}>
      <QuestionCircleOutlined aria-hidden={false} style={{ marginInlineStart: 4 }} />
    </Tooltip>
  </span>
);
type T = (id: string, values?: Record<string, string | number>) => string;

type CardProps = {
  name: string;
  title: string;
  tip: string;
  value: string;
  /** The figure is past its limit: a red frame. */
  alert: boolean;
  /** Written under the figure: which limit the frame follows. */
  limit?: string;
  /** The total includes a day that is not over. */
  provisional?: boolean;
};

function QualityCard({ name, title, tip, value, alert, limit, provisional }: CardProps) {
  const { token } = theme.useToken();
  return (
    <Card
      size="small"
      data-testid={`quality-card-${name}`}
      data-alert={alert ? 'true' : 'false'}
      style={{
        flex: '1 1 170px',
        minWidth: 0,
        ...(alert
          ? { borderColor: token.colorError, boxShadow: `0 0 0 1px ${token.colorError}` }
          : {}),
      }}
    >
      <Statistic
        title={headerWithTip(title, tip)}
        value={value}
        styles={alert ? { content: { color: token.colorError } } : undefined}
        formatter={(v) => <span data-testid="quality-value">{v}</span>}
      />
      {provisional ? <ProvisionalTag testId={`quality-provisional-${name}`} /> : null}
      {limit ? (
        <Typography.Text type={alert ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
          {limit}
        </Typography.Text>
      ) : null}
    </Card>
  );
}

const byDate = (a: SessionQualityRow, b: SessionQualityRow) =>
  a.statDate < b.statDate ? -1 : a.statDate > b.statDate ? 1 : 0;

/**
 * 通话质量 (`STATS:VIEW`): six cards over the chosen range, the success rate of each day, the connect
 * time of each day in four exclusive buckets, and the table of the days. A card is framed red when
 * the success rate is below, or the share of connects slower than 10 seconds above, the limit of the
 * build (`ADMIN_QUALITY_MIN_SUCCESS_RATE`, `ADMIN_QUALITY_MAX_SLOW_SHARE`).
 */
export default function SessionQualityPage() {
  const intl = useIntl();
  const t: T = (id, values) => intl.formatMessage({ id }, values);
  const meta = useAdminMeta();
  // What is being edited, and what was asked for with Search (the cards, the charts, the export).
  const [draft, setDraft] = useState<DayRange>(() => lastNDaysUtc(7));
  const [applied, setApplied] = useState<DayRange>(draft);
  const fetcher = useCallback(() => getSessionQuality(applied), [applied]);
  const { data, failure, reload } = useStatRead(fetcher);
  const rows = useMemo(() => (data ? [...data.items].sort(byDate) : null), [data]);

  const limits = {
    minSuccessRate: buildVars.qualityMinSuccessRate,
    maxSlowShare: buildVars.qualityMaxSlowShare,
  };
  const seconds = (value: number | null) =>
    value === null
      ? DASH
      : t('sessions.unit.seconds', { value: formatDecimal(value, intl.locale, 2) });
  const percent = (value: number | null, digits = 1) => formatPercent(value, intl.locale, digits);
  const bucketLabel = (bucket: (typeof JOIN_BUCKETS)[number]) =>
    t(`sessions.quality.bucket.${bucket}`);

  // The totals include today when a row of today is there: they are provisional (UTC, settledDay.ts).
  const today = todayUtc();
  const provisional =
    rows !== null &&
    hasProvisionalDay(
      rows.map((r) => r.statDate),
      today,
    );
  const totals = useMemo(() => (rows ? sumRows(rows) : null), [rows]);
  const rate = totals ? successRate(totals) : null;
  const slow = totals ? bucketShare(totals, 'joinGt10s') : null;
  const flags = qualityFlags({ successRate: rate, slowShare: slow }, limits);

  const lineData = ((): LinePoint[] => {
    if (!rows) return [];
    const byDay = new Map(rows.map((r) => [r.statDate, r]));
    const series = t('sessions.quality.chart.rate');
    // A day without a row, or without a denominator, has no rate: a gap, not 0%.
    return daysBetween(applied.from, applied.to).map((statDate) => {
      const row = byDay.get(statDate);
      return { statDate, series, value: row ? successRate(row) : null };
    });
  })();

  const columnData = ((): ColumnPoint[] => {
    if (!rows) return [];
    const byDay = new Map(rows.map((r) => [r.statDate, r]));
    return daysBetween(applied.from, applied.to).flatMap((statDate) =>
      JOIN_BUCKETS.map((bucket) => {
        const count = byDay.get(statDate)?.[bucket];
        const known = typeof count === 'number' && Number.isFinite(count) && count >= 0;
        return { statDate, bucket: bucketLabel(bucket), value: known ? count : 0 };
      }),
    );
  })();

  const count = (value: number | undefined) => formatCount(value, intl.locale);
  const columns: ColumnsType<SessionQualityRow> = [
    {
      key: 'statDate',
      title: t('sessions.common.date'),
      fixed: 'left',
      render: (_: unknown, row) => (
        <>
          {row.statDate}
          {isProvisionalDay(row.statDate, today) ? (
            <ProvisionalTag testId="provisional-row" style={{ marginInlineStart: 4 }} />
          ) : null}
        </>
      ),
    },
    {
      key: 'connected',
      title: t('sessions.quality.col.connected'),
      align: 'end',
      render: (_: unknown, row) => count(row.connected),
    },
    {
      key: 'agentUnavailable',
      title: t('sessions.quality.col.agentUnavailable'),
      align: 'end',
      render: (_: unknown, row) => count(row.agentUnavailable),
    },
    {
      key: 'successRate',
      title: headerWithTip(
        t('sessions.quality.col.successRate'),
        t('sessions.quality.card.successRate.tip'),
      ),
      align: 'end',
      render: (_: unknown, row) => percent(successRate(row)),
    },
    {
      key: 'avgJoin',
      title: headerWithTip(
        t('sessions.quality.col.avgJoin'),
        t('sessions.quality.card.avgJoin.tip'),
      ),
      align: 'end',
      render: (_: unknown, row) => seconds(averageJoinSeconds(row)),
    },
    ...JOIN_BUCKETS.map((bucket) => ({
      key: bucket,
      title: bucketLabel(bucket),
      align: 'end' as const,
      render: (_: unknown, row: SessionQualityRow) => count(row[bucket]),
    })),
    {
      key: 'limitReached',
      title: t('sessions.quality.col.limitReached'),
      align: 'end',
      render: (_: unknown, row) => count(row.limitReached),
    },
    {
      key: 'notJoined',
      title: t('sessions.quality.col.notJoined'),
      align: 'end',
      render: (_: unknown, row) => count(row.discardedUserNotJoined),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <UtcNotice />
      <ReportHelper pageKey="sessionQuality" />
      <Flex gap={12} wrap align="center">
        <DateRangeUtc
          value={draft}
          onChange={setDraft}
          maxDays={meta.statsMaxRangeDays ?? undefined}
        />
        <Button type="primary" onClick={() => setApplied({ ...draft })}>
          {t('stat.common.query')}
        </Button>
        <ExportButton
          name="session-quality"
          viewCode="STATS:VIEW"
          params={{ from: applied.from, to: applied.to }}
        />
      </Flex>
      <LandBar name="session-quality" onLanded={reload} />
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
      {rows === null && !failure ? <Spin /> : null}
      {rows ? (
        <>
          <Flex gap={12} wrap>
            <QualityCard
              provisional={provisional}
              name="successRate"
              title={t('sessions.quality.card.successRate')}
              tip={t('sessions.quality.card.successRate.tip')}
              value={percent(rate)}
              alert={flags.lowSuccessRate}
              limit={t('sessions.quality.card.limitMin', {
                limit: percent(limits.minSuccessRate),
              })}
            />
            <QualityCard
              provisional={provisional}
              name="avgJoin"
              title={t('sessions.quality.card.avgJoin')}
              tip={t('sessions.quality.card.avgJoin.tip')}
              value={seconds(totals ? averageJoinSeconds(totals) : null)}
              alert={false}
            />
            <QualityCard
              provisional={provisional}
              name="le2"
              title={t('sessions.quality.card.le2')}
              tip={t('sessions.quality.card.le2.tip')}
              value={percent(totals ? bucketShare(totals, 'joinLe2s') : null)}
              alert={false}
            />
            <QualityCard
              provisional={provisional}
              name="gt10"
              title={t('sessions.quality.card.gt10')}
              tip={t('sessions.quality.card.gt10.tip')}
              value={percent(slow)}
              alert={flags.highSlowShare}
              limit={t('sessions.quality.card.limitMax', {
                limit: percent(limits.maxSlowShare),
              })}
            />
            <QualityCard
              provisional={provisional}
              name="limitReached"
              title={t('sessions.quality.card.limitReached')}
              tip={t('sessions.quality.card.limitReached.tip')}
              value={totals ? count(totals.limitReached) : DASH}
              alert={false}
            />
            <QualityCard
              provisional={provisional}
              name="notJoined"
              title={t('sessions.quality.card.notJoined')}
              tip={t('sessions.quality.card.notJoined.tip')}
              value={totals ? count(totals.discardedUserNotJoined) : DASH}
              alert={false}
            />
          </Flex>
          <Flex gap={24} wrap>
            <div style={{ flex: '1 1 420px', minWidth: 0 }}>
              <Typography.Text strong>{t('sessions.quality.chart.rate')}</Typography.Text>
              <DayLineChart
                data={lineData}
                yTitle={t('sessions.quality.chart.rate.y')}
                percent
                today={today}
              />
            </div>
            <div style={{ flex: '1 1 420px', minWidth: 0 }}>
              <Typography.Text strong>{t('sessions.quality.chart.buckets')}</Typography.Text>
              <StackedDayChart
                data={columnData}
                yTitle={t('sessions.quality.chart.buckets.y')}
                today={today}
              />
            </div>
          </Flex>
          {provisional ? (
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12 }}
              data-testid="provisional-chart-note"
            >
              {t('stat.common.provisional.columnNote')}
            </Typography.Text>
          ) : null}
          <Table<SessionQualityRow>
            size="small"
            rowKey="statDate"
            columns={columns}
            dataSource={rows}
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        </>
      ) : null}
    </Flex>
  );
}
