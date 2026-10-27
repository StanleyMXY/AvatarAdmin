import { formatInstant } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';

/** The part of `useIntl()` this needs (Umi's copy of react-intl and ours have different types). */
export type Translator = {
  locale?: string;
  messages: Record<string, unknown>;
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
};

/** The text of a code from the language file, or the code itself when the file has no text for it. */
export function codeText(intl: Translator, prefix: string, code: unknown): string {
  const text = typeof code === 'string' ? code : plainText(code);
  const id = `${prefix}.${text}`;
  return text !== '' && intl.messages[id] ? intl.formatMessage({ id }) : text;
}

/** An instant of the backend in the interface language, or a dash when there is none (a value that is not text is none). */
export function instantText(locale: string, value: unknown): string {
  return typeof value === 'string' && value !== '' ? formatInstant(value, locale) : DASH;
}

/** Text the backend sent, or a dash when there is none; whatever its type, it is text. */
export function orDash(value: unknown): string {
  const text = plainText(value);
  return text === '' ? DASH : text;
}

/** "App screen: Store", "Web address: https://…" or "No link", in the current language. */
export function describeLink(intl: Translator, linkType: unknown, linkTarget: unknown): string {
  const kind = codeText(intl, 'pages.link.type', linkType);
  if (linkType === 'NONE' || kind === '') return kind === '' ? DASH : kind;
  const target = plainText(linkTarget);
  const shown = linkType === 'SCREEN' ? codeText(intl, 'pages.link.screen', target) : target;
  return shown === ''
    ? kind
    : intl.formatMessage({ id: 'notifications.link.summary' }, { kind, target: shown });
}

/** The name of the administrator who sent a message, or the first characters of the id when the account is gone. */
export function adminText(name: unknown, id: unknown): string {
  const shown = plainText(name);
  if (shown !== '') return shown;
  const raw = plainText(id);
  return raw === '' ? DASH : raw.slice(0, 8);
}

/** The reason of a refused field in words: the language file's text of the reason code, else the text of INVALID_REQUEST. */
export function reasonText(intl: Translator, reason: unknown): string {
  const id = `reason.${plainText(reason)}`;
  return intl.messages[id]
    ? intl.formatMessage({ id })
    : intl.formatMessage({ id: 'error.INVALID_REQUEST' });
}
