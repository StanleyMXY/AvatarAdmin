import { Pie } from '@ant-design/plots';
import { useIntl } from '@umijs/max';
import { Card, Empty, Flex, Select, Table } from 'antd';
import { useMemo } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { TrendChart } from '../../components/stat/TrendChart';
import type { ShareChannelRow } from '../../services/invite';
import { getChartTheme } from '../../theme/chartTheme';
import { useThemeMode } from '../../theme/modes';
import { plainText } from '../../utils/plainText';
import { DASH, formatCount, formatPercent } from '../../utils/ratio';
import { groupChannels } from './channelGroups';
import { count, rateOf } from './numbers';

type Props = {
  rows: ShareChannelRow[];
  from: string;
  to: string;
  /** The channel chosen in the list; the empty string means all of them. */
  channel: string;
  onChannel: (channel: string) => void;
};

const KEEP = 5;

/**
 * The third tab: a list of the channels that appear in the data (and "All"), the share of each
 * channel as a pie, the five channels with the most shares as lines (the rest as "Other"), and the
 * rows. The list narrows the rows (and the export); the pie and the lines are about all channels,
 * because one channel would always be a whole pie.
 */
export function ShareChannelsTab({ rows, from, to, channel, onChannel }: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const [mode] = useThemeMode();
  const theme = getChartTheme(mode);

  const names = useMemo(
    () =>
      [
        ...new Set(rows.map((row) => plainText(row.shareChannel)).filter((name) => name !== '')),
      ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    [rows],
  );
  const { groups, total } = useMemo(() => groupChannels(rows, KEEP), [rows]);
  const nameOf = (group: { name: string; other: boolean }) =>
    group.other ? t('invite.share.other') : group.name === '' ? DASH : group.name;

  const pie = groups.map((group) => ({
    channel: nameOf(group),
    value: group.total,
    ratio: rateOf(group.total, total),
  }));
  const lineRows = useMemo(() => {
    const days = new Set(groups.flatMap((group) => Object.keys(group.byDay)));
    return [...days].sort().map((statDate) => ({
      statDate,
      ...Object.fromEntries(groups.map((group, i) => [`c${i}`, group.byDay[statDate] ?? 0])),
    }));
  }, [groups]);

  const shown =
    channel === '' ? rows : rows.filter((row) => plainText(row.shareChannel) === channel);

  return (
    <Flex vertical gap={16}>
      <Select
        virtual={false}
        aria-label={t('invite.share.channel')}
        style={{ width: 280, maxWidth: '100%' }}
        value={channel}
        onChange={onChannel}
        options={[
          { value: '', label: t('invite.share.channelAll') },
          ...names.map((name) => ({ value: name, label: name })),
        ]}
      />
      <Card size="small" title={t('invite.share.pieTitle')} data-testid="invite-channel-pie">
        {total === 0 ? (
          <Empty description={t('invite.share.noShares')} />
        ) : (
          <Pie
            data={pie}
            angleField="value"
            colorField="channel"
            theme={theme.g2Theme}
            scale={{ color: { range: theme.palette } }}
            label={{
              text: (d: { channel: string; ratio: number | null }) =>
                `${d.channel} ${formatPercent(d.ratio, intl.locale)}`,
              position: 'outside',
              style: { fill: theme.textColor },
            }}
            height={300}
          />
        )}
      </Card>
      <Card size="small" title={t('invite.share.topTitle')} data-testid="invite-channel-lines">
        {total === 0 ? (
          <Empty description={t('invite.share.noShares')} />
        ) : (
          <TrendChart
            rows={lineRows}
            xField="statDate"
            from={from}
            to={to}
            series={groups.map((group, i) => ({ field: `c${i}`, label: nameOf(group) }))}
          />
        )}
      </Card>
      <Card size="small" title={t('invite.share.detail')}>
        <div data-testid="invite-channel-detail">
          <Table
            size="small"
            rowKey="key"
            dataSource={shown.map((row, index) => ({ ...row, key: String(index) }))}
            pagination={{ pageSize: 50, hideOnSinglePage: true, showSizeChanger: false }}
            scroll={{ x: 'max-content' }}
            columns={[
              {
                title: t('invite.share.col.date'),
                dataIndex: 'statDate',
                render: (value: unknown) => plainText(value),
              },
              {
                title: t('invite.share.col.channel'),
                dataIndex: 'shareChannel',
                render: (value: unknown) => (
                  <EllipsisPopoverText text={plainText(value)} width={260} />
                ),
              },
              {
                title: t('invite.share.col.pv'),
                dataIndex: 'sharePv',
                align: 'right' as const,
                render: (value: unknown) => formatCount(count(value), intl.locale),
              },
              {
                title: t('invite.share.col.uv'),
                dataIndex: 'shareUv',
                align: 'right' as const,
                render: (value: unknown) => formatCount(count(value), intl.locale),
              },
            ]}
          />
        </div>
      </Card>
    </Flex>
  );
}
