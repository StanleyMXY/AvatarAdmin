import type { ClientConfigItem } from '../../services/clientConfig';

const timeOf = (item: Pick<ClientConfigItem, 'updatedAt'>): string | null =>
  typeof item.updatedAt === 'string' && item.updatedAt !== '' ? item.updatedAt : null;

/** The values with their languages in a fixed order, so two readings of the same key give the same text. */
const contentOf = (item: Pick<ClientConfigItem, 'values'>): string => {
  const values = item.values;
  if (typeof values !== 'object' || values === null || Array.isArray(values)) {
    return JSON.stringify(values ?? null);
  }
  return JSON.stringify(Object.entries(values).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
};

/**
 * Whether the key `current` (read again just before a save) is still the key `opened` (read when
 * the editor opened): the time of the last change when both readings have one, else the values. A
 * key that is no longer in the answer is not the same.
 */
export function sameVersion(
  opened: Pick<ClientConfigItem, 'updatedAt' | 'values'>,
  current: Pick<ClientConfigItem, 'updatedAt' | 'values'> | undefined,
): boolean {
  if (!current) return false;
  const before = timeOf(opened);
  const now = timeOf(current);
  if (before !== null && now !== null) return before === now;
  return contentOf(opened) === contentOf(current);
}
