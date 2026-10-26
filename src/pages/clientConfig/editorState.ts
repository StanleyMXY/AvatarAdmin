import type { ClientConfigItem, ClientConfigValue } from '../../services/clientConfig';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';
import { isLanguageTag } from '../notifications/compose';
import { cleanValue, type ValueProblem, validateValue } from './valueRules';

/** One language of the key being edited; `locale` is `""` for the default value. */
export type Entry = { locale: string; value: unknown };
export type Draft = Entry[];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** What the editor of the type starts a language with. */
export function emptyValue(type: string): unknown {
  if (type === 'BOOLEAN') return false;
  if (type === 'INT') return null;
  return '';
}

/** The value in the form the editor of the type works with, whatever the backend sent. */
function forEditor(type: string, value: unknown): unknown {
  if (type === 'URL' || type === 'EMAIL' || type === 'STRING') {
    return typeof value === 'string' ? value : plainText(value);
  }
  if (type === 'BOOLEAN') return value === true;
  if (type === 'INT') return typeof value === 'number' ? value : null;
  return value;
}

const byLocale = (a: Entry, b: Entry) => {
  if (a.locale === b.locale) return 0;
  if (a.locale === '') return -1;
  if (b.locale === '') return 1;
  return a.locale < b.locale ? -1 : 1;
};

/** The languages of a key to edit: the default first, then the others by tag. */
export function draftOf(item: Pick<ClientConfigItem, 'type' | 'values'>): Draft {
  if (!isPlainObject(item.values)) return [];
  return Object.entries(item.values)
    .map(([locale, value]) => ({ locale, value: forEditor(item.type, value) }))
    .sort(byLocale);
}

/**
 * The map that `PUT` takes: every language, as a whole. A language that has no value yet (an empty
 * number box) is left out; `problemsOf` is what says it cannot be saved.
 */
export function valuesOf(type: string, draft: Draft): Record<string, ClientConfigValue> {
  return Object.fromEntries(
    draft
      .filter((entry) => entry.value !== null && entry.value !== undefined)
      .map((entry) => [entry.locale, cleanValue(type, entry.value) as ClientConfigValue]),
  );
}

export type EntryProblem = { locale: string | null; reason: ValueProblem };

/** Every language is checked; the key can be saved only when the list is empty. A key with no language at all is refused too. */
export function problemsOf(type: string, draft: Draft): EntryProblem[] {
  if (draft.length === 0) return [{ locale: null, reason: 'EMPTY_NOT_ALLOWED' }];
  const problems: EntryProblem[] = [];
  for (const entry of draft) {
    const reason = validateValue(type, entry.value);
    if (reason !== null) problems.push({ locale: entry.locale, reason });
  }
  return problems;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Whether the draft differs from what the item holds now (the order of the languages does not count). */
export function isChanged(item: Pick<ClientConfigItem, 'type' | 'values'>, draft: Draft): boolean {
  const before = draftOf(item);
  if (before.length !== draft.length) return true;
  return draft.some((entry) => {
    const old = before.find((e) => e.locale === entry.locale);
    return old === undefined || !same(old.value, entry.value);
  });
}

export const setValue = (draft: Draft, locale: string, value: unknown): Draft =>
  draft.map((entry) => (entry.locale === locale ? { ...entry, value } : entry));

export const removeLanguage = (draft: Draft, locale: string): Draft =>
  draft.filter((entry) => entry.locale !== locale);

export type AddLanguage =
  | { ok: true; draft: Draft }
  | { ok: false; problem: 'INVALID_LANGUAGE_TAG' | 'DUPLICATE' };

/**
 * Adds a language with an empty value. A tag the contract does not allow, or one that is in the
 * draft already (in any case), is refused. With `allowDefault` an empty tag adds the default value.
 */
export function addLanguage(
  draft: Draft,
  raw: string,
  options: { allowDefault?: boolean; initial?: unknown } = {},
): AddLanguage {
  const tag = trimSpec(raw);
  const isDefault = tag === '' && options.allowDefault === true;
  if (!isDefault && !isLanguageTag(tag)) return { ok: false, problem: 'INVALID_LANGUAGE_TAG' };
  if (draft.some((entry) => entry.locale.toLowerCase() === tag.toLowerCase())) {
    return { ok: false, problem: 'DUPLICATE' };
  }
  // `initial` may be null (an empty number box), which is not the same as not given.
  const entry: Entry = { locale: tag, value: 'initial' in options ? options.initial : '' };
  return { ok: true, draft: isDefault ? [entry, ...draft] : [...draft, entry] };
}
