import { getLocale, history } from '@umijs/max';
import type { ReactElement } from 'react';
import appRoutes from '../config/routes';
import { type AccessMe, canAccess } from './access/canAccess';
import { buildVars } from './buildVars';
import { HeaderDropdown } from './components/layout/HeaderDropdown';
import { LangSwitch } from './components/layout/LangSwitch';
import { signOut } from './components/layout/signOut';
import { TabManager } from './components/layout/TabManager';
import { ThemeSwitch } from './components/layout/ThemeSwitch';
import { applyInitialLocale } from './locales/initLocale';
import { Forbidden } from './pages/403';
import NotFoundPage from './pages/404';
import { setLocaleProvider } from './request/apiClient';
import { ThemeRoot } from './theme/ThemeRoot';
import { LAYOUT } from './theme/tokens';

// The request layer asks Umi for the language when a request is made, so Accept-Language always
// matches what the user sees. (The call happens later; Umi's plugin manager does not exist yet while
// this file is being loaded, so nothing here may call getLocale() at load time.)
setLocaleProvider(() => getLocale());

/** Umi calls this once, with its plugins ready, before the first page is drawn: choose the language now. */
export function render(oldRender: () => void): void {
  applyInitialLocale();
  oldRender();
}

/** What the app knows about the signed-in administrator; the session task fills it from `GET /me`. */
export type InitialState = { me?: AccessMe & { username?: string } };

export async function getInitialState(): Promise<InitialState> {
  return {};
}

/** Wraps the whole app: the theme (Ant Design token set) of the chosen mode. */
export function rootContainer(container: ReactElement): ReactElement {
  return <ThemeRoot>{container}</ThemeRoot>;
}

export const layout = ({ initialState }: { initialState?: InitialState }) => {
  const me = initialState?.me;
  const can = (code?: string) => canAccess(me, code);
  return {
    title: buildVars.productName,
    logo: buildVars.logoUrl,
    layout: 'mix' as const,
    fixedHeader: true,
    fixSiderbar: true,
    siderWidth: LAYOUT.siderWidth,
    headerHeight: LAYOUT.headerHeight,
    contentStyle: { padding: LAYOUT.contentPadding },
    menu: { locale: true },
    actionsRender: () => [<LangSwitch key="lang" />, <ThemeSwitch key="theme" />],
    avatarProps: {
      render: () =>
        me?.username ? (
          <HeaderDropdown
            username={me.username}
            onChangePassword={() => history.push('/user/change-password')}
            onLogout={signOut}
          />
        ) : null,
    },
    unAccessible: <Forbidden />,
    noFound: <NotFoundPage />,
    childrenRender: (children: ReactElement) => (
      <TabManager routes={appRoutes} can={can} locale={getLocale()}>
        {children}
      </TabManager>
    ),
  };
};
