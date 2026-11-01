import { useIntl } from '@umijs/max';
import { Alert, Button, Card, Flex, Spin, Statistic, Table, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import { UtcNotice } from '../../components/stat/UtcNotice';
import { type CreditStats, getCreditStats } from '../../services/credits';
import { describeFailure } from '../../session/describe';
import { useAdminMeta } from '../../session/useSession';
import { formatCount } from '../../utils/ratio';
import { lastNDaysUtc } from '../../utils/utcDay';
import { groupSpent } from './groupSpent';

type SpentRow = {
  rowKey: string;
  spendKind: string | null;
  keyText: string | null;
  count: number;
  credits: number;
  children?: SpentRow[];
};

/** 额度统计 (`FINANCE:VIEW`): packs sold, credits refunded and credits spent by UTC day range; sandbox purchases are not counted. */
export default function CreditStatsPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const meta = useAdminMeta();
  const [range, setRange] = useState<DayRange>(() => lastNDaysUtc(7));
  const [data, setData] = useState<CreditStats | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const counter = useRef(0);
  // Switching the language changes `intl`; the figures do not depend on it, so it must not make a new request.
  const intlRef = useRef(intl);
  intlRef.current = intl;

  const load = useCallback(async () => {
    const mine = ++counter.current;
    setData(null);
    setFailure(null);
    try {
      const answer = await getCreditStats(range.from, range.to);
      if (mine === counter.current) setData(answer);
    } catch (error) {
      if (mine === counter.current) setFailure(describeFailure(intlRef.current, error).text);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const spent = useMemo<SpentRow[]>(
    () =>
      groupSpent(data?.spent ?? []).map((group) => ({
        rowKey: group.spendKind,
        spendKind: group.spendKind,
        keyText: null,
        count: group.count,
        credits: group.credits,
        ...(group.children.length > 0
          ? {
              children: group.children.map((child, index) => ({
                rowKey: `${group.spendKind}/${index}`,
                spendKind: null,
                keyText: child.key,
                count: child.count,
                credits: child.credits,
              })),
            }
          : {}),
      })),
    [data],
  );

  const number = (n: number) => formatCount(n, intl.locale);
  const totals = {
    packs: (data?.purchases ?? []).reduce((n, r) => n + r.packs, 0),
    bought: (data?.purchases ?? []).reduce((n, r) => n + r.credits, 0),
    refunded: (data?.refunded ?? []).reduce((n, r) => n + r.credits, 0),
    spent: (data?.spent ?? []).reduce((n, r) => n + r.credits, 0),
  };
  const productKey = (r: { store: string; productId: string }) => `${r.store}/${r.productId}`;
  const storeColumns = [
    { title: t('credits.products.store'), dataIndex: 'store' },
    {
      title: t('credits.products.productId'),
      dataIndex: 'productId',
      render: (value: string) => <EllipsisPopoverText text={value} width={220} />,
    },
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
      <Typography.Text type="secondary">{t('credits.stats.sandboxNote')}</Typography.Text>
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
      {data === null && !failure ? <Spin /> : null}
      {data ? (
        <>
          <Flex gap={16} wrap>
            {(
              [
                ['packs', 'credits.stats.totalPacks', totals.packs],
                ['bought', 'credits.stats.totalBought', totals.bought],
                ['refunded', 'credits.stats.totalRefunded', totals.refunded],
                ['spent', 'credits.stats.totalSpent', totals.spent],
              ] as const
            ).map(([name, title, value]) => (
              <Card
                key={name}
                size="small"
                style={{ minWidth: 180 }}
                data-testid={`credits-total-${name}`}
              >
                <Statistic title={t(title)} value={number(value)} />
              </Card>
            ))}
          </Flex>
          <Card size="small" title={t('credits.stats.purchases')}>
            <div data-testid="credits-purchases">
              <Table
                size="small"
                pagination={false}
                rowKey={productKey}
                dataSource={data.purchases}
                scroll={{ x: 'max-content' }}
                columns={[
                  ...storeColumns,
                  {
                    title: t('credits.stats.packs'),
                    dataIndex: 'packs',
                    align: 'right' as const,
                    render: (value: number) => number(value),
                  },
                  {
                    title: t('credits.stats.credits'),
                    dataIndex: 'credits',
                    align: 'right' as const,
                    render: (value: number) => number(value),
                  },
                ]}
              />
            </div>
          </Card>
          <Card size="small" title={t('credits.stats.refunded')}>
            <div data-testid="credits-refunded">
              <Table
                size="small"
                pagination={false}
                rowKey={productKey}
                dataSource={data.refunded}
                scroll={{ x: 'max-content' }}
                columns={[
                  ...storeColumns,
                  {
                    title: t('credits.stats.credits'),
                    dataIndex: 'credits',
                    align: 'right' as const,
                    render: (value: number) => number(value),
                  },
                ]}
              />
            </div>
          </Card>
          <Card size="small" title={t('credits.stats.spent')}>
            <div data-testid="credits-spent">
              <Table
                size="small"
                pagination={false}
                rowKey="rowKey"
                dataSource={spent}
                scroll={{ x: 'max-content' }}
                expandable={{ defaultExpandAllRows: true }}
                columns={[
                  {
                    title: t('credits.stats.category'),
                    dataIndex: 'spendKind',
                    render: (_: unknown, row: SpentRow) =>
                      row.spendKind !== null ? (
                        <strong>
                          {intl.messages[`credits.spendKind.${row.spendKind}`]
                            ? t(`credits.spendKind.${row.spendKind}`)
                            : row.spendKind}
                        </strong>
                      ) : (
                        <EllipsisPopoverText text={row.keyText} width={240} />
                      ),
                  },
                  {
                    title: t('credits.stats.count'),
                    dataIndex: 'count',
                    align: 'right' as const,
                    render: (value: number) => number(value),
                  },
                  {
                    title: t('credits.stats.credits'),
                    dataIndex: 'credits',
                    align: 'right' as const,
                    render: (value: number) => number(value),
                  },
                ]}
              />
            </div>
          </Card>
        </>
      ) : null}
    </Flex>
  );
}
