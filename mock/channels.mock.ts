import { guard } from './_core/auth';
import { ok } from './_core/http';

// The three channel packages of the preset data. Writing channels belongs to the channel task.
const CHANNELS = [
  {
    channelCode: 'play',
    name: 'Google Play',
    platform: 'ANDROID',
    distribution: 'STORE',
    packageName: 'app.example.play',
    enabled: true,
    createdAt: '2026-10-01T00:00:00Z',
  },
  {
    channelCode: 'direct',
    name: 'Direct download',
    platform: 'ANDROID',
    distribution: 'DIRECT',
    packageName: 'app.example.direct',
    enabled: true,
    createdAt: '2026-10-01T00:00:00Z',
  },
  {
    channelCode: 'appstore',
    name: 'App Store',
    platform: 'IOS',
    distribution: 'STORE',
    packageName: null,
    enabled: true,
    createdAt: '2026-10-01T00:00:00Z',
  },
];

export default {
  // Any signed-in administrator may read the list (contract 24.7).
  'GET /api/admin/channels': guard(null, () => ok({ items: structuredClone(CHANNELS) })),
};
