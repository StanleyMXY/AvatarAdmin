import { countCodePoints } from '../../utils/codePoints';
import { trimSpec } from '../../utils/trimSpec';

// The rules of a version that the browser can check before it asks (contract 24.1 and 24.2). The
// backend checks them all again and has the last word; the number of the version that is active is
// only what the list showed a moment ago.

export type Texts = Record<string, string>;

export type RuleCheck =
  | { ok: true }
  | { ok: false; reasonKey: string; values?: Record<string, number | string> };

const ok: RuleCheck = { ok: true };
const bad = (reasonKey: string, values?: Record<string, number | string>): RuleCheck =>
  values ? { ok: false, reasonKey, values } : { ok: false, reasonKey };

const rule = (name: string) => `appVersions.rule.${name}`;
/** The numbers of a version are 32-bit integers in the backend (answers 91): from 1 to 2147483647, not up to 2^53 - 1. */
export const MAX_CODE = 2_147_483_647;
const wholeFrom1 = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= MAX_CODE;
const known = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const VERSION_NAME_MAX = 32;

/** `x.y.z`: three numbers of ASCII digits with dots, at most 32 characters. The text is checked as it is, not trimmed. */
export function checkVersionName(value: string): RuleCheck {
  return /^\d+\.\d+\.\d+$/.test(value) && value.length <= VERSION_NAME_MAX
    ? ok
    : bad(rule('versionName'));
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

/** A language key of the notes: a language of 2 or 3 letters and subtags of 2 to 8 characters, at most 35 in all. */
const LANGUAGE_KEY = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const LANGUAGE_KEY_MAX = 35;
const LANGUAGES_MAX = 30;
const NOTE_MAX = 4000;

/**
 * The update notes as the backend takes them (answers 91): an object of at most 30 languages, each
 * with a key of the form above and a text of 1 to 4000 code points, and English (`en`) not blank.
 * A language that is empty is not sent, so it is not counted. Any language is taken: the list of
 * supported languages is not asked. The first fault found is returned.
 */
export function checkChangelog(texts: Texts | null | undefined): RuleCheck {
  const sent = cleanChangelog(texts);
  const tags = Object.keys(sent);
  if (typeof sent.en !== 'string') return bad(rule('changelogEn'));
  if (tags.length > LANGUAGES_MAX) return bad(rule('changelogTooMany'));
  for (const tag of tags) {
    if (!LANGUAGE_KEY.test(tag) || tag.length > LANGUAGE_KEY_MAX) {
      return { ok: false, reasonKey: rule('changelogKey'), values: { tag } };
    }
    if (countCodePoints(sent[tag]) > NOTE_MAX) {
      return { ok: false, reasonKey: rule('changelogTooLong'), values: { tag } };
    }
  }
  return ok;
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
