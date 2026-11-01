// The admin token lives in memory and in sessionStorage (so a reload of the tab keeps the
// session). It is never written to localStorage, a cookie or a url. Storage can be missing or
// refuse access (private windows, blocked site data), so every access is guarded and memory
// alone is enough.

const TOKEN_KEY = 'avatar-admin.token';

let memoryToken: string | null = null;
let hydrated = false;
let expiredLatch = false;
let handlers: SessionHandlers | null = null;

export type SessionHandlers = { onExpired: () => void; onForbidden: () => void };

export function getToken(): string | null {
  if (!hydrated) {
    hydrated = true;
    try {
      memoryToken = sessionStorage.getItem(TOKEN_KEY);
    } catch {
      memoryToken = null;
    }
  }
  return memoryToken;
}

export function setToken(token: string): void {
  hydrated = true;
  memoryToken = token;
  expiredLatch = false;
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // memory only
  }
}

export function clearToken(): void {
  hydrated = true;
  memoryToken = null;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // memory is already empty and is not refilled from storage after this point
  }
}

export function setSessionHandlers(next: SessionHandlers): void {
  handlers = next;
}

/**
 * Runs a handler of the shell. Its bug must not replace the answer of the request that reported
 * it (the caller would see the handler's error instead of an ApiError, and an upload would never
 * end), so it is logged, with the project tag and without any token, and not passed on.
 */
function runHandler(name: keyof SessionHandlers): void {
  try {
    handlers?.[name]();
  } catch (error) {
    console.error(
      `[avatar-admin] the session handler ${name} failed:`,
      error instanceof Error ? error.message : 'not an Error',
    );
  }
}

/**
 * A request that was sent with `sentToken` was answered ADMIN_INVALID_TOKEN. Clears the token and
 * calls `onExpired`, once however many requests report it. A report about a token that has been
 * replaced since (a slow answer arriving after a new login) is ignored.
 */
export function handleTokenExpired(sentToken: string | null): void {
  if (getToken() !== sentToken) return;
  clearToken();
  if (expiredLatch) return;
  expiredLatch = true;
  runHandler('onExpired');
}

/** A request was answered ADMIN_FORBIDDEN: the permissions the page shows may be out of date. */
export function handleForbidden(): void {
  runHandler('onForbidden');
}

/**
 * Test helper: forgets the in-memory state (token, handlers, "already read storage"). It does NOT
 * clear sessionStorage, so a token saved there is read back by the next getToken(). Signing out
 * is `clearToken()`.
 */
export function resetSessionState(): void {
  memoryToken = null;
  hydrated = false;
  expiredLatch = false;
  handlers = null;
}
