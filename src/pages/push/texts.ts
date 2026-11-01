import { codeText, type Translator } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';

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
