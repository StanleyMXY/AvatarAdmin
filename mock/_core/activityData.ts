// In-memory state of the activity endpoints of the mock backend (contract 28): sign-in activities
// with their steps and records, daily task configurations and task records. It hangs on `globalThis`
// like the rest of the mock state (see store.ts), so saving a mock file does not lose it;
// `resetActivityStore` puts the sample data back (the tests call it, a restart does it too). Not a
// mock file itself: Umi's loader reads every file in mock/, and only files that export handlers belong there.

import { multilingualSamples, type SampleLanguage, sampleText } from './fixtures';
import { addDays, todayOf } from './statData';
import { store } from './store';

export type MockReward = { dayNum: number; rewardCredits: number; bonusCredits: number };

export type MockActivity = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'DISABLED';
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  rewards: MockReward[];
};

export type MockCheckinRecord = {
  id: string;
  accountId: string;
  activityId: string;
  checkinDate: string;
  dayNum: number;
  consecutiveDays: number;
  rewardCredits: number;
  bonusCredits: number;
  createdAt: string;
};

export type MockTaskConfig = {
  id: string;
  taskName: string;
  taskType: 'daily_login' | 'call_seconds' | 'text_messages';
  targetValue: number;
  rewardCredits: number;
  description: string;
  claimTimeoutSeconds: number | null;
  sortOrder: number;
  status: 'ENABLED' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
};

export type MockTaskRecord = {
  id: string;
  accountId: string;
  taskId: string;
  taskDate: string;
  currentProgress: number;
  status: 'IN_PROGRESS' | 'CLAIMABLE' | 'REWARDED' | 'EXPIRED';
  timezone: string;
  windowStartAt: string;
  windowEndAt: string;
  targetValue: number;
  rewardCredits: number | null;
  completedAt: string | null;
  claimDeadlineAt: string | null;
  rewardedAt: string | null;
  creditsGranted: number | null;
  createdAt: string;
};

export type ActivityStore = {
  activities: MockActivity[];
  checkinRecords: MockCheckinRecord[];
  taskConfigs: MockTaskConfig[];
  taskRecords: MockTaskRecord[];
  next: { activity: number; taskConfig: number };
};

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** `UTC−12`: the last time zone on earth. An activity has ended when the day after it is past there too (contract 28.1). */
export function lifecycleOf(
  activity: Pick<MockActivity, 'status' | 'endDate'>,
  now: Date = new Date(),
): 'DRAFT' | 'ACTIVE' | 'ENDED' | 'DISABLED' {
  if (activity.status === 'ACTIVE' && activity.endDate !== null) {
    const lastZoneToday = todayOf(new Date(now.getTime() - 12 * HOUR));
    if (activity.endDate < lastZoneToday) return 'ENDED';
  }
  return activity.status;
}

/** Two ranges overlap when each starts before the other ends; an empty end is no end, an empty start is no start. */
export function rangesOverlap(
  a: { startDate: string | null; endDate: string | null },
  b: { startDate: string | null; endDate: string | null },
): boolean {
  const startsBeforeEnd = (x: string | null, y: string | null) =>
    x === null || y === null || x <= y;
  return startsBeforeEnd(a.startDate, b.endDate) && startsBeforeEnd(b.startDate, a.endDate);
}

const accountId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const steps = (credits: number[], bonusOnLast = 0): MockReward[] =>
  credits.map((rewardCredits, i) => ({
    dayNum: i + 1,
    rewardCredits,
    bonusCredits: i === credits.length - 1 ? bonusOnLast : 0,
  }));

function seed(now: Date): ActivityStore {
  const today = todayOf(now);
  const iso = (days: number) => new Date(now.getTime() - days * DAY).toISOString();
  const lang = (language: SampleLanguage, n: number) => sampleText(language, n);

  const activities: MockActivity[] = [
    {
      id: '1',
      name: 'Autumn check-in 🍂',
      startDate: addDays(today, -20),
      endDate: addDays(today, 40),
      status: 'ACTIVE',
      createdBy: '1001',
      createdAt: iso(25),
      updatedAt: iso(20),
      rewards: steps([1, 1, 2, 2, 3, 3, 5], 2),
    },
    {
      // Stored as live, but its last day is long past: shown as ended.
      id: '2',
      name: lang('es', 0),
      startDate: addDays(today, -120),
      endDate: addDays(today, -60),
      status: 'ACTIVE',
      createdBy: '1001',
      createdAt: iso(130),
      updatedAt: iso(120),
      rewards: steps([1, 2, 3]),
    },
    {
      id: '3',
      name: lang('th', 2),
      startDate: addDays(today, 100),
      endDate: addDays(today, 130),
      status: 'DRAFT',
      createdBy: '9999',
      createdAt: iso(5),
      updatedAt: iso(5),
      rewards: steps([2, 2, 2, 4]),
    },
    {
      id: '4',
      name: lang('ar', 2),
      startDate: addDays(today, 60),
      endDate: addDays(today, 90),
      status: 'DISABLED',
      createdBy: '1001',
      createdAt: iso(40),
      updatedAt: iso(10),
      rewards: steps([1, 3]),
    },
    {
      // A draft that overlaps the live one: publishing it asks first.
      id: '5',
      name: lang('vi', 2),
      startDate: addDays(today, 10),
      endDate: addDays(today, 50),
      status: 'DRAFT',
      createdBy: '1001',
      createdAt: iso(3),
      updatedAt: iso(3),
      rewards: steps([1, 2, 3, 4, 5]),
    },
    {
      // A stopped one with a name that cannot be broken, no start and no end: enabling it overlaps the live one.
      id: '6',
      name: multilingualSamples.longUnbroken,
      startDate: null,
      endDate: null,
      status: 'DISABLED',
      createdBy: '1001',
      createdAt: iso(60),
      updatedAt: iso(50),
      rewards: steps([1]),
    },
    {
      id: '7',
      name: lang('id', 2),
      startDate: addDays(today, 200),
      endDate: null,
      status: 'DRAFT',
      createdBy: '1001',
      createdAt: iso(1),
      updatedAt: iso(1),
      rewards: steps([3, 3]),
    },
  ];

  const checkinRecords: MockCheckinRecord[] = [];
  for (let n = 1; n <= 45; n += 1) {
    const streak = ((n - 1) % 7) + 1;
    const activityId = n <= 30 ? '1' : n <= 42 ? '2' : '99'; // 99 is an activity that has been deleted
    const reward = (activities[activityId === '2' ? 1 : 0].rewards[(streak - 1) % 3] ?? {
      rewardCredits: 1,
      bonusCredits: 0,
    }) as MockReward;
    checkinRecords.push({
      id: String(n),
      accountId: n === 7 ? `${accountId(7)}${'x'.repeat(200)}` : accountId(((n - 1) % 9) + 1),
      activityId,
      checkinDate: addDays(today, -(n % 30)),
      dayNum: streak,
      consecutiveDays: streak + (n % 3 === 0 ? 7 : 0),
      rewardCredits: n % 11 === 0 ? 0 : reward.rewardCredits,
      bonusCredits: n % 5 === 0 ? 2 : 0,
      createdAt: new Date(now.getTime() - n * 5 * HOUR).toISOString(),
    });
  }

  const taskConfigs: MockTaskConfig[] = [
    {
      id: '1',
      taskName: 'Open the app 📱',
      taskType: 'daily_login',
      targetValue: 1,
      rewardCredits: 1,
      description: 'Open the app once a day.',
      claimTimeoutSeconds: null,
      sortOrder: 1,
      status: 'ENABLED',
      createdAt: iso(60),
      updatedAt: iso(30),
    },
    {
      id: '2',
      taskName: lang('th', 1),
      taskType: 'call_seconds',
      targetValue: 600,
      rewardCredits: 3,
      description: lang('th', 2),
      claimTimeoutSeconds: 3600,
      sortOrder: 2,
      status: 'ENABLED',
      createdAt: iso(60),
      updatedAt: iso(30),
    },
    {
      id: '3',
      taskName: lang('ar', 1),
      taskType: 'text_messages',
      targetValue: 20,
      rewardCredits: 0,
      description: lang('ar', 2),
      claimTimeoutSeconds: null,
      sortOrder: 3,
      status: 'ENABLED',
      createdAt: iso(60),
      updatedAt: iso(30),
    },
    {
      id: '4',
      taskName: lang('vi', 2),
      taskType: 'call_seconds',
      targetValue: 1800,
      rewardCredits: 5,
      description: multilingualSamples.longUnbroken,
      claimTimeoutSeconds: 7200,
      sortOrder: 4,
      status: 'DISABLED',
      createdAt: iso(20),
      updatedAt: iso(2),
    },
    {
      id: '5',
      taskName: lang('id', 2),
      taskType: 'text_messages',
      targetValue: 5,
      rewardCredits: 1,
      description: lang('en', 3),
      claimTimeoutSeconds: 600,
      sortOrder: 5,
      status: 'ENABLED',
      createdAt: iso(10),
      updatedAt: iso(10),
    },
    {
      id: '6',
      taskName: `${lang('zh', 3)} ${lang('es', 3)}`,
      taskType: 'daily_login',
      targetValue: 1,
      rewardCredits: 2,
      description: '',
      claimTimeoutSeconds: null,
      sortOrder: 6,
      status: 'DISABLED',
      createdAt: iso(9),
      updatedAt: iso(9),
    },
  ];

  const taskRecords: MockTaskRecord[] = [];
  const states = ['IN_PROGRESS', 'CLAIMABLE', 'REWARDED', 'EXPIRED'] as const;
  for (let n = 1; n <= 48; n += 1) {
    // Configurations 1 to 3 have records, 4 to 6 have none; 99 is a configuration that has been deleted.
    const taskId = n <= 16 ? '1' : n <= 32 ? '2' : n <= 44 ? '3' : '99';
    const config = taskConfigs[Number(taskId) - 1];
    const status = states[n % 4];
    const target = config?.targetValue ?? 10;
    const day = addDays(today, -(n % 20));
    const completedAt =
      status === 'IN_PROGRESS'
        ? null
        : new Date(Date.parse(`${day}T09:00:00Z`) + n * 60_000).toISOString();
    const reward = config?.rewardCredits ?? 2;
    taskRecords.push({
      id: String(n),
      accountId: accountId(((n - 1) % 9) + 1),
      taskId,
      taskDate: day,
      currentProgress: status === 'IN_PROGRESS' ? Math.floor(target / 3) : target,
      status,
      timezone: n % 2 === 0 ? 'Asia/Bangkok' : 'America/Sao_Paulo',
      windowStartAt: `${day}T00:00:00Z`,
      windowEndAt: `${addDays(day, 1)}T00:00:00Z`,
      targetValue: target,
      rewardCredits: status === 'IN_PROGRESS' ? null : reward,
      completedAt,
      claimDeadlineAt:
        config?.claimTimeoutSeconds && completedAt
          ? new Date(Date.parse(completedAt) + config.claimTimeoutSeconds * 1000).toISOString()
          : null,
      rewardedAt:
        status === 'REWARDED' && completedAt
          ? new Date(Date.parse(completedAt) + 90_000).toISOString()
          : null,
      creditsGranted: status === 'REWARDED' ? reward : null,
      createdAt: new Date(Date.parse(`${day}T01:00:00Z`)).toISOString(),
    });
  }

  return {
    activities,
    checkinRecords,
    taskConfigs,
    taskRecords,
    next: { activity: 8, taskConfig: 7 },
  };
}

const holder = globalThis as { __avatarAdminMockActivity?: ActivityStore };

export const activityState: ActivityStore = (() => {
  holder.__avatarAdminMockActivity ??= seed(new Date());
  return holder.__avatarAdminMockActivity;
})();

export function resetActivityStore(now: Date = new Date()): void {
  Object.assign(activityState, seed(now));
}

/** The name of the administrator, read when asked; `null` when the administrator has been deleted. */
export const usernameOf = (adminId: string | null): string | null =>
  adminId === null ? null : (store.admins.get(adminId)?.username ?? null);
