import { useIntl } from '@umijs/max';
import { Flex, Typography } from 'antd';
import { AccountEntitlementsPanel } from '../subscriptions/AccountEntitlementsPanel';
import { grantBlocked, revokeBlocked } from './accountState';

/**
 * 订阅与权益 (`SUBSCRIPTION:VIEW`): the effective values and the entitlement rows of the account,
 * with grant and revoke for `SUBSCRIPTION:GRANT`. A grant does not touch the store subscription,
 * and the page says so. For an account that waits for deletion the grant is disabled, and for one
 * that is being deleted the revoke is too (contract 17.4, state table).
 */
export function EntitlementsTab({ accountId, status }: { accountId: string; status: string }) {
  const intl = useIntl();
  return (
    <Flex vertical gap={12}>
      <Typography.Text type="secondary">
        {intl.formatMessage({ id: 'users.entitlements.storeNote' })}
      </Typography.Text>
      <AccountEntitlementsPanel
        key={accountId}
        accountId={accountId}
        grantDisabled={grantBlocked(status)}
        revokeDisabled={revokeBlocked(status)}
      />
    </Flex>
  );
}
