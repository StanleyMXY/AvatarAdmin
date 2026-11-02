import type { Surface } from '../../services/ads';
import type { Translator } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';

// The surfaces of a unit (answers 39): where it is served, as a list of {platform, channel}; a
// channel of null is every channel of that platform, and an empty list is every end. The form holds
// one row for each pair, with the channel as text.

export const SURFACE_PLATFORMS = ['ANDROID', 'IOS'] as const;
export type SurfacePlatform = (typeof SURFACE_PLATFORMS)[number];

export type SurfaceRow = { platform: SurfacePlatform | undefined; channel: string };

/** The code of a channel as the backend takes it in a surface. */
const CHANNEL = /^[a-z0-9_-]{2,32}$/;

/** The rows for what a unit has. Whatever has the wrong shape is left out instead of breaking the page. */
export function fromSurfaces(value: unknown): SurfaceRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): SurfaceRow[] => {
    if (typeof item !== 'object' || item === null) return [];
    const { platform, channel } = item as { platform?: unknown; channel?: unknown };
    if (platform !== 'ANDROID' && platform !== 'IOS') return [];
    return [{ platform, channel: typeof channel === 'string' ? channel : '' }];
  });
}

/** What the request carries: exactly `platform` and `channel`, a box left empty as null, each pair once, a row without a platform not at all. */
export function toSurfaces(rows: readonly SurfaceRow[]): Surface[] {
  const out: Surface[] = [];
  for (const row of rows) {
    if (row.platform === undefined) continue;
    const channel = trimSpec(row.channel) === '' ? null : trimSpec(row.channel);
    if (!out.some((x) => x.platform === row.platform && x.channel === channel)) {
      out.push({ platform: row.platform, channel });
    }
  }
  return out;
}

export type SurfaceProblem = { platform?: 'REQUIRED'; channel?: 'FORMAT' } | null;

/** What is wrong with each row. */
export function surfaceProblems(rows: readonly SurfaceRow[]): SurfaceProblem[] {
  return rows.map((row) => {
    if (row.platform === undefined) return { platform: 'REQUIRED' };
    const channel = trimSpec(row.channel);
    return channel !== '' && !CHANNEL.test(channel) ? { channel: 'FORMAT' } : null;
  });
}

/** Where the unit is served as one line for a table cell, in the interface language. */
export function summarizeSurfaces(intl: Translator, value: unknown): string {
  const rows = fromSurfaces(value);
  if (rows.length === 0) return intl.formatMessage({ id: 'ads.units.surfaces.all' });
  const names = rows.map((row) =>
    trimSpec(row.channel) === '' ? row.platform : `${row.platform}/${plainText(row.channel)}`,
  );
  return intl.formatMessage({ id: 'ads.units.surfaces.only' }, { list: names.join(', ') });
}
