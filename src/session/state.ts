import type { AdminMeta, Me } from '../services/auth';

/** What the app knows about the signed-in administrator; Umi keeps it as the initial state. */
export type SessionState = {
  me?: Me;
  meta?: Partial<AdminMeta>;
  /**
   * The token is still held but the account could not be read because the service could not be
   * reached (network, time limit, the gateway's own page). Not signed out: the page offers a retry.
   */
  unavailable?: boolean;
};
