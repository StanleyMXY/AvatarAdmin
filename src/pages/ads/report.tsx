import { useIntl } from '@umijs/max';
import { Button, Flex, Select, Spin, Table, Tabs, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo, useState } from 'react';
import { ChannelSelect } from '../../components/ChannelSelect';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { ExportButton } from '../../components/ExportButton';
import { FailureBar } from '../../components/FailureBar';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import { LandBar } from '../../components/stat/LandBar';
import { TrendChart } from '../../components/stat/TrendChart';
import { UtcNotice } from '../../components/stat/UtcNotice';
import { useLatestRead } from '../../hooks/useLatestRead';
import { getReport, type ReportParams } from '../../services/ads';
import { useAdminMeta } from '../../session/useSession';
import { codeText } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';
import { safeRatio } from '../../utils/ratio';
import { lastNDaysUtc } from '../../utils/utcDay';
import { Checklist } from './Checklist';
import { type DrillRow, DrillTable } from './DrillTable';
import { ReportCards } from './ReportCards';
import { countCell, percentText } from './reportFigures';

const TABS = [
  ['placement', 'by-placement'],
  ['campaign', 'by-campaign'],
  ['creative', 'by-creative'],
  ['country', 'by-country'],
] as const;
type TabKey = (typeof TABS)[number][0];

type Applied = { range: DayRange; platform: string; channel: string };

type DailyRow = {
  statDate: string;
  impressions: number | null;
  clicks: number | null;
  completions: number | null;
};

/**
 * 广告报表: the numbers of the in-app ads over a range of UTC days, for a platform and a channel
 * (both optional; "all" is not sent). Cards with the formulas, one chart of the impressions and
 * the clicks, the days, four drill-downs that share one table, and the reasons for no ad. There is
 * no count of distinct users and no revenue, eCPM or fill rate: those do not exist in this system.
 */
export default function AdReportPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const meta = useAdminMeta();
  const [draft, setDraft] = useState<Applied>(() => ({
    range: lastNDaysUtc(7),
    platform: 'ALL',
    channel: 'ALL',
  }));
  const [applied, setApplied] = useState<Applied>(draft);
  const [tab, setTab] = useState<TabKey>('placement');

  const params = useMemo<ReportParams>(
    () => ({
      from: applied.range.from,
      to: applied.range.to,
      ...(applied.platform !== 'ALL' ? { platform: applied.platform } : {}),
      ...(applied.channel !== 'ALL' ? { channelCode: applied.channel } : {}),
    }),
    [applied],
  );
  const dimension = TABS.find(([key]) => key === tab)?.[1] ?? 'by-placement';

  const overview = useLatestRead(useCallback(() => getReport('overview', params), [params]));
  const drill = useLatestRead(
    useCallback(
      () => getReport(dimension as 'by-placement', params) as Promise<Record<string, unknown>[]>,
      [dimension, params],
    ),
  );
  const nofill = useLatestRead(useCallback(() => getReport('nofill', params), [params]));

  const reloadAll = () => {
    overview.reload();
    drill.reload();
    nofill.reload();
  };

  const search = () => setApplied({ ...draft, range: { ...draft.range } });

  const days = useMemo<DailyRow[] | null>(
    () =>
      overview.data
        ? overview.data.daily.map((d) => ({
            statDate: plainText(d.statDate),
            impressions: typeof d.impressions === 'number' ? d.impressions : null,
            clicks: typeof d.clicks === 'number' ? d.clicks : null,
            completions: typeof d.completions === 'number' ? d.completions : null,
          }))
        : null,
    [overview.data],
  );

  const drillRows = useMemo<DrillRow[]>(
    () => (drill.data ?? []).map((row, i) => ({ ...row, __key: String(i) })),
    [drill.data],
  );
  const nofillRows = useMemo(
    () => (nofill.data ?? []).map((row, i) => ({ ...row, __key: String(i) })),
    [nofill.data],
  );

  const dayColumns: ColumnsType<DailyRow> = [
    { key: 'date', title: t('ads.report.col.date'), render: (_, r) => r.statDate },
    {
      key: 'impressions',
      title: t('ads.report.col.impressions'),
      align: 'end',
      render: (_, r) => countCell(r.impressions, intl.locale),
    },
    {
      key: 'clicks',
      title: t('ads.report.col.clicks'),
      align: 'end',
      render: (_, r) => countCell(r.clicks, intl.locale),
    },
    {
      key: 'ctr',
      title: t('ads.report.col.ctr'),
      align: 'end',
      render: (_, r) => percentText(safeRatio(r.clicks, r.impressions), intl.locale),
    },
    {
      key: 'completions',
      title: t('ads.report.col.completions'),
      align: 'end',
      render: (_, r) => countCell(r.completions, intl.locale),
    },
  ];

  type NoFill = (typeof nofillRows)[number];
  const nofillColumns: ColumnsType<NoFill> = [
    { key: 'date', title: t('ads.report.col.date'), render: (_, r) => plainText(r.statDate) },
    {
      key: 'slot',
      title: t('ads.report.col.slot'),
      render: (_, r) => <span style={{ overflowWrap: 'anywhere' }}>{plainText(r.slotKey)}</span>,
    },
    {
      key: 'reason',
      title: t('ads.report.col.reason'),
      render: (_, r) => {
        const code = plainText(r.reason);
        const text = codeText(intl, 'ads.report.reason', code);
        return text === code ? (
          <span style={{ overflowWrap: 'anywhere' }}>{code}</span>
        ) : (
          <Flex vertical>
            <Typography.Text code style={{ alignSelf: 'start' }}>
              {code}
            </Typography.Text>
            <EllipsisPopoverText text={text} lines={3} width={420} />
          </Flex>
        );
      },
    },
    {
      key: 'count',
      title: t('ads.report.col.count'),
      align: 'end',
      render: (_, r) => countCell(r.cnt, intl.locale),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Checklist />
      <UtcNotice />
      <Flex gap={12} wrap align="center">
        <DateRangeUtc
          value={draft.range}
          onChange={(range) => setDraft((d) => ({ ...d, range }))}
          maxDays={meta.statsMaxRangeDays ?? undefined}
        />
        <Select
          style={{ minWidth: 120 }}
          aria-label={t('stat.common.platform')}
          value={draft.platform}
          options={['ALL', 'ANDROID', 'IOS'].map((p) => ({
            value: p,
            label: t(`stat.common.platform.${p}`),
          }))}
          onChange={(platform) => setDraft((d) => ({ ...d, platform }))}
        />
        <ChannelSelect
          withAll
          withUnknown
          value={draft.channel}
          onChange={(channel) => setDraft((d) => ({ ...d, channel }))}
        />
        <Button type="primary" onClick={search}>
          {t('stat.common.query')}
        </Button>
        <ExportButton name="ads-report" viewCode="ADS:REPORT" params={{ ...params }} />
      </Flex>
      <LandBar name="ad-daily" onLanded={reloadAll} />

      {overview.failure ? (
        <FailureBar failure={overview.failure} onRetry={overview.reload} />
      ) : null}
      {overview.data === null && !overview.failure ? <Spin /> : null}
      {overview.data ? <ReportCards totals={overview.data.totals} /> : null}

      <Flex vertical gap={8}>
        <Typography.Text strong>{t('ads.report.trendTitle')}</Typography.Text>
        {days ? (
          <TrendChart
            rows={days}
            xField="statDate"
            series={[
              { field: 'impressions', label: t('ads.report.col.impressions') },
              { field: 'clicks', label: t('ads.report.col.clicks') },
            ]}
            from={applied.range.from}
            to={applied.range.to}
          />
        ) : null}
        <Table<DailyRow>
          size="small"
          rowKey="statDate"
          columns={dayColumns}
          dataSource={days ?? []}
          loading={days === null && !overview.failure}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: t('ads.report.empty') }}
        />
      </Flex>

      <Flex vertical gap={8}>
        <Tabs
          activeKey={tab}
          onChange={(key) => setTab(key as TabKey)}
          items={TABS.map(([key]) => ({ key, label: t(`ads.report.tab.${key}`) }))}
        />
        {drill.failure ? <FailureBar failure={drill.failure} onRetry={drill.reload} /> : null}
        <DrillTable
          dimension={dimension}
          rows={drillRows}
          loading={drill.data === null && !drill.failure}
        />
      </Flex>

      <Flex vertical gap={8}>
        <Typography.Text strong>{t('ads.report.nofillTitle')}</Typography.Text>
        <Typography.Text type="secondary" data-testid="ads-nofill-note">
          {t('ads.report.nofillNote')}
        </Typography.Text>
        {nofill.failure ? <FailureBar failure={nofill.failure} onRetry={nofill.reload} /> : null}
        <Table
          size="small"
          rowKey="__key"
          columns={nofillColumns}
          dataSource={nofillRows}
          loading={nofill.data === null && !nofill.failure}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: t('ads.report.empty') }}
        />
      </Flex>
    </Flex>
  );
}
