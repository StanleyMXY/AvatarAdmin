import type { AdminMeta, Me } from '../services/auth';

/** What the app knows about the signed-in administrator; Umi keeps it as the initial state. */
export type SessionState = { me?: Me; meta?: Partial<AdminMeta> };
