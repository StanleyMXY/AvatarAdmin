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
  const meId = me?.id;
  const meName = me?.username;
  if (!meId && !meName) return true;
  if (meId && target.id) return meId === target.id;
  if (meName && target.username) return meName.toLowerCase() === target.username.toLowerCase();
  return false;
}
