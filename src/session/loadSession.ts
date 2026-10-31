import { forgetTabs } from '../components/layout/signOut';
import { getToken } from '../request/session';
import { getAdminMeta, getMe } from '../services/auth';
import type { SessionState } from './state';

/**
 * The session as the server sees it now: the account (`GET /me`) and, unless the account must
 * change its password first (then the server refuses it), the shared values (`GET /meta`).
 * The result is for the token held when the read began. If that token is gone or was replaced
 * meanwhile (the person signed out, the server refused it, another account signed in) there is no
 * session to describe: the result is empty and nothing more is asked, and a caller that compares
 * the token after the call (see `SessionGate` and `useSession.establish`) does not use it.
 * Without a token the result is empty too. When the token is still held but the account cannot be
 * read (network, time limit, the gateway's page, or the backend's own error) the result is
 * `{ unavailable: true }`: only a token the server refused signs the person out, so here the token
 * stays and reading again may work.
 */
export async function loadSession(): Promise<SessionState> {
  const started = getToken();
  if (started === null) return {};
  let me: SessionState['me'];
  try {
    me = await getMe();
  } catch {
    if (getToken() !== started) return tokenChanged();
    // The token is still held and nobody said it is void: an account that cannot be read is not the
    // same as being signed out. The token stays; the page offers to read again, or to sign out.
    return { unavailable: true };
  }
  if (getToken() !== started) return tokenChanged();
  const meta = me.mustChangePassword ? undefined : await getAdminMeta();
  // The token can be refused between the two reads: then there is no session to show.
  if (getToken() !== started) return tokenChanged();
  return { me, meta };
}

/**
 * The token is not the one the read began with. A token that is gone (refused by the server) takes
 * the tabs of that account with it; a token that was replaced belongs to an account that is
 * signing in now, whose tabs are not ours to forget.
 */
function tokenChanged(): SessionState {
  if (getToken() === null) forgetTabs();
  return {};
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
