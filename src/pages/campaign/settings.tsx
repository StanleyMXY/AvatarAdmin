import { useIntl } from '@umijs/max';
import { Alert, Flex } from 'antd';
import { ConfigForm } from '../config/ConfigForm';

/**
 * 归因参数 (`ATTRIBUTION:MANAGE`): the keys `attribution.*` with the shared configuration form,
 * and a note on the order in which an install is matched to a click.
 */
export default function SettingsPage() {
  const intl = useIntl();
  return (
    <Flex vertical gap={16}>
      <Alert
        type="info"
        showIcon
        data-testid="campaign-settings-order"
        title={intl.formatMessage({ id: 'campaign.settings.order.title' })}
        description={intl.formatMessage({ id: 'campaign.settings.order.content' })}
      />
      <ConfigForm editPermission="ATTRIBUTION:MANAGE" />
    </Flex>
  );
}
