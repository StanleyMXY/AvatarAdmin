import { useIntl } from '@umijs/max';
import { Flex, Tabs } from 'antd';
import { useState } from 'react';
import { UtcNotice } from '../../components/stat/UtcNotice';
import { ClicksTab } from './ClicksTab';
import { RecordsTab } from './RecordsTab';
import { SummaryTab } from './SummaryTab';
import { useCampaigns } from './useCampaigns';

type TabKey = 'clicks' | 'records' | 'summary';

/**
 * 归因明细 (`ATTRIBUTION:VIEW`): three tabs, the clicks, the installs and registrations of both
 * sources, and the summary. All three are read live; the days are UTC days. The list of campaigns is
 * read once for the filter and the names.
 */
export default function AttributionPage() {
  const intl = useIntl();
  const [tab, setTab] = useState<TabKey>('clicks');
  const campaigns = useCampaigns();
  return (
    <Flex vertical gap={8}>
      <UtcNotice />
      <Tabs
        destroyOnHidden
        activeKey={tab}
        onChange={(key) => setTab(key as TabKey)}
        items={[
          {
            key: 'clicks',
            label: intl.formatMessage({ id: 'campaign.attribution.tab.clicks' }),
            children: <ClicksTab campaigns={campaigns} />,
          },
          {
            key: 'records',
            label: intl.formatMessage({ id: 'campaign.attribution.tab.records' }),
            children: <RecordsTab campaigns={campaigns} />,
          },
          {
            key: 'summary',
            label: intl.formatMessage({ id: 'campaign.attribution.tab.summary' }),
            children: <SummaryTab />,
          },
        ]}
      />
    </Flex>
  );
}
