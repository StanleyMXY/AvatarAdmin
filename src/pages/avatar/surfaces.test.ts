import { describe, expect, it } from 'vitest';
import type { Surface } from '../../services/avatar';
import { ALL_CHANNELS, applyChange, toSelections, toSurfaces } from './surfaces';

describe('toSurfaces: the value of contract 3.7', () => {
  it('is an empty list when nothing is chosen (every end)', () => {
    expect(toSurfaces({ ANDROID: [], IOS: [] })).toEqual([]);
  });

  it('writes "all channels of the platform" as a null channel', () => {
    expect(toSurfaces({ ANDROID: [ALL_CHANNELS], IOS: [] })).toEqual([
      { platform: 'ANDROID', channel: null },
    ]);
  });

  it('writes a chosen channel as its code, in the order of the platforms', () => {
    expect(toSurfaces({ ANDROID: ['play', 'direct'], IOS: ['appstore'] })).toEqual([
      { platform: 'ANDROID', channel: 'play' },
      { platform: 'ANDROID', channel: 'direct' },
      { platform: 'IOS', channel: 'appstore' },
    ]);
  });

  it('keeps no single channel of a platform that has "all channels"', () => {
    expect(toSurfaces({ ANDROID: ['play', ALL_CHANNELS], IOS: ['appstore', 'appstore'] })).toEqual([
      { platform: 'ANDROID', channel: null },
      { platform: 'IOS', channel: 'appstore' },
    ]);
  });
});

describe('toSelections: the other way round', () => {
  it('reads what toSurfaces wrote', () => {
    const lists: Surface[][] = [
      [],
      [{ platform: 'IOS', channel: null }],
      [
        { platform: 'ANDROID', channel: 'play' },
        { platform: 'IOS', channel: 'appstore' },
      ],
    ];
    for (const list of lists) expect(toSurfaces(toSelections(list))).toEqual(list);
  });

  it('shows a null channel as "all channels" even when single channels of the platform are stored beside it', () => {
    expect(
      toSelections([
        { platform: 'ANDROID', channel: 'play' },
        { platform: 'ANDROID', channel: null },
      ]),
    ).toEqual({ ANDROID: [ALL_CHANNELS], IOS: [] });
  });
});

describe('applyChange: the box of one platform', () => {
  it('choosing "all channels" replaces the single channels', () => {
    expect(applyChange(['play'], ['play', ALL_CHANNELS])).toEqual([ALL_CHANNELS]);
  });

  it('choosing a single channel takes "all channels" away', () => {
    expect(applyChange([ALL_CHANNELS], [ALL_CHANNELS, 'play'])).toEqual(['play']);
  });

  it('leaves other changes alone, including emptying the box', () => {
    expect(applyChange(['play'], ['play', 'direct'])).toEqual(['play', 'direct']);
    expect(applyChange(['play', 'direct'], ['direct'])).toEqual(['direct']);
    expect(applyChange([ALL_CHANNELS], [])).toEqual([]);
  });
});
