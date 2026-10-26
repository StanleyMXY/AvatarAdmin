import { useIntl } from '@umijs/max';
import { Flex, Typography } from 'antd';
import { ConfigForm } from '../config/ConfigForm';

/** 召回参数 (`PUSH:CONFIG`): the keys of the daily recall push and of the push sending, with the shared configuration form. */
export default function RecallPage() {
  const intl = useIntl();
  return (
    <Flex vertical gap={16}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        {intl.formatMessage({ id: 'push.recall.note' })}
      </Typography.Paragraph>
      <ConfigForm editPermission="PUSH:CONFIG" />
    </Flex>
  );
}
