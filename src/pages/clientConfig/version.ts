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
 * the editor opened): not when the time of the last change moved, and not when the values differ
 * (also under an unchanged time). A key that is no longer in the answer is not the same.
 */
export function sameVersion(
  opened: Pick<ClientConfigItem, 'updatedAt' | 'values'>,
  current: Pick<ClientConfigItem, 'updatedAt' | 'values'> | undefined,
): boolean {
  if (!current) return false;
  const before = timeOf(opened);
  const now = timeOf(current);
  // A time that moved is a change. A time that did not move is not proof of none: the backend may
  // leave the time of a language row that did not change as it was (contract 17.4 says the time of
  // the key is that of the latest row), so the values are compared as well.
  if (before !== null && now !== null && before !== now) return false;
  return contentOf(opened) === contentOf(current);
}
