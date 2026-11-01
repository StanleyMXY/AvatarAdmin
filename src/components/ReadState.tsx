import { useIntl } from '@umijs/max';
import { Alert, Button, Spin } from 'antd';

/**
 * The failure bar (with a retry) or the spinner of something that is being read. `failure` is the
 * words of the error code from `useLatestRead`; nothing is drawn once the read has succeeded.
 */
export function ReadState({
  failure,
  loading,
  onRetry,
}: {
  failure: string | null;
  loading: boolean;
  onRetry: () => void;
}) {
  const intl = useIntl();
  if (failure) {
    return (
      <Alert
        type="error"
        showIcon
        title={intl.formatMessage({ id: 'pages.common.loadFailed' }, { message: failure })}
        action={
          <Button size="small" onClick={onRetry}>
            {intl.formatMessage({ id: 'pages.common.retry' })}
          </Button>
        }
      />
    );
  }
  return loading ? <Spin /> : null;
}
