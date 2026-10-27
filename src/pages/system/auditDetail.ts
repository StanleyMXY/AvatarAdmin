import { plainText } from '../../utils/plainText';

/** What stands in the place of a text that belongs to a credential. */
export const HIDDEN = '********';

const MAX_DEPTH = 12;
const CUT = '…';

// ---- which keys name a credential ----

// Written in the forms a key can take after `fold`: lower case, no accents or other combining marks,
// and nothing but letters. A part is found anywhere in the key ("newPassword", "facebookAccessToken").
const CREDENTIAL_PARTS = [
  // English
  'password',
  'passwd',
  'passcode',
  'passphrase',
  'secret',
  'token',
  'credential',
  'authorization',
  'apikey',
  'privatekey',
  'cookie',
  'signature',
  'totp',
  // Russian, Thai, Arabic, Spanish, Indonesian, Vietnamese, Chinese
  'пароль',
  'секрет',
  'токен',
  'รหัสผ่าน',
  'รหัสลับ',
  'كلمةالمرور',
  'كلمةالسر',
  'contrasena',
  'katasandi',
  'matkhau',
  '密码',
  '密碼',
  '口令',
  '令牌',
  '密钥',
  '密鑰',
];
// Short words: a whole word of the key is compared (an "otp" inside "footprint" is not one).
const CREDENTIAL_WORDS = new Set(['pwd', 'otp', 'pass', 'pin']);
// "code" names a credential only together with one of these ("verificationCode"); a permission code,
// an error code or a country code is not one.
const CODE_WORDS = new Set(['code', 'codes']);
const CODE_CONTEXT = new Set([
  'verify',
  'verification',
  'sms',
  'mail',
  'email',
  'phone',
  'mfa',
  'totp',
  'otp',
  '2fa',
  'auth',
  'captcha',
  'security',
  'confirm',
  'confirmation',
  'reset',
  'recovery',
  'backup',
  'login',
  'activation',
]);
const NOT_A_CREDENTIAL_CODE = new Set([
  'country',
  'area',
  'dial',
  'error',
  'status',
  'http',
  'language',
  'currency',
  'region',
]);

/** Lower case, without accents and other combining marks, nothing but letters. */
const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}]/gu, '');
const FOLDED_PARTS = CREDENTIAL_PARTS.map(fold);

const wordsOf = (key: string): string[] =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

function isCredentialKey(key: string): boolean {
  const letters = fold(key);
  if (FOLDED_PARTS.some((part) => letters.includes(part))) return true;
  const words = wordsOf(key);
  if (words.some((word) => CREDENTIAL_WORDS.has(word))) return true;
  return (
    words.some((word) => CODE_WORDS.has(word)) &&
    words.some((word) => CODE_CONTEXT.has(word)) &&
    !words.some((word) => NOT_A_CREDENTIAL_CODE.has(word))
  );
}

// Next to the key and the value of a change there can be a name of the setting: { key: "sms.api_secret",
// old: "a", new: "b" }. When that name is a credential, the old and the new value are hidden.
const LABEL_KEYS = new Set([
  'key',
  'name',
  'field',
  'property',
  'attribute',
  'param',
  'parameter',
  'setting',
  'item',
  'config',
]);
const VALUE_WORDS = new Set([
  'old',
  'new',
  'value',
  'values',
  'from',
  'to',
  'before',
  'after',
  'previous',
  'prev',
  'current',
  'next',
]);

function namesCredential(object: Record<string, unknown>): boolean {
  return Object.entries(object).some(
    ([key, value]) =>
      LABEL_KEYS.has(key.toLowerCase()) && typeof value === 'string' && isCredentialKey(value),
  );
}
const isValueKey = (key: string): boolean => wordsOf(key).some((word) => VALUE_WORDS.has(word));

// ---- credentials in free text ----

// The same words as they are written, for text: "password=abc", "token: abc", "Authorization: Bearer abc",
// "password is abc", "密码：abc".
const TEXT_PARTS = [
  'password',
  'passwd',
  'passcode',
  'passphrase',
  'secret',
  'token',
  'credential',
  'authorization',
  'api[_ -]?key',
  'private[_ -]?key',
  'cookie',
  'signature',
  'totp',
  'пароль',
  'секрет',
  'токен',
  'รหัสผ่าน',
  'รหัสลับ',
  'كلمة\\s*المرور',
  'كلمة\\s*السر',
  'contraseña',
  'contrasena',
  'kata\\s*sandi',
  'mật\\s*khẩu',
  '密码',
  '密碼',
  '口令',
  '令牌',
  '密钥',
  '密鑰',
];
// Whole words only.
const TEXT_WORDS = [
  'otp',
  'pin',
  'pwd',
  '(?:verification|verify|security|login|reset|recovery|backup|sms|email)[_ -]?code',
];
// The rest of the name after the word ("passwordChangedAt", "token_v2"); a key is short, and the bound keeps
// the search linear on a long text. What stands before the word is not needed: "newPassword=x" is found at
// "Password".
const AFTER = '[\\p{L}\\p{N}_.-]{0,40}';
const KEY_NAME = `(?:${TEXT_PARTS.join('|')})${AFTER}|(?<![\\p{L}\\p{N}])(?:${TEXT_WORDS.join('|')})`;
const TEXT_PAIR = new RegExp(
  `(?<head>["']?(?<key>${KEY_NAME})(?![\\p{L}\\p{N}])["']?(?:\\s*[:：=]\\s*|\\s+is\\s+))` +
    `(?:(?:bearer|basic|digest|token)\\s+)?` +
    `(?:"(?<dq>[^"]*)(?<dqEnd>")?|'(?<sq>[^']*)(?<sqEnd>')?|(?<bare>[^\\s,;"'}\\]]+))`,
  'giu',
);
// "https://user:secret@host/": the part after the colon of the user information.
const ADDRESS_USER = /(\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]*:)([^\s@/]+)(@)/gi;
// A value that is a flag, or a number of a key that counts something, is not a credential.
const FLAG = /^(?:true|false|null|undefined)$/i;
const COUNTING_WORDS = new Set([
  'version',
  'count',
  'length',
  'ttl',
  'seconds',
  'minutes',
  'hours',
  'days',
  'max',
  'min',
  'limit',
  'attempts',
]);

function maskPairs(text: string): string {
  return text
    .replace(ADDRESS_USER, `$1${HIDDEN}$3`)
    .replace(TEXT_PAIR, (whole, ...rest: unknown[]) => {
      const groups = rest[rest.length - 1] as Record<string, string | undefined>;
      const { head = '', key = '', dq, dqEnd, sq, sqEnd, bare } = groups;
      if (dq !== undefined) return `${head}"${HIDDEN}${dqEnd ?? ''}`;
      if (sq !== undefined) return `${head}'${HIDDEN}${sqEnd ?? ''}`;
      const value = bare ?? '';
      if (FLAG.test(value)) return whole;
      const last = wordsOf(key).at(-1) ?? '';
      if (/^\d+$/.test(value) && COUNTING_WORDS.has(last)) return whole;
      return `${head}${HIDDEN}`;
    });
}

function maskText(text: string): string {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.stringify(maskDetail(JSON.parse(text)));
    } catch {
      // not JSON after all (or cut off): it is text
    }
  }
  return maskPairs(text);
}

/**
 * A copy of the detail of an audit row in which the text that belongs to a credential is replaced:
 * a string under a key that names a password, secret, token, verification code and the like, at any
 * depth (also when the key sits in another language), the old and new text of a setting whose name is
 * such a key, and the same words with a value in plain text. Only text is replaced: a number, a flag
 * or an empty value keeps what it is, so `tokenVersion: 3` and `mustChangePassword: true` stay readable.
 * This is the second line, as well as it can be done: the backend is not meant to write a credential
 * into the detail, and the question to the backend stays open. Nothing is changed in the value given.
 */
export function maskDetail(value: unknown, depth = 0, credential = false): unknown {
  if (depth > MAX_DEPTH) return CUT;
  if (typeof value === 'string') return credential ? HIDDEN : maskText(value);
  if (Array.isArray(value)) return value.map((item) => maskDetail(item, depth + 1, credential));
  if (typeof value === 'object' && value !== null) {
    const object = value as Record<string, unknown>;
    const named = namesCredential(object);
    const copy: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(object)) {
      copy[key] = maskDetail(
        item,
        depth + 1,
        credential || isCredentialKey(key) || (named && isValueKey(key)),
      );
    }
    return copy;
  }
  return value;
}

/**
 * The detail as one text for a table cell: text as it is, other values written out (objects and lists
 * as JSON), nothing as an empty text; text that belongs to a credential hidden. Never throws.
 */
export function detailText(value: unknown): string {
  try {
    return plainText(maskDetail(value));
  } catch {
    return '';
  }
}
