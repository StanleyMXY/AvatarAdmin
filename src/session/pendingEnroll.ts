// The enrollment token and the authenticator address live here, in memory only: a reload of the
// enroll page loses them (the person signs in again), which is what the 10-minute single-use token
// is for. Neither is written to a storage, to the address, or to a log.

/** `redirect` is where the person was going when the sign-in began (checked again before use). */
export type PendingEnroll = { enrollToken: string; otpauthUri: string; redirect?: string | null };

let pending: PendingEnroll | undefined;

export function setPendingEnroll(next: PendingEnroll): void {
  pending = next;
}

export function getPendingEnroll(): PendingEnroll | undefined {
  return pending;
}

export function clearPendingEnroll(): void {
  pending = undefined;
}
