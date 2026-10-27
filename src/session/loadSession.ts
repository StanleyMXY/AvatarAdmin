import { forgetTabs } from '../components/layout/signOut';
import { isServiceUnreachable } from '../request/errors';
import { getToken } from '../request/session';
import { getAdminMeta, getMe } from '../services/auth';
import type { SessionState } from './state';

/**
 * The session as the server sees it now: the account (`GET /me`) and, unless the account must
 * change its password first (then the server refuses it), the shared values (`GET /meta`).
 * Without a token, or when the account cannot be read, the result is empty: a lost token has
 * already been reported to the session layer by the request layer. When the token is still held
 * but the service cannot be reached (network, time limit, the gateway's page) the result is
 * `{ unavailable: true }`: not signed out, the token stays, and reading again may work.
 */
export async function loadSession(): Promise<SessionState> {
  if (getToken() === null) return {};
  let me: SessionState['me'];
  try {
    me = await getMe();
  } catch (error) {
    // A token the server refused is gone now; the tabs of that account are not kept for the next one.
    if (getToken() === null) {
      forgetTabs();
      return {};
    }
    // The token is still held and nobody said it is void: the service could not be reached, which
    // is not the same as being signed out. The token stays; the page offers to read again.
    return isServiceUnreachable(error) ? { unavailable: true } : {};
  }
  const meta = me.mustChangePassword ? undefined : await getAdminMeta();
  // The token can be refused between the two reads: then there is no session to show.
  if (getToken() === null) {
    forgetTabs();
    return {};
  }
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
