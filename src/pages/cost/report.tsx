import { Link, useIntl } from '@umijs/max';
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Flex,
  Select,
  Spin,
  Statistic,
  Table,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { ExportButton } from '../../components/ExportButton';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import { LandBar } from '../../components/stat/LandBar';
import { UtcNotice } from '../../components/stat/UtcNotice';
import { formatAmount, listUsageModels, loadAllPages, RESOURCE_TYPES } from '../../services/cost';
import { getUsageCost } from '../../services/stats/reports';
import { useAdminMeta } from '../../session/useSession';
import { plainText } from '../../utils/plainText';
import { DASH, formatCount } from '../../utils/ratio';
import { trimSpec } from '../../utils/trimSpec';
import { daysBetween, lastNDaysUtc } from '../../utils/utcDay';
import { CostChart } from './CostChart';
import { type CostGroup, chartSeries, groupLines, NO_COST, summarize, toLine } from './costRows';
import { labelOf, quantityText } from './labels';
import { useLatestRead } from './useLatestRead';

const SOURCES = ['CALL', 'TEXT', 'GENERATION'] as const;
const TIERS = ['GUEST', 'FREE', 'PAID', 'SYSTEM', 'UNKNOWN'] as const;
const UNPRICED_LINK = '/cost/prices?tab=models&hasPrice=false';

type Filters = {
  resourceType?: string;
  model: string;
  source?: string;
  tier?: string;
  currency?: string;
};
type T = (id: string, values?: Record<string, string | number>) => string;

function MetricCard({
  name,
  title,
  children,
}: {
  name: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card size="small" data-testid={`cost-card-${name}`} style={{ flex: '1 1 220px', minWidth: 0 }}>
      <Statistic title={title} value=" " formatter={() => children} />
    </Card>
  );
}

/**
 * 成本报表 (`COST:VIEW`): total cost (each currency on its own line), requests, requests without a
 * price, the daily cost by model (one chart for each currency) and the table by resource type,
 * model, source and user type. Money is decimal text added exactly; currencies are never added to
 * each other; the requests without a price are the "No cost" group and are only counted.
 */
export default function CostReportPage() {
  const intl = useIntl();
  const t: T = (id, values) => intl.formatMessage({ id }, values);
  const meta = useAdminMeta();
  const [draft, setDraft] = useState<DayRange>(() => lastNDaysUtc(7));
  const [draftFilters, setDraftFilters] = useState<Filters>({ model: '' });
  const [applied, setApplied] = useState<{ range: DayRange; filters: Filters }>(() => ({
    range: draft,
    filters: draftFilters,
  }));
  const [modelNames, setModelNames] = useState<string[]>([]);
  const [seen, setSeen] = useState<string[]>([]);

  const params = useMemo(() => {
    const model = trimSpec(applied.filters.model);
    return {
      from: applied.range.from,
      to: applied.range.to,
      ...(applied.filters.resourceType ? { resourceType: applied.filters.resourceType } : {}),
      ...(model ? { model } : {}),
      ...(applied.filters.source ? { source: applied.filters.source } : {}),
      ...(applied.filters.tier ? { tier: applied.filters.tier } : {}),
      ...(applied.filters.currency ? { currency: applied.filters.currency } : {}),
    };
  }, [applied]);

  const fetcher = useCallback(() => getUsageCost(params), [params]);
  const { data, failure, reload } = useLatestRead(fetcher);

  // The registered models, for suggestions in the model box; a failure only means no suggestions.
  useEffect(() => {
    let alive = true;
    loadAllPages(listUsageModels)
      .then(({ items }) => {
        if (alive) setModelNames([...new Set(items.map((m) => plainText(m.model)))].slice(0, 200));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const lines = useMemo(() => (data ? data.items.map(toLine) : null), [data]);
  useEffect(() => {
    if (lines) setSeen([...new Set(lines.map((l) => l.currency).filter((c) => c !== NO_COST))]);
  }, [lines]);

  const summary = useMemo(() => (lines ? summarize(lines) : null), [lines]);
  const groups = useMemo(() => (lines ? groupLines(lines) : []), [lines]);
  const charts = useMemo(
    () => (lines ? chartSeries(lines, daysBetween(applied.range.from, applied.range.to)) : []),
    [lines, applied.range],
  );

  const currencyOptions = useMemo(() => {
    const codes = [...new Set([...(meta.allowedCurrencies ?? []), ...seen])];
    return [
      ...codes.map((c) => ({ value: c, label: c })),
      { value: NO_COST, label: intl.formatMessage({ id: 'cost.common.noCost' }) },
    ];
  }, [meta.allowedCurrencies, seen, intl]);

  const money = (currency: string, amount: string | null) =>
    amount === null ? DASH : `${plainText(currency)} ${formatAmount(amount) ?? DASH}`;
  const count = (value: number | null) => formatCount(value, intl.locale);

  const columns: ColumnsType<CostGroup> = [
    {
      key: 'resourceType',
      title: t('cost.report.col.resourceType'),
      render: (_, g) => labelOf(intl, 'cost.resourceType', g.resourceType),
    },
    {
      key: 'model',
      title: t('cost.report.col.model'),
      render: (_, g) => <EllipsisPopoverText text={g.model} width={220} />,
    },
    {
      key: 'source',
      title: t('cost.report.col.source'),
      render: (_, g) => labelOf(intl, 'cost.source', g.source),
    },
    {
      key: 'tier',
      title: t('cost.report.col.tier'),
      render: (_, g) => labelOf(intl, 'cost.tier', g.tier),
    },
    {
      key: 'currency',
      title: t('cost.report.col.currency'),
      render: (_, g) => (g.currency === NO_COST ? t('cost.common.noCost') : plainText(g.currency)),
    },
    {
      key: 'requests',
      title: t('cost.report.col.requests'),
      align: 'end',
      render: (_, g) => count(g.requests),
    },
    {
      key: 'input',
      title: t('cost.report.col.inputTokens'),
      align: 'end',
      render: (_, g) => count(g.inputTokens),
    },
    {
      key: 'cached',
      title: t('cost.report.col.cachedInputTokens'),
      align: 'end',
      render: (_, g) => count(g.cachedInputTokens),
    },
    {
      key: 'output',
      title: t('cost.report.col.outputTokens'),
      align: 'end',
      render: (_, g) => count(g.outputTokens),
    },
    {
      key: 'quantity',
      title: t('cost.report.col.quantity'),
      align: 'end',
      render: (_, g) => (g.quantity === null ? DASH : quantityText(intl, g.quantity, g.unit)),
    },
    {
      key: 'cost',
      title: t('cost.report.col.cost'),
      align: 'end',
      render: (_, g) => money(g.currency, g.cost),
    },
    {
      key: 'unpriced',
      title: t('cost.report.col.unpriced'),
      align: 'end',
      render: (_, g) => count(g.unpriced),
    },
  ];

  const set = (patch: Partial<Filters>) => setDraftFilters((f) => ({ ...f, ...patch }));

  return (
    <Flex vertical gap={16}>
      <Alert
        type="info"
        showIcon
        data-testid="cost-note"
        title={t('cost.report.note.title')}
        description={
          <>
            <div>{t('cost.report.note.body')}</div>
            <div>{t('cost.report.note.unpriced')}</div>
          </>
        }
      />
      <UtcNotice />
      <Flex gap={12} wrap align="center">
        <DateRangeUtc
          value={draft}
          onChange={setDraft}
          maxDays={meta.statsMaxRangeDays ?? undefined}
        />
        <Select
          aria-label={t('cost.report.filter.resourceType')}
          placeholder={t('cost.report.filter.resourceType')}
          allowClear
          style={{ minWidth: 160 }}
          value={draftFilters.resourceType}
          onChange={(v) => set({ resourceType: v })}
          options={RESOURCE_TYPES.map((r) => ({
            value: r,
            label: labelOf(intl, 'cost.resourceType', r),
          }))}
        />
        <AutoComplete
          aria-label={t('cost.report.filter.model')}
          placeholder={t('cost.report.filter.model')}
          allowClear
          style={{ minWidth: 180 }}
          value={draftFilters.model}
          onChange={(v) => set({ model: v ?? '' })}
          options={modelNames.map((m) => ({ value: m, label: m }))}
          filterOption={(input, option) =>
            String(option?.value ?? '')
              .toLowerCase()
              .includes(input.toLowerCase())
          }
        />
        <Select
          aria-label={t('cost.report.filter.source')}
          placeholder={t('cost.report.filter.source')}
          allowClear
          style={{ minWidth: 140 }}
          value={draftFilters.source}
          onChange={(v) => set({ source: v })}
          options={SOURCES.map((s) => ({ value: s, label: labelOf(intl, 'cost.source', s) }))}
        />
        <Select
          aria-label={t('cost.report.filter.tier')}
          placeholder={t('cost.report.filter.tier')}
          allowClear
          style={{ minWidth: 140 }}
          value={draftFilters.tier}
          onChange={(v) => set({ tier: v })}
          options={TIERS.map((s) => ({ value: s, label: labelOf(intl, 'cost.tier', s) }))}
        />
        <Select
          aria-label={t('cost.report.filter.currency')}
          placeholder={t('cost.report.filter.currency')}
          allowClear
          style={{ minWidth: 140 }}
          value={draftFilters.currency}
          onChange={(v) => set({ currency: v })}
          options={currencyOptions}
        />
        <Button
          type="primary"
          onClick={() => setApplied({ range: { ...draft }, filters: { ...draftFilters } })}
        >
          {t('stat.common.query')}
        </Button>
        <ExportButton name="usage-cost" viewCode="COST:VIEW" params={params} />
      </Flex>
      <LandBar name="usage-cost" onLanded={reload} />
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
      {lines === null && !failure ? <Spin /> : null}
      {lines && summary ? (
        <>
          <Flex gap={12} wrap>
            <MetricCard name="total" title={t('cost.report.card.total')}>
              {summary.totals.length === 0 ? (
                <span data-testid="cost-value">{DASH}</span>
              ) : (
                <Flex vertical gap={2}>
                  {summary.totals.map((total) => (
                    <div
                      key={total.currency}
                      data-testid={`cost-total-${total.currency}`}
                      dir="ltr"
                      style={{ overflowWrap: 'anywhere' }}
                    >
                      {money(total.currency, total.amount)}
                    </div>
                  ))}
                </Flex>
              )}
            </MetricCard>
            <MetricCard name="requests" title={t('cost.report.card.requests')}>
              <span data-testid="cost-value">{count(summary.requests)}</span>
            </MetricCard>
            <MetricCard name="unpriced" title={t('cost.report.card.unpriced')}>
              <Link to={UNPRICED_LINK} style={{ display: 'block' }}>
                <span data-testid="cost-value">{count(summary.unpriced)}</span>
                <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                  {t('cost.report.card.unpricedLink')}
                </Typography.Text>
              </Link>
            </MetricCard>
          </Flex>
          {charts.length === 0 ? (
            <Typography.Text type="secondary">{t('cost.report.chart.empty')}</Typography.Text>
          ) : (
            <Flex gap={24} wrap>
              {charts.map((chart) => (
                <div key={chart.currency} style={{ flex: '1 1 420px', minWidth: 0 }}>
                  <Typography.Text strong data-testid="cost-chart-title">
                    {t('cost.report.chart.title', { currency: chart.currency })}
                  </Typography.Text>
                  <CostChart currency={chart.currency} points={chart.points} />
                </div>
              ))}
            </Flex>
          )}
          <Table<CostGroup>
            size="small"
            rowKey="key"
            title={() => t('cost.report.table.title')}
            columns={columns}
            dataSource={groups}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: t('cost.report.empty') }}
          />
        </>
      ) : null}
    </Flex>
  );
}
