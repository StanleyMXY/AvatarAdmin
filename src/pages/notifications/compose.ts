import type { LinkTargetValue } from '../../components/LinkTargetField';
import type { SendNotificationBody } from '../../services/notifications';
import { countCodePoints } from '../../utils/codePoints';
import { trimSpec } from '../../utils/trimSpec';

/** Contract 25.3: a title is at most 100 and a body at most 500 code points, once trimmed. */
export const MAX_TITLE = 100;
export const MAX_BODY = 500;
const MAX_TAG = 35;
const TAG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/** The text of one language of the message. `en` is always the first entry. */
export type Entry = { locale: string; title: string; body: string };

/** Length of a text as the backend counts it: trimmed with the contract's whitespace, then code points. */
export const lengthOf = (text: string): number => countCodePoints(trimSpec(text));

export type EntryProblems = {
  title?: 'EMPTY_NOT_ALLOWED' | 'TOO_LONG';
  body?: 'EMPTY_NOT_ALLOWED' | 'TOO_LONG';
};

const problemOf = (text: string, max: number) => {
  const length = lengthOf(text);
  if (length === 0) return 'EMPTY_NOT_ALLOWED' as const;
  return length > max ? ('TOO_LONG' as const) : undefined;
};

/** What is wrong with the title and the body of one language: empty, or longer than the limit. */
export function entryProblems(entry: Entry): EntryProblems {
  const problems: EntryProblems = {};
  const title = problemOf(entry.title, MAX_TITLE);
  const body = problemOf(entry.body, MAX_BODY);
  if (title) problems.title = title;
  if (body) problems.body = body;
  return problems;
}

/** A language tag as the contract allows it (25.3): `^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$`, at most 35 characters. */
export const isLanguageTag = (tag: string): boolean => tag.length <= MAX_TAG && TAG.test(tag);

export type AddLanguage =
  | { ok: true; entries: Entry[] }
  | { ok: false; problem: 'INVALID_LANGUAGE_TAG' | 'DUPLICATE' };

/** Adds an empty language at the end. A tag that is there already (in any case) is refused. */
export function addLanguage(entries: Entry[], raw: string): AddLanguage {
  const tag = trimSpec(raw);
  if (!isLanguageTag(tag)) return { ok: false, problem: 'INVALID_LANGUAGE_TAG' };
  if (entries.some((e) => e.locale.toLowerCase() === tag.toLowerCase())) {
    return { ok: false, problem: 'DUPLICATE' };
  }
  return { ok: true, entries: [...entries, { locale: tag, title: '', body: '' }] };
}

/**
 * The request: the texts of every language trimmed (the backend stores the trimmed text), the
 * recipients as parsed, and the link only when there is one.
 */
export function buildSendBody(input: {
  ids: string[];
  entries: Entry[];
  link: LinkTargetValue;
  push: boolean;
}): SendNotificationBody {
  const body: SendNotificationBody = {
    accountIds: input.ids,
    titleI18n: Object.fromEntries(input.entries.map((e) => [e.locale, trimSpec(e.title)])),
    bodyI18n: Object.fromEntries(input.entries.map((e) => [e.locale, trimSpec(e.body)])),
    push: input.push,
  };
  if (input.link.linkType !== 'NONE') {
    body.linkType = input.link.linkType;
    body.linkTarget = trimSpec(input.link.linkTarget);
  }
  return body;
}
