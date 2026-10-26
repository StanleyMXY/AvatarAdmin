/**
 * Is `target` the signed-in administrator? The account id decides when both sides have one; when
 * either side lacks an id the user names are compared (they are unique without regard to case,
 * contract 18). When nothing is known about the signed-in administrator every row counts as the
 * own one: the protections of the own account are the ones to keep when in doubt.
 */
export function isOwnAccount(
  me: { id?: string; username?: string } | undefined,
  target: { id?: string; username?: string },
): boolean {
  // An id can arrive as a number on one side and as text on the other: they are compared as text.
  const idOf = (value: unknown): string =>
    value === undefined || value === null ? '' : String(value);
  const meId = idOf(me?.id);
  const targetId = idOf(target.id);
  const meName = me?.username;
  if (!meId && !meName) return true;
  if (meId && targetId) return meId === targetId;
  if (meName && target.username) return meName.toLowerCase() === target.username.toLowerCase();
  return false;
}
