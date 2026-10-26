import { history, useIntl, useModel } from '@umijs/max';
import { App } from 'antd';
import { type ReactNode, useEffect, useRef } from 'react';
import { forgetTabs } from '../components/layout/signOut';
import { setSessionHandlers } from '../request/session';
import { readMeAgain } from './loadSession';
import { clearPendingEnroll } from './pendingEnroll';
import { loginUrl } from './returnUrl';

/**
 * Connects the request layer to the page. A lost token (401 ADMIN_INVALID_TOKEN) clears the
 * account, forgets the tabs and goes to the sign-in page with the page the person was on; the
 * request that failed is not sent again. A refusal (403 ADMIN_FORBIDDEN) says so and reads the
 * permissions again, once however many refusals arrive together. Nothing polls.
 */
export function SessionBridge({ children }: { children: ReactNode }) {
  const intl = useIntl();
  const { message } = App.useApp();
  const { setInitialState } = useModel('@@initialState');
  const latest = useRef({ intl, message, setInitialState });
  latest.current = { intl, message, setInitialState };

  useEffect(() => {
    setSessionHandlers({
      onExpired: () => {
        const { intl, message, setInitialState } = latest.current;
        clearPendingEnroll();
        forgetTabs();
        void setInitialState({});
        message.warning({
          key: 'admin-expired',
          content: intl.formatMessage({ id: 'error.ADMIN_INVALID_TOKEN' }),
        });
        history.replace(loginUrl(window.location.pathname, window.location.search));
      },
      onForbidden: () => {
        const { intl, message, setInitialState } = latest.current;
        // One notice however many refusals arrive together (the key makes antd show it once).
        message.error({
          key: 'admin-forbidden',
          content: intl.formatMessage({ id: 'error.ADMIN_FORBIDDEN' }),
        });
        void readMeAgain().then((me) => {
          if (me) void setInitialState((previous) => ({ ...(previous ?? {}), me }));
        });
      },
    });
  }, []);

  return <>{children}</>;
}
