import type { ProColumns } from '@ant-design/pro-components';
import { Link, useAccess, useIntl } from '@umijs/max';
import { Button, Tag } from 'antd';
import { useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { StatusTag } from '../../components/StatusTag';
import {
  listSubscriptions,
  SUBSCRIPTION_STORES,
  type Subscription,
} from '../../services/subscriptions';
import { formatInstant } from '../../utils/format';
import { DASH } from '../../utils/ratio';
import { SUBSCRIPTION_STATES, SubscriptionDrawer, useStateOptions } from './SubscriptionDrawer';

type Filter = { accountId?: string; state?: string; store?: string; productId?: string };

/** 订阅列表: every store subscription, with filters on account, status, store and product; the detail is a drawer. */
export default function SubscriptionListPage() {
  const intl = useIntl();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const t = (id: string) => intl.formatMessage({ id });
  const states = useStateOptions();
  const [open, setOpen] = useState<string | null>(null);
  const when = (iso: string | null) => (iso ? formatInstant(iso, intl.locale) : DASH);

  const columns: ProColumns<Subscription>[] = [
    { title: t('subscriptions.list.id'), dataIndex: 'id', search: false },
    {
      title: t('subscriptions.list.account'),
      dataIndex: 'accountId',
      render: (_, row) =>
        row.accountId === null ? (
          DASH
        ) : access.canAccess('USER:VIEW') ? (
          <Link to={`/users/${row.accountId}`}>{row.accountId}</Link>
        ) : (
          row.accountId
        ),
    },
    {
      title: t('subscriptions.list.state'),
      dataIndex: 'state',
      valueType: 'select',
      valueEnum: Object.fromEntries(
        SUBSCRIPTION_STATES.map((state) => [state, { text: states[state].label }]),
      ),
      render: (_, row) => <StatusTag status={row.state} options={states} />,
    },
    {
      title: t('subscriptions.list.store'),
      dataIndex: 'store',
      valueType: 'select',
      valueEnum: Object.fromEntries(SUBSCRIPTION_STORES.map((store) => [store, { text: store }])),
    },
    {
      title: t('subscriptions.list.product'),
      dataIndex: 'productId',
      render: (_, row) => <EllipsisPopoverText text={row.productId} lines={1} width={200} />,
    },
    {
      title: t('subscriptions.list.period'),
      search: false,
      render: (_, row) => `${when(row.currentPeriodStart)} → ${when(row.currentPeriodEnd)}`,
    },
    {
      title: t('subscriptions.list.autoRenew'),
      dataIndex: 'autoRenew',
      search: false,
      render: (_, row) => t(row.autoRenew ? 'subscriptions.yes' : 'subscriptions.no'),
    },
    {
      title: t('subscriptions.list.environment'),
      dataIndex: 'environment',
      search: false,
      render: (_, row) =>
        row.environment === 'SANDBOX' ? (
          <Tag color="orange">{t('subscriptions.env.SANDBOX')}</Tag>
        ) : (
          t('subscriptions.env.PRODUCTION')
        ),
    },
    {
      title: t('subscriptions.list.purchasedAt'),
      dataIndex: 'purchasedAt',
      search: false,
      render: (_, row) => when(row.purchasedAt),
    },
    {
      title: t('subscriptions.list.actions'),
      valueType: 'option',
      render: (_, row) => [
        <Button key="detail" type="link" size="small" onClick={() => setOpen(row.id)}>
          {t('subscriptions.list.details')}
        </Button>,
      ],
    },
  ];

  return (
    <>
      <PagedListTable<Subscription, Filter>
        rowKey="id"
        columns={columns}
        // four filters: all of them are shown, none hides behind "expand"
        defaultCollapsed={false}
        request={(params) => listSubscriptions(params)}
      />
      <SubscriptionDrawer id={open} onClose={() => setOpen(null)} />
    </>
  );
}
