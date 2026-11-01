// Whether the gateway in front of the backend has recently answered with its own "unavailable"
// page (502, 503, 504) to a read. The shell shows one notice with a retry button while it is so;
// nothing here is stored or sent anywhere.

// The reads that met the page and have not worked since, by `METHOD /path` (no query). The notice
// stays while there is one: another request that works says nothing about a read that did not.
const failing = new Set<string>();
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

export const isServiceUnavailable = (): boolean => failing.size > 0;

export function subscribeServiceStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** A read, named by `key`, met the gateway's page. */
export function markServiceUnavailable(key = ''): void {
  if (failing.has(key)) return;
  failing.add(key);
  if (failing.size === 1) notify();
}

/**
 * The read named by `key` worked (or got an answer of the backend itself). Without a key every read
 * is forgotten: the person left the page or pressed retry.
 */
export function markServiceReachable(key?: string): void {
  const had = failing.size > 0;
  if (key === undefined) failing.clear();
  else failing.delete(key);
  if (had && failing.size === 0) notify();
}

/** Test helper: back to "reachable" without telling anyone. */
export function resetServiceStatus(): void {
  failing.clear();
  notify();
}
