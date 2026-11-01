// State of the user module in the mock backend: the accounts (with the facts the list, the detail and
// the abuse report are made of), their devices, authentication events and sessions, the deletion
// tasks and the registration audit. It hangs on `globalThis`, like the rest of the mock state, so
// saving a mock file does not lose it; `resetUsersStore` puts the sample data back (tests call it).
//
// The accounts include the ids that the other mock modules (credits, avatars, memory, subscriptions)
// use for theirs, so the tabs of a user in the browser have data behind them.
import { createHash } from 'node:crypto';
import { SAMPLE_LANGUAGES, sampleText } from './fixtures';
import { findAdminByUsername } from './store';

export type UserStatus = 'ACTIVE' | 'BANNED' | 'PENDING_DELETION' | 'DELETING';
export type RegisterMethod = 'EMAIL' | 'GOOGLE' | 'APPLE' | 'PHONE';

export type MockAttribution = {
  source: string | null;
  matchType: string | null;
  mediaSource: string | null;
  campaign: string | null;
  installTime: string | null;
  registeredAt: string | null;
};

export type MockUser = {
  id: string;
  /** The whole e-mail; the endpoints mask it unless the administrator may see it. */
  email: string | null;
  emailVerifiedAt: string | null;
  phone: string | null;
  phoneVerifiedAt: string | null;
  status: UserStatus;
  banReason: string | null;
  bannedAt: string | null;
  currentAvatarAssetId: string | null;
  currentVoiceAssetId: string | null;
  personaModerationStatus: string | null;
  companionName: string | null;
  timezone: string | null;
  conversationLanguage: string | null;
  lifetimeGrantSeconds: number | null;
  lifetimeUsedSeconds: number | null;
  channelCode: string | null;
  registerPlatform: string | null;
  priorInviteeRewarded: boolean | null;
  inviteRewardedCount: number | null;
  createdAt: string;
  loginMethods: string[];
  trafficType: 'PAID' | 'ORGANIC';
  companionship: {
    interactionCount: number;
    currentStreak: number;
    lastInteractionDate: string | null;
    lastInteractionAt: string | null;
  };
  counts: { avatars: number; voices: number; looks: number; cosmetics: number };
  attribution: MockAttribution | null;
  // ---- kept by the backend, never returned by the detail ----
  /** Has a valid store subscription entitlement (the report counts such an account as paid). */
  paid: boolean;
  registerMethod: RegisterMethod;
  /** The opaque device and IP keys of the registration audit (HMACs in the real system). */
  deviceKey: string;
  ipKey: string;
};

export type MockDevice = {
  id: string;
  platform: string;
  appVersion: string;
  locale: string;
  lastSeenAt: string;
  tokenSuffix: string;
};

export type MockAuthEvent = {
  type: string;
  reason: string | null;
  deviceIdHashPrefix: string | null;
  ipHashPrefix: string | null;
  at: string;
};

export type MockSession = {
  id: string;
  requestedAt: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  modelTier: string;
  language: string;
  endReason: string | null;
};

export type MockDeletion = {
  id: string;
  accountId: string;
  requestedBy: string | null;
  reason: string | null;
  status: 'SCHEDULED' | 'CANCELED' | 'PENDING' | 'RUNNING' | 'FAILED' | 'COMPLETED';
  executeAfter: string | null;
  statusBefore: 'ACTIVE' | 'BANNED' | null;
  canceledAt: string | null;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
  completedAt: string | null;
};

type UsersState = {
  users: MockUser[];
  devices: Map<string, MockDevice[]>;
  authEvents: Map<string, MockAuthEvent[]>;
  sessions: Map<string, MockSession[]>;
  deletions: MockDeletion[];
  nextDeletionId: number;
};

/** The sample accounts by what makes each of them interesting (the first five share ids with the credit and avatar mocks). */
export const USER = {
  /** E-mail, phone and Google login, an attribution record, care data, devices, many events. */
  rich: '00000000-0000-4000-8000-0000000000a1',
  negative: '00000000-0000-4000-8000-0000000000a2',
  /** Phone only, no e-mail, no attribution record, no care data. */
  noAttribution: '00000000-0000-4000-8000-0000000000a3',
  pendingDeletion: '00000000-0000-4000-8000-0000000000a4',
  deleting: '00000000-0000-4000-8000-0000000000a5',
  /** Shares its id with the memory mock's banned account. */
  banned: '2005',
} as const;

const holder = globalThis as { __avatarAdminMockUsers?: UsersState };
holder.__avatarAdminMockUsers ??= {
  users: [],
  devices: new Map(),
  authEvents: new Map(),
  sessions: new Map(),
  deletions: [],
  nextDeletionId: 9000,
};

export const usersState: UsersState = holder.__avatarAdminMockUsers;

// ---- masks (contract 17.4) ----

/** `a***@d***.com`: the first character of the local part and of every label of the domain but the last, which stays. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 0) return '***';
  const local = email.slice(0, at);
  const labels = email.slice(at + 1).split('.');
  const first = (text: string) => Array.from(text)[0] ?? '';
  const maskedLocal = Array.from(local).length <= 1 ? '*' : `${first(local)}***`;
  const maskedDomain = labels
    .map((label, index) => (index === labels.length - 1 ? label : `${first(label)}***`))
    .join('.');
  return `${maskedLocal}@${maskedDomain}`;
}

/** Only the last four digits are kept. */
export const maskPhone = (phone: string): string => `****${phone.slice(-4)}`;

/** The e-mail normalised the way the backend does for a filter (contract 2.2): trimmed, lower case. */
export const normaliseEmail = (email: string): string => email.trim().toLowerCase();

// ---- seed ----

const hex = (seed: string, length = 64): string =>
  createHash('sha256').update(seed).digest('hex').slice(0, length);

const MINUTE = 60 * 1000;
const agoMinutes = (minutes: number): string =>
  new Date(Date.now() - minutes * MINUTE).toISOString();
const agoDays = (days: number, extraMinutes = 0): string =>
  agoMinutes(days * 24 * 60 + extraMinutes);

const LANGUAGE_TAGS = ['th', 'ar', 'id', 'vi', 'es', 'en', 'zh'] as const;
const TIMEZONES = [
  'Asia/Bangkok',
  'Asia/Riyadh',
  'Asia/Jakarta',
  'Asia/Ho_Chi_Minh',
  'Europe/Madrid',
  'America/New_York',
  'Asia/Shanghai',
];
const COMPANION_NAMES = ['ฟ้าใส', 'نجمة', 'Bintang', 'Ánh Dương', 'Estrella', 'Skye', '小星'];
const CHANNELS = ['google_play', 'huawei', 'xiaomi', 'official', null];
const MEDIA = ['Facebook Ads', 'Google Ads', 'TikTok Ads', 'Organic', null];

type Base = Partial<MockUser> & { id: string };

function makeUser(index: number, over: Base): MockUser {
  const language = index % LANGUAGE_TAGS.length;
  const created = over.createdAt ?? agoDays(40 + index, index);
  const media = MEDIA[index % MEDIA.length];
  const hasAttribution = media !== null;
  const paidTraffic = media !== null && media.toLowerCase() !== 'organic';
  return {
    email: `user${index}@example.com`,
    emailVerifiedAt: created,
    phone: null,
    phoneVerifiedAt: null,
    status: 'ACTIVE',
    banReason: null,
    bannedAt: null,
    currentAvatarAssetId: null,
    currentVoiceAssetId: null,
    personaModerationStatus: 'NONE',
    companionName: COMPANION_NAMES[language],
    timezone: TIMEZONES[language],
    conversationLanguage: LANGUAGE_TAGS[language],
    lifetimeGrantSeconds: 600,
    lifetimeUsedSeconds: (index * 37) % 600,
    channelCode: CHANNELS[index % CHANNELS.length],
    registerPlatform: index % 2 === 0 ? 'ANDROID' : 'IOS',
    priorInviteeRewarded: false,
    inviteRewardedCount: index % 4 === 0 ? 1 : 0,
    createdAt: created,
    loginMethods: ['EMAIL'],
    trafficType: paidTraffic ? 'PAID' : 'ORGANIC',
    companionship: {
      interactionCount: index * 3,
      currentStreak: index % 5,
      lastInteractionDate: index === 0 ? null : agoDays(1).slice(0, 10),
      lastInteractionAt: index === 0 ? null : agoDays(1),
    },
    counts: { avatars: index % 3, voices: index % 2, looks: index % 4, cosmetics: index % 3 },
    attribution: hasAttribution
      ? {
          source: 'APPSFLYER',
          matchType: index % 2 === 0 ? 'DEVICE_ID' : 'CLICK',
          mediaSource: media,
          campaign: `launch_${LANGUAGE_TAGS[language]}`,
          installTime: created,
          registeredAt: created,
        }
      : null,
    paid: false,
    registerMethod: 'EMAIL',
    deviceKey: hex(`device-${over.id}`),
    ipKey: hex(`ip-${over.id}`),
    ...over,
  };
}

function seedUsers(): MockUser[] {
  const list: MockUser[] = [];
  const add = (over: Base) => list.push(makeUser(list.length + 1, over));

  add({
    id: USER.rich,
    email: 'maria.garcia@example.com',
    phone: '+34612345678',
    phoneVerifiedAt: agoDays(30),
    loginMethods: ['EMAIL', 'PHONE', 'GOOGLE'],
    companionName: COMPANION_NAMES[0],
    timezone: 'Asia/Bangkok',
    conversationLanguage: 'th',
    channelCode: 'google_play',
    registerPlatform: 'ANDROID',
    trafficType: 'PAID',
    currentAvatarAssetId: '00000000-0000-4000-8000-000000000a55',
    currentVoiceAssetId: '00000000-0000-4000-8000-000000000b01',
    companionship: {
      interactionCount: 128,
      currentStreak: 6,
      lastInteractionDate: agoDays(1).slice(0, 10),
      lastInteractionAt: agoDays(1),
    },
    counts: { avatars: 2, voices: 1, looks: 2, cosmetics: 2 },
    attribution: {
      source: 'APPSFLYER',
      matchType: 'DEVICE_ID',
      mediaSource: 'Facebook Ads',
      campaign: 'th_launch',
      installTime: agoDays(45),
      registeredAt: agoDays(44),
    },
    createdAt: agoDays(44),
    paid: true,
    registerMethod: 'EMAIL',
  });
  add({
    id: USER.negative,
    email: 'nguyen.an@example.vn',
    companionName: 'Ánh Dương',
    timezone: 'Asia/Ho_Chi_Minh',
    conversationLanguage: 'vi',
    channelCode: 'official',
    trafficType: 'ORGANIC',
    attribution: {
      source: 'SELF',
      matchType: null,
      mediaSource: 'Organic',
      campaign: null,
      installTime: agoDays(30),
      registeredAt: agoDays(30),
    },
    createdAt: agoDays(30),
  });
  add({
    id: USER.noAttribution,
    email: null,
    emailVerifiedAt: null,
    phone: '+66812345678',
    phoneVerifiedAt: agoDays(20),
    loginMethods: ['PHONE'],
    companionName: null,
    timezone: 'Asia/Bangkok',
    conversationLanguage: 'th',
    channelCode: null,
    trafficType: 'ORGANIC',
    attribution: null,
    companionship: {
      interactionCount: 0,
      currentStreak: 0,
      lastInteractionDate: null,
      lastInteractionAt: null,
    },
    counts: { avatars: 0, voices: 0, looks: 0, cosmetics: 0 },
    createdAt: agoDays(20),
    registerMethod: 'PHONE',
  });
  add({
    id: USER.pendingDeletion,
    email: 'ahmed.ali@example.ae',
    status: 'PENDING_DELETION',
    companionName: 'نجمة',
    timezone: 'Asia/Riyadh',
    conversationLanguage: 'ar',
    createdAt: agoDays(90),
  });
  add({
    id: USER.deleting,
    email: 'sari.dewi@example.id',
    status: 'DELETING',
    companionName: 'Bintang',
    timezone: 'Asia/Jakarta',
    conversationLanguage: 'id',
    createdAt: agoDays(120),
  });
  add({
    id: USER.banned,
    email: 'carlos.ruiz@example.es',
    status: 'BANNED',
    banReason: 'Spam: repeated advertising links in the profile. 违规广告 · spam repetido',
    bannedAt: agoDays(3),
    companionName: 'Estrella',
    timezone: 'Europe/Madrid',
    conversationLanguage: 'es',
    createdAt: agoDays(60),
  });
  // the other ids of the memory mock
  add({ id: '2001', createdAt: agoDays(15) });
  add({ id: '2002', createdAt: agoDays(16) });
  add({
    id: '2003',
    status: 'PENDING_DELETION',
    companionName: 'Skye',
    conversationLanguage: 'en',
    createdAt: agoDays(70),
  });
  add({ id: '2004', status: 'DELETING', createdAt: agoDays(80) });
  // the ids of the subscription mock
  for (let i = 0; i < 10; i++) {
    add({
      id: String(10000000001 + i),
      paid: i % 3 === 0,
      registerMethod: i % 4 === 0 ? 'GOOGLE' : 'EMAIL',
      loginMethods: i % 4 === 0 ? ['GOOGLE'] : ['EMAIL'],
      createdAt: agoDays(12 + i, i * 7),
    });
  }
  // text in every language the product targets, one string without a break, one with an emoji
  const tricky = [
    sampleText('th', 2),
    sampleText('ar', 2),
    sampleText('zh', 2),
    'A'.repeat(300),
    `${sampleText('es', 3)}😀`,
    `${sampleText('vi', 2)} 🎉`,
  ];
  tricky.forEach((name, i) => {
    add({
      id: String(40000000001 + i),
      email: `tricky${i}@example.com`,
      companionName: name,
      status: i === 3 ? 'BANNED' : 'ACTIVE',
      banReason: i === 3 ? 'B'.repeat(400) : null,
      bannedAt: i === 3 ? agoDays(2) : null,
      createdAt: agoDays(5 + i, 3 * i),
    });
  });

  // ---- accounts that the abuse report groups ----
  const group = (
    label: string,
    by: 'device' | 'ip',
    free: number,
    paid: number,
    firstDay: number,
  ) => {
    const shared = hex(`${by}-${label}`);
    for (let i = 0; i < free + paid; i++) {
      const isPaid = i >= free;
      add({
        id: `${label}-${String(i + 1).padStart(2, '0')}`,
        email: `${label}.${i + 1}@example.com`,
        paid: isPaid,
        registerMethod: (['EMAIL', 'GOOGLE', 'APPLE', 'PHONE'] as const)[i % 4],
        deviceKey: by === 'device' ? shared : hex(`${label}-device-${i}`),
        ipKey: by === 'ip' ? shared : hex(`${label}-ip-${i}`),
        companionName: sampleText(SAMPLE_LANGUAGES[i % SAMPLE_LANGUAGES.length], 0),
        createdAt: agoDays(firstDay, i * 90),
      });
    }
  };
  group('dev-a', 'device', 7, 2, 2);
  group('dev-b', 'device', 5, 1, 3);
  group('dev-c', 'device', 3, 0, 4);
  group('ip-a', 'ip', 9, 1, 1);
  group('ip-b', 'ip', 4, 0, 5);

  list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  return list;
}

const STORE_TOKEN_CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function seedDevices(user: MockUser, index: number): MockDevice[] {
  const count = user.id === USER.rich ? 3 : 1 + (index % 2);
  return Array.from({ length: count }, (_, i) => {
    const token = hex(`token-${user.id}-${i}`, 6)
      .split('')
      .map((c, k) => (k % 2 === 0 ? STORE_TOKEN_CHARS[Number.parseInt(c, 16) % 54] : c))
      .join('');
    return {
      id: String(index * 10 + i + 1),
      platform: i % 2 === 0 ? 'ANDROID' : 'IOS',
      appVersion: `1.${4 + i}.${index % 9}`,
      locale: ['th-TH', 'ar-SA', 'id-ID', 'vi-VN', 'es-ES', 'en-US', 'zh-CN'][(index + i) % 7],
      lastSeenAt: agoDays(i + 1, index),
      tokenSuffix: token,
    };
  });
}

const EVENT_PLAN: { type: string; reason: string | null; device: boolean }[] = [
  { type: 'LOGIN_OK', reason: null, device: true },
  { type: 'LOGIN_FAIL', reason: 'INVALID_CREDENTIALS', device: false },
  { type: 'REFRESH_REUSE', reason: null, device: true },
  { type: 'OTP_FAIL', reason: 'OTP_INVALID', device: true },
  { type: 'PASSWORD_CHANGE', reason: null, device: true },
  { type: 'SOCIAL_LINK', reason: null, device: false },
  { type: 'LOGOUT', reason: null, device: true },
  { type: 'LOGIN_OK', reason: null, device: true },
  { type: 'LOGIN_FAIL', reason: 'RATE_LIMITED', device: false },
  { type: 'REGISTER', reason: null, device: true },
];

function seedEvents(user: MockUser): MockAuthEvent[] {
  const count = user.id === USER.rich ? EVENT_PLAN.length : 4;
  return EVENT_PLAN.slice(0, count)
    .map((plan, i) => ({
      type: plan.type,
      reason: plan.reason,
      deviceIdHashPrefix: plan.device ? hex(`ev-device-${user.id}-${i % 2}`, 8) : null,
      ipHashPrefix: hex(`ev-ip-${user.id}-${i % 3}`, 8),
      at: agoMinutes(30 + i * 700),
    }))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

function seedSessions(user: MockUser, index: number): MockSession[] {
  const count = user.id === USER.rich ? 5 : index % 3;
  return Array.from({ length: count }, (_, i) => {
    const requested = agoMinutes(100 + i * 1500);
    const duration = 120 + ((index * 31 + i * 77) % 900);
    const ongoing = i === 0 && index % 4 === 0 && user.id !== USER.rich;
    return {
      id: `s-${user.id.slice(-6)}-${i + 1}`,
      requestedAt: requested,
      startedAt: new Date(Date.parse(requested) + 5000).toISOString(),
      endedAt: ongoing
        ? null
        : new Date(Date.parse(requested) + (duration + 5) * 1000).toISOString(),
      durationSeconds: ongoing ? null : duration,
      modelTier: i % 2 === 0 ? 'STANDARD' : 'PREMIUM',
      language: LANGUAGE_TAGS[(index + i) % LANGUAGE_TAGS.length],
      endReason: ongoing ? null : ['USER_LEFT', 'DEADLINE', 'ROOM_FINISHED', 'BANNED'][i % 4],
    };
  });
}

function seedDeletions(): MockDeletion[] {
  const rootId = findAdminByUsername('root')?.id ?? '1001';
  let n = 0;
  const task = (over: Partial<MockDeletion> & Pick<MockDeletion, 'accountId' | 'status'>) => {
    n += 1;
    const created = over.createdAt ?? agoDays(n, n);
    const row: MockDeletion = {
      id: String(5000 + n),
      requestedBy: null,
      reason: null,
      executeAfter: null,
      statusBefore: 'ACTIVE',
      canceledAt: null,
      attempts: 0,
      lastError: null,
      nextAttemptAt: null,
      createdAt: created,
      completedAt: null,
      ...over,
    };
    return row;
  };
  const future = (days: number) => new Date(Date.now() + days * 24 * 60 * MINUTE).toISOString();
  return [
    task({
      accountId: USER.pendingDeletion,
      status: 'SCHEDULED',
      reason: 'PRIVACY_CONCERN',
      executeAfter: future(9),
      createdAt: agoDays(5),
    }),
    task({
      accountId: '2003',
      status: 'SCHEDULED',
      requestedBy: rootId,
      executeAfter: future(12),
      createdAt: agoDays(2),
    }),
    task({
      accountId: USER.deleting,
      status: 'RUNNING',
      reason: 'TOO_EXPENSIVE',
      executeAfter: agoDays(1),
      nextAttemptAt: agoDays(1),
      createdAt: agoDays(15),
    }),
    task({
      accountId: '2004',
      status: 'PENDING',
      reason: 'OTHER',
      executeAfter: agoMinutes(20),
      nextAttemptAt: agoMinutes(20),
      createdAt: agoDays(14),
    }),
    task({
      accountId: '50000000001',
      status: 'FAILED',
      reason: 'TECHNICAL_PROBLEMS',
      executeAfter: agoDays(3),
      attempts: 2,
      lastError: 'step 1: the memory service answered 503 (service unavailable)',
      nextAttemptAt: agoMinutes(-30),
      createdAt: agoDays(17),
    }),
    task({
      accountId: '50000000002',
      status: 'FAILED',
      requestedBy: rootId,
      executeAfter: agoDays(4),
      attempts: 5,
      lastError: `step 3: ${sampleText('th', 2)}`,
      nextAttemptAt: agoMinutes(-90),
      createdAt: agoDays(18),
    }),
    task({
      accountId: '50000000003',
      status: 'FAILED',
      requestedBy: '9999',
      statusBefore: 'BANNED',
      reason: 'NOT_USEFUL',
      executeAfter: agoDays(6),
      attempts: 8,
      lastError: 'x'.repeat(600),
      nextAttemptAt: agoMinutes(-240),
      createdAt: agoDays(21),
    }),
    task({
      accountId: '50000000004',
      status: 'COMPLETED',
      reason: 'FOUND_ALTERNATIVE',
      executeAfter: agoDays(20),
      completedAt: agoDays(19),
      createdAt: agoDays(34),
    }),
    task({
      accountId: '50000000005',
      status: 'COMPLETED',
      requestedBy: rootId,
      executeAfter: agoDays(25),
      completedAt: agoDays(24),
      createdAt: agoDays(39),
    }),
    task({
      accountId: '50000000006',
      status: 'CANCELED',
      reason: 'TECHNICAL_PROBLEMS',
      executeAfter: agoDays(8),
      canceledAt: agoDays(10),
      createdAt: agoDays(24),
    }),
  ];
}

export function resetUsersStore(): void {
  usersState.users = seedUsers();
  usersState.devices = new Map();
  usersState.authEvents = new Map();
  usersState.sessions = new Map();
  usersState.users.forEach((user, index) => {
    usersState.devices.set(user.id, seedDevices(user, index));
    usersState.authEvents.set(user.id, seedEvents(user));
    usersState.sessions.set(user.id, seedSessions(user, index));
  });
  usersState.deletions = seedDeletions();
  usersState.nextDeletionId = 9000;
}

export const findUser = (id: string): MockUser | undefined =>
  usersState.users.find((user) => user.id === id);

export const nextDeletionId = (): string => String(usersState.nextDeletionId++);

resetUsersStore();
