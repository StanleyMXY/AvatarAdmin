import { useIntl } from '@umijs/max';
import { Card, Flex, Statistic, Typography } from 'antd';
import { TrendChart } from '../../components/stat/TrendChart';
import type { ShareFunnelRow } from '../../services/invite';
import { formatCount } from '../../utils/ratio';
import { count, sumCounts } from './numbers';

type Props = { rows: ShareFunnelRow[]; from: string; to: string };

/**
 * The first tab: four cards that are sums of counts (a count can be added over days) and the daily
 * shares as one line. There is no card of unique visitors: a UV is the number of different people
 * of one day, and adding days would count the same person again.
 */
export function ShareOverview({ rows, from, to }: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const cards = [
    {
      name: 'sharePv',
      title: t('invite.share.sharePv'),
      sum: sumCounts(rows.map((r) => r.sharePv)),
    },
    {
      name: 'linkClickPv',
      title: t('invite.share.linkClickPv'),
      sum: sumCounts(rows.map((r) => r.linkClickPv)),
    },
    {
      name: 'downloadClickPv',
      title: t('invite.share.downloadClickPv'),
      sum: sumCounts(rows.map((r) => r.downloadClickPv)),
    },
    {
      name: 'registered',
      title: t('invite.share.registered'),
      sum: sumCounts(rows.map((r) => r.registered)),
    },
  ];
  return (
    <Flex vertical gap={16}>
      <Flex gap={16} wrap>
        {cards.map((card) => (
          <Card
            key={card.name}
            size="small"
            style={{ minWidth: 180 }}
            data-testid={`invite-share-card-${card.name}`}
          >
            <Statistic title={card.title} value={formatCount(card.sum, intl.locale)} />
          </Card>
        ))}
      </Flex>
      <Typography.Text type="secondary">{t('invite.share.uvNote')}</Typography.Text>
      <Card size="small" title={t('invite.share.dailyShares')} data-testid="invite-share-trend">
        <TrendChart
          rows={rows.map((row) => ({ statDate: row.statDate, sharePv: count(row.sharePv) }))}
          xField="statDate"
          from={from}
          to={to}
          series={[{ field: 'sharePv', label: t('invite.share.sharePv') }]}
        />
      </Card>
    </Flex>
  );
}
