import { useIntl } from '@umijs/max';
import { Alert, Flex } from 'antd';
import type { FeatureGate, FeatureValue } from '../../services/subscriptions';
import { unrestrictedQuota } from './featureRules';

/**
 * The reminders shown while an entitlement's feature values or a product mapping are saved: when
 * the entitlement sets neither the daily nor the monthly quota of calls (or of messages) and the
 * defaults do not either, its subscribers are not limited at all. They are reminders, not blocks.
 */
export function QuotaWarnings({
  values,
  gates,
}: {
  values: Readonly<Record<string, FeatureValue | undefined>>;
  gates: readonly FeatureGate[];
}) {
  const intl = useIntl();
  const { call, chat } = unrestrictedQuota(values, gates);
  if (!call && !chat) return null;
  return (
    <Flex vertical gap={8}>
      {call ? (
        <Alert
          type="warning"
          showIcon
          title={intl.formatMessage({ id: 'subscriptions.warning.call' })}
        />
      ) : null}
      {chat ? (
        <Alert
          type="warning"
          showIcon
          title={intl.formatMessage({ id: 'subscriptions.warning.chat' })}
        />
      ) : null}
    </Flex>
  );
}
