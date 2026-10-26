import type { Surface } from '../../services/avatar';

/** The part of `useIntl()` this needs (Umi's copy of react-intl and ours have different types). */
export type Translator = {
  messages: Record<string, unknown>;
  formatMessage: (descriptor: { id: string }, values?: Record<string, string | number>) => string;
};

/** The text of a code from the language file, or the code itself when the file has no text for it. */
export function codeText(intl: Translator, prefix: string, code: string): string {
  const id = `${prefix}.${code}`;
  return intl.messages[id] ? intl.formatMessage({ id }) : code;
}

/** "All ends" for an empty list, else "Android · every channel, iOS · play". */
export function describeSurfaces(intl: Translator, surfaces: readonly Surface[]): string {
  if (surfaces.length === 0) return intl.formatMessage({ id: 'avatar.surfaces.all' });
  return surfaces
    .map((s) => {
      const platform = codeText(intl, 'avatar.platform', s.platform);
      return `${platform} · ${s.channel ?? intl.formatMessage({ id: 'avatar.surfaces.allChannels' })}`;
    })
    .join(', ');
}
