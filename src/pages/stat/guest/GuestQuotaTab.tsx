import { QuestionCircleOutlined } from '@ant-design/icons';
import { Column } from '@ant-design/plots';
import { Link, useAccess, useIntl } from '@umijs/max';
import { Button, Card, Flex, Statistic, Table, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo, useState } from 'react';
import { DateRangeUtc, type DayRange } from '../../../components/stat/DateRangeUtc';
import { getGuestQuota } from '../../../services/stats/reports';
import type { GuestQuotaBucketKey } from '../../../services/stats/types';
import { useAdminMeta } from '../../../session/useSession';
import { getChartTheme } from '../../../theme/chartTheme';
import { useThemeMode } from '../../../theme/modes';
import { DASH, formatCount, formatPercent } from '../../../utils/ratio';
import { defaultRange } from '../../analytics/defaultRange';
import { HeaderWithTip } from './GuestDailyTab';
import { bucketConversionRate, QUOTA_BUCKETS, quotaCards } from './quota';
import { ReportState } from './ReportState';
import { useReport } from './useReport';

type Access = { canAccess: (code?: string) => boolean };

type BucketRow = { key: GuestQuotaBucketKey; devices: number; converted: number };

/**
 * 额度使用: how much of their call allowance the guest devices used (read live, no landing bar).
 * Six cards, the devices by share used, and the conversion of each bucket.
 */
export function GuestQuotaTab() {
  const intl = useIntl();
  const meta = useAdminMeta();
  const access = useAccess() as unknown as Access;
  const [mode] = useThemeMode();
  const theme = getChartTheme(mode);
  const [draft, setDraft] = useState<DayRange>(() => defaultRange(meta.statsMaxRangeDays, 7));
  const [applied, setApplied] = useState<DayRange>(draft);
  const fetcher = useCallback(() => getGuestQuota(applied), [applied]);
  const { data: quota, failure, reload } = useReport(fetcher);
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const minutes = (n: number | null) =>
    n === null
      ? DASH
      : t('stat.guest.quota.minutes', {
          n: new Intl.NumberFormat(intl.locale, { maximumFractionDigits: 1 }).format(n),
        });

  const cards = useMemo(() => (quota ? quotaCards(quota) : null), [quota]);
  const rows = useMemo<BucketRow[]>(
    () => (quota ? QUOTA_BUCKETS.map((key) => ({ key, ...quota.buckets[key] })) : []),
    [quota],
  );
  const chart = rows.map((row) => ({
    bucket: row.key,
    label: t(`stat.guest.quota.bucket.${row.key}`),
    devices: row.devices,
  }));

  const card = (name: string, title: string, value: string, tip?: string) => (
    <Card
      size="small"
      data-testid={`quota-card-${name}`}
      style={{ flex: '1 1 150px', minWidth: 0 }}
    >
      <Statistic
        title={
          tip ? (
            <span>
              {title}
              <Tooltip title={tip}>
                <QuestionCircleOutlined
                  data-testid={`tip-quota-card-${name}`}
                  aria-hidden={false}
                  style={{ marginInlineStart: 4 }}
                />
              </Tooltip>
            </span>
          ) : (
            title
          )
        }
        value={value}
        formatter={(v) => <span data-testid="quota-value">{v}</span>}
      />
    </Card>
  );

  const columns: ColumnsType<BucketRow> = [
    {
      title: <HeaderWithTip id="stat.guest.quota.bucket" testId="tip-quota-bucket" />,
      key: 'bucket',
      render: (_: unknown, row) => t(`stat.guest.quota.bucket.${row.key}`),
    },
    {
      title: t('stat.guest.quota.col.devices'),
      dataIndex: 'devices',
      align: 'end',
      render: (n: number) => formatCount(n, intl.locale),
    },
    {
      title: <HeaderWithTip id="stat.guest.quota.col.converted" testId="tip-quota-converted" />,
      dataIndex: 'converted',
      align: 'end',
      render: (n: number) => formatCount(n, intl.locale),
    },
    {
      title: t('stat.guest.quota.col.rate'),
      key: 'rate',
      align: 'end',
      render: (_: unknown, row) => formatPercent(bucketConversionRate(row), intl.locale),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex gap={12} wrap align="center">
        <DateRangeUtc
          value={draft}
          onChange={setDraft}
          maxDays={meta.statsMaxRangeDays ?? undefined}
        />
        <Button type="primary" onClick={() => setApplied({ ...draft })}>
          {t('stat.common.query')}
        </Button>
        {access.canAccess('CONFIG:MANAGE') ? (
          <Link to="/config#guest.call_minutes_total">{t('stat.guest.quota.configLink')}</Link>
        ) : null}
      </Flex>
      <Typography.Text type="secondary">{t('stat.guest.quota.rangeNote')}</Typography.Text>
      <ReportState failure={failure} loading={quota === null} onRetry={reload} />
      {quota && cards ? (
        <>
          <Flex gap={12} wrap>
            {card(
              'configured',
              t('stat.guest.quota.configured'),
              cards.configuredMinutes === null
                ? t('stat.guest.quota.notConfigured')
                : minutes(cards.configuredMinutes),
              t('stat.guest.quota.configured.tip'),
            )}
            {card(
              'devices',
              t('stat.guest.quota.devices'),
              formatCount(cards.devices, intl.locale),
            )}
            {card(
              'noGrant',
              t('stat.guest.quota.noGrant'),
              formatCount(cards.noGrant, intl.locale),
              t('stat.guest.quota.noGrant.tip'),
            )}
            {card(
              'neverCalled',
              t('stat.guest.quota.neverCalled'),
              formatPercent(cards.neverCalledShare, intl.locale),
              t('stat.guest.quota.neverCalled.tip'),
            )}
            {card(
              'exhausted',
              t('stat.guest.quota.exhausted'),
              formatPercent(cards.exhaustedShare, intl.locale),
              t('stat.guest.quota.exhausted.tip'),
            )}
            {card(
              'avgUsed',
              t('stat.guest.quota.avgUsed'),
              minutes(cards.avgUsedMinutes),
              t('stat.guest.quota.avgUsed.tip'),
            )}
          </Flex>
          <div>
            <Typography.Text strong>{t('stat.guest.quota.chart')}</Typography.Text>
            <Column
              data={chart}
              xField="label"
              yField="devices"
              theme={theme.g2Theme}
              scale={{ color: { range: theme.palette } }}
              axis={{
                x: { labelFill: theme.textColor },
                y: { labelFill: theme.textColor, gridStroke: theme.gridColor },
              }}
              height={280}
            />
          </div>
          <div>
            <Typography.Text strong>{t('stat.guest.quota.table')}</Typography.Text>
            <Table<BucketRow>
              size="small"
              rowKey="key"
              columns={columns}
              dataSource={rows}
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          </div>
        </>
      ) : null}
    </Flex>
  );
}
