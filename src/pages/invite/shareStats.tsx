import { useIntl } from '@umijs/max';
import { Alert, Button, Flex, Spin, Tabs } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { ExportButton } from '../../components/ExportButton';
import { ReadState } from '../../components/ReadState';
import { DateRangeUtc, type DayRange } from '../../components/stat/DateRangeUtc';
import { LandBar } from '../../components/stat/LandBar';
import { UtcNotice } from '../../components/stat/UtcNotice';
import { useLatestRead } from '../../hooks/useLatestRead';
import { getShareChannels, getShareFunnel } from '../../services/invite';
import { useAdminMeta } from '../../session/useSession';
import { lastNDaysUtc } from '../../utils/utcDay';
import { ShareChannelsTab } from './ShareChannelsTab';
import { ShareFunnelTab } from './ShareFunnelTab';
import { ShareOverview } from './ShareOverview';
import { channelRowsOf, funnelRowsOf } from './shareRows';

/**
 * 分享统计 (`INVITE:VIEW`): read from the summary tables, with "re-land this day" for an
 * administrator who may. Overview, funnel and channels share one range (UTC days) and one Search.
 */
export default function ShareStatsPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const meta = useAdminMeta();
  const [draft, setDraft] = useState<DayRange>(() => lastNDaysUtc(7));
  const [range, setRange] = useState<DayRange>(draft);
  const [tab, setTab] = useState('overview');
  const [channel, setChannel] = useState('');

  const funnelFetcher = useCallback(
    () => getShareFunnel({ from: range.from, to: range.to }),
    [range],
  );
  const channelFetcher = useCallback(
    () => getShareChannels({ from: range.from, to: range.to }),
    [range],
  );
  const funnel = useLatestRead(funnelFetcher);
  const channels = useLatestRead(channelFetcher);
  const funnelRows = useMemo(() => funnelRowsOf(funnel.data?.items), [funnel.data]);
  const channelRows = useMemo(() => channelRowsOf(channels.data?.items), [channels.data]);

  const search = () => {
    setRange({ ...draft });
    setChannel('');
  };
  const reloadAll = () => {
    funnel.reload();
    channels.reload();
  };

  const onChannelsTab = tab === 'channels';
  const waiting = <Spin />;

  return (
    <Flex vertical gap={16}>
      <UtcNotice />
      <Flex gap={12} wrap align="center">
        <DateRangeUtc
          value={draft}
          onChange={setDraft}
          maxDays={meta.statsMaxRangeDays ?? undefined}
        />
        <Button type="primary" onClick={search}>
          {t('stat.common.query')}
        </Button>
        <ExportButton
          name={onChannelsTab ? 'share-channel' : 'share-funnel'}
          viewCode="INVITE:VIEW"
          params={{
            from: range.from,
            to: range.to,
            shareChannel: onChannelsTab && channel !== '' ? channel : undefined,
          }}
        />
      </Flex>
      <LandBar name={['share-funnel', 'share-channel']} onLanded={reloadAll} />
      {funnel.failure ? (
        <ReadState failure={funnel.failure} loading={false} onRetry={funnel.reload} />
      ) : null}
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'overview',
            label: t('invite.share.tab.overview'),
            children: funnel.data ? (
              <ShareOverview rows={funnelRows} from={range.from} to={range.to} />
            ) : funnel.failure ? null : (
              waiting
            ),
          },
          {
            key: 'funnel',
            label: t('invite.share.tab.funnel'),
            children: funnel.data ? (
              <ShareFunnelTab rows={funnelRows} from={range.from} to={range.to} />
            ) : funnel.failure ? null : (
              waiting
            ),
          },
          {
            key: 'channels',
            label: t('invite.share.tab.channels'),
            children: channels.data ? (
              <ShareChannelsTab
                rows={channelRows}
                from={range.from}
                to={range.to}
                channel={channel}
                onChannel={setChannel}
              />
            ) : channels.failure ? (
              <Alert
                type="error"
                showIcon
                title={intl.formatMessage(
                  { id: 'pages.common.loadFailed' },
                  { message: channels.failure },
                )}
                action={
                  <Button size="small" onClick={channels.reload}>
                    {t('pages.common.retry')}
                  </Button>
                }
              />
            ) : (
              waiting
            ),
          },
        ]}
      />
    </Flex>
  );
}
