import type { Translator } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';

/** The reason of a refused field in words: the language file's text of the reason code, else the text of INVALID_REQUEST. */
export function reasonText(intl: Translator, reason: unknown): string {
  const id = `reason.${plainText(reason)}`;
  return intl.messages[id]
    ? intl.formatMessage({ id })
    : intl.formatMessage({ id: 'error.INVALID_REQUEST' });
}
