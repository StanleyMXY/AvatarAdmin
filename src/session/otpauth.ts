/**
 * The key to type into an authenticator by hand, read from the `otpauth://` address the server sent
 * for the QR code (its `secret` parameter, base32). Null when there is none that can be used, so
 * the page offers nothing rather than something wrong. Spaces and dashes are taken out and the
 * padding dropped, because authenticators accept the key without them.
 */
export function setupKeyOf(otpauthUri: unknown): string | null {
  if (typeof otpauthUri !== 'string') return null;
  let url: URL;
  try {
    url = new URL(otpauthUri);
  } catch {
    return null;
  }
  if (url.protocol !== 'otpauth:') return null;
  const secret = (url.searchParams.get('secret') ?? '')
    .replace(/[\s-]/g, '')
    .replace(/=+$/, '')
    .toUpperCase();
  return /^[A-Z2-7]+$/.test(secret) ? secret : null;
}

/** The key in groups of four letters, the way it is read aloud and typed. */
export function groupKey(key: string): string {
  return key.replace(/(.{4})(?=.)/g, '$1 ');
}
