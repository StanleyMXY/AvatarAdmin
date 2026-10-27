import { useIntl } from '@umijs/max';
import { Button, Result } from 'antd';

/**
 * Fills the page when the account could not be read because the service could not be reached. The
 * person is still signed in (the token is kept); `onRetry` reads the account again.
 */
export function ServiceUnavailable({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
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
        <Button type="primary" loading={retrying} onClick={onRetry}>
          {intl.formatMessage({ id: 'pages.common.retry' })}
        </Button>
      }
    />
  );
}
