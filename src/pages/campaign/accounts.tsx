import { useIntl } from '@umijs/max';
import { Tabs } from 'antd';
import { useRef, useState } from 'react';
import type { Kept } from '../../hooks/useKeptState';
import { useLatestRead } from '../../hooks/useLatestRead';
import { readCostSettings } from '../../services/campaign';
import { CampaignsTab } from './CampaignsTab';
import { CostsTab } from './CostsTab';
import { useCampaigns } from './useCampaigns';

type TabKey = 'campaigns' | 'costs';

/**
 * 投放账户与成本 (`ATTRIBUTION:MANAGE`): two tabs, the campaigns and their costs. The list of
 * campaigns and the parameters of the costs (currency, batch limit, link root) are read once here and
 * shared by both tabs.
 */
export default function AccountsPage() {
  const intl = useIntl();
  const [tab, setTab] = useState<TabKey>('campaigns');
  // The tabs are drawn again each time they are opened (so that they read fresh data); what the person
  // chose in the filters of the costs is kept here for when it is opened again.
  const kept = useRef<Kept['current']>({}) as Kept;
  const campaigns = useCampaigns();
  const settings = useLatestRead(readCostSettings);
  // `undefined` while the setting is not known; a failed read leaves it unknown too.
  const linkBase = settings.data === null ? undefined : settings.data.linkBaseUrl;

  return (
    <Tabs
      destroyOnHidden
      activeKey={tab}
      onChange={(key) => setTab(key as TabKey)}
      items={[
        {
          key: 'campaigns',
          label: intl.formatMessage({ id: 'campaign.accounts.tab.campaigns' }),
          children: <CampaignsTab campaigns={campaigns} linkBase={linkBase} kept={kept} />,
        },
        {
          key: 'costs',
          label: intl.formatMessage({ id: 'campaign.accounts.tab.costs' }),
          children: <CostsTab campaigns={campaigns} settings={settings.data} kept={kept} />,
        },
      ]}
    />
  );
}
