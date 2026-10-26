import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { codeText, type Translator } from '../notifications/texts';

export { adminText, codeText, instantText, orDash, type Translator } from '../notifications/texts';

/** The description or the use of a key, from the language file; the key itself where the file has no text for it. */
export function keyText(intl: Translator, key: unknown, part: 'desc' | 'usage'): string {
  const name = plainText(key);
  const id = `clientConfig.${name}.${part}`;
  return intl.messages[id] ? intl.formatMessage({ id }) : name;
}

/** The system configuration key a read-only key takes its value from, when the language file knows it. */
export function sourceOf(intl: Translator, key: unknown): string | null {
  const id = `clientConfig.${plainText(key)}.source`;
  return intl.messages[id] ? intl.formatMessage({ id }) : null;
}

/** "Decided by the X setting; change it in System configuration", or the same without X when it is not known. */
export function readOnlyNote(intl: Translator, key: unknown): string {
  const source = sourceOf(intl, key);
  return source === null
    ? intl.formatMessage({ id: 'clientConfig.readOnly.noteGeneric' })
    : intl.formatMessage({ id: 'clientConfig.readOnly.note' }, { source });
}

export const typeText = (intl: Translator, type: unknown): string =>
  codeText(intl, 'clientConfig.type', type) || DASH;

/** The reason a value was refused, in words: the shared reason text, else this page's own, else the text of INVALID_REQUEST. */
export function problemText(intl: Translator, reason: unknown): string {
  const name = plainText(reason);
  for (const id of [`reason.${name}`, `clientConfig.problem.${name}`]) {
    if (intl.messages[id]) return intl.formatMessage({ id });
  }
  return intl.formatMessage({ id: 'error.INVALID_REQUEST' });
}

/** A value as the person reads it: Yes or No for a switch, the items of a list, a number as it is, text as text; a dash for nothing. */
export function formatValue(intl: Translator, value: unknown): string {
  if (value === null || value === undefined) return DASH;
  if (typeof value === 'boolean')
    return intl.formatMessage({ id: value ? 'clientConfig.yes' : 'clientConfig.no' });
  if (Array.isArray(value)) return value.map((entry) => plainText(entry)).join(', ');
  return plainText(value);
}
