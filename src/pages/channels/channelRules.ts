// The rules of a channel package that the browser can check before it asks (contract 24.7). The
// backend checks them all again and has the last word. Its 400 for a channel has no `ref` and no
// reason code (answers 90), so these are the only place a field gets its own words.

import { countCodePoints } from '../../utils/codePoints';
import { trimSpec } from '../../utils/trimSpec';

export type RuleCheck = { ok: true } | { ok: false; reasonKey: string };

const ok: RuleCheck = { ok: true };
const bad = (reasonKey: string): RuleCheck => ({ ok: false, reasonKey });

// Anchored at both ends and checked on the whole text. In JavaScript `$` does not match before a
// final line break, so 'ab\n' is refused.
const CODE = /^[a-z0-9_-]{2,32}$/;
// What the application id of Android and the bundle id of iOS are written with.
const PACKAGE_NAME = /^[A-Za-z0-9._-]+$/;

/** `^[a-z0-9_-]{2,32}$`, not the reserved `unknown`, and not a code the list has. */
export function checkChannelCode(code: string, existing: readonly string[]): RuleCheck {
  if (!CODE.test(code)) return bad('channels.rule.code');
  if (code === 'unknown') return bad('channels.rule.codeReserved');
  return existing.includes(code) ? bad('channels.rule.codeExists') : ok;
}

/** The most code points a name has (answers 90) and the most characters a package name has. */
export const NAME_MAX = 64;
export const PACKAGE_NAME_MAX = 255;

/** 1 to 64 code points after the ends are cut (the way the backend counts), not blank. */
export function checkChannelName(name: string): RuleCheck {
  const cut = trimSpec(name);
  if (cut === '') return bad('channels.rule.nameRequired');
  return countCodePoints(cut) > NAME_MAX ? bad('channels.rule.nameTooLong') : ok;
}

/** None (an empty text), or at most 255 letters, digits, dots, hyphens and underscores. */
export function checkPackageName(name: string): RuleCheck {
  if (name.length > PACKAGE_NAME_MAX) return bad('channels.rule.packageTooLong');
  return name === '' || PACKAGE_NAME.test(name) ? ok : bad('channels.rule.packageName');
}

/** Which distributions a platform can have: a direct download is an Android file. */
export function distributionsFor(platform: 'ANDROID' | 'IOS' | undefined): {
  STORE: boolean;
  DIRECT: boolean;
} {
  return { STORE: true, DIRECT: platform !== 'IOS' };
}
