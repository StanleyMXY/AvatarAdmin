import { useIntl } from '@umijs/max';
import { Alert, Flex } from 'antd';
import { ConfigForm } from '../config/ConfigForm';

/** 奖励设置 (`INVITE:CONFIG`): every `invite.*` parameter, rendered like the system configuration. */
export default function InviteRewardsPage() {
  const intl = useIntl();
  return (
    <Flex vertical gap={16}>
      <Alert
        type="info"
        showIcon
        data-testid="invite-rewards-note"
        title={intl.formatMessage({ id: 'invite.rewards.note' })}
      />
      <ConfigForm editPermission="INVITE:CONFIG" />
    </Flex>
  );
}
