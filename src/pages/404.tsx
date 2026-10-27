import { history, useIntl } from '@umijs/max';
import { Button, Result } from 'antd';

export default function NotFoundPage() {
  const intl = useIntl();
  return (
    <Result
      status="404"
      title={intl.formatMessage({ id: 'pages.404.title' })}
      subTitle={intl.formatMessage({ id: 'pages.404.subtitle' })}
      extra={
        <Button type="primary" onClick={() => history.push('/dashboard')}>
          {intl.formatMessage({ id: 'pages.404.back' })}
        </Button>
      }
    />
  );
}
