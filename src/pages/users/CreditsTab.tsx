import { useIntl } from '@umijs/max';
import { Button, Flex, Tooltip, Typography } from 'antd';
import { useState } from 'react';
import { Can } from '../../components/Can';
import { AccountCreditsPanel } from '../credits/AccountCreditsPanel';
import { AdjustRequestModal } from '../credits/AdjustRequestModal';
import { newRequestBlocked } from './accountState';

/**
 * 额度 (`SUBSCRIPTION:VIEW`): the balance and the ledger of the account, and, for an administrator
 * with `SUBSCRIPTION:GRANT`, a new adjustment request for this account. The button is disabled
 * while the account waits for deletion or is being deleted (the backend refuses, contract 17.4).
 */
export function CreditsTab({ accountId, status }: { accountId: string; status: string }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const [creating, setCreating] = useState(false);
  const blocked = newRequestBlocked(status);
  return (
    <Flex vertical gap={16}>
      <Can code="SUBSCRIPTION:GRANT">
        <Flex vertical gap={8} align="flex-start">
          <Tooltip title={blocked ? t('users.credits.blocked') : undefined}>
            <span>
              <Button type="primary" disabled={blocked} onClick={() => setCreating(true)}>
                {t('users.credits.newRequest')}
              </Button>
            </span>
          </Tooltip>
          {blocked ? (
            <Typography.Text type="secondary">{t('users.credits.blocked')}</Typography.Text>
          ) : null}
        </Flex>
        <AdjustRequestModal
          open={creating}
          accountId={accountId}
          onClose={() => setCreating(false)}
          onCreated={() => {}}
        />
      </Can>
      <AccountCreditsPanel key={accountId} accountId={accountId} />
    </Flex>
  );
}
