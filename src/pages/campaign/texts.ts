import { formatInstant } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { DASH, formatCount } from '../../utils/ratio';

/** The part of `useIntl()` this needs (Umi's copy of react-intl and ours have different types). */
export type Translator = {
  locale?: string;
  messages: Record<string, unknown>;
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
};

/** The text of a code from the language file, or the code itself when the file has no text for it. */
export function codeText(intl: Translator, prefix: string, code: unknown): string {
  const text = typeof code === 'string' ? code : '';
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
