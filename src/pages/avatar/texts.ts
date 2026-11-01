import type { Surface } from '../../services/avatar';
import { codeText, type Translator } from '../../utils/displayText';

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
