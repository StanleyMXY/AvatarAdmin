import { formatInstant } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { DASH, formatCount } from '../../utils/ratio';

/** The part of `useIntl()` this needs (Umi's copy of react-intl and ours have different types). */
export type Translator = {
  locale: string;
  messages: Record<string, unknown>;
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
};

/** The text of a code from the language file, or the code itself when the file has no text for it (a code the backend added later is never hidden). */
export function codeText(intl: Translator, prefix: string, code: unknown): string {
  const text = typeof code === 'string' ? code : plainText(code);
  const id = `${prefix}.${text}`;
  return text !== '' && Object.hasOwn(intl.messages, id) ? intl.formatMessage({ id }) : text;
}

/** An instant of the backend in the interface language, or a dash when there is none (a value that is not text is none). */
export function instantText(locale: string, value: unknown): string {
  return typeof value === 'string' && value !== '' ? formatInstant(value, locale) : DASH;
}

/** A count from the backend with thousands separators; a dash for anything that is not a number, and 0 stays 0. */
export function countText(locale: string, value: unknown): string {
  return typeof value === 'number' ? formatCount(value, locale) : DASH;
}

/** A calendar day or any text from the backend as it is; nothing is a dash. */
export function plainOrDash(value: unknown): string {
  const text = plainText(value);
  return text === '' ? DASH : text;
}

const LIFECYCLE_COLOR: Record<string, string> = {
  DRAFT: 'default',
  ACTIVE: 'success',
  ENDED: 'warning',
  DISABLED: 'error',
};

/** The status tags of a sign-in activity: its words in the current language and a colour for each state. */
export function lifecycleOptions(
  intl: Translator,
): Record<string, { label: string; color: string }> {
  return Object.fromEntries(
    ['DRAFT', 'ACTIVE', 'ENDED', 'DISABLED'].map((status) => [
      status,
      {
        label: intl.formatMessage({ id: `activity.lifecycle.${status}` }),
        color: LIFECYCLE_COLOR[status],
      },
    ]),
  );
}
