import { history, useModel } from '@umijs/max';
import { useCallback, useEffect, useState } from 'react';
import { signOut as forgetSession } from '../components/layout/signOut';
import { clearToken, getToken, setToken } from '../request/session';
import type { AdminMeta } from '../services/auth';
import { loadSession, readMeAgain } from './loadSession';
import { clearPendingEnroll } from './pendingEnroll';
import { CHANGE_PASSWORD_PATH, DEFAULT_RETURN, safeReturnUrl } from './returnUrl';
import type { SessionState } from './state';

/**
 * The signed-in administrator. `establish(token)` is for the pages that have just received a
 * token (sign-in, enrollment): it keeps the token, reads the account and shows where to go next.
 */
export function useSession() {
  const { initialState, setInitialState } = useModel('@@initialState');
  const state = initialState as SessionState | undefined;

  const refreshPermissions = useCallback(async () => {
    const me = await readMeAgain();
    if (me) await setInitialState((previous) => ({ ...(previous ?? {}), me }));
  }, [setInitialState]);

  const signOut = useCallback(() => {
    clearPendingEnroll();
    void setInitialState({});
    forgetSession();
  }, [setInitialState]);

  const establish = useCallback(
    async (token: string, redirect?: string | null): Promise<string | undefined> => {
      setToken(token);
      const next = await loadSession();
      if (!next.me || getToken() === null) {
        // The token was given but the account cannot be read: do not stay half signed in.
        clearToken();
        return undefined;
      }
      clearPendingEnroll();
      await setInitialState(next);
      return next.me.mustChangePassword
        ? CHANGE_PASSWORD_PATH
        : safeReturnUrl(redirect ?? DEFAULT_RETURN);
    },
    [setInitialState],
  );

  /** The password was changed: every token is void now, so the person signs in again with the new one. */
  const finishPasswordChange = useCallback(() => {
    signOut();
  }, [signOut]);

  return {
    me: state?.me,
    meta: state?.meta,
    refreshPermissions,
    signOut,
    establish,
    finishPasswordChange,
  };
}

/** The shared values from `GET /meta`; empty when they could not be read. */
export function useAdminMeta(): Partial<AdminMeta> {
  const { initialState } = useModel('@@initialState');
  return (initialState as SessionState | undefined)?.meta ?? {};
}

/**
 * Navigates after a sign-in, but only once the account is in the app's state. Umi's state reaches
 * a page that mounts right after `setInitialState` one tick later; going at once would show the
 * next page an empty account and send the person back to sign-in.
 */
export function useGoWhenSignedIn(): (target: string) => void {
  const { me } = useSession();
  const [target, setTarget] = useState<string | undefined>();
  useEffect(() => {
    if (target !== undefined && me) history.replace(target);
  }, [target, me]);
  return setTarget;
}
