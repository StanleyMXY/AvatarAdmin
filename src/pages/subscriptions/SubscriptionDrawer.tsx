import { Link, useAccess, useIntl } from '@umijs/max';
import { Alert, Button, Descriptions, Drawer, Empty, Flex, Spin, Tag, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { type StatusOption, StatusTag } from '../../components/StatusTag';
import { useFailure } from '../../hooks/useFailure';
import { useLatestCall } from '../../hooks/useLatestCall';
import { getSubscription, type SubscriptionDetail } from '../../services/subscriptions';
import { formatInstant } from '../../utils/format';
import { DASH } from '../../utils/ratio';
import { sortTimeline } from './featureRules';

const STATE_COLORS: Record<string, string> = {
  PENDING: 'blue',
  ACTIVE: 'green',
  CANCELED: 'orange',
  IN_GRACE_PERIOD: 'gold',
  ON_HOLD: 'orange',
  PAUSED: 'default',
  EXPIRED: 'default',
  REVOKED: 'red',
};

/** How many characters of a purchase token are shown (the push token list shows six as well). */
const REF_SUFFIX = 6;

export const SUBSCRIPTION_STATES = Object.keys(STATE_COLORS);

/** The state options of the status tag and of the filter, in the current language. */
export function useStateOptions(): Record<string, StatusOption> {
  const intl = useIntl();
  return Object.fromEntries(
    SUBSCRIPTION_STATES.map((state) => [
      state,
      {
        label: intl.formatMessage({ id: `subscriptions.state.${state}` }),
        color: STATE_COLORS[state],
      },
    ]),
  );
}

type Props = {
  /** The subscription to show; null keeps the drawer closed. */
  id: string | null;
  onClose: () => void;
};

/**
 * One subscription with its event timeline, in a drawer. The timeline is ordered by the time the
 * store signed the event, newest first; an event with an error is marked red and one that needs
 * attention carries a tag. The detail is read again each time the drawer opens.
 */
export function SubscriptionDrawer({ id, onClose }: Props) {
  const intl = useIntl();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const t = (key: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: key }, values);
  const states = useStateOptions();
  const [detail, setDetail] = useState<SubscriptionDetail | null>(null);
  const { text: failure, fail, clear } = useFailure();
  const begin = useLatestCall();

  const load = useCallback(
    async (subscriptionId: string) => {
      // Only the newest read counts: a slow answer for a subscription opened before must not
      // replace the one that is shown now.
      const isCurrent = begin();
      setDetail(null);
      clear();
      try {
        const answer = await getSubscription(subscriptionId);
        if (isCurrent()) setDetail(answer);
      } catch (error) {
        if (isCurrent()) fail(error);
      }
    },
    [begin, fail, clear],
  );

  useEffect(() => {
    if (id !== null) void load(id);
  }, [id, load]);

  const when = (iso: string | null) => (iso ? formatInstant(iso, intl.locale) : DASH);

  const body = () => {
    if (failure)
      return (
        <Alert
          type="error"
          showIcon
          title={t('pages.common.loadFailed', { message: failure })}
          action={
            <Button size="small" onClick={() => id !== null && void load(id)}>
              {t('pages.common.retry')}
            </Button>
          }
        />
      );
    if (!detail) return <Spin />;
    const events = sortTimeline(detail.events);
    return (
      <Flex vertical gap={24}>
        <Descriptions
          size="small"
          column={1}
          bordered
          items={[
            { key: 'id', label: t('subscriptions.list.id'), children: detail.id },
            {
              key: 'account',
              label: t('subscriptions.list.account'),
              children:
                detail.accountId === null ? (
                  DASH
                ) : access.canAccess('USER:VIEW') ? (
                  <Link to={`/users/${detail.accountId}`}>{detail.accountId}</Link>
                ) : (
                  detail.accountId
                ),
            },
            { key: 'store', label: t('subscriptions.list.store'), children: detail.store },
            {
              key: 'ref',
              label: t('subscriptions.detail.storeRef'),
              // A Google reference is the purchase token: whoever holds it can claim the subscription
              // by verifying it, so like a push token only its last characters are shown.
              children:
                detail.store === 'GOOGLE' ? (
                  `…${[...detail.storeRef].slice(-REF_SUFFIX).join('')}`
                ) : (
                  <EllipsisPopoverText text={detail.storeRef} lines={1} width={260} />
                ),
            },
            { key: 'product', label: t('subscriptions.list.product'), children: detail.productId },
            {
              key: 'state',
              label: t('subscriptions.list.state'),
              children: <StatusTag status={detail.state} options={states} />,
            },
            {
              key: 'period',
              label: t('subscriptions.list.period'),
              children: `${when(detail.currentPeriodStart)} → ${when(detail.currentPeriodEnd)}`,
            },
            {
              key: 'grace',
              label: t('subscriptions.detail.grace'),
              children: when(detail.gracePeriodEndsAt),
            },
            {
              key: 'renew',
              label: t('subscriptions.list.autoRenew'),
              children: t(detail.autoRenew ? 'subscriptions.yes' : 'subscriptions.no'),
            },
            {
              key: 'env',
              label: t('subscriptions.list.environment'),
              children:
                detail.environment === 'SANDBOX' ? (
                  <Tag color="orange">{t('subscriptions.env.SANDBOX')}</Tag>
                ) : (
                  t('subscriptions.env.PRODUCTION')
                ),
            },
            {
              key: 'purchased',
              label: t('subscriptions.list.purchasedAt'),
              children: when(detail.purchasedAt),
            },
            {
              key: 'firstActive',
              label: t('subscriptions.detail.firstActiveAt'),
              children: when(detail.firstActiveAt),
            },
            {
              key: 'voided',
              label: t('subscriptions.detail.voidedAt'),
              children: when(detail.voidedAt),
            },
            {
              key: 'synced',
              label: t('subscriptions.detail.lastSyncedAt'),
              children: when(detail.lastSyncedAt),
            },
          ]}
        />
        <div>
          <Typography.Title level={5}>{t('subscriptions.detail.timeline')}</Typography.Title>
          <Typography.Paragraph type="secondary">
            {t('subscriptions.detail.timelineHint')}
          </Typography.Paragraph>
          {events.length === 0 ? (
            <Empty />
          ) : (
            <Flex vertical gap={12}>
              {events.map((event) => (
                <div
                  key={event.id}
                  data-testid="timeline-event"
                  data-signed-at={event.eventSignedAt}
                  style={{
                    borderInlineStart: `3px solid ${event.error ? 'var(--ant-color-error, #ff4d4f)' : 'var(--ant-color-border, #d9d9d9)'}`,
                    paddingInlineStart: 12,
                  }}
                >
                  <Flex gap={8} wrap align="center">
                    <Typography.Text strong>{event.type}</Typography.Text>
                    {event.subtype ? (
                      <Typography.Text type="secondary">{event.subtype}</Typography.Text>
                    ) : null}
                    {event.needsAttention ? (
                      <Tag color="orange">{t('subscriptions.event.needsAttention')}</Tag>
                    ) : null}
                  </Flex>
                  <div>
                    {t('subscriptions.event.signedAt')}: {when(event.eventSignedAt)}
                  </div>
                  <div>
                    {t('subscriptions.event.receivedAt')}: {when(event.receivedAt)}
                  </div>
                  <div>
                    {t('subscriptions.event.processedAt')}: {when(event.processedAt)}
                  </div>
                  {event.error ? (
                    <Typography.Text type="danger" data-testid="event-error">
                      {t('subscriptions.event.error')}:{' '}
                      <EllipsisPopoverText text={event.error} lines={3} width={420} />
                    </Typography.Text>
                  ) : null}
                </div>
              ))}
            </Flex>
          )}
        </div>
      </Flex>
    );
  };

  return (
    <Drawer
      open={id !== null}
      onClose={onClose}
      size={640}
      destroyOnHidden
      title={t('subscriptions.detail.title', { id: id ?? '' })}
    >
      {body()}
    </Drawer>
  );
}
