import { getLocale } from '@umijs/max';
import type { ReactElement } from 'react';
import appRoutes from '../config/routes';
import { canAccess } from './access/canAccess';
import { buildVars } from './buildVars';
import { AccountMenu } from './components/layout/AccountMenu';
import { LangSwitch } from './components/layout/LangSwitch';
import { pageTitleRender } from './components/layout/pageTitle';
import { TabManager } from './components/layout/TabManager';
import { ThemeSwitch } from './components/layout/ThemeSwitch';
import { applyInitialLocale } from './locales/initLocale';
import { Forbidden } from './pages/403';
import NotFoundPage from './pages/404';
import { setLocaleProvider } from './request/apiClient';
import { loadSession } from './session/loadSession';
import { SessionBridge } from './session/SessionBridge';
import { SessionGate } from './session/SessionGate';
import type { SessionState } from './session/state';
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

/** What the app knows about the signed-in administrator (`GET /me`) and the shared values (`GET /meta`). */
export type InitialState = SessionState;

export async function getInitialState(): Promise<InitialState> {
  return loadSession();
}

/**
 * Inside Umi's data providers and outside its router: connects the request layer's session signals
 * (token lost, permission refused) to the page.
 */
export function innerProvider(container: ReactElement): ReactElement {
  return <SessionBridge>{container}</SessionBridge>;
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
    // Nothing of the shell (menu, header) belongs to a person we cannot name: not while the account
    // is being read, not when nobody is signed in (the gate is sending them to sign-in), and not
    // when it could not be read (token still held; the notice fills the whole page).
    pure: !me,
    fixedHeader: true,
    fixSiderbar: true,
    siderWidth: LAYOUT.siderWidth,
    headerHeight: LAYOUT.headerHeight,
    contentStyle: { padding: LAYOUT.contentPadding },
    menu: { locale: true },
    pageTitleRender,
    actionsRender: () => [<LangSwitch key="lang" />, <ThemeSwitch key="theme" />],
    avatarProps: { render: () => <AccountMenu /> },
    // The 403 page sits under the tab bar like every other page: the tabs are not unmounted and
    // read back from storage when a limited account opens a page it may not see.
    unAccessible: (
      <SessionGate>
        <TabManager routes={appRoutes} can={can} locale={getLocale()}>
          <Forbidden />
        </TabManager>
      </SessionGate>
    ),
    noFound: <NotFoundPage />,
    childrenRender: (children: ReactElement) => (
      <SessionGate>
        <TabManager routes={appRoutes} can={can} locale={getLocale()}>
          {children}
        </TabManager>
      </SessionGate>
    ),
  };
};
