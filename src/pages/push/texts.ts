import { formatInstant } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { DASH, formatCount } from '../../utils/ratio';

/** The part of `useIntl()` this needs (Umi's copy of react-intl and ours have different types). */
export type Translator = {
  messages: Record<string, unknown>;
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
};

/** The text of a code from the language file, or the code itself when the file has no text for it. */
export function codeText(intl: Translator, prefix: string, code: unknown): string {
  const text = typeof code === 'string' ? code : '';
  const id = `${prefix}.${text}`;
  return text !== '' && intl.messages[id] ? intl.formatMessage({ id }) : text;
}

/** "App screen: Store", "Web address: https://…" or "No link", in the current language. */
export function describeLink(intl: Translator, linkType: unknown, linkTarget: unknown): string {
  const kind = codeText(intl, 'pages.link.type', linkType);
  if (linkType === 'NONE' || kind === '') return kind;
  const target = typeof linkTarget === 'string' ? linkTarget : plainText(linkTarget);
  const shown = linkType === 'SCREEN' ? codeText(intl, 'pages.link.screen', target) : target;
  return shown === ''
    ? kind
    : intl.formatMessage({ id: 'push.link.summary' }, { kind, target: shown });
}

/** An instant of the backend in the interface language, or a dash when there is none (a value that is not text is none). */
export function instantText(locale: string, value: unknown): string {
  return typeof value === 'string' && value !== '' ? formatInstant(value, locale) : DASH;
}

/** A count from the backend with thousands separators; a dash for anything that is not a number. */
export function countText(locale: string, value: unknown): string {
  return typeof value === 'number' ? formatCount(value, locale) : DASH;
}
