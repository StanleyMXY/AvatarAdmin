import { useIntl } from '@umijs/max';
import { Flex, Tabs, Typography } from 'antd';
import { useState } from 'react';
import { UtcNotice } from '../../components/stat/UtcNotice';
import { GuestCohortTab } from './guest/GuestCohortTab';
import { GuestDailyTab } from './guest/GuestDailyTab';
import { GuestQuotaTab } from './guest/GuestQuotaTab';
import { GuestRetentionTab } from './guest/GuestRetentionTab';

/**
 * 游客统计 (`STATS:VIEW`): guests have no account on the server, so everything here counts devices.
 * Four tabs: the guest daily report, the conversion cohorts, guest retention and allowance use.
 */
export default function GuestStatsPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  // Landing recomputes the summaries that three tabs show; a tab that was opened before stays
  // mounted behind the others, so each one reads again when something was landed.
  const [landedTick, setLandedTick] = useState(0);
  const tabProps = { landedTick, onLanded: () => setLandedTick((n) => n + 1) };
  return (
    <Flex vertical gap={16}>
      <UtcNotice />
      <Typography.Text type="secondary">{t('stat.guest.devicesNote')}</Typography.Text>
      <Tabs
        items={[
          {
            key: 'daily',
            label: t('stat.guest.tab.daily'),
            children: <GuestDailyTab {...tabProps} />,
          },
          {
            key: 'cohort',
            label: t('stat.guest.tab.cohort'),
            children: <GuestCohortTab {...tabProps} />,
          },
          {
            key: 'retention',
            label: t('stat.guest.tab.retention'),
            children: <GuestRetentionTab {...tabProps} />,
          },
          { key: 'quota', label: t('stat.guest.tab.quota'), children: <GuestQuotaTab /> },
        ]}
      />
    </Flex>
  );
}
