import { describe, expect, it } from 'vitest';
import { groupSpent } from './groupSpent';

const row = (
  spendKind: string,
  featureKey: string | null,
  itemKey: string | null,
  count: number,
  credits: number,
) => ({ spendKind, featureKey, itemKey, count, credits });

describe('groupSpent', () => {
  it('groups by spend kind in the order feature, cosmetic, look, and totals each group', () => {
    const groups = groupSpent([
      row('LOOK', null, null, 4, 400),
      row('COSMETIC', null, 'outfit_red', 3, 300),
      row('FEATURE', 'assets.avatar_max', null, 2, 200),
      row('COSMETIC', null, 'bg_beach', 1, 80),
      row('FEATURE', 'assets.voice_max', null, 5, 400),
    ]);
    expect(groups.map((g) => g.spendKind)).toEqual(['FEATURE', 'COSMETIC', 'LOOK']);
    expect(groups[0]).toMatchObject({ count: 7, credits: 600 });
    expect(groups[1]).toMatchObject({ count: 4, credits: 380 });
    expect(groups[2]).toMatchObject({ count: 4, credits: 400 });
  });

  it('splits features by feature key and cosmetics by item key, and does not split a look', () => {
    const groups = groupSpent([
      row('FEATURE', 'b.key', null, 1, 10),
      row('FEATURE', 'a.key', null, 1, 20),
      row('COSMETIC', null, 'z', 1, 5),
      row('COSMETIC', null, 'y', 1, 6),
      row('LOOK', null, null, 2, 50),
    ]);
    expect(groups[0].children.map((c) => c.key)).toEqual(['a.key', 'b.key']);
    expect(groups[1].children.map((c) => c.key)).toEqual(['y', 'z']);
    expect(groups[2].children).toEqual([]);
  });

  it('adds up rows that repeat a key, and keeps a missing key as null instead of dropping the row', () => {
    const groups = groupSpent([
      row('FEATURE', 'a', null, 1, 10),
      row('FEATURE', 'a', null, 2, 20),
      row('FEATURE', null, null, 1, 1),
    ]);
    expect(groups[0].children).toEqual([
      { key: 'a', count: 3, credits: 30 },
      { key: null, count: 1, credits: 1 },
    ]);
    expect(groups[0]).toMatchObject({ count: 4, credits: 31 });
  });

  it('keeps a spend kind it does not know, after the known ones, without children', () => {
    const groups = groupSpent([row('GIFT', null, null, 1, 9), row('LOOK', null, null, 1, 1)]);
    expect(groups.map((g) => g.spendKind)).toEqual(['LOOK', 'GIFT']);
    expect(groups[1].children).toEqual([]);
  });

  it('gives nothing for nothing', () => {
    expect(groupSpent([])).toEqual([]);
  });
});
