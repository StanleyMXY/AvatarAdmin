import { useIntl } from '@umijs/max';
import { Alert, Button, Card, Flex, Spin, Statistic, Table, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import { UtcNotice } from '../../components/stat/UtcNotice';
import { useFailure } from '../../hooks/useFailure';
import { useLatestCall } from '../../hooks/useLatestCall';
import {
  getModerationStats,
  type ModerationStatRow,
  type ModerationStats,
} from '../../services/moderation';
import { useAdminMeta } from '../../session/useSession';
import { formatCount } from '../../utils/ratio';
import { lastNDaysUtc } from '../../utils/utcDay';
import { formatDuration } from './duration';
import { labelOf } from './options';

/** 审核统计 (`MODERATION:VIEW`): new, approved, rejected and automatically blocked records by UTC day, content type and source. */
export default function ModerationStatsPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const meta = useAdminMeta();
  const [range, setRange] = useState<DayRange>(() => lastNDaysUtc(7));
  const [data, setData] = useState<ModerationStats | null>(null);
  const { text: failure, fail, clear } = useFailure();
  const begin = useLatestCall();

  const load = useCallback(async () => {
    const isCurrent = begin();
    setData(null);
    clear();
    try {
      const answer = await getModerationStats(range);
      if (isCurrent()) setData(answer);
    } catch (error) {
      if (isCurrent()) fail(error);
    }
  }, [range, begin, fail, clear]);

  useEffect(() => {
    void load();
  }, [load]);

  const number = (n: number | null | undefined) => formatCount(n, intl.locale);
  const sum = (key: 'created' | 'approved' | 'rejected' | 'blocked') =>
    (data?.items ?? []).reduce((n, row) => n + row[key], 0);

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
      {failure ? (
        <Alert
          type="error"
          showIcon
          title={t('moderation.stats.loadFailed', { message: failure })}
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
                ['created', 'moderation.stats.created', number(sum('created'))],
                ['approved', 'moderation.stats.approved', number(sum('approved'))],
                ['rejected', 'moderation.stats.rejected', number(sum('rejected'))],
                ['blocked', 'moderation.stats.blocked', number(sum('blocked'))],
              ] as const
            ).map(([name, title, value]) => (
              <Card
                key={name}
                size="small"
                style={{ minWidth: 160 }}
                data-testid={`moderation-total-${name}`}
              >
                <Statistic title={t(title)} value={value} />
              </Card>
            ))}
            <Card size="small" style={{ minWidth: 200 }} data-testid="moderation-avg-handle">
              <Statistic
                title={t('moderation.stats.avgHandle')}
                value={formatDuration(data.avgHandleSeconds, t, intl.locale)}
              />
            </Card>
            <Card size="small" style={{ minWidth: 200 }} data-testid="moderation-oldest-pending">
              <Statistic
                title={t('moderation.stats.oldestPending')}
                value={formatDuration(data.oldestPendingSeconds, t, intl.locale)}
              />
            </Card>
          </Flex>
          <Card size="small" title={t('moderation.stats.byDay')}>
            <Table<ModerationStatRow>
              size="small"
              pagination={false}
              rowKey={(row) => `${row.statDate}|${row.contentType}|${row.source}`}
              dataSource={[...data.items].sort((a, b) =>
                a.statDate < b.statDate ? 1 : a.statDate > b.statDate ? -1 : 0,
              )}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: t('moderation.stats.empty') }}
              columns={[
                { title: t('moderation.stats.date'), dataIndex: 'statDate' },
                {
                  title: t('moderation.field.contentType'),
                  dataIndex: 'contentType',
                  render: (value: string) =>
                    labelOf(t, intl.messages, 'moderation.contentType', value),
                },
                {
                  title: t('moderation.field.source'),
                  dataIndex: 'source',
                  render: (value: string) => labelOf(t, intl.messages, 'moderation.source', value),
                },
                ...(['created', 'approved', 'rejected', 'blocked'] as const).map((key) => ({
                  title: t(`moderation.stats.${key}`),
                  dataIndex: key,
                  align: 'right' as const,
                  render: (value: number) => number(value),
                })),
              ]}
            />
          </Card>
        </>
      ) : null}
      <Typography.Text type="secondary">{t('moderation.stats.avgHandleTip')}</Typography.Text>
    </Flex>
  );
}
