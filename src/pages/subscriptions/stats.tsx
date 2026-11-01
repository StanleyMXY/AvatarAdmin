import { useIntl } from '@umijs/max';
import { Alert, Button, Card, Flex, Spin, Statistic, Table, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import { UtcNotice } from '../../components/stat/UtcNotice';
import { getSubscriptionStats, type SubscriptionStatRow } from '../../services/subscriptions';
import { describeFailure } from '../../session/describe';
import { useAdminMeta } from '../../session/useSession';
import { DASH, formatCount } from '../../utils/ratio';
import { lastNDaysUtc } from '../../utils/utcDay';

const DECIMAL = /^-?\d+(\.\d+)?$/;

/**
 * A list price with its currency. A decimal string is written as it is, without ever turning it into a
 * floating point number (the browser formats the digits as they are, so "9007199254740993.01" and
 * "24.999" come out as they went in). A finite JSON number is formatted as the number it is. Anything else
 * (null, NaN, a malformed string, an object) is a dash; an amount without a currency is a plain number;
 * a currency the browser does not know is written as it is.
 */
export function formatListPrice(
  amount: number | string | null,
  currency: string | null,
  locale: string,
): string {
  let decimals: number;
  if (typeof amount === 'string' && DECIMAL.test(amount)) {
    decimals = amount.split('.')[1]?.length ?? 0;
  } else if (typeof amount === 'number' && Number.isFinite(amount)) {
    decimals = 0;
  } else {
    return DASH;
  }
  // A decimal string is a valid argument of `format` (ECMA-402 NumberFormat v3); the typings of this
  // project's `lib` still say number, hence the cast.
  const write = (options: Intl.NumberFormatOptions) =>
    new Intl.NumberFormat(locale, { ...options, maximumFractionDigits: 20 }).format(
      amount as number,
    );
  // No digit is rounded away and none is dropped: a plain number keeps as many decimals as it was sent with.
  const plain = () => write({ minimumFractionDigits: Math.min(20, decimals) });
  if (!currency) return plain();
  try {
    return write({ style: 'currency', currency });
  } catch {
    return `${currency} ${plain()}`;
  }
}

/**
 * The active subscriptions of the last day in the rows that has a complete snapshot (every row of the day has one),
 * with that day. A snapshot is of one day and is never added across days; a day with no or a partial snapshot
 * (today is still being counted) is skipped. Null if no day qualifies.
 */
export function activeOnLastSnapshotDay(
  rows: readonly SubscriptionStatRow[],
): { day: string; value: number } | null {
  const days = [...new Set(rows.map((r) => r.statDate))].sort().reverse();
  for (const day of days) {
    const ofDay = rows.filter((r) => r.statDate === day);
    if (ofDay.every((r) => r.active !== null)) {
      return { day, value: ofDay.reduce((sum, r) => sum + (r.active ?? 0), 0) };
    }
  }
  return null;
}

const SUMS = ['new', 'renewed', 'canceled', 'expired', 'refunded'] as const;

/** 订阅统计 (`FINANCE:VIEW`): active, new, renewed, canceled, expired and refunded subscriptions by store and product; list prices, sandbox not counted. */
export default function SubscriptionStatsPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const meta = useAdminMeta();
  const [range, setRange] = useState<DayRange>(() => lastNDaysUtc(7));
  const [rows, setRows] = useState<SubscriptionStatRow[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const counter = useRef(0);

  const load = useCallback(async () => {
    const mine = ++counter.current;
    setRows(null);
    setFailure(null);
    try {
      const { items } = await getSubscriptionStats(range);
      if (mine === counter.current) setRows(items);
    } catch (error) {
      if (mine === counter.current) setFailure(describeFailure(intl, error).text);
    }
  }, [range, intl]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    return Object.fromEntries(SUMS.map((name) => [name, rows.reduce((n, r) => n + r[name], 0)]));
  }, [rows]);

  const snapshot = useMemo(() => (rows ? activeOnLastSnapshotDay(rows) : null), [rows]);
  const cards: { name: string; value: number | null }[] = [
    { name: 'active', value: snapshot ? snapshot.value : null },
    ...SUMS.map((name) => ({ name, value: totals ? totals[name] : null })),
  ];

  return (
    <Flex vertical gap={16}>
      <Flex gap={12} wrap align="center">
        <DateRangeUtc
          value={range}
          onChange={setRange}
          maxDays={meta.statsMaxRangeDays ?? undefined}
        />
        <UtcNotice />
      </Flex>
      <Typography.Text strong>{t('subscriptions.stats.priceNote')}</Typography.Text>
      <Typography.Text type="secondary">{t('subscriptions.stats.liveNote')}</Typography.Text>
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
          <Flex gap={16} wrap>
            {cards.map(({ name, value }) => (
              <Card
                key={name}
                size="small"
                style={{ minWidth: 170 }}
                data-testid={`subscription-total-${name}`}
              >
                <Statistic
                  title={t(`subscriptions.stats.${name}`)}
                  value={value === null ? DASH : formatCount(value, intl.locale)}
                />
                {name === 'active' ? (
                  <Typography.Text type="secondary">
                    {snapshot
                      ? t('subscriptions.stats.activeAsOf', { date: snapshot.day })
                      : t('subscriptions.stats.activeNone')}
                  </Typography.Text>
                ) : null}
              </Card>
            ))}
          </Flex>
          <Table<SubscriptionStatRow>
            size="small"
            rowKey={(r) => `${r.statDate}|${r.store}|${r.productId}|${r.listPriceCurrency ?? ''}`}
            dataSource={rows}
            scroll={{ x: 'max-content' }}
            pagination={{
              defaultPageSize: 20,
              pageSizeOptions: [10, 20, 50, 100],
              showSizeChanger: true,
            }}
            columns={[
              { title: t('subscriptions.stats.date'), dataIndex: 'statDate' },
              { title: t('subscriptions.list.store'), dataIndex: 'store' },
              {
                title: t('subscriptions.list.product'),
                dataIndex: 'productId',
                render: (productId: string) => (
                  <EllipsisPopoverText text={productId} lines={1} width={240} />
                ),
              },
              {
                title: t('subscriptions.stats.active'),
                dataIndex: 'active',
                render: (n: number | null) => formatCount(n, intl.locale),
              },
              ...SUMS.map((name) => ({
                title: t(`subscriptions.stats.${name}`),
                dataIndex: name,
                render: (n: number) => formatCount(n, intl.locale),
              })),
              {
                title: t('subscriptions.stats.listPrice'),
                render: (_: unknown, r: SubscriptionStatRow) =>
                  formatListPrice(r.listPriceAmount, r.listPriceCurrency, intl.locale),
              },
            ]}
          />
        </>
      ) : null}
    </Flex>
  );
}
