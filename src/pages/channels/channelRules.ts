// The rules of a channel package that the browser can check before it asks (contract 24.7). The
// backend checks them all again and has the last word.

export type RuleCheck = { ok: true } | { ok: false; reasonKey: string };

const ok: RuleCheck = { ok: true };
const bad = (reasonKey: string): RuleCheck => ({ ok: false, reasonKey });

// \n is a character of its own for `$` in some engines: the pattern is checked on the whole text.
const CODE = /^[a-z0-9_-]{2,32}$/;
// What the application id of Android and the bundle id of iOS are written with.
const PACKAGE_NAME = /^[A-Za-z0-9._-]+$/;

/** `^[a-z0-9_-]{2,32}$`, not the reserved `unknown`, and not a code the list has. */
export function checkChannelCode(code: string, existing: readonly string[]): RuleCheck {
  if (!CODE.test(code)) return bad('channels.rule.code');
  if (code === 'unknown') return bad('channels.rule.codeReserved');
  return existing.includes(code) ? bad('channels.rule.codeExists') : ok;
}

/** None (an empty text), or letters, digits, dots, hyphens and underscores. */
export function checkPackageName(name: string): RuleCheck {
  return name === '' || PACKAGE_NAME.test(name) ? ok : bad('channels.rule.packageName');
}

/** Which distributions a platform can have: a direct download is an Android file. */
export function distributionsFor(platform: 'ANDROID' | 'IOS' | undefined): {
  STORE: boolean;
  DIRECT: boolean;
} {
  return { STORE: true, DIRECT: platform !== 'IOS' };
}
