import { history, useIntl, useLocation } from '@umijs/max';
import { Button, Result } from 'antd';
import { useMemo } from 'react';
import appRoutes from '../../config/routes';
import type { AdminRoute } from '../access/canAccess';
import { indexPages, matchPage } from '../components/layout/pageIndex';

/**
 * Shown when an administrator opens a page the account has no permission for: says so, and names the
 * permission the page needs (from the language file; the code itself when there is no name).
 */
export function Forbidden({ routes = appRoutes }: { routes?: AdminRoute[] }) {
  const intl = useIntl();
  const { pathname } = useLocation();
  const pages = useMemo(() => indexPages(routes), [routes]);
  const code = matchPage(pages, pathname)?.access;
  const nameKey = code ? `permission.${code}` : undefined;
  const name =
    code && nameKey && intl.messages[nameKey] ? intl.formatMessage({ id: nameKey }) : code;
  return (
    <Result
      status="403"
      title={intl.formatMessage({ id: 'pages.403.title' })}
      subTitle={
        <>
          <div>{intl.formatMessage({ id: 'pages.403.subtitle' })}</div>
          {name ? <div>{intl.formatMessage({ id: 'pages.403.needs' }, { name })}</div> : null}
        </>
      }
      extra={
        <Button type="primary" onClick={() => history.push('/dashboard')}>
          {intl.formatMessage({ id: 'pages.403.back' })}
        </Button>
      }
    />
  );
}

export default Forbidden;
