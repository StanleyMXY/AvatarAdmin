// In-memory state of the channel package endpoints of the mock backend (contract 24.7): the three
// preset channels and the ones the channel page adds. It hangs on `globalThis` like the rest of the
// mock state (see store.ts), so saving a mock file does not lose it; `resetChannelsStore` puts the
// preset data back. The app version endpoints read it too: a version belongs to a channel. Not a
// mock file itself: Umi's loader reads every file in mock/, and only files that export handlers
// belong there.

export type MockChannel = {
  code: string;
  name: string;
  platform: 'ANDROID' | 'IOS';
  distribution: 'STORE' | 'DIRECT';
  packageName: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type ChannelsStore = { channels: Map<string, MockChannel> };

const PRESET_AT = '2026-10-01T00:00:00Z';

function seed(): ChannelsStore {
  const preset: MockChannel[] = [
    {
      code: 'play',
      name: 'Android store',
      platform: 'ANDROID',
      distribution: 'STORE',
      packageName: 'app.example.play',
      enabled: true,
      createdAt: PRESET_AT,
      updatedAt: PRESET_AT,
    },
    {
      code: 'direct',
      name: 'Direct download',
      platform: 'ANDROID',
      distribution: 'DIRECT',
      packageName: 'app.example.direct',
      enabled: true,
      createdAt: PRESET_AT,
      updatedAt: PRESET_AT,
    },
    {
      code: 'appstore',
      name: 'iOS store',
      platform: 'IOS',
      distribution: 'STORE',
      packageName: null,
      enabled: true,
      createdAt: PRESET_AT,
      updatedAt: PRESET_AT,
    },
  ];
  return { channels: new Map(preset.map((c) => [c.code, c])) };
}

const holder = globalThis as { __avatarAdminMockChannels?: ChannelsStore };

export const channelsState: ChannelsStore = (() => {
  holder.__avatarAdminMockChannels ??= seed();
  return holder.__avatarAdminMockChannels;
})();

export function resetChannelsStore(): void {
  Object.assign(channelsState, seed());
}
