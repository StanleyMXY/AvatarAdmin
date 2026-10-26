import { getToken } from '../request/session';
import { getAdminMeta, getMe } from '../services/auth';
import type { SessionState } from './state';

/**
 * The session as the server sees it now: the account (`GET /me`) and, unless the account must
 * change its password first (then the server refuses it), the shared values (`GET /meta`).
 * Without a token, or when the account cannot be read, the result is empty: a lost token has
 * already been reported to the session layer by the request layer.
 */
export async function loadSession(): Promise<SessionState> {
  if (getToken() === null) return {};
  let me: SessionState['me'];
  try {
    me = await getMe();
  } catch {
    return {};
  }
  const meta = me.mustChangePassword ? undefined : await getAdminMeta();
  return { me, meta };
}

let reading: Promise<SessionState['me'] | undefined> | undefined;

/**
 * Reads the account again (after a 403 the permissions on screen may be out of date). Many 403s
 * arriving together share one read. Resolves to undefined when it cannot be read.
 */
export function readMeAgain(): Promise<SessionState['me'] | undefined> {
  if (reading) return reading;
  reading = getMe()
    .catch(() => undefined)
    .finally(() => {
      reading = undefined;
    });
  return reading;
}
