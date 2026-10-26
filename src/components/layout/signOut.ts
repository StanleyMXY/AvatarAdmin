import { history } from '@umijs/max';
import { clearToken } from '../../request/session';
import { TABS_STORAGE_KEY } from './TabManager';

/** Forgets the token and the remembered tabs and goes to the sign-in page. */
export function signOut(): void {
  clearToken();
  try {
    localStorage.removeItem(TABS_STORAGE_KEY);
  } catch {
    // nothing remembered, or storage is not available
  }
  history.replace('/user/login');
}
