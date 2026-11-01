import { formatInstant } from './format';
import { plainText } from './plainText';
import { DASH, formatCount } from './ratio';

/** The part of `useIntl()` this needs (Umi's copy of react-intl and ours have different types). */
export type Translator = {
  locale?: string;
  messages: Record<string, unknown>;
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
};

/**
 * The text of a code from the language file, or the code itself when the file has no text for it
 * (a code the backend added later is never hidden). A code that is not text is nothing, unless
 * `writeOut` is set: then it is written out as text (a number as its digits, an object as JSON).
 */
export function codeText(
  intl: Translator,
  prefix: string,
  code: unknown,
  options: { writeOut?: boolean } = {},
): string {
  const text = typeof code === 'string' ? code : options.writeOut ? plainText(code) : '';
  const id = `${prefix}.${text}`;
  return text !== '' && intl.messages[id] ? intl.formatMessage({ id }) : text;
}

/** An instant of the backend in the interface language, or a dash when there is none (a value that is not text is none). */
export function instantText(locale: string, value: unknown): string {
  return typeof value === 'string' && value !== '' ? formatInstant(value, locale) : DASH;
}

/** A count from the backend with thousands separators; a dash for anything that is not a number. */
export function countText(locale: string, value: unknown): string {
  return typeof value === 'number' ? formatCount(value, locale) : DASH;
}

/** Text the backend sent, or a dash when there is none; whatever its type, it is text. */
export function orDash(value: unknown): string {
  const text = plainText(value);
  return text === '' ? DASH : text;
}

/** The name of the administrator who did something, or the first characters of the id when the account is gone. */
export function adminText(name: unknown, id: unknown): string {
  const shown = plainText(name);
  if (shown !== '') return shown;
  const raw = plainText(id);
  return raw === '' ? DASH : raw.slice(0, 8);
}
