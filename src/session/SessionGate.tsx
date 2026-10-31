import { history, useLocation, useModel } from '@umijs/max';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '../request/session';
import { loadSession } from './loadSession';
import { gateFor } from './returnUrl';
import { ServiceUnavailable } from './ServiceUnavailable';
import type { SessionState } from './state';
import { useSession } from './useSession';

/**
 * Shows its children only to someone who may be on this page: signed in, and not obliged to change
 * the password first. Anyone else is sent where `gateFor` says and sees nothing meanwhile. A person
 * whose account could not be read (the network, the gateway or the backend failed) is still signed
 * in: they see the notice with a retry and a sign-out instead of the sign-in page, at the same
 * address.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const { initialState, setInitialState } = useModel('@@initialState');
  const { pathname, search } = useLocation();
  const { signOut } = useSession();
  const state = initialState as SessionState | undefined;
  const unavailable = !state?.me && state?.unavailable === true;
  const target = unavailable ? null : gateFor({ pathname, search }, { me: state?.me });
  useEffect(() => {
    if (target) history.replace(target);
  }, [target]);

  const [retrying, setRetrying] = useState(false);
  const reading = useRef(false);
  const retry = useCallback(async () => {
    if (reading.current) return;
    reading.current = true;
    setRetrying(true);
    const started = getToken();
    try {
      const next = await loadSession();
      // Another account may have signed in while this was on its way: what was read belongs to a
      // session that is over and must not be put in its place. (If the token is just gone, the
      // result is empty, which is the state of a person who is not signed in.)
      const now = getToken();
      if (now === null || now === started) await setInitialState(next);
    } finally {
      reading.current = false;
      setRetrying(false);
    }
  }, [setInitialState]);

  if (unavailable)
    return <ServiceUnavailable onRetry={retry} onSignOut={signOut} retrying={retrying} />;
  return target ? null : children;
}
