// In-memory state of the app version endpoints of the mock backend (contract 24.1 and 24.2): the
// versions of the channels, and the records of the APK files that were uploaded. It hangs on
// `globalThis` like the rest of the mock state (see store.ts), so saving a mock file does not lose
// it; `resetAppVersionsStore` puts the sample data back. Not a mock file itself: Umi's loader reads
// every file in mock/, and only files that export handlers belong there.

import { createHash } from 'node:crypto';
import type { AppVersion } from '../../src/services/appVersions/types';
import { multilingualSamples } from './fixtures';
import { findAdminByUsername } from './store';

export type MockVersion = AppVersion;

/** The record of an uploaded file; a DIRECT version takes its address, size and checksum from it. */
export type MockApkUpload = {
  id: string;
  kind: 'APK' | 'AD_MEDIA';
  used: boolean;
  apkUrl: string;
  apkSizeBytes: number;
  apkSha256: string;
};

type AppVersionsStore = {
  versions: Map<string, MockVersion>;
  uploads: Map<string, MockApkUpload>;
  next: { version: number; upload: number };
  /** False while `upload.public_base_url` is "not configured": the upload answers 503. */
  apkAvailable: boolean;
  /** True makes the next upload answer 400 INVALID_FILE (a file without a v2 signature, for example). */
  nextApkRefusal: boolean;
};

export const sha256Of = (text: string): string => createHash('sha256').update(text).digest('hex');

export const apkUrlOf = (uploadId: string): string =>
  `https://downloads.example.com/apk/${uploadId}.apk`;

/** A record for a file that was uploaded; the size and checksum follow from the id. */
export function makeApkUpload(id: string, used: boolean): MockApkUpload {
  const sizeBytes = 20_000_000 + (Number.parseInt(sha256Of(id).slice(0, 6), 16) % 60_000_000);
  return {
    id,
    kind: 'APK',
    used,
    apkUrl: apkUrlOf(id),
    apkSizeBytes: sizeBytes,
    apkSha256: sha256Of(`apk:${id}`),
  };
}

const T = multilingualSamples;
const notes = (en: string): Record<string, string> => ({
  en,
  th: T.th[1],
  ar: T.ar[3],
  id: T.id[2],
  vi: T.vi[2],
  es: T.es[2],
  'zh-Hans': T.zh[2],
});

function seed(now: Date): AppVersionsStore {
  const root = findAdminByUsername('root')?.id ?? null;
  const day = 24 * 60 * 60 * 1000;
  const ago = (days: number) => new Date(now.getTime() - days * day).toISOString();
  const uploads = new Map<string, MockApkUpload>();
  const versions = new Map<string, MockVersion>();
  let n = 0;

  const add = (
    channelCode: string,
    platform: 'ANDROID' | 'IOS',
    row: {
      versionName: string;
      versionCode: number;
      minVersionCode: number;
      status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
      createdDaysAgo: number;
      activatedDaysAgo?: number;
      storeUrl?: string;
      uploadId?: string;
      changelog: Record<string, string>;
    },
  ) => {
    n += 1;
    const id = `ver-${String(n).padStart(4, '0')}`;
    const upload = row.uploadId ? makeApkUpload(row.uploadId, true) : null;
    if (upload) uploads.set(upload.id, upload);
    versions.set(id, {
      id,
      channelCode,
      platform,
      versionName: row.versionName,
      versionCode: row.versionCode,
      minVersionCode: row.minVersionCode,
      storeUrl: row.storeUrl ?? null,
      apkUploadId: upload?.id ?? null,
      apkUrl: upload?.apkUrl ?? null,
      apkSizeBytes: upload?.apkSizeBytes ?? null,
      apkSha256: upload?.apkSha256 ?? null,
      changelog: row.changelog,
      status: row.status,
      createdBy: root,
      createdByUsername: null,
      activatedBy: row.status === 'DRAFT' ? null : root,
      activatedByUsername: null,
      activatedAt: row.activatedDaysAgo === undefined ? null : ago(row.activatedDaysAgo),
      createdAt: ago(row.createdDaysAgo),
      updatedAt: ago(row.activatedDaysAgo ?? row.createdDaysAgo),
    });
  };

  const PLAY = 'https://play.google.com/store/apps/details?id=app.example.play';
  add('play', 'ANDROID', {
    versionName: '1.0.0',
    versionCode: 100,
    minVersionCode: 1,
    status: 'ARCHIVED',
    createdDaysAgo: 60,
    activatedDaysAgo: 58,
    storeUrl: PLAY,
    changelog: notes('First release'),
  });
  add('play', 'ANDROID', {
    versionName: '1.1.0',
    versionCode: 110,
    minVersionCode: 100,
    status: 'ACTIVE',
    createdDaysAgo: 30,
    activatedDaysAgo: 28,
    storeUrl: `${PLAY}&hl=en`,
    changelog: notes('Faster calls and a new look'),
  });
  add('play', 'ANDROID', {
    versionName: '1.2.0',
    versionCode: 120,
    minVersionCode: 110,
    status: 'DRAFT',
    createdDaysAgo: 3,
    storeUrl: PLAY,
    changelog: notes('Voice improvements'),
  });

  add('direct', 'ANDROID', {
    versionName: '1.0.0',
    versionCode: 100,
    minVersionCode: 1,
    status: 'ARCHIVED',
    createdDaysAgo: 55,
    activatedDaysAgo: 54,
    uploadId: 'up-seed-0001',
    changelog: notes('First release'),
  });
  add('direct', 'ANDROID', {
    versionName: '1.1.0',
    versionCode: 110,
    minVersionCode: 100,
    status: 'ACTIVE',
    createdDaysAgo: 29,
    activatedDaysAgo: 27,
    uploadId: 'up-seed-0002',
    changelog: notes('Faster calls and a new look'),
  });
  add('direct', 'ANDROID', {
    versionName: '1.2.0',
    versionCode: 120,
    minVersionCode: 110,
    status: 'DRAFT',
    createdDaysAgo: 2,
    uploadId: 'up-seed-0003',
    changelog: notes('Voice improvements'),
  });

  const APP = 'https://apps.apple.com/th/app/avatar-chat/id1234567890';
  add('appstore', 'IOS', {
    versionName: '3.0.0',
    versionCode: 300,
    minVersionCode: 1,
    status: 'ARCHIVED',
    createdDaysAgo: 50,
    activatedDaysAgo: 49,
    storeUrl: APP,
    changelog: notes('First release'),
  });
  add('appstore', 'IOS', {
    versionName: '3.1.0',
    versionCode: 310,
    minVersionCode: 300,
    status: 'ACTIVE',
    createdDaysAgo: 20,
    activatedDaysAgo: 19,
    storeUrl: APP,
    changelog: notes('Faster calls and a new look'),
  });
  add('appstore', 'IOS', {
    versionName: '3.2.0',
    versionCode: 311,
    // above the version that is active: users on the newest version are forced to update
    minVersionCode: 311,
    status: 'DRAFT',
    createdDaysAgo: 1,
    storeUrl: APP,
    changelog: notes('A required security update'),
  });

  return {
    versions,
    uploads,
    next: { version: n + 1, upload: 1 },
    apkAvailable: true,
    nextApkRefusal: false,
  };
}

const holder = globalThis as { __avatarAdminMockAppVersions?: AppVersionsStore };

export const appVersionsState: AppVersionsStore = (() => {
  holder.__avatarAdminMockAppVersions ??= seed(new Date());
  return holder.__avatarAdminMockAppVersions;
})();

export function resetAppVersionsStore(now: Date = new Date()): void {
  Object.assign(appVersionsState, seed(now));
}
