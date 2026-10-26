import { history } from '@umijs/max';
import { clearToken } from '../../request/session';
import { LOGIN_PATH } from '../../session/returnUrl';
import { TABS_STORAGE_KEY } from './TabManager';

/** Forgets the remembered tabs (paths of pages that belong to the account that is leaving). */
export function forgetTabs(): void {
  try {
    localStorage.removeItem(TABS_STORAGE_KEY);
  } catch {
    // nothing remembered, or storage is not available
  }
}

/** Forgets the token and the remembered tabs and goes to the sign-in page. */
export function signOut(): void {
  clearToken();
  forgetTabs();
  history.replace(LOGIN_PATH);
}
