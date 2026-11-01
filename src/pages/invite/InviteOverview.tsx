import { QuestionCircleOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Button, Card, Flex, Statistic, Table, Tooltip } from 'antd';
import { useCallback, useMemo } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { TrendChart } from '../../components/stat/TrendChart';
import { getInviteStats } from '../../services/invite';
import { plainText } from '../../utils/plainText';
import { DASH, formatCount, formatPercent } from '../../utils/ratio';
import { count, rateOf } from './numbers';
import { ReadState } from './ReadState';
import { useRead } from './useRead';

export type StatsQuery = { from: string; to: string; limit: number };

type Props = {
  query: StatsQuery;
  onViewFission: (accountId: string) => void;
};

/** The first tab: six numbers, the daily trend (two series in one chart) and the ranking of inviters. */
export function InviteOverview({ query, onViewFission }: Props) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const fetcher = useCallback(() => getInviteStats(query), [query]);
  const { data, failure, loading, reload } = useRead(fetcher);

  const daily = useMemo(
    () =>
      (data?.daily ?? [])
        .filter((row) => typeof row.date === 'string')
        .map((row) => ({
          statDate: row.date,
          invitees: count(row.invitees),
          activeInviters: count(row.activeInviters),
        })),
    [data],
  );
  const ranking = useMemo(
    () =>
      (data?.ranking ?? []).map((row, index) => ({
        rank: index + 1,
        accountId: plainText(row.inviterAccountId),
        inviteCount: count(row.inviteCount),
      })),
    [data],
  );

  if (!data) return <ReadState failure={failure} loading={loading} onRetry={reload} />;

  const number = (value: unknown) => formatCount(count(value), intl.locale);
  const participation = rateOf(data.activeInviters, data.registeredAccounts);
  const average = count(data.avgInvitesPerInviter);
  const cards: { name: string; title: string; value: string; tip?: string }[] = [
    {
      name: 'totalInvitees',
      title: t('invite.stats.totalInvitees'),
      value: number(data.totalInvitees),
    },
    {
      name: 'activeInviters',
      title: t('invite.stats.activeInviters'),
      value: number(data.activeInviters),
    },
    {
      name: 'participation',
      title: t('invite.stats.participation'),
      value: formatPercent(participation, intl.locale),
      tip: t('invite.stats.participationTip'),
    },
    {
      name: 'avgInvites',
      title: t('invite.stats.avgInvites'),
      value:
        average === null
          ? DASH
          : new Intl.NumberFormat(intl.locale, { maximumFractionDigits: 2 }).format(average),
    },
    { name: 'rewarded', title: t('invite.stats.rewarded'), value: number(data.rewardedInvitees) },
    { name: 'credits', title: t('invite.stats.credits'), value: number(data.creditsGranted) },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex gap={16} wrap>
        {cards.map((card) => (
          <Card
            key={card.name}
            size="small"
            style={{ minWidth: 180 }}
            data-testid={`invite-kpi-${card.name}`}
          >
            <Statistic
              title={
                card.tip ? (
                  <Tooltip title={card.tip}>
                    <span>
                      {card.title}
                      <QuestionCircleOutlined aria-hidden style={{ marginInlineStart: 4 }} />
                    </span>
                  </Tooltip>
                ) : (
                  card.title
                )
              }
              value={card.value}
            />
          </Card>
        ))}
      </Flex>
      <Card size="small" title={t('invite.stats.trend')} data-testid="invite-trend">
        <TrendChart
          wholeNumbers
          rows={daily}
          xField="statDate"
          from={query.from}
          to={query.to}
          series={[
            { field: 'invitees', label: t('invite.stats.trend.invitees') },
            { field: 'activeInviters', label: t('invite.stats.trend.activeInviters') },
          ]}
        />
      </Card>
      <Card size="small" title={t('invite.stats.ranking')}>
        <div data-testid="invite-ranking">
          <Table
            size="small"
            rowKey="rank"
            dataSource={ranking}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
            columns={[
              { title: t('invite.stats.rank'), dataIndex: 'rank', width: 80 },
              {
                title: t('invite.stats.inviterAccountId'),
                dataIndex: 'accountId',
                render: (value: string) => (
                  <EllipsisPopoverText text={value} width={320} dir="ltr" />
                ),
              },
              {
                title: t('invite.stats.inviteCount'),
                dataIndex: 'inviteCount',
                align: 'right' as const,
                render: (value: number | null) => formatCount(value, intl.locale),
              },
              {
                title: t('invite.stats.actions'),
                key: 'actions',
                render: (_: unknown, row: { accountId: string }) => (
                  <Button type="link" size="small" onClick={() => onViewFission(row.accountId)}>
                    {t('invite.stats.viewFission')}
                  </Button>
                ),
              },
            ]}
          />
        </div>
      </Card>
    </Flex>
  );
}
