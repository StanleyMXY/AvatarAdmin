import { useIntl } from '@umijs/max';
import { Alert, Button } from 'antd';

/** The words of a failed read, with a button that reads again. */
export function FailureBar({ failure, onRetry }: { failure: string; onRetry: () => void }) {
  const intl = useIntl();
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
