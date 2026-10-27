import { useIntl } from '@umijs/max';
import { Alert, Button } from 'antd';
import { useSyncExternalStore } from 'react';
import { isServiceUnavailable, subscribeServiceStatus } from '../../request/serviceStatus';

/**
 * The notice above the page while the gateway says the service is unavailable (502, 503, 504 to a
 * read). Retry loads the page again; the notice goes when any request is answered again.
 */
export function ServiceNotice({ onRetry }: { onRetry: () => void }) {
  const intl = useIntl();
  const unavailable = useSyncExternalStore(subscribeServiceStatus, isServiceUnavailable);
  if (!unavailable) return null;
  return (
    <Alert
      type="warning"
      showIcon
      role="alert"
      style={{ marginBottom: 12 }}
      title={intl.formatMessage({ id: 'error.GATEWAY_UNAVAILABLE' })}
      action={
        <Button size="small" onClick={onRetry}>
          {intl.formatMessage({ id: 'pages.common.retry' })}
        </Button>
      }
    />
  );
}
