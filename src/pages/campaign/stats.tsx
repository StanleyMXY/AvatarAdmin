import { useIntl } from '@umijs/max';
import { Button, Flex, Spin, Table, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { ExportButton } from '../../components/ExportButton';
import { FailureBar } from '../../components/FailureBar';
import { HeaderTip } from '../../components/HeaderTip';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import { LandBar } from '../../components/stat/LandBar';
import { ReportHelper } from '../../components/stat/ReportHelper';
import { TrendChart } from '../../components/stat/TrendChart';
import { UtcNotice } from '../../components/stat/UtcNotice';
import { useLatestCall } from '../../hooks/useLatestCall';
import { useLatestRead } from '../../hooks/useLatestRead';
import { getPerformance, type PerformanceRow, readCostSettings } from '../../services/campaign';
import { describeFailure } from '../../session/describe';
import { useAdminMeta } from '../../session/useSession';
import { countText, orDash } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { lastNDaysUtc } from '../../utils/utcDay';
import { CampaignSelect } from './CampaignSelect';
import { moneyText, numberOf, rateText, shareText, unitCostText } from './figures';
import { useCampaigns } from './useCampaigns';

type Filter = { range: DayRange; campaignId: string | undefined };
type Row = PerformanceRow & { rowKey: string; unattributed?: boolean };

const DAILY_PAGE_SIZE = 20;
const initialFilter = (): Filter => ({ range: lastNDaysUtc(7), campaignId: undefined });
/** The campaign id 0 is not a campaign: it is the row of the installs that matched none. */
const isUnattributedRow = (row: PerformanceRow) => String(row.campaignId ?? '') === '0';

/**
 * 投放效果 (`ATTRIBUTION:VIEW`): the funnel of the own attribution for each campaign and for each
 * day: page views, clicks, installs, registrations, the rates between them and the costs. A rate or
 * a cost per unit whose denominator is 0 is a dash. One chart of the counts of the days above the
 * table of the campaigns and the table of the days (20 rows to a page).
 */
export default function CampaignStatsPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const meta = useAdminMeta();
  const campaigns = useCampaigns();
  // The currency of every cost; an administrator who may not read the setting gets no currency in the heads.
  const settings = useLatestRead(readCostSettings);
  const currency = settings.data?.currency ?? null;

  // What is being edited, and what was asked for with Search (the reports, the chart and the export).
  const [draft, setDraft] = useState<Filter>(initialFilter);
  const [applied, setApplied] = useState<Filter>(initialFilter);
  const [campaignRows, setCampaignRows] = useState<PerformanceRow[] | null>(null);
  const [dayRows, setDayRows] = useState<PerformanceRow[] | null>(null);
  // The failed read itself (boxed: a thrown value can be anything); its words, and what the backend
  // refused about the dates, are made when the page is drawn, so they follow the language.
  const [failed, setFailed] = useState<{ error: unknown } | null>(null);
  const begin = useLatestCall();

  const load = useCallback(async () => {
    const isCurrent = begin();
    setCampaignRows(null);
    setDayRows(null);
    setFailed(null);
    const query = {
      from: applied.range.from,
      to: applied.range.to,
      campaignId: applied.campaignId,
    };
    try {
      const [byCampaign, byDay] = await Promise.all([
        getPerformance({ ...query, groupBy: 'campaign' }),
        getPerformance({ ...query, groupBy: 'day' }),
      ]);
      if (!isCurrent()) return;
      setCampaignRows(byCampaign.items);
      setDayRows(byDay.items);
    } catch (error) {
      if (isCurrent()) setFailed({ error });
    }
  }, [applied, begin]);

  const described = failed === null ? null : describeFailure(intl, failed.error);
  const failure = described === null ? null : described.text;
  // A range error names `from` or `to` (the same for every statistics page): say which date, with
  // the words of the reason and of the field.
  const rangeRefusals = (described?.fields ?? []).flatMap((field) =>
    field.ref === 'from' || field.ref === 'to'
      ? [
          intl.formatMessage(
            { id: 'campaign.stats.range.line' },
            {
              field: intl.formatMessage({ id: `campaign.stats.range.${field.ref}` }),
              reason: field.text,
              hint: intl.formatMessage({ id: `campaign.stats.range.${field.ref}.hint` }),
            },
          ),
        ]
      : [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const interval = meta.landIntervalMinutes;
  const locale = intl.locale;

  // ---- the table of the campaigns: the unattributed installs are the last row ----
  const summary = useMemo<Row[]>(() => {
    const rows = campaignRows ?? [];
    const own = rows.filter((r) => !isUnattributedRow(r));
    const rest = rows.filter(isUnattributedRow);
    return [
      ...own.map((r, i) => ({ ...r, rowKey: `c|${plainText(r.campaignId)}|${i}` })),
      ...rest.map((r, i) => ({ ...r, rowKey: `u|${i}`, unattributed: true })),
    ];
  }, [campaignRows]);

  const share = useMemo(() => {
    const unattributed = summary.find((r) => r.unattributed);
    const matched = summary
      .filter((r) => !r.unattributed)
      .reduce((sum, r) => sum + (numberOf(r.installs) ?? 0), 0);
    const count = numberOf(unattributed?.unattributedInstalls);
    return count === null ? DASH : shareText(count, matched + count, locale);
  }, [summary, locale]);

  const days = useMemo<(PerformanceRow & { statDate: string; rowKey: string })[]>(
    () =>
      (dayRows ?? [])
        .filter((r): r is PerformanceRow & { statDate: string } => typeof r.statDate === 'string')
        .map((r) => ({ ...r, rowKey: r.statDate })),
    [dayRows],
  );

  const series = [
    { field: 'pageViews', label: t('campaign.stats.col.pageViews') },
    { field: 'clicks', label: t('campaign.stats.col.clicks') },
    { field: 'installs', label: t('campaign.stats.col.installs') },
    { field: 'registered', label: t('campaign.stats.col.registered') },
  ];

  /** A campaign's code and name: what the backend sent, else the list of campaigns, else the id. */
  const identity = (row: PerformanceRow) => {
    const known = campaigns.byId(row.campaignId);
    const code = plainText(row.campaignCode) || known?.code || plainText(row.campaignId);
    const name = plainText(row.campaignName) || known?.name || '';
    return { code, name };
  };

  const money = (id: string) =>
    currency ? (
      <HeaderTip
        id={`campaign.stats.col.${id}`}
        label={t(`campaign.stats.col.${id}.in`, { currency })}
      />
    ) : (
      <HeaderTip id={`campaign.stats.col.${id}`} />
    );

  const metricColumns = (): ColumnsType<Row> => {
    const plain = (render: (row: Row) => React.ReactNode) => (_: unknown, row: Row) =>
      row.unattributed ? DASH : render(row);
    return [
      {
        title: <HeaderTip id="campaign.stats.col.pageViews" />,
        key: 'pageViews',
        align: 'end',
        render: plain((row) => countText(locale, row.pageViews)),
      },
      {
        title: <HeaderTip id="campaign.stats.col.clicks" />,
        key: 'clicks',
        align: 'end',
        render: plain((row) => countText(locale, row.clicks)),
      },
      {
        title: <HeaderTip id="campaign.stats.col.clickRate" />,
        key: 'clickRate',
        align: 'end',
        render: plain((row) => rateText(row.clickRate, row.clicks, row.pageViews, locale)),
      },
      {
        title: <HeaderTip id="campaign.stats.col.installs" />,
        key: 'installs',
        align: 'end',
        render: (_: unknown, row: Row) =>
          row.unattributed ? (
            <Flex vertical align="end">
              <span data-testid="unattributed-count">
                {countText(locale, row.unattributedInstalls)}
              </span>
              <Tooltip title={t('campaign.stats.unattributed.share', { share })}>
                <Typography.Text
                  type="secondary"
                  data-testid="unattributed-share"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {t('campaign.stats.unattributed.shareShort', { share })}
                </Typography.Text>
              </Tooltip>
            </Flex>
          ) : (
            countText(locale, row.installs)
          ),
      },
      {
        title: <HeaderTip id="campaign.stats.col.registered" />,
        key: 'registered',
        align: 'end',
        render: plain((row) => countText(locale, row.registered)),
      },
      {
        title: <HeaderTip id="campaign.stats.col.installRate" />,
        key: 'installRate',
        align: 'end',
        render: plain((row) => rateText(row.installRate, row.installs, row.clicks, locale)),
      },
      {
        title: <HeaderTip id="campaign.stats.col.registerRate" />,
        key: 'registerRate',
        align: 'end',
        render: plain((row) => rateText(row.registerRate, row.registered, row.installs, locale)),
      },
      {
        title: money('cost'),
        key: 'cost',
        align: 'end',
        render: plain((row) => moneyText(row.cost, locale)),
      },
      {
        title: money('cpa'),
        key: 'cpa',
        align: 'end',
        render: plain((row) => unitCostText(row.cpa, row.cost, row.registered, locale)),
      },
      {
        title: money('cpi'),
        key: 'cpi',
        align: 'end',
        render: plain((row) => unitCostText(row.cpi, row.cost, row.installs, locale)),
      },
    ];
  };

  const summaryColumns: ColumnsType<Row> = [
    {
      title: t('campaign.stats.col.code'),
      key: 'code',
      render: (_: unknown, row) =>
        row.unattributed ? (
          DASH
        ) : (
          <Typography.Text style={{ overflowWrap: 'anywhere' }}>
            {identity(row).code}
          </Typography.Text>
        ),
    },
    {
      title: t('campaign.stats.col.name'),
      key: 'name',
      render: (_: unknown, row) =>
        row.unattributed ? (
          <Tooltip title={t('campaign.stats.unattributed.tip')}>
            <span>{t('campaign.stats.unattributed')}</span>
          </Tooltip>
        ) : (
          <EllipsisPopoverText text={identity(row).name} width={220} />
        ),
    },
    ...metricColumns(),
  ];

  const dayColumns: ColumnsType<Row> = [
    {
      title: t('campaign.stats.col.date'),
      key: 'date',
      fixed: 'left',
      render: (_: unknown, row) => orDash(row.statDate),
    },
    ...metricColumns(),
  ];

  const loaded = campaignRows !== null && dayRows !== null;
  const exportParams = {
    from: applied.range.from,
    to: applied.range.to,
    campaignId: applied.campaignId,
    groupBy: 'campaign',
  };

  return (
    <Flex vertical gap={16}>
      <ReportHelper pageKey="campaign" />
      <Flex vertical gap={4}>
        <UtcNotice />
        <Typography.Text type="secondary" data-testid="campaign-stats-today">
          {typeof interval === 'number' && Number.isFinite(interval) && interval >= 1
            ? t('dashboard.explain.landInterval', { minutes: interval })
            : t('dashboard.explain.provisional')}
        </Typography.Text>
      </Flex>
      <Flex gap={12} wrap align="center">
        <DateRangeUtc
          value={draft.range}
          onChange={(range) => setDraft((d) => ({ ...d, range }))}
          maxDays={meta.statsMaxRangeDays ?? undefined}
        />
        <CampaignSelect
          list={campaigns}
          value={draft.campaignId}
          neededCode="ATTRIBUTION:MANAGE"
          onChange={(campaignId) => setDraft((d) => ({ ...d, campaignId }))}
        />
        <Button type="primary" onClick={() => setApplied({ ...draft })}>
          {t('stat.common.query')}
        </Button>
        <ExportButton
          name="attribution-performance"
          viewCode="ATTRIBUTION:VIEW"
          params={exportParams}
        />
      </Flex>
      {rangeRefusals.length > 0 ? (
        <Typography.Text type="danger" data-testid="campaign-stats-range-error">
          {rangeRefusals.join(' ')}
        </Typography.Text>
      ) : null}
      <LandBar name="attribution-daily" onLanded={() => void load()} />
      {failure ? <FailureBar failure={failure} onRetry={() => void load()} /> : null}
      {!loaded && !failure ? <Spin /> : null}
      {loaded ? (
        <>
          <Typography.Text strong>{t('campaign.stats.chartTitle')}</Typography.Text>
          <TrendChart
            rows={days}
            xField="statDate"
            series={series}
            from={applied.range.from}
            to={applied.range.to}
          />
          <Typography.Text strong>{t('campaign.stats.summaryTitle')}</Typography.Text>
          <Table<Row>
            size="small"
            rowKey="rowKey"
            columns={summaryColumns}
            dataSource={summary}
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: t('campaign.stats.empty') }}
            onRow={(row) =>
              row.unattributed
                ? ({ 'data-testid': 'unattributed-row' } as React.HTMLAttributes<HTMLElement>)
                : {}
            }
          />
          <Typography.Text strong>{t('campaign.stats.dailyTitle')}</Typography.Text>
          <Table<Row>
            size="small"
            rowKey="rowKey"
            columns={dayColumns}
            dataSource={days}
            pagination={{
              pageSize: DAILY_PAGE_SIZE,
              showSizeChanger: false,
              hideOnSinglePage: true,
            }}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: t('campaign.stats.empty') }}
          />
        </>
      ) : null}
    </Flex>
  );
}
