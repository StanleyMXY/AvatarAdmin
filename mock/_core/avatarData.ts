// In-memory state of the avatar, cosmetic and complaint endpoints of the mock backend: the cosmetic
// and action catalogs, upload records, declaration versions, renderer models, failed generation
// tasks, system default avatars, the avatars of a few accounts, and the likeness complaints. It
// hangs on `globalThis` like the rest of the mock state (see store.ts), so saving a mock file does
// not lose it; `resetAvatarStore` puts the sample data back (the tests call it, a restart does it too).
// Not a mock file itself: Umi's loader reads every file in mock/, and only files that export
// handlers belong there, so this one lives in _core/.
import { multilingualSamples } from './fixtures';

export const ACCOUNT = {
  /** Has two avatars with looks and four cosmetics. */
  rich: '00000000-0000-4000-8000-0000000000a1',
  /** Exists but has no avatar. */
  empty: '00000000-0000-4000-8000-0000000000a3',
} as const;

export type Surface = { platform: 'ANDROID' | 'IOS'; channel: string | null };

export type MockCosmetic = {
  id: string;
  key: string;
  kind: 'OUTFIT' | 'BACKGROUND';
  names: Record<string, string>;
  /** The name of the file behind the preview address; `null`: the file is missing. */
  previewFile: string | null;
  generationSpec: string;
  compatibleStyles: ('STYLIZED_3D' | 'REALISTIC')[];
  surfaces: Surface[];
  creditPrice: number | null;
  isFree: boolean;
  isDefault: boolean;
  enabled: boolean;
  sortOrder: number;
};

export type MockAction = {
  id: string;
  key: string;
  names: Record<string, string>;
  description: string;
  iconFile: string | null;
  generationSpec: string;
  compatibleStyles: ('STYLIZED_3D' | 'REALISTIC')[];
  surfaces: Surface[];
  triggerableBy: 'USER' | 'AGENT' | 'BOTH';
  enabled: boolean;
  sortOrder: number;
  /** How many existing looks lack the clip of this action (what a backfill would queue). */
  missingClips: number;
};

export type MockUpload = {
  id: string;
  kind: 'CATALOG_IMAGE' | 'RENDERER_MODEL' | 'DEFAULT_AVATAR_SOURCE';
  sizeBytes: number;
  sha256: string;
  used: boolean;
};

export type MockDeclaration = {
  version: string;
  texts: Record<string, string>;
  activeFrom: string | null;
  isActive: boolean;
};

export type MockRendererModel = {
  id: string;
  rendererKind: string;
  version: string;
  platform: 'ANDROID' | 'IOS';
  abi: string;
  sha256: string;
  sizeBytes: number;
  rendererFormatVersion: number;
  minVersionCode: number;
  enabled: boolean;
  createdAt: string;
};

export type MockGenerationTask = {
  id: string;
  accountId: string | null;
  type: 'AVATAR' | 'VOICE' | 'LOOK' | 'LOOK_REPREPARE' | 'ACTION_CLIP';
  status: 'FAILED' | 'SUCCEEDED' | 'PROCESSING';
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MockDefaultAvatar = {
  id: string;
  name: string;
  style: 'STYLIZED_3D' | 'REALISTIC';
  status: 'DRAFT' | 'GENERATING' | 'READY';
  isActive: boolean;
  failureReason: string | null;
  lookId: string | null;
  sourceFile: string | null;
  previewFile: string | null;
  /** When the generation was started (epoch ms), while it runs. */
  startedAt: number | null;
  createdAt: number;
};

export type MockAccountLook = {
  lookId: string;
  status: 'READY';
  outfitItemId: string | null;
  backgroundItemId: string | null;
  previewFile: string | null;
  createdAt: string;
};

export type MockAccountAvatar = {
  assetId: string;
  name: string;
  style: 'STYLIZED_3D' | 'REALISTIC';
  createdAt: string;
  currentLookId: string | null;
  looks: MockAccountLook[];
};

export type MockOwned = {
  itemId: string;
  itemKey: string;
  source: 'CREDITS' | 'ADMIN_GRANT';
  creditLedgerId: string | null;
  grantedAt: string;
};

export type MockComplaintStatus =
  | 'RECEIVED'
  | 'INVESTIGATING'
  | 'RESOLVED_REMOVED'
  | 'RESOLVED_NOT_FOUND'
  | 'REJECTED';

export type MockComplaintEvent = {
  id: string;
  fromStatus: MockComplaintStatus | null;
  toStatus: MockComplaintStatus;
  note: string | null;
  adminId: string | null;
  createdAt: string;
};

export type MockComplaint = {
  id: string;
  contactEmail: string;
  description: string;
  status: MockComplaintStatus;
  receivedAt: string;
  dueAt: string;
  resolvedAt: string | null;
  handledBy: string | null;
  relatedAvatarAssetIds: string[];
  /** The media type of each piece of evidence, by index. */
  evidence: string[];
  events: MockComplaintEvent[];
};

export type AvatarStore = {
  cosmetics: MockCosmetic[];
  actions: MockAction[];
  uploads: Map<string, MockUpload>;
  declarations: MockDeclaration[];
  rendererModels: MockRendererModel[];
  generationTasks: MockGenerationTask[];
  defaultAvatars: MockDefaultAvatar[];
  accountAvatars: Map<string, MockAccountAvatar[]>;
  accountCosmetics: Map<string, MockOwned[]>;
  complaints: MockComplaint[];
  /** The audit trail of evidence reads, newest last: who read which piece of which complaint. */
  evidenceReads: { complaintId: string; index: number; adminId: string }[];
  /** False: the generation of a default avatar answers 503 GENERATION_NOT_CONFIGURED. */
  generationConfigured: boolean;
  /** Counts the addresses handed out, so that every list answer carries new ones. */
  signatures: number;
  next: { id: number; upload: number };
};

const HOUR = 3600 * 1000;
const { th, ar, id: idn, vi, es, en, zh } = multilingualSamples;

const S3D = 'STYLIZED_3D' as const;
const REAL = 'REALISTIC' as const;

/** A catalog name in the languages the product targets; the English one always exists but for a few rows. */
function names(n: number): Record<string, string> {
  const pick = (list: readonly string[]) => list[n % list.length];
  return {
    en: pick(en),
    'zh-Hans': pick(zh),
    th: pick(th),
    ar: pick(ar),
    id: pick(idn),
    vi: pick(vi),
    es: pick(es),
  };
}

function seed(now: Date): AvatarStore {
  const ago = (hours: number): string => new Date(now.getTime() - hours * HOUR).toISOString();
  const ahead = (hours: number): string => new Date(now.getTime() + hours * HOUR).toISOString();
  const uuid = (prefix: string, n: number) =>
    `00000000-0000-4000-8000-${prefix}${String(n).padStart(8, '0')}`;

  const cosmetics: MockCosmetic[] = [
    {
      id: '1',
      key: 'outfit_default',
      kind: 'OUTFIT',
      names: { en: 'Everyday outfit', 'zh-Hans': '日常装' },
      previewFile: 'outfit-default.svg',
      generationSpec: 'a plain white t-shirt',
      compatibleStyles: [S3D, REAL],
      surfaces: [],
      creditPrice: null,
      isFree: true,
      isDefault: true,
      enabled: true,
      sortOrder: 0,
    },
    {
      id: '2',
      key: 'bg_default',
      kind: 'BACKGROUND',
      names: { en: 'Soft studio', 'zh-Hans': '柔光影棚' },
      previewFile: 'bg-default.svg',
      generationSpec: 'a softly lit photo studio with a pale wall',
      compatibleStyles: [S3D, REAL],
      surfaces: [],
      creditPrice: null,
      isFree: true,
      isDefault: true,
      enabled: true,
      sortOrder: 0,
    },
    {
      id: '3',
      key: 'outfit_red_dress',
      kind: 'OUTFIT',
      names: names(0),
      previewFile: 'outfit-red-dress.svg',
      generationSpec: 'a red evening dress with thin straps',
      compatibleStyles: [S3D],
      surfaces: [{ platform: 'ANDROID', channel: null }],
      creditPrice: 150,
      isFree: false,
      isDefault: false,
      enabled: true,
      sortOrder: 10,
    },
    {
      id: '4',
      key: 'outfit_blue_suit',
      kind: 'OUTFIT',
      names: names(1),
      previewFile: 'outfit-blue-suit.svg',
      generationSpec: 'a navy blue business suit with a white shirt',
      compatibleStyles: [REAL],
      surfaces: [
        { platform: 'ANDROID', channel: 'play' },
        { platform: 'IOS', channel: null },
      ],
      creditPrice: 120,
      isFree: false,
      isDefault: false,
      enabled: true,
      sortOrder: 20,
    },
    {
      id: '5',
      key: 'bg_beach',
      kind: 'BACKGROUND',
      names: names(2),
      previewFile: 'bg-beach.svg',
      generationSpec: 'a sunny beach with soft waves behind',
      compatibleStyles: [S3D, REAL],
      surfaces: [],
      creditPrice: 80,
      isFree: false,
      isDefault: false,
      enabled: true,
      sortOrder: 30,
    },
    {
      id: '6',
      key: 'bg_night_city',
      kind: 'BACKGROUND',
      names: names(3),
      previewFile: null,
      generationSpec: 'a night city skyline with warm lights',
      compatibleStyles: [S3D],
      surfaces: [],
      creditPrice: null,
      isFree: false,
      isDefault: false,
      enabled: false,
      sortOrder: 40,
    },
    {
      // A name without English and one that is a single long string: the table must hold both.
      id: '7',
      key: 'outfit_only_thai',
      kind: 'OUTFIT',
      names: { th: th[2] },
      previewFile: 'outfit-only-thai.svg',
      generationSpec: 'a light summer shirt',
      compatibleStyles: [S3D, REAL],
      surfaces: [],
      creditPrice: 60,
      isFree: false,
      isDefault: false,
      enabled: true,
      sortOrder: 50,
    },
    {
      id: '8',
      key: 'outfit_long_name',
      kind: 'OUTFIT',
      names: { en: multilingualSamples.longUnbroken, ar: ar[2] },
      previewFile: 'outfit-long-name.svg',
      generationSpec: 'a long grey coat',
      compatibleStyles: [REAL],
      surfaces: [],
      creditPrice: 90,
      isFree: false,
      isDefault: false,
      enabled: true,
      sortOrder: 60,
    },
  ];
  for (let n = 0; n < 18; n++) {
    cosmetics.push({
      id: String(9 + n),
      key: `bulk_item_${String(n + 1).padStart(2, '0')}`,
      kind: n % 2 === 0 ? 'OUTFIT' : 'BACKGROUND',
      names: names(n + 4),
      previewFile: `bulk-${n + 1}.svg`,
      generationSpec: `item number ${n + 1} for the paging of the list`,
      compatibleStyles: n % 3 === 0 ? [S3D, REAL] : [S3D],
      surfaces: [],
      creditPrice: n % 4 === 0 ? null : 40 + n,
      isFree: n % 4 === 0,
      isDefault: false,
      enabled: n % 5 !== 0,
      sortOrder: 100 + n,
    });
  }

  const actions: MockAction[] = [
    ['wave', 'BOTH', true, 7],
    ['smile', 'USER', true, 0],
    ['shy', 'AGENT', true, 3],
    ['nod', 'BOTH', true, 0],
    ['blow_kiss', 'USER', false, 4],
    ['dance', 'BOTH', true, 12],
  ].map(([key, by, enabled, missing], n) => ({
    id: String(n + 1),
    key: key as string,
    names: names(n),
    description: `The character performs the ${key} gesture and keeps looking at the user.`,
    iconFile: n === 3 ? null : `action-${key}.svg`,
    generationSpec: `The person ${String(key).replace('_', ' ')}s toward the camera with a natural expression.`,
    compatibleStyles: n % 2 === 0 ? [S3D, REAL] : [S3D],
    surfaces: n === 2 ? [{ platform: 'IOS' as const, channel: null }] : [],
    triggerableBy: by as MockAction['triggerableBy'],
    enabled: enabled as boolean,
    sortOrder: n * 10,
    missingClips: missing as number,
  }));

  const declarations: MockDeclaration[] = [
    {
      version: '2026-09-v1',
      texts: { en: en[0], th: th[0], ar: ar[0], 'zh-Hans': zh[0] },
      activeFrom: ago(24 * 20),
      isActive: false,
    },
    {
      version: '2026-10-v2',
      texts: {
        en: en[1],
        th: th[1],
        ar: ar[1],
        id: idn[1],
        vi: vi[1],
        es: es[1],
        'zh-Hans': zh[1],
      },
      activeFrom: ago(24 * 3),
      isActive: true,
    },
    {
      version: '2026-11-v3-draft',
      texts: { en: en[2], es: es[2] },
      activeFrom: null,
      isActive: false,
    },
  ];

  const rendererModels: MockRendererModel[] = [
    {
      id: '1',
      rendererKind: 'AVATAR_RENDERER_V1',
      version: '1.0.0',
      platform: 'ANDROID',
      abi: 'arm64-v8a',
      sha256: 'a3f1c9d2e47b58c01f6a2b9d84e3705ca1b6f08d92e4c7a35b10d6e8f9a2c4b7',
      sizeBytes: 48_234_496,
      rendererFormatVersion: 1,
      minVersionCode: 100,
      enabled: true,
      createdAt: ago(24 * 14),
    },
    {
      id: '2',
      rendererKind: 'AVATAR_RENDERER_V1',
      version: '1.0.0',
      platform: 'IOS',
      abi: 'arm64',
      sha256: '0b7e5d1a93c4f28e6d07a1b35c9f84e2d6a07b13c58e9f4a2d61b0c37e85f9a4',
      sizeBytes: 51_380_224,
      rendererFormatVersion: 1,
      minVersionCode: 100,
      enabled: true,
      createdAt: ago(24 * 14),
    },
    {
      id: '3',
      rendererKind: 'AVATAR_RENDERER_V1',
      version: '0.9.2',
      platform: 'ANDROID',
      abi: 'armeabi-v7a',
      sha256: 'f5d83b0a1c7e92466ab05d3e8f17c42b9a60d5e13f8b7c24a9d0e61b53f7a8c0',
      sizeBytes: 39_845_888,
      rendererFormatVersion: 1,
      minVersionCode: 80,
      enabled: false,
      createdAt: ago(24 * 40),
    },
  ];

  const reasons = [
    'CONTENT_REJECTED',
    'GENERATION_FAILED',
    'EXTERNAL_TIMEOUT',
    'EXTERNAL_TASK_LOST',
    'SUBJECT_UNDERAGE',
    'NO_FACE_DETECTED',
    'ACCOUNT_DELETED',
  ];
  const taskTypes: MockGenerationTask['type'][] = [
    'AVATAR',
    'VOICE',
    'LOOK',
    'LOOK_REPREPARE',
    'ACTION_CLIP',
  ];
  const generationTasks: MockGenerationTask[] = Array.from({ length: 27 }, (_, n) => ({
    id: uuid('0000000f', n + 1),
    // Every fifth task is a system task: it has no account.
    accountId: n % 5 === 0 ? null : uuid('0000000a', (n % 4) + 1),
    type: taskTypes[n % taskTypes.length],
    status: 'FAILED',
    failureReason: n % 9 === 8 ? null : reasons[n % reasons.length],
    createdAt: ago(n * 5 + 2),
    updatedAt: ago(n * 5 + 1),
  }));
  generationTasks.push(
    {
      ...generationTasks[0],
      id: uuid('0000000f', 100),
      accountId: ACCOUNT.rich,
      type: 'AVATAR',
      status: 'SUCCEEDED',
      failureReason: null,
    },
    {
      ...generationTasks[0],
      id: uuid('0000000f', 101),
      accountId: ACCOUNT.rich,
      type: 'LOOK',
      status: 'PROCESSING',
      failureReason: null,
    },
  );

  const defaultAvatars: MockDefaultAvatar[] = [
    {
      id: 'da-5',
      name: 'Mira',
      style: REAL,
      status: 'READY',
      isActive: true,
      failureReason: null,
      lookId: 'look-da-5',
      sourceFile: 'source-mira.svg',
      previewFile: 'preview-mira.svg',
      startedAt: null,
      createdAt: now.getTime() - 9 * 24 * HOUR,
    },
    {
      id: 'da-4',
      name: th[0],
      style: S3D,
      status: 'READY',
      isActive: false,
      failureReason: null,
      lookId: 'look-da-4',
      sourceFile: 'source-thai.svg',
      previewFile: 'preview-thai.svg',
      startedAt: null,
      createdAt: now.getTime() - 6 * 24 * HOUR,
    },
    {
      id: 'da-3',
      name: ar[0],
      style: S3D,
      status: 'DRAFT',
      isActive: false,
      failureReason: 'SUBJECT_UNDERAGE',
      lookId: null,
      sourceFile: 'source-arabic.svg',
      previewFile: null,
      startedAt: null,
      createdAt: now.getTime() - 4 * 24 * HOUR,
    },
    {
      id: 'da-2',
      name: 'Luna 😀',
      style: S3D,
      status: 'GENERATING',
      isActive: false,
      failureReason: null,
      lookId: null,
      sourceFile: 'source-luna.svg',
      previewFile: null,
      // Long enough that the page shows it as running (see settleGenerations).
      startedAt: now.getTime() + 365 * 24 * HOUR,
      createdAt: now.getTime() - 2 * 24 * HOUR,
    },
    {
      id: 'da-1',
      name: multilingualSamples.longUnbroken.slice(0, 30),
      style: REAL,
      status: 'DRAFT',
      isActive: false,
      failureReason: null,
      lookId: null,
      sourceFile: null,
      previewFile: null,
      startedAt: null,
      createdAt: now.getTime() - 1 * 24 * HOUR,
    },
  ];

  const accountAvatars = new Map<string, MockAccountAvatar[]>();
  accountAvatars.set(ACCOUNT.rich, [
    {
      assetId: uuid('00000a55', 1),
      name: 'Sakura',
      style: S3D,
      createdAt: ago(24 * 12),
      currentLookId: uuid('000001c0', 2),
      looks: [
        {
          lookId: uuid('000001c0', 2),
          status: 'READY',
          outfitItemId: '3',
          backgroundItemId: '5',
          previewFile: 'face-look-2.svg',
          createdAt: ago(24 * 5),
        },
        {
          lookId: uuid('000001c0', 1),
          status: 'READY',
          outfitItemId: '1',
          backgroundItemId: '2',
          previewFile: null,
          createdAt: ago(24 * 12),
        },
      ],
    },
    {
      assetId: uuid('00000a55', 2),
      name: th[0].slice(0, 20),
      style: REAL,
      createdAt: ago(24 * 30),
      currentLookId: null,
      looks: [],
    },
  ]);
  accountAvatars.set(ACCOUNT.empty, []);

  const accountCosmetics = new Map<string, MockOwned[]>();
  accountCosmetics.set(ACCOUNT.rich, [
    {
      itemId: '3',
      itemKey: 'outfit_red_dress',
      source: 'CREDITS',
      creditLedgerId: '1001',
      grantedAt: ago(24 * 6),
    },
    {
      itemId: '5',
      itemKey: 'bg_beach',
      source: 'ADMIN_GRANT',
      creditLedgerId: null,
      grantedAt: ago(24 * 5),
    },
  ]);
  accountCosmetics.set(ACCOUNT.empty, []);

  const complaint = (
    n: number,
    status: MockComplaintStatus,
    receivedHoursAgo: number,
    dueInHours: number,
    description: string,
    evidence: string[],
    extra: Partial<MockComplaint> = {},
  ): MockComplaint => ({
    id: uuid('0000c0a1', n),
    contactEmail: `person${n}@example.org`,
    description,
    status,
    receivedAt: ago(receivedHoursAgo),
    dueAt: ahead(dueInHours),
    resolvedAt: null,
    handledBy: null,
    relatedAvatarAssetIds: [],
    evidence,
    events: [],
    ...extra,
  });

  const complaints: MockComplaint[] = [
    complaint(1, 'RECEIVED', 60, -12, en[2], ['image/jpeg', 'image/png']),
    complaint(2, 'INVESTIGATING', 50, -2, th[2], ['application/pdf'], {
      handledBy: '1002',
      events: [
        {
          id: '1',
          fromStatus: 'RECEIVED',
          toStatus: 'INVESTIGATING',
          note: 'Asked the uploader for the original photo',
          adminId: '1002',
          createdAt: ago(40),
        },
      ],
    }),
    complaint(3, 'RECEIVED', 10, 38, ar[2], []),
    complaint(4, 'RECEIVED', 3, 45, `${multilingualSamples.longUnbroken}${'ب'.repeat(300)}`, [
      'image/png',
      'image/jpeg',
      'application/pdf',
    ]),
    complaint(5, 'RESOLVED_REMOVED', 200, -150, es[2], ['image/jpeg'], {
      status: 'RESOLVED_REMOVED',
      resolvedAt: ago(120),
      handledBy: '1001',
      relatedAvatarAssetIds: [uuid('00000a55', 7), uuid('00000a55', 8)],
      events: [
        {
          id: '2',
          fromStatus: 'RECEIVED',
          toStatus: 'INVESTIGATING',
          note: null,
          adminId: '1001',
          createdAt: ago(180),
        },
        {
          id: '3',
          fromStatus: 'INVESTIGATING',
          toStatus: 'RESOLVED_REMOVED',
          note: 'Found both avatars by the uploader email',
          adminId: '1001',
          createdAt: ago(120),
        },
      ],
    }),
    complaint(6, 'RESOLVED_NOT_FOUND', 150, -100, vi[2], [], {
      resolvedAt: ago(90),
      handledBy: '9999',
      events: [
        {
          id: '4',
          fromStatus: 'RECEIVED',
          toStatus: 'RESOLVED_NOT_FOUND',
          note: idn[2],
          adminId: '9999',
          createdAt: ago(90),
        },
      ],
    }),
    complaint(7, 'REJECTED', 90, -40, zh[2], ['image/png'], {
      resolvedAt: ago(50),
      handledBy: '1002',
      events: [
        {
          id: '5',
          fromStatus: 'RECEIVED',
          toStatus: 'REJECTED',
          note: zh[3],
          adminId: '1002',
          createdAt: ago(50),
        },
      ],
    }),
  ];
  for (let n = 8; n <= 24; n++) {
    complaints.push(
      complaint(
        n,
        n % 2 === 0 ? 'RECEIVED' : 'INVESTIGATING',
        n * 2,
        // Due after the seven above, so that the first page holds them in the order the tests expect.
        60 + n,
        [en, th, ar, idn, vi, es, zh][n % 7][0],
        n % 3 === 0 ? ['image/jpeg'] : [],
      ),
    );
  }

  return {
    cosmetics,
    actions,
    uploads: new Map(),
    declarations,
    rendererModels,
    generationTasks,
    defaultAvatars,
    accountAvatars,
    accountCosmetics,
    complaints,
    evidenceReads: [],
    generationConfigured: true,
    signatures: 0,
    next: { id: 1000, upload: 1 },
  };
}

const holder = globalThis as { __avatarAdminMockAvatar?: AvatarStore };

export const avatarState: AvatarStore = (() => {
  holder.__avatarAdminMockAvatar ??= seed(new Date());
  return holder.__avatarAdminMockAvatar;
})();

/** Puts the sample data back (in place, so that every importer sees it). */
export function resetAvatarStore(now: Date = new Date()): void {
  Object.assign(avatarState, seed(now));
}

export const nextId = (): string => String(avatarState.next.id++);

/** A signed address of a file of the mock backend: a new one on every call, as the real addresses are. */
export function signedUrl(file: string | null): string | null {
  if (file === null) return null;
  avatarState.signatures += 1;
  return `/api/admin/mock-files/${encodeURIComponent(file)}?sig=${avatarState.signatures}`;
}

/** The statuses that close a complaint. */
export const CLOSED = ['RESOLVED_REMOVED', 'RESOLVED_NOT_FOUND', 'REJECTED'];

/** How long a generation of the mock backend takes (ms). */
export const GENERATION_MS = 3000;

/**
 * Finishes the generations that have run long enough: the avatar becomes READY with a preview, or,
 * when the name says "fail", goes back to DRAFT with a reason (a failed generation is never a state).
 */
export function settleGenerations(now: number = Date.now()): void {
  for (const row of avatarState.defaultAvatars) {
    if (row.status !== 'GENERATING' || row.startedAt === null) continue;
    if (now - row.startedAt < GENERATION_MS) continue;
    row.startedAt = null;
    if (/\bfail\b/i.test(row.name)) {
      row.status = 'DRAFT';
      row.failureReason = 'GENERATION_FAILED';
    } else {
      row.status = 'READY';
      row.lookId = `look-${row.id}`;
      row.previewFile = `preview-${row.id}.svg`;
    }
  }
}
