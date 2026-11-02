import { describe, expect, it } from 'vitest';
import enUS from '../../locales/en-US';
import {
  fromSurfaces,
  type SurfaceRow,
  summarizeSurfaces,
  surfaceProblems,
  toSurfaces,
} from './surfaces';

const intl = {
  messages: enUS as Record<string, string>,
  formatMessage: ({ id }: { id: string }, values?: Record<string, string | number>) =>
    ((enUS as Record<string, string>)[id] ?? id).replace(/\{(\w+)\}/g, (_, k) =>
      String(values?.[k] ?? ''),
    ),
};

describe('the surfaces of a unit (answers 39)', () => {
  it('reads what the backend sent into rows, and drops what has the wrong shape instead of breaking', () => {
    expect(
      fromSurfaces([
        { platform: 'ANDROID', channel: 'play' },
        { platform: 'IOS', channel: null },
        { platform: 'WEB', channel: null },
        { platform: 'ANDROID', channel: 5 },
        null,
        'x',
      ]),
    ).toEqual([
      { platform: 'ANDROID', channel: 'play' },
      { platform: 'IOS', channel: '' },
      { platform: 'ANDROID', channel: '' },
    ]);
    expect(fromSurfaces(null)).toEqual([]);
    expect(fromSurfaces(undefined)).toEqual([]);
    expect(fromSurfaces('ANDROID')).toEqual([]);
  });

  it('writes the rows as the request wants them: exactly platform and channel, channel null for an empty box, each pair once', () => {
    const rows: SurfaceRow[] = [
      { platform: 'ANDROID', channel: ' play ' },
      { platform: 'IOS', channel: '' },
      { platform: 'ANDROID', channel: 'play' },
      { platform: undefined, channel: '' },
    ];
    expect(toSurfaces(rows)).toEqual([
      { platform: 'ANDROID', channel: 'play' },
      { platform: 'IOS', channel: null },
    ]);
    for (const item of toSurfaces(rows))
      expect(Object.keys(item).sort()).toEqual(['channel', 'platform']);
    expect(toSurfaces([])).toEqual([]);
  });

  it('sees what is wrong with a row: no platform; a channel that is not 2 to 32 of a-z, 0-9, - and _', () => {
    expect(
      surfaceProblems([
        { platform: undefined, channel: '' },
        { platform: 'ANDROID', channel: 'Play' },
        { platform: 'ANDROID', channel: 'p' },
        { platform: 'ANDROID', channel: 'a'.repeat(33) },
        { platform: 'ANDROID', channel: 'ไทย' },
        { platform: 'ANDROID', channel: 'play_direct-2' },
        { platform: 'IOS', channel: '' },
      ]),
    ).toEqual([
      { platform: 'REQUIRED' },
      { channel: 'FORMAT' },
      { channel: 'FORMAT' },
      { channel: 'FORMAT' },
      { channel: 'FORMAT' },
      null,
      null,
    ]);
  });

  it('says in a cell where the unit is served: every end for none, "ANDROID/play" for a channel, and the platform alone for any channel', () => {
    expect(summarizeSurfaces(intl, [])).toBe('All platforms and channels');
    expect(summarizeSurfaces(intl, null)).toBe('All platforms and channels');
    expect(summarizeSurfaces(intl, [{ platform: 'ANDROID', channel: null }])).toBe('Only ANDROID');
    expect(
      summarizeSurfaces(intl, [
        { platform: 'ANDROID', channel: 'play' },
        { platform: 'IOS', channel: null },
      ]),
    ).toBe('Only ANDROID/play, IOS');
    expect(summarizeSurfaces(intl, [{ platform: 'IOS', channel: 'appstore' }])).toBe(
      'Only IOS/appstore',
    );
  });
});
