import { plainText } from '../../utils/plainText';

/** What stands in the place of a value that belongs to a credential. */
export const HIDDEN = '********';

const MAX_DEPTH = 12;
const CUT = '…';

// Keys, with everything but letters taken out and in lower case, that name a credential. A whole word
// is compared for the short ones (an "otp" inside "footprint" is not one).
const CREDENTIAL_PARTS = [
  'password',
  'passwd',
  'secret',
  'token',
  'credential',
  'authorization',
  'apikey',
  'privatekey',
  'cookie',
  'signature',
  'totp',
];
const CREDENTIAL_WORDS = new Set(['pwd', 'otp', 'pass']);

function isCredentialKey(key: string): boolean {
  const letters = key.toLowerCase().replace(/[^a-z]/g, '');
  if (CREDENTIAL_PARTS.some((part) => letters.includes(part))) return true;
  // camelCase and snake_case words: "userOtp", "otp_code"
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/);
  return words.some((word) => CREDENTIAL_WORDS.has(word));
}

// "password=abc", "token: abc", "apiKey = abc" inside free text: the value up to the next white space or comma.
const KEY_VALUE = new RegExp(
  `\\b((?:[A-Za-z]*(?:${CREDENTIAL_PARTS.join('|')})[A-Za-z]*)\\s*[:=]\\s*)([^\\s,;]+)`,
  'gi',
);

function maskText(text: string): string {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.stringify(maskDetail(JSON.parse(text)));
    } catch {
      // not JSON after all: it is text
    }
  }
  return text.replace(KEY_VALUE, `$1${HIDDEN}`);
}

/**
 * A copy of the detail of an audit row with every value that belongs to a credential replaced:
 * the value of a key that names a password, secret, token and the like, at any depth, and the same
 * words with a value in plain text. The backend is not meant to write such values into the detail; this
 * is the second line, so that a row that has one anyway is not shown. Nothing is changed in the value
 * given.
 */
export function maskDetail(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return CUT;
  if (typeof value === 'string') return maskText(value);
  if (Array.isArray(value)) return value.map((item) => maskDetail(item, depth + 1));
  if (typeof value === 'object' && value !== null) {
    const copy: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      copy[key] = isCredentialKey(key) ? HIDDEN : maskDetail(item, depth + 1);
    }
    return copy;
  }
  return value;
}

/**
 * The detail as one text for a table cell: text as it is, other values written out (objects and lists
 * as JSON), nothing as an empty text; credentials hidden. Never throws.
 */
export function detailText(value: unknown): string {
  try {
    return plainText(maskDetail(value));
  } catch {
    return '';
  }
}
