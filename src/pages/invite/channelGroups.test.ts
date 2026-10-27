import { describe, expect, it } from 'vitest';
import { groupChannels } from './channelGroups';

const row = (statDate: string, shareChannel: unknown, sharePv: unknown) => ({
  statDate,
  shareChannel,
  sharePv,
  shareUv: 1,
});

describe('groupChannels', () => {
  const rows = [
    row('d1', 'a', 10),
    row('d1', 'b', 50),
    row('d1', 'c', 5),
    row('d2', 'a', 10),
    row('d2', 'd', 4),
    row('d2', 'e', 3),
    row('d2', 'f', 2),
    row('d2', 'g', 1),
  ];

  it('keeps the five channels with the most shares and puts the rest into one group', () => {
    const { groups, total } = groupChannels(rows, 5);
    expect(groups.map((g) => [g.name, g.total, g.other])).toEqual([
      ['b', 50, false],
      ['a', 20, false],
      ['c', 5, false],
      ['d', 4, false],
      ['e', 3, false],
      ['Other', 3, true],
    ]);
    expect(total).toBe(85);
  });

  it('gives the per-day numbers of each group, the rest being the sum of the rest on that day', () => {
    const { groups } = groupChannels(rows, 5);
    const other = groups.at(-1);
    expect(other?.byDay).toEqual({ d2: 3 });
    expect(groups[1].byDay).toEqual({ d1: 10, d2: 10 });
  });

  it('has no rest group with five channels or fewer and breaks ties by name', () => {
    const { groups } = groupChannels([row('d', 'z', 4), row('d', 'y', 4), row('d', 'x', 9)], 5);
    expect(groups.map((g) => g.name)).toEqual(['x', 'y', 'z']);
  });

  it('ignores a row whose number is not valid or whose day is not text, and a group with nothing shared', () => {
    const { groups, total } = groupChannels(
      [
        row('d', 'a', -4),
        row('d', 'b', 'x'),
        row('d', 'c', 0),
        row(1 as never, 'e', 5),
        row('d', 'f', 6),
      ],
      5,
    );
    expect(groups.map((g) => g.name)).toEqual(['f']);
    expect(total).toBe(6);
  });

  it('names a channel that is not text by its plain text and an empty one by an empty name', () => {
    const { groups } = groupChannels([row('d', 77, 3), row('d', null, 2)], 5);
    expect(groups.map((g) => g.name)).toEqual(['77', '']);
  });

  it('never gives a negative number for the rest', () => {
    const many = Array.from({ length: 9 }, (_, i) => row('d', `c${i}`, i + 1));
    const { groups } = groupChannels(many, 5);
    expect(groups.at(-1)?.total).toBeGreaterThanOrEqual(0);
  });
});
