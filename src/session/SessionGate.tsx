import { history, useLocation, useModel } from '@umijs/max';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { loadSession } from './loadSession';
import { gateFor } from './returnUrl';
import { ServiceUnavailable } from './ServiceUnavailable';
import type { SessionState } from './state';

/**
 * Shows its children only to someone who may be on this page: signed in, and not obliged to change
 * the password first. Anyone else is sent where `gateFor` says and sees nothing meanwhile. A person
 * whose account could not be read because the service is unreachable is still signed in: they see
 * the notice with a retry instead of the sign-in page, at the same address.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const { initialState, setInitialState } = useModel('@@initialState');
  const { pathname, search } = useLocation();
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
    try {
      await setInitialState(await loadSession());
    } finally {
      reading.current = false;
      setRetrying(false);
    }
  }, [setInitialState]);

  if (unavailable) return <ServiceUnavailable onRetry={retry} retrying={retrying} />;
  return target ? null : children;
}
