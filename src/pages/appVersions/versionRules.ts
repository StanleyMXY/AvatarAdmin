import { trimSpec } from '../../utils/trimSpec';

// The rules of a version that the browser can check before it asks (contract 24.1 and 24.2). The
// backend checks them all again and has the last word; the number of the version that is active is
// only what the list showed a moment ago.

export type Texts = Record<string, string>;

export type RuleCheck =
  | { ok: true }
  | { ok: false; reasonKey: string; values?: Record<string, number> };

const ok: RuleCheck = { ok: true };
const bad = (reasonKey: string, values?: Record<string, number>): RuleCheck =>
  values ? { ok: false, reasonKey, values } : { ok: false, reasonKey };

const rule = (name: string) => `appVersions.rule.${name}`;
const wholeFrom1 = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
const known = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** `x.y.z`: three numbers of ASCII digits with dots. The text is checked as it is, not trimmed. */
export function checkVersionName(value: string): RuleCheck {
  return /^\d+\.\d+\.\d+$/.test(value) ? ok : bad(rule('versionName'));
}

/** A whole number from 1, and strictly above the version number that is active in the channel (when that is known). */
export function checkVersionCode(value: unknown, activeCode: number | null): RuleCheck {
  if (!wholeFrom1(value)) return bad(rule('versionCodeWhole'));
  if (known(activeCode) && value <= activeCode) {
    return bad(rule('versionCodeAbove'), { active: activeCode });
  }
  return ok;
}

/** A whole number from 1 that is not above the version number (when that is known). */
export function checkMinVersionCode(value: unknown, versionCode: number | null): RuleCheck {
  if (!wholeFrom1(value)) return bad(rule('minWhole'));
  if (known(versionCode) && value > versionCode) {
    return bad(rule('minAbove'), { versionCode });
  }
  return ok;
}

/** The update notes need English (`en`), and it must not be blank. */
export function checkChangelog(texts: Texts | null | undefined): RuleCheck {
  const en = texts?.en;
  return typeof en === 'string' && trimSpec(en) !== '' ? ok : bad(rule('changelogEn'));
}

/** The notes to send: trimmed with the contract's set, the languages left empty left out. */
export function cleanChangelog(texts: Texts | null | undefined): Texts {
  const result: Texts = {};
  for (const [tag, text] of Object.entries(texts ?? {})) {
    const trimmed = trimSpec(typeof text === 'string' ? text : '');
    if (trimmed !== '') result[tag] = trimmed;
  }
  return result;
}

/** The language tabs of the notes: English first, the supported languages, then any language the notes already have. */
export function changelogTags(
  supported: readonly string[] | null | undefined,
  texts: Texts | null | undefined,
): string[] {
  return [...new Set(['en', ...(supported ?? []), ...Object.keys(texts ?? {})])];
}
