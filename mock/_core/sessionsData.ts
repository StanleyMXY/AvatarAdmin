// Sample calls for the mock backend (contract 17.4, the 通话 row; the columns are those of the Session
// entity, contract 18). Account sessions carry an account id and no device; guest sessions carry the
// hash of their device and no account. The newest few are the ones the tests look for by name; the
// rest is filler spread over about a week, in every language the product targets. State is on
// `globalThis` so that saving a mock file does not lose it, and can be reset for a test.
import { createHash } from 'node:crypto';

export type MockSession = {
  id: string;
  accountId: string | null;
  /** The whole hash of the device: the page cuts it to 8 characters. */
  deviceId: string | null;
  freeTier: boolean;
  roomName: string;
  requestedAt: string;
  timezone: string;
  modelTier: string;
  language: string;
  renderMode: 'DEVICE' | 'CLOUD' | 'NONE';
  deadlineAt: string;
  startedAt: string;
  endReason: string | null;
  agentJoinedAt: string;
  userJoinedAt: string | null;
  userLeftAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
};

const sha = (seed: string): string => createHash('sha256').update(seed).digest('hex');

export const GUEST_DEVICE = sha('mock-guest-device-1');
const ACCOUNTS = [
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-0000000000a2',
  '00000000-0000-4000-8000-0000000000a3',
  '00000000-0000-4000-8000-0000000000a4',
  '2005',
];

/** The sessions the tests look for by name. */
export const SESSION = {
  registered: 'ses-0001',
  deadline: 'ses-0002',
  ongoing: 'ses-0003',
  guest: 'ses-0004',
  guestOngoing: 'ses-0005',
  hostile: 'ses-0006',
  registeredAccount: ACCOUNTS[0],
} as const;

const TAGS = ['th', 'ar', 'id', 'vi', 'es', 'en', 'zh'] as const;
const ZONES = [
  'Asia/Bangkok',
  'Asia/Riyadh',
  'Asia/Jakarta',
  'Asia/Ho_Chi_Minh',
  'Europe/Madrid',
  'America/Mexico_City',
  'Asia/Shanghai',
];
const REASONS = [
  'USER_LEFT',
  'USER_LEFT',
  'DEADLINE',
  'ROOM_FINISHED',
  'USER_LEFT',
  'SUPERSEDED',
  'BANNED',
];
const MINUTE = 60 * 1000;

type Plan = {
  id: string;
  account: string | null;
  device: string | null;
  minutesAgo: number;
  joinSeconds: number;
  seconds: number | null;
  reason: string | null;
  tier?: string;
  language?: string;
  zone?: string;
};

function build(plan: Plan, index: number, now: number): MockSession {
  const requested = now - plan.minutesAgo * MINUTE;
  const started = requested + plan.joinSeconds * 1000;
  const ended = plan.seconds === null ? null : started + plan.seconds * 1000;
  const guest = plan.account === null;
  const iso = (ms: number) => new Date(ms).toISOString();
  return {
    id: plan.id,
    accountId: plan.account,
    deviceId: plan.device,
    freeTier: !guest && index % 3 === 0,
    roomName: `room_${sha(`room-${plan.id}`).slice(0, 32)}`,
    requestedAt: iso(requested),
    timezone: plan.zone ?? ZONES[index % ZONES.length],
    modelTier: plan.tier ?? (index % 2 === 0 ? 'standard' : 'premium'),
    language: plan.language ?? TAGS[index % TAGS.length],
    renderMode: (['DEVICE', 'CLOUD', 'NONE'] as const)[index % 3],
    deadlineAt: iso(started + 3600 * 1000),
    startedAt: iso(started),
    endReason: plan.reason,
    agentJoinedAt: iso(started),
    userJoinedAt: iso(started + 1500),
    userLeftAt: ended === null ? null : iso(ended),
    endedAt: ended === null ? null : iso(ended),
    durationSeconds: plan.seconds,
  };
}

function seed(now: number): MockSession[] {
  const named: Plan[] = [
    {
      id: SESSION.guestOngoing,
      account: null,
      device: sha('mock-guest-device-2'),
      minutesAgo: 3,
      joinSeconds: 3,
      seconds: null,
      reason: null,
    },
    {
      id: SESSION.ongoing,
      account: ACCOUNTS[1],
      device: null,
      minutesAgo: 8,
      joinSeconds: 4,
      seconds: null,
      reason: null,
    },
    {
      id: SESSION.registered,
      account: ACCOUNTS[0],
      device: null,
      minutesAgo: 40,
      joinSeconds: 2,
      seconds: 312,
      reason: 'USER_LEFT',
      language: 'th',
      tier: 'standard',
    },
    {
      id: SESSION.guest,
      account: null,
      device: GUEST_DEVICE,
      minutesAgo: 70,
      joinSeconds: 12,
      seconds: 180,
      reason: 'ROOM_FINISHED',
      language: 'es',
    },
    {
      id: SESSION.deadline,
      account: ACCOUNTS[0],
      device: null,
      minutesAgo: 100,
      joinSeconds: 5,
      seconds: 3600,
      reason: 'DEADLINE',
      language: 'vi',
      tier: 'premium',
    },
    {
      id: SESSION.hostile,
      account: 'x'.repeat(5000),
      device: null,
      minutesAgo: 130,
      joinSeconds: 6,
      seconds: 95,
      reason: 'USER_LEFT',
      tier: 'ระดับพรีเมียมสำหรับผู้ใช้ที่มีชื่อยาวมากมายเกินไป',
      language: 'ar',
      zone: '😀'.repeat(40),
    },
    {
      id: 'ses-0007',
      account: ACCOUNTS[2],
      device: null,
      minutesAgo: 160,
      joinSeconds: 1,
      seconds: 20,
      reason: 'USER_LEFT',
      language: 'id',
    },
    {
      id: 'ses-0008',
      account: ACCOUNTS[3],
      device: null,
      minutesAgo: 190,
      joinSeconds: 9,
      seconds: 600,
      reason: 'DEADLINE',
      language: 'en',
    },
  ];
  const filler: Plan[] = Array.from({ length: 52 }, (_, i) => {
    const guest = i % 4 === 1;
    const reason = REASONS[i % REASONS.length];
    return {
      id: `ses-${String(i + 9).padStart(4, '0')}`,
      account: guest ? null : ACCOUNTS[i % ACCOUNTS.length],
      device: guest ? sha(`mock-guest-device-${(i % 6) + 3}`) : null,
      minutesAgo: 240 + i * 170,
      joinSeconds: 1 + ((i * 7) % 13),
      seconds: 20 + ((i * 97) % 1700),
      reason: reason === 'DEADLINE' ? 'DEADLINE' : reason,
    };
  });
  return [...named, ...filler].map((plan, i) => build(plan, i, now));
}

type SessionsState = { sessions: MockSession[]; anchor: number };

const holder = globalThis as { __avatarAdminMockSessions?: SessionsState };
// The sample times are counted back from the moment the mock started, so a reset gives the same rows.
const started = Date.now();
holder.__avatarAdminMockSessions ??= { sessions: seed(started), anchor: started };
export const sessionsState: SessionsState = holder.__avatarAdminMockSessions;

/** Puts the sample calls back (for a test). */
export function resetSessionsStore(): void {
  sessionsState.sessions = seed(sessionsState.anchor);
}

/** The columns of the list, no more. */
export function listRow(s: MockSession) {
  return {
    id: s.id,
    accountId: s.accountId,
    deviceId: s.deviceId,
    requestedAt: s.requestedAt,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    durationSeconds: s.durationSeconds,
    modelTier: s.modelTier,
    language: s.language,
  };
}

/** The columns of one session that the details show. */
export function detailRow(s: MockSession) {
  return {
    ...listRow(s),
    freeTier: s.freeTier,
    roomName: s.roomName,
    timezone: s.timezone,
    renderMode: s.renderMode,
    deadlineAt: s.deadlineAt,
    endReason: s.endReason,
    agentJoinedAt: s.agentJoinedAt,
    userJoinedAt: s.userJoinedAt,
    userLeftAt: s.userLeftAt,
  };
}
