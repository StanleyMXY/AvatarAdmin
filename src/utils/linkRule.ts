// Contract section 1.7: the one rule for every link the server hands to a client. The same
// reason codes come back from the backend in INVALID_REQUEST details, so one text per code
// (`reason.<code>`) serves the browser check and the backend answer.

export type LinkReasonKey =
  | 'NOT_HTTPS'
  | 'INVALID_HOST'
  | 'INVALID_PORT'
  | 'INVALID_PATH'
  | 'TOO_LONG';

export type LinkCheck = { ok: true } | { ok: false; reasonKey: LinkReasonKey };

export const DEFAULT_LINK_MAX_LENGTH = 2048;

const SCHEME = 'https://';
const HOST = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const IPV6 = /^\[[0-9A-Fa-f:.]*:[0-9A-Fa-f:.]*\]$/;
const PORT = /^[0-9]{1,5}$/;
// Printable ASCII, `!` to `~`, without the backslash.
const REST = /^[/?#][!-[\]-~]*$/;

/**
 * Checks `value` against the link rule. Checks run in the order scheme, host, port, path, then
 * total length, so a link with a structural fault gets that reason even when it is also too long.
 * `maxLength` is 2048 for configuration links (contract 1.7) and can be given for others.
 */
export function validateServerLink(value: string, opts: { maxLength?: number } = {}): LinkCheck {
  const maxLength = opts.maxLength ?? DEFAULT_LINK_MAX_LENGTH;
  if (!value.startsWith(SCHEME)) return fail('NOT_HTTPS');

  const afterScheme = value.slice(SCHEME.length);
  const authorityEnd = afterScheme.search(/[/?#]/);
  const authority = authorityEnd === -1 ? afterScheme : afterScheme.slice(0, authorityEnd);
  const rest = authorityEnd === -1 ? '' : afterScheme.slice(authorityEnd);

  if (authority.includes('@')) return fail('INVALID_HOST');

  let host: string;
  let port: string | null;
  if (authority.startsWith('[')) {
    const close = authority.indexOf(']');
    if (close === -1) return fail('INVALID_HOST');
    host = authority.slice(0, close + 1);
    const after = authority.slice(close + 1);
    if (after === '') port = null;
    else if (after.startsWith(':')) port = after.slice(1);
    else return fail('INVALID_HOST');
    if (!IPV6.test(host)) return fail('INVALID_HOST');
  } else {
    const colon = authority.indexOf(':');
    host = colon === -1 ? authority : authority.slice(0, colon);
    port = colon === -1 ? null : authority.slice(colon + 1);
    if (!HOST.test(host)) return fail('INVALID_HOST');
  }
  if (port !== null && !PORT.test(port)) return fail('INVALID_PORT');
  if (rest !== '' && !REST.test(rest)) return fail('INVALID_PATH');
  if (value.length > maxLength) return fail('TOO_LONG');
  return { ok: true };
}

function fail(reasonKey: LinkReasonKey): LinkCheck {
  return { ok: false, reasonKey };
}
