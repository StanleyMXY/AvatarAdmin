import type { CreditStats } from '../../services/credits';

type SpentRow = CreditStats['spent'][number];

export type SpentChild = { key: string | null; count: number; credits: number };
export type SpentGroup = {
  spendKind: string;
  count: number;
  credits: number;
  /** Features by feature key, cosmetics by item key; a look is not split. */
  children: SpentChild[];
};

const KNOWN_ORDER = ['FEATURE', 'COSMETIC', 'LOOK'];

const rank = (kind: string): number => {
  const at = KNOWN_ORDER.indexOf(kind);
  return at === -1 ? KNOWN_ORDER.length : at;
};

/**
 * The spending rows the backend sends (one per spend kind and key) as groups: one per spend kind,
 * with its totals and, for a feature or a cosmetic, one child per feature key or item key. A row
 * without the key it should have stays as a child with a null key instead of being dropped, and a
 * spend kind that is not known comes after the known ones.
 */
export function groupSpent(rows: readonly SpentRow[]): SpentGroup[] {
  const groups = new Map<string, SpentGroup>();
  for (const row of rows) {
    const group = groups.get(row.spendKind) ?? {
      spendKind: row.spendKind,
      count: 0,
      credits: 0,
      children: [],
    };
    group.count += row.count;
    group.credits += row.credits;
    const splitsByKey = row.spendKind === 'FEATURE' || row.spendKind === 'COSMETIC';
    if (splitsByKey) {
      const key = row.spendKind === 'FEATURE' ? row.featureKey : row.itemKey;
      const child = group.children.find((c) => c.key === key);
      if (child) {
        child.count += row.count;
        child.credits += row.credits;
      } else {
        group.children.push({ key, count: row.count, credits: row.credits });
      }
    }
    groups.set(row.spendKind, group);
  }
  for (const group of groups.values()) {
    group.children.sort((a, b) => {
      if (a.key === null) return b.key === null ? 0 : 1;
      if (b.key === null) return -1;
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    });
  }
  return [...groups.values()].sort((a, b) => rank(a.spendKind) - rank(b.spendKind));
}
