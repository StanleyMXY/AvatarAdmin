import { codeText, type Translator } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';

/** "App screen: Store", "Web address: https://…" or "No link", in the current language. */
export function describeLink(intl: Translator, linkType: unknown, linkTarget: unknown): string {
  const kind = codeText(intl, 'pages.link.type', linkType, { writeOut: true });
  if (linkType === 'NONE' || kind === '') return kind === '' ? DASH : kind;
  const target = plainText(linkTarget);
  const shown =
    linkType === 'SCREEN'
      ? codeText(intl, 'pages.link.screen', target, { writeOut: true })
      : target;
  return shown === ''
    ? kind
    : intl.formatMessage({ id: 'notifications.link.summary' }, { kind, target: shown });
}

/** The reason of a refused field in words: the language file's text of the reason code, else the text of INVALID_REQUEST. */
export function reasonText(intl: Translator, reason: unknown): string {
  const id = `reason.${plainText(reason)}`;
  return intl.messages[id]
    ? intl.formatMessage({ id })
    : intl.formatMessage({ id: 'error.INVALID_REQUEST' });
}
