import { PLATFORMS, type Platform, type Surface } from '../../services/avatar';

/** The option that stands for "every channel of the platform" in a platform's selection. */
export const ALL_CHANNELS = '*';

export type Selections = Record<Platform, string[]>;

/** What each platform's box holds for a stored list: `*` when the platform has a null channel, else the channel codes. */
export function toSelections(surfaces: readonly Surface[]): Selections {
  const result = { ANDROID: [], IOS: [] } as Selections;
  for (const platform of PLATFORMS) {
    const mine = surfaces.filter((s) => s.platform === platform);
    if (mine.some((s) => s.channel === null)) {
      result[platform] = [ALL_CHANNELS];
    } else {
      result[platform] = [...new Set(mine.map((s) => s.channel as string))];
    }
  }
  return result;
}

/**
 * The list the contract wants (3.7): one `{platform, channel}` per chosen channel, `channel: null`
 * for "all channels of the platform", and an empty list when nothing is chosen, which means every end.
 * A platform with "all channels" has no entry for single channels (the null one covers them).
 */
export function toSurfaces(selections: Selections): Surface[] {
  const result: Surface[] = [];
  for (const platform of PLATFORMS) {
    const chosen = selections[platform];
    if (chosen.includes(ALL_CHANNELS)) {
      result.push({ platform, channel: null });
      continue;
    }
    for (const channel of [...new Set(chosen)]) result.push({ platform, channel });
  }
  return result;
}

/**
 * The new content of one platform's box after a change: choosing "all channels" replaces the single
 * channels, and choosing a single channel takes "all channels" away.
 */
export function applyChange(before: readonly string[], after: readonly string[]): string[] {
  const added = after.filter((v) => !before.includes(v));
  if (added.includes(ALL_CHANNELS)) return [ALL_CHANNELS];
  if (before.includes(ALL_CHANNELS)) return after.filter((v) => v !== ALL_CHANNELS);
  return [...after];
}
