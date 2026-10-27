import { history, useLocation, useModel } from '@umijs/max';
import { type ReactNode, useEffect } from 'react';
import { gateFor } from './returnUrl';
import type { SessionState } from './state';

/**
 * Shows its children only to someone who may be on this page: signed in, and not obliged to change
 * the password first. Anyone else is sent where `gateFor` says and sees nothing meanwhile.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const { initialState } = useModel('@@initialState');
  const { pathname, search } = useLocation();
  const target = gateFor(
    { pathname, search },
    { me: (initialState as SessionState | undefined)?.me },
  );
  useEffect(() => {
    if (target) history.replace(target);
  }, [target]);
  return target ? null : children;
}
