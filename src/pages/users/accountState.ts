// The operation matrix of the account states (contract 17.4, "账号状态与后台操作"): which write the
// backend takes for which `User.status`. The buttons follow it, so an administrator is not offered
// what would only come back as 409 INVALID_STATE or 403 ACCOUNT_DELETION_SCHEDULED / ACCOUNT_DELETING.
// A status that is not one of the four is not offered a write that needs a known state.

type Status = string | null | undefined;

/** Ban: only an active account. */
export const canBan = (status: Status): boolean => status === 'ACTIVE';

/** Unban: only a banned account. */
export const canUnban = (status: Status): boolean => status === 'BANNED';

/** Start a deletion: an active or a banned account (the ban comes back if the deletion is cancelled). */
export const canStartDeletion = (status: Status): boolean =>
  status === 'ACTIVE' || status === 'BANNED';

/** Cancel a deletion: only while the account waits in its grace period. */
export const canCancelDeletion = (status: Status): boolean => status === 'PENDING_DELETION';

/** The account waits for deletion or is being deleted. */
export const waitsOrRuns = (status: Status): boolean =>
  status === 'PENDING_DELETION' || status === 'DELETING';

/** A new limited-time entitlement is refused (403 ACCOUNT_DELETION_SCHEDULED / ACCOUNT_DELETING). */
export const grantBlocked = waitsOrRuns;

/** A new credit adjustment request is refused for the same two states. */
export const newRequestBlocked = waitsOrRuns;

/** Revoking an entitlement still works in the grace period and is refused only while the account is being deleted. */
export const revokeBlocked = (status: Status): boolean => status === 'DELETING';
