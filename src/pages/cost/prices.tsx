import { useAccess, useIntl, useLocation } from '@umijs/max';
import { Card, Flex, Tabs } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Can } from '../../components/Can';
import { getAdminMeta } from '../../services/auth';
import { useAdminMeta } from '../../session/useSession';
import { ConfigForm } from '../config/ConfigForm';
import { AlertsLine } from './AlertsLine';
import { CurrentTab } from './CurrentTab';
import { ManualTab } from './ManualTab';
import { ModelsTab } from './ModelsTab';
import { PendingTab } from './PendingTab';

type Access = { canAccess: (code?: string) => boolean };
type TabKey = 'pending' | 'current' | 'manual' | 'models';

/**
 * 价格 (`COST:VIEW`; the writes need `COST:PRICE`): pending prices, current prices, entering a price by
 * hand, the models, and the parameters of the prices. The address can open a tab (`?tab=models`) with
 * the "no price in force" filter (`&hasPrice=false`), which is where the cost report sends its
 * "requests without a price" card.
 */
export default function PricesPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const access = useAccess() as unknown as Access;
  const meta = useAdminMeta();
  const { search } = useLocation();

  // The allowed currencies were read once, at sign-in. Another page may have changed
  // `usage_price.allowed_currencies` since, so the page reads `GET /meta` again when it opens and
  // before a price is confirmed (the session layer is left alone). A read that gives no list keeps
  // the list that is held.
  const [freshAllowed, setFreshAllowed] = useState<string[] | undefined>();
  const allowedCurrencies = freshAllowed ?? meta.allowedCurrencies;
  const latestRead = useRef(0);
  const readAllowed = useCallback(async () => {
    const mine = ++latestRead.current;
    const read = await getAdminMeta();
    if (mine === latestRead.current && Array.isArray(read.allowedCurrencies))
      setFreshAllowed(read.allowedCurrencies);
  }, []);
  useEffect(() => {
    void readAllowed();
  }, [readAllowed]);

  const canPrice = access.canAccess('COST:PRICE');
  const canAlerts = canPrice && access.canAccess('MONITOR:VIEW');

  const query = new URLSearchParams(search);
  const asked = query.get('tab');
  const [tab, setTab] = useState<TabKey>(() =>
    asked === 'current' || asked === 'models' || (asked === 'manual' && canPrice)
      ? asked
      : 'pending',
  );
  const [onlyUnpriced] = useState(() => query.get('hasPrice') === 'false');

  const items = [
    {
      key: 'pending',
      label: t('cost.prices.tab.pending'),
      children: <PendingTab allowedCurrencies={allowedCurrencies} readAllowed={readAllowed} />,
    },
    { key: 'current', label: t('cost.prices.tab.current'), children: <CurrentTab /> },
    ...(canPrice
      ? [
          {
            key: 'manual',
            label: t('cost.prices.tab.manual'),
            children: (
              <ManualTab allowedCurrencies={allowedCurrencies} onSaved={() => setTab('current')} />
            ),
          },
        ]
      : []),
    {
      key: 'models',
      label: t('cost.prices.tab.models'),
      children: <ModelsTab onlyUnpricedInitially={onlyUnpriced} />,
    },
  ];

  return (
    <Flex vertical gap={16}>
      {canAlerts ? <AlertsLine /> : null}
      <Tabs
        activeKey={tab}
        onChange={(key) => setTab(key as TabKey)}
        items={items}
        destroyOnHidden
      />
      <Can code="COST:PRICE">
        <Card size="small" title={t('cost.prices.params')}>
          <ConfigForm editPermission="COST:PRICE" />
        </Card>
      </Can>
    </Flex>
  );
}
