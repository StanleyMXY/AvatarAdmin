// In-memory state of the in-app ad endpoints of the mock backend (contract 22): campaigns, the four
// preset placements, units, creatives and the upload records. It hangs on `globalThis` like the
// rest of the mock state (see store.ts), so saving a mock file does not lose it; `resetAdsStore`
// puts the sample data back (the tests call it, a restart does it too). Not a mock file itself:
// Umi's loader reads every file in mock/, and only files that export handlers belong there.

import type {
  AdFormat,
  CampaignStatus,
  ClickAction,
  CreativeType,
  ReviewStatus,
  ServingStatus,
  Targeting,
  UnitStatus,
} from '../../src/services/ads/types';
import { multilingualSamples, sampleText } from './fixtures';
import { store } from './store';

export type MockCampaign = {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  priority: number;
  startAt: string | null;
  endAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MockPlacement = {
  id: string;
  slotKey: string;
  adFormat: AdFormat;
  name: string;
  enabled: boolean;
  frequencyCap: number;
  cooldownMinutes: number | null;
  rewardCredits: number | null;
  creativeAspect: string;
  creativeMinShortSide: number;
  creativeMaxBytes: number;
  updatedAt: string;
};

export type MockUnit = {
  id: string;
  campaignId: string;
  placementId: string;
  name: string;
  status: UnitStatus;
  targeting: Targeting;
  weight: number;
  dailyImpressionCap: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

/** The record of an uploaded file; a creative takes its size, dimensions and addresses from it. */
export type MockUpload = {
  id: string;
  kind: 'AD_MEDIA' | 'APK';
  mediaType: CreativeType;
  width: number;
  height: number;
  bytes: number;
  durationSeconds: number | null;
  used: boolean;
};

export type MockCreative = {
  id: string;
  adUnitId: string;
  uploadId: string;
  clickAction: ClickAction;
  clickTarget: string;
  language: string;
  reviewStatus: ReviewStatus;
  servingStatus: ServingStatus;
  weight: number;
  rewardAfterSeconds: number | null;
  skippable: boolean;
  title: string | null;
  body: string | null;
  ctaText: string | null;
  advertiserName: string | null;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NextMedia = Pick<
  MockUpload,
  'mediaType' | 'width' | 'height' | 'bytes' | 'durationSeconds'
>;

export type AdsStore = {
  campaigns: Map<string, MockCampaign>;
  placements: Map<string, MockPlacement>;
  units: Map<string, MockUnit>;
  creatives: Map<string, MockCreative>;
  uploads: Map<string, MockUpload>;
  next: { campaign: number; unit: number; creative: number; upload: number };
  /** `GET /ads/meta`: false until a GeoIP database is set up (contract 22.11). */
  geoConfigured: boolean;
  /** False: `POST /ads/media` answers 503 DEPENDENCY_UNAVAILABLE (`upload.public_base_url` is not set). */
  mediaAvailable: boolean;
  /** What the next upload is read as; a test sets it. Without it the uploads cycle through the samples. */
  nextMedia: NextMedia | null;
  mediaCursor: number;
};

const DAY = 86_400_000;
const ROOT = '1001';

/** The files the mock "reads" when it is asked to take an upload, in turn: two that fit, two that do not. */
export const MEDIA_SAMPLES: readonly NextMedia[] = [
  { mediaType: 'IMAGE', width: 1080, height: 1920, bytes: 380_211, durationSeconds: null },
  { mediaType: 'VIDEO', width: 1080, height: 1920, bytes: 4_800_000, durationSeconds: 12 },
  { mediaType: 'IMAGE', width: 1280, height: 720, bytes: 210_000, durationSeconds: null },
  { mediaType: 'IMAGE', width: 600, height: 1067, bytes: 90_000, durationSeconds: null },
];

const COLORS = ['#3b6ea5', '#a54b3b', '#3ba57a', '#8a3ba5', '#a58a3b', '#3b8aa5'];

/** A small picture that needs no network, so that a thumbnail shows in a page opened offline. */
function pictureOf(id: string, width: number, height: number): string {
  const color = COLORS[Number(id.replace(/\D/g, '')) % COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="160" viewBox="0 0 90 160"><rect width="90" height="160" fill="${color}"/><text x="45" y="86" font-size="14" text-anchor="middle" fill="#fff">${width}x${height}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** The addresses an answer carries; they are made again on every read, as the backend does. */
export const mediaUrlOf = (upload: MockUpload): string =>
  upload.mediaType === 'VIDEO'
    ? `https://media.example.test/ads/${upload.id}.mp4`
    : pictureOf(upload.id, upload.width, upload.height);
export const thumbnailUrlOf = (upload: MockUpload): string =>
  pictureOf(upload.id, upload.width, upload.height);

const iso = (ms: number): string => new Date(ms).toISOString();

function seedPlacements(ms: number): MockPlacement[] {
  const spec = { creativeAspect: '9:16', creativeMinShortSide: 720, creativeMaxBytes: 10_485_760 };
  const at = iso(ms - 20 * DAY);
  return [
    {
      id: '1',
      slotKey: 'app_open',
      adFormat: 'SPLASH',
      name: 'App open',
      enabled: true,
      frequencyCap: 2,
      cooldownMinutes: 30,
      rewardCredits: null,
      updatedAt: at,
      ...spec,
    },
    {
      id: '2',
      slotKey: 'call_end',
      adFormat: 'INTERSTITIAL',
      name: 'After a call',
      enabled: true,
      frequencyCap: 3,
      cooldownMinutes: 10,
      rewardCredits: null,
      updatedAt: at,
      ...spec,
    },
    {
      id: '3',
      slotKey: 'history_feed',
      adFormat: 'NATIVE',
      name: 'In the chat history',
      enabled: false,
      frequencyCap: 10,
      cooldownMinutes: 0,
      rewardCredits: null,
      updatedAt: at,
      ...spec,
    },
    {
      id: '4',
      slotKey: 'reward_credits',
      adFormat: 'REWARDED',
      name: 'Watch to earn credits',
      enabled: true,
      frequencyCap: 5,
      cooldownMinutes: null,
      rewardCredits: 10,
      updatedAt: at,
      ...spec,
    },
  ];
}

function seedCampaigns(ms: number): MockCampaign[] {
  const row = (
    id: string,
    name: string,
    status: CampaignStatus,
    priority: number,
    startDays: number | null,
    endDays: number | null,
    description: string | null = null,
  ): MockCampaign => ({
    id,
    name,
    description,
    status,
    priority,
    startAt: startDays === null ? null : iso(ms + startDays * DAY),
    endAt: endDays === null ? null : iso(ms + endDays * DAY),
    createdBy: ROOT,
    updatedBy: ROOT,
    createdAt: iso(ms - (30 - Number(id)) * DAY),
    updatedAt: iso(ms - (10 - Number(id)) * DAY),
  });
  return [
    row('1', sampleText('th', 0), 'DRAFT', 100, 3, 30),
    row('2', sampleText('ar', 0), 'ACTIVE', 50, -10, 40, sampleText('ar', 1)),
    row('3', sampleText('id', 0), 'PAUSED', 100, -20, null),
    row('4', sampleText('vi', 0), 'ENDED', 10, -40, -5),
    row('5', sampleText('es', 0), 'ENDED', 100, -60, -30),
    row('6', sampleText('en', 0), 'ACTIVE', 200, -2, 60, sampleText('en', 1)),
    row('7', sampleText('zh', 0), 'DRAFT', 100, null, null),
    row(
      '8',
      multilingualSamples.longUnbroken,
      'ACTIVE',
      100,
      -1,
      90,
      `${sampleText('th', 2)} ${'B'.repeat(300)}`,
    ),
  ];
}

function seedUnits(ms: number): MockUnit[] {
  const row = (
    id: string,
    campaignId: string,
    placementId: string,
    name: string,
    status: UnitStatus,
    targeting: Targeting,
    weight: number,
    dailyImpressionCap: number,
  ): MockUnit => ({
    id,
    campaignId,
    placementId,
    name,
    status,
    targeting,
    weight,
    dailyImpressionCap,
    createdBy: ROOT,
    updatedBy: ROOT,
    createdAt: iso(ms - 15 * DAY),
    updatedAt: iso(ms - 5 * DAY),
  });
  return [
    row(
      '1',
      '2',
      '1',
      sampleText('ar', 2),
      'ACTIVE',
      { platforms: ['ANDROID', 'IOS'], geo: ['TH', 'ID'], languages: ['th', 'id'] },
      100,
      0,
    ),
    row(
      '2',
      '2',
      '2',
      sampleText('th', 3),
      'ACTIVE',
      {
        os_version_min: '13',
        app_version_min: '1.2.0',
        day_parts: [
          { start: '8:00', end: '22:30' },
          { start: '23:00', end: '2:00' },
        ],
      },
      100,
      5000,
    ),
    row('3', '6', '3', sampleText('es', 2), 'ACTIVE', {}, 0, 0),
    row(
      '4',
      '6',
      '4',
      sampleText('vi', 3),
      'ACTIVE',
      { geo: ['VN'], languages: ['vi', 'en'] },
      100,
      200,
    ),
    row('5', '3', '1', sampleText('id', 2), 'PAUSED', { platforms: ['IOS'] }, 100, 0),
    row('6', '1', '2', sampleText('zh', 2), 'DRAFT', {}, 100, 0),
    row(
      '7',
      '4',
      '1',
      multilingualSamples.longUnbroken,
      'PAUSED',
      { geo: ['ES', 'US', 'SA'] },
      100,
      0,
    ),
    row('8', '2', '3', sampleText('en', 2), 'DRAFT', { languages: ['en'] }, 100, 0),
  ];
}

type CreativeSeed = {
  id: string;
  unit: string;
  media: NextMedia;
  review: ReviewStatus;
  serving?: ServingStatus;
  skippable?: boolean;
  reward?: number | null;
  title?: string | null;
  ctaText?: string | null;
  advertiser?: string | null;
  language?: string;
  weight?: number;
  note?: string | null;
  action?: ClickAction;
  target?: string;
};

const IMAGE = MEDIA_SAMPLES[0];
const VIDEO = MEDIA_SAMPLES[1];
const VIDEO_15 = { ...VIDEO, durationSeconds: 15 };

function seedCreatives(ms: number): { creatives: MockCreative[]; uploads: MockUpload[] } {
  const seeds: CreativeSeed[] = [
    { id: '1', unit: '1', media: IMAGE, review: 'APPROVED', advertiser: sampleText('th', 1) },
    {
      id: '2',
      unit: '1',
      media: VIDEO,
      review: 'APPROVED',
      serving: 'PAUSED',
      skippable: false,
      language: 'th',
      weight: 30,
    },
    {
      id: '3',
      unit: '2',
      media: IMAGE,
      review: 'DRAFT',
      title: sampleText('vi', 1),
      language: 'vi',
    },
    {
      id: '4',
      unit: '2',
      media: IMAGE,
      review: 'REJECTED',
      note: sampleText('ar', 3),
      language: 'ar',
    },
    {
      id: '5',
      unit: '3',
      media: IMAGE,
      review: 'APPROVED',
      title: sampleText('th', 3),
      ctaText: sampleText('id', 1),
      advertiser: sampleText('es', 1),
    },
    {
      id: '6',
      unit: '4',
      media: VIDEO_15,
      review: 'APPROVED',
      reward: 10,
      language: 'vi',
      action: 'IN_APP_ROUTE',
      target: 'credits',
    },
    {
      id: '7',
      unit: '4',
      media: IMAGE,
      review: 'DRAFT',
      reward: 5,
      language: 'ar',
      title: sampleText('ar', 2),
    },
    { id: '8', unit: '5', media: IMAGE, review: 'APPROVED', serving: 'PAUSED', language: 'id' },
    {
      id: '9',
      unit: '8',
      media: IMAGE,
      review: 'DRAFT',
      title: multilingualSamples.longUnbroken,
      ctaText: 'OK',
      advertiser: multilingualSamples.edgeCases[1],
    },
    {
      id: '10',
      unit: '1',
      media: IMAGE,
      review: 'DRAFT',
      advertiser: sampleText('zh', 1),
      title: sampleText('zh', 3),
      language: 'zh',
    },
  ];
  const uploads: MockUpload[] = [];
  const creatives = seeds.map((seed): MockCreative => {
    const upload: MockUpload = {
      id: `up-seed-${seed.id}`,
      kind: 'AD_MEDIA',
      used: true,
      ...seed.media,
    };
    uploads.push(upload);
    const reviewed = seed.review !== 'DRAFT';
    return {
      id: seed.id,
      adUnitId: seed.unit,
      uploadId: upload.id,
      clickAction: seed.action ?? 'OPEN_URL',
      clickTarget: seed.target ?? `https://example.com/offer/${seed.id}`,
      language: seed.language ?? '*',
      reviewStatus: seed.review,
      servingStatus: seed.serving ?? 'ACTIVE',
      weight: seed.weight ?? 100,
      rewardAfterSeconds: seed.reward ?? null,
      skippable: seed.skippable ?? true,
      title: seed.title ?? null,
      body: seed.title ? sampleText('en', Number(seed.id)) : null,
      ctaText: seed.ctaText ?? null,
      advertiserName: seed.advertiser ?? null,
      reviewNote: seed.review === 'REJECTED' ? (seed.note ?? 'Not suitable') : null,
      reviewedBy: reviewed ? ROOT : null,
      reviewedAt: reviewed ? iso(ms - 3 * DAY) : null,
      createdBy: ROOT,
      createdAt: iso(ms - 12 * DAY),
      updatedAt: iso(ms - 3 * DAY),
    };
  });
  return { creatives, uploads };
}

const byId = <T extends { id: string }>(rows: T[]): Map<string, T> =>
  new Map(rows.map((row) => [row.id, row]));

function seed(now: Date): AdsStore {
  const ms = now.getTime();
  const campaigns = seedCampaigns(ms);
  const units = seedUnits(ms);
  const { creatives, uploads } = seedCreatives(ms);
  return {
    campaigns: byId(campaigns),
    placements: byId(seedPlacements(ms)),
    units: byId(units),
    creatives: byId(creatives),
    uploads: byId(uploads),
    next: {
      campaign: campaigns.length + 1,
      unit: units.length + 1,
      creative: creatives.length + 1,
      upload: 1,
    },
    geoConfigured: false,
    mediaAvailable: true,
    nextMedia: null,
    mediaCursor: 0,
  };
}

const holder = globalThis as { __avatarAdminMockAds?: AdsStore };

export const adsState: AdsStore = (() => {
  holder.__avatarAdminMockAds ??= seed(new Date());
  return holder.__avatarAdminMockAds;
})();

export function resetAdsStore(now: Date = new Date()): void {
  Object.assign(adsState, seed(now));
}

/** The name of the administrator, read when asked; `null` when the administrator has been deleted. */
export const usernameOf = (id: string | null): string | null =>
  id === null ? null : (store.admins.get(id)?.username ?? null);
