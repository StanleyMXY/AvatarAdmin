import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Link, useAccess, useIntl } from '@umijs/max';
import { App, Flex, Tag, Typography } from 'antd';
import { useRef } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { type RowAction, RowActions } from '../../components/RowActions';
import {
  ackSubscriptionEvent,
  listSubscriptionEvents,
  reprocessSubscriptionEvent,
  type SubscriptionEvent,
} from '../../services/subscriptions';
import { describeFailure } from '../../session/describe';
import { formatInstant } from '../../utils/format';
import { DASH } from '../../utils/ratio';

type Filter = { status?: string; needsAttentionFilter?: string };

/** 事件重处理: the events the store sent; failed ones can be processed again, ones that need a person can be marked handled. */
export default function EventsPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const t = (id: string) => intl.formatMessage({ id });
  const actionRef = useRef<ActionType | undefined>(undefined);
  const when = (iso: string | null) => (iso ? formatInstant(iso, intl.locale) : DASH);
  const canGrant = access.canAccess('SUBSCRIPTION:GRANT');

  // A write that was refused says why, and the list is read again: the event may have changed meanwhile.
  const write = (send: () => Promise<unknown>, doneKey: string) => async () => {
    try {
      await send();
      message.success(t(doneKey));
    } catch (error) {
      message.error(describeFailure(intl, error).text);
    } finally {
      actionRef.current?.reload();
    }
  };

  const actionsOf = (event: SubscriptionEvent): RowAction[] => {
    if (!canGrant) return [];
    const actions: RowAction[] = [];
    if (event.error !== null) {
      actions.push({
        key: 'reprocess',
        label: t('subscriptions.events.reprocess'),
        confirmText: t('subscriptions.events.reprocessConfirm'),
        onClick: write(
          () => reprocessSubscriptionEvent(event.id),
          'subscriptions.events.reprocessed',
        ),
      });
    }
    if (event.needsAttention) {
      actions.push({
        key: 'ack',
        label: t('subscriptions.events.ack'),
        onClick: write(() => ackSubscriptionEvent(event.id), 'subscriptions.events.acked'),
      });
    }
    return actions;
  };

  const columns: ProColumns<SubscriptionEvent>[] = [
    {
      title: t('subscriptions.list.state'),
      dataIndex: 'status',
      hideInTable: true,
      valueType: 'select',
      valueEnum: { FAILED: { text: t('subscriptions.events.failed') } },
    },
    {
      title: t('subscriptions.event.needsAttention'),
      dataIndex: 'needsAttentionFilter',
      hideInTable: true,
      valueType: 'select',
      valueEnum: { true: { text: t('subscriptions.yes') } },
    },
    { title: t('subscriptions.events.id'), dataIndex: 'id', search: false },
    {
      title: t('subscriptions.events.subscription'),
      dataIndex: 'subscriptionId',
      search: false,
      render: (_, row) => row.subscriptionId ?? DASH,
    },
    {
      title: t('subscriptions.list.account'),
      dataIndex: 'accountId',
      search: false,
      render: (_, row) =>
        row.accountId === null ? (
          DASH
        ) : access.canAccess('USER:VIEW') ? (
          <Link to={`/users/${row.accountId}`}>{row.accountId}</Link>
        ) : (
          row.accountId
        ),
    },
    { title: t('subscriptions.list.store'), dataIndex: 'store', search: false },
    {
      title: t('subscriptions.events.type'),
      dataIndex: 'type',
      search: false,
      render: (_, row) => (
        <Flex vertical gap={0}>
          <Typography.Text>{row.type}</Typography.Text>
          {row.subtype ? <Typography.Text type="secondary">{row.subtype}</Typography.Text> : null}
        </Flex>
      ),
    },
    {
      title: t('subscriptions.event.signedAt'),
      dataIndex: 'eventSignedAt',
      search: false,
      render: (_, row) => when(row.eventSignedAt),
    },
    {
      title: t('subscriptions.event.receivedAt'),
      dataIndex: 'receivedAt',
      search: false,
      render: (_, row) => when(row.receivedAt),
    },
    {
      title: t('subscriptions.event.processedAt'),
      dataIndex: 'processedAt',
      search: false,
      render: (_, row) => when(row.processedAt),
    },
    {
      title: t('subscriptions.event.error'),
      dataIndex: 'error',
      search: false,
      render: (_, row) =>
        row.error ? (
          <Typography.Text type="danger">
            <EllipsisPopoverText text={row.error} lines={2} width={280} />
          </Typography.Text>
        ) : (
          DASH
        ),
    },
    {
      title: t('subscriptions.events.attention'),
      dataIndex: 'needsAttention',
      search: false,
      render: (_, row) =>
        row.needsAttention ? (
          <Tag color="orange">{t('subscriptions.event.needsAttention')}</Tag>
        ) : (
          DASH
        ),
    },
    {
      title: t('subscriptions.list.actions'),
      valueType: 'option',
      render: (_, row) => <RowActions actions={actionsOf(row)} />,
    },
  ];

  return (
    <PagedListTable<SubscriptionEvent, Filter>
      rowKey="id"
      columns={columns}
      actionRef={actionRef}
      request={({ page, pageSize, status, needsAttentionFilter }) =>
        listSubscriptionEvents({
          page,
          pageSize,
          status: status === 'FAILED' ? 'FAILED' : undefined,
          needsAttention: needsAttentionFilter === 'true' ? true : undefined,
        })
      }
    />
  );
}
