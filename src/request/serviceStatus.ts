// Whether the gateway in front of the backend has recently answered with its own "unavailable"
// page (502, 503, 504) to a read. The shell shows one notice with a retry button while it is so;
// nothing here is stored or sent anywhere.

let unavailable = false;
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

export const isServiceUnavailable = (): boolean => unavailable;

export function subscribeServiceStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function markServiceUnavailable(): void {
  if (unavailable) return;
  unavailable = true;
  notify();
}

export function markServiceReachable(): void {
  if (!unavailable) return;
  unavailable = false;
  notify();
}

/** Test helper: back to "reachable" without telling anyone. */
export function resetServiceStatus(): void {
  unavailable = false;
  notify();
}
