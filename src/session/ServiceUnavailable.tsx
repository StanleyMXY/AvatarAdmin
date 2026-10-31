import { useIntl } from '@umijs/max';
import { Button, Result, Space } from 'antd';

/**
 * Fills the page when the account could not be read (the network, the gateway or the backend
 * failed). The person is still signed in (the token is kept); `onRetry` reads the account again,
 * and `onSignOut` lets them leave when the error lasts.
 */
export function ServiceUnavailable({
  onRetry,
  onSignOut,
  retrying,
}: {
  onRetry: () => void;
  onSignOut: () => void;
  retrying: boolean;
}) {
  const intl = useIntl();
  return (
    <Result
      role="alert"
      status="warning"
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
      title={intl.formatMessage({ id: 'error.GATEWAY_UNAVAILABLE' })}
      extra={
        <Space>
          <Button type="primary" loading={retrying} onClick={onRetry}>
            {intl.formatMessage({ id: 'pages.common.retry' })}
          </Button>
          <Button onClick={onSignOut}>{intl.formatMessage({ id: 'pages.header.logout' })}</Button>
        </Space>
      }
    />
  );
}
