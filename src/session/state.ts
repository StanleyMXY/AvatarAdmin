import type { AdminMeta, Me } from '../services/auth';

/** What the app knows about the signed-in administrator; Umi keeps it as the initial state. */
export type SessionState = {
  me?: Me;
  meta?: Partial<AdminMeta>;
  /**
   * The token is still held but the account could not be read (network, time limit, the gateway's
   * own page, or the backend's own error). Not signed out: the page offers a retry and a sign-out.
   */
  unavailable?: boolean;
};
