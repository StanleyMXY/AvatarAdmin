export const LOGIN_PATH = '/user/login';
export const ENROLL_PATH = '/user/enroll';
export const CHANGE_PASSWORD_PATH = '/user/change-password';
export const DEFAULT_RETURN = '/dashboard';

const AUTH_PATHS = [LOGIN_PATH, ENROLL_PATH, CHANGE_PASSWORD_PATH];

/** A path as the router sees it: no query or fragment, lower case, no repeated, `.` or trailing slashes. */
export function normalizePath(path: string): string {
  const bare = path.split(/[?#]/)[0].toLowerCase();
  const parts = bare.split('/').filter((part) => part !== '' && part !== '.');
  return `/${parts.join('/')}`;
}

const isAuthPath = (path: string) => AUTH_PATHS.includes(normalizePath(path));

/**
 * Where to go after signing in: a path of this site that starts with exactly one `/`. Anything
 * that could leave the site (`//host`, a scheme, a backslash, a control character or space) and the
 * sign-in pages themselves give the overview.
 */
export function safeReturnUrl(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return DEFAULT_RETURN;
  if (!raw.startsWith('/') || raw.startsWith('//')) return DEFAULT_RETURN;
  // Control characters, spaces before the first `?` and backslashes can be read as another address.
  const beforeQuery = raw.split('?')[0];
  // biome-ignore lint/suspicious/noControlCharactersInRegex: the point is to refuse control characters
  if (/[\u0000-\u001f\u007f\\]/.test(raw) || /\s/.test(beforeQuery)) return DEFAULT_RETURN;
  // An encoded backslash or slash right after the first `/` is refused as well: some servers decode it.
  if (/^\/(%5c|%2f)/i.test(raw)) return DEFAULT_RETURN;
  if (isAuthPath(raw)) return DEFAULT_RETURN;
  return raw;
}

/** The sign-in address that brings the person back to the page they were on. */
export function loginUrl(pathname: string, search: string): string {
  const here = `${pathname}${search}`;
  if (
    normalizePath(pathname) === '/' ||
    normalizePath(pathname) === DEFAULT_RETURN ||
    isAuthPath(here)
  ) {
    return LOGIN_PATH;
  }
  return `${LOGIN_PATH}?redirect=${encodeURIComponent(here)}`;
}

type GateSession = { me: { mustChangePassword: boolean } | undefined };

/**
 * The address a person must be sent to from `location`, or null when they may stay. Not signed in:
 * the sign-in page. Must change the password: only the change-password page is open to them.
 */
export function gateFor(
  location: { pathname: string; search: string },
  session: GateSession,
): string | null {
  const { pathname, search } = location;
  if (!session.me) return loginUrl(pathname, search);
  if (session.me.mustChangePassword) {
    return normalizePath(pathname) === CHANGE_PASSWORD_PATH ? null : CHANGE_PASSWORD_PATH;
  }
  if (normalizePath(pathname) === CHANGE_PASSWORD_PATH) return DEFAULT_RETURN;
  return null;
}
