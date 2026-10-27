import { useIntl } from '@umijs/max';
import { Typography } from 'antd';

/** The line that says statistics days are UTC days. */
export function UtcNotice() {
  const intl = useIntl();
  return (
    <Typography.Text type="secondary">
      {intl.formatMessage({ id: 'stat.common.utcNotice' })}
    </Typography.Text>
  );
}
