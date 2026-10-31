// In-memory state of the push endpoints of the mock backend: templates, manual tasks, periodic
// pushes, records with the result for each token, and upload records. It hangs on `globalThis` like
// the rest of the mock state (see store.ts), so saving a mock file does not lose it;
// `resetPushStore` puts the sample data back (the tests call it, a restart does it too). Not a mock
// file itself: Umi's loader reads every file in mock/, and only files that export handlers belong there.

import { multilingualSamples, type SampleLanguage, sampleText } from './fixtures';
import { META_DEFAULTS } from './meta';
import { store } from './store';

export type MockLinkType = 'NONE' | 'SCREEN' | 'URL';

export type MockTemplate = {
  id: string;
  triggerReason: string;
  locale: string;
  title: string;
  body: string;
  linkType: MockLinkType;
  linkTarget: string | null;
  imageFile: string | null;
  enabled: boolean;
};

export type MockAudience = {
  audience: 'ALL' | 'ACCOUNTS' | 'GUESTS' | 'ACCOUNT_IDS';
  accountIds: string[] | null;
  platforms: string[] | null;
  locales: string[] | null;
};

export type MockContent = {
  title: string;
  body: string;
  linkType: MockLinkType;
  linkTarget: string | null;
  imageFile: string | null;
};

export type MockTask = MockAudience &
  MockContent & {
    id: string;
    createdBy: string | null;
    scheduledAt: string;
    scheduleId: string | null;
    status: 'PENDING' | 'RUNNING' | 'DONE' | 'CANCELLED';
    note: string | null;
    sentCount: number;
    failedCount: number;
  };

export type MockSchedule = MockAudience &
  MockContent & {
    id: string;
    createdBy: string | null;
    repeat: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    daysOfWeek: number[] | null;
    dayOfMonth: number | null;
    timeOfDay: string;
    timezone: string;
    startDate: string;
    endDate: string | null;
    enabled: boolean;
    nextRunAt: string | null;
  };

export type MockRecord = {
  id: string;
  accountId: string;
  pushType: string;
  triggerReason: string;
  localDate: string;
  createdAt: string;
};

export type MockDelivery = {
  id: string;
  pushId: string;
  pushTokenId: string;
  result: 'ACCEPTED' | 'INVALID_TOKEN' | 'FAILED';
  sentAt: string;
};

export type MockUpload = { id: string; used: boolean; file: string };

export type PushStore = {
  templates: MockTemplate[];
  tasks: MockTask[];
  schedules: MockSchedule[];
  records: MockRecord[];
  deliveries: MockDelivery[];
  uploads: Map<string, MockUpload>;
  /** `app.supported_locales`, which decides which languages a recall reason needs a template in. */
  supportedLocales: string[];
  /**
   * How `GET /push/templates` answers: with `total` (the default), or the way the backend's contract
   * (a14) writes it, without `total`, paged or not paged at all. For tests of the page.
   */
  templateList: 'with-total' | 'paged-without-total' | 'unpaged-without-total';
  next: { template: number; task: number; schedule: number; upload: number };
};

// ---- time zones (no library: the standard `Intl`) ----

const partsOf = (timeZone: string, instant: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    y: n('year'),
    m: n('month'),
    d: n('day'),
    h: n('hour'),
    min: n('minute'),
    s: n('second'),
  };
};

/** Minutes the zone is ahead of UTC at this instant. */
const offsetMinutes = (timeZone: string, instant: Date): number => {
  const p = partsOf(timeZone, instant);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
};

/** The UTC instant at which the clock of the zone reads this date and time. */
const zonedToUtc = (timeZone: string, y: number, m: number, d: number, h: number, min: number) => {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const first = offsetMinutes(timeZone, new Date(guess));
  let instant = guess - first * 60000;
  const second = offsetMinutes(timeZone, new Date(instant));
  if (second !== first) instant = guess - second * 60000;
  return new Date(instant);
};

export const isTimeZone = (name: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name });
    return true;
  } catch {
    return false;
  }
};

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * The next time a schedule goes out, as a UTC instant after `from`, or `null` when it is switched
 * off or past its end date. The time is read in the time zone of the schedule; a monthly day that
 * the month does not have becomes the last day of the month (contract 8.5).
 */
export function nextRunAt(
  schedule: Pick<
    MockSchedule,
    | 'repeat'
    | 'daysOfWeek'
    | 'dayOfMonth'
    | 'timeOfDay'
    | 'timezone'
    | 'startDate'
    | 'endDate'
    | 'enabled'
  >,
  from: Date = new Date(),
): string | null {
  if (!schedule.enabled) return null;
  const [hh, mm] = schedule.timeOfDay.split(':').map(Number);
  const today = partsOf(schedule.timezone, from);
  const first = Date.UTC(today.y, today.m - 1, today.d) - 86_400_000;
  for (let i = 0; i < 800; i += 1) {
    const day = new Date(first + i * 86_400_000);
    const y = day.getUTCFullYear();
    const m = day.getUTCMonth() + 1;
    const d = day.getUTCDate();
    const text = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (text < schedule.startDate) continue;
    if (schedule.endDate !== null && text > schedule.endDate) return null;
    const isoDay = day.getUTCDay() === 0 ? 7 : day.getUTCDay();
    const matches =
      schedule.repeat === 'DAILY' ||
      (schedule.repeat === 'WEEKLY' && (schedule.daysOfWeek ?? []).includes(isoDay)) ||
      (schedule.repeat === 'MONTHLY' &&
        d === Math.min(schedule.dayOfMonth ?? 1, daysInMonth(y, m)));
    if (!matches) continue;
    const instant = zonedToUtc(schedule.timezone, y, m, d, hh, mm);
    if (instant.getTime() > from.getTime()) return instant.toISOString();
  }
  return null;
}

// ---- the sample data ----

const HOUR = 3_600_000;
const LANGUAGE_OF: Record<string, SampleLanguage> = {
  en: 'en',
  th: 'th',
  ar: 'ar',
  id: 'id',
  vi: 'vi',
  es: 'es',
  'zh-Hans': 'zh',
};

const accountId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function seed(now: Date): PushStore {
  const ago = (hours: number) => new Date(now.getTime() - hours * HOUR).toISOString();
  const ahead = (hours: number) => new Date(now.getTime() + hours * HOUR).toISOString();
  let tid = 1;
  const template = (
    triggerReason: string,
    locale: string,
    over: Partial<MockTemplate> = {},
  ): MockTemplate => {
    const language = LANGUAGE_OF[locale] ?? 'en';
    const shift = triggerReason === 'daily_recall' ? 0 : 1;
    return {
      id: String(tid++),
      triggerReason,
      locale,
      title: sampleText(language, shift),
      body: sampleText(language, shift + 2),
      linkType: 'NONE',
      linkTarget: null,
      imageFile: null,
      enabled: true,
      ...over,
    };
  };
  const templates: MockTemplate[] = [
    template('daily_recall', 'en', { linkType: 'SCREEN', linkTarget: 'conversation' }),
    template('daily_recall', 'zh-Hans', { imageFile: 'push-recall.svg' }),
    template('daily_recall', 'th'),
    template('daily_recall', 'ar'),
    template('daily_recall', 'id', {
      linkType: 'URL',
      linkTarget: 'https://example.com/welcome-back',
    }),
    template('daily_recall', 'vi'),
    template('daily_recall', 'es', { title: multilingualSamples.longUnbroken }),
    // streak_at_risk has no English template: the matrix of an English-only deployment shows that cell red.
    template('streak_at_risk', 'zh-Hans', { enabled: false }),
    template('streak_at_risk', 'th', { enabled: false }),
    template('streak_at_risk', 'id', { enabled: false }),
    template('streak_at_risk', 'es', { enabled: false }),
  ];

  const audienceAll: MockAudience = {
    audience: 'ALL',
    accountIds: null,
    platforms: null,
    locales: null,
  };
  const plain = (n: number, language: SampleLanguage): MockContent => ({
    title: sampleText(language, n),
    body: sampleText(language, n + 2),
    linkType: 'NONE',
    linkTarget: null,
    imageFile: null,
  });
  const taskRow = (
    n: number,
    status: MockTask['status'],
    over: Partial<MockTask> = {},
  ): MockTask => ({
    id: String(n),
    createdBy: n % 7 === 0 ? '9999' : '1001',
    ...audienceAll,
    ...plain(n, (['th', 'ar', 'id', 'vi', 'es', 'en', 'zh'] as SampleLanguage[])[n % 7]),
    scheduledAt: ago(n * 9),
    scheduleId: null,
    status,
    note: null,
    sentCount: status === 'DONE' ? 1000 + n * 37 : 0,
    failedCount: status === 'DONE' ? n % 9 : 0,
    ...over,
  });
  const tasks: MockTask[] = [
    taskRow(1, 'PENDING', { scheduledAt: ahead(3) }),
    taskRow(2, 'PENDING', {
      scheduledAt: ahead(30),
      audience: 'ACCOUNT_IDS',
      accountIds: [accountId(11), accountId(12)],
    }),
    taskRow(3, 'RUNNING', { scheduledAt: ago(0.2), sentCount: 120, failedCount: 3 }),
    taskRow(4, 'DONE', { platforms: ['ANDROID'], locales: ['th', 'id'], scheduleId: '1' }),
    taskRow(5, 'CANCELLED', { note: 'MISSED', scheduledAt: ago(90) }),
    taskRow(6, 'CANCELLED', { scheduledAt: ago(100), audience: 'GUESTS' }),
  ];
  for (let n = 7; n <= 28; n += 1) {
    tasks.push(
      taskRow(n, 'DONE', {
        audience: n % 3 === 0 ? 'ACCOUNTS' : 'ALL',
        scheduleId: n % 4 === 0 ? '2' : null,
      }),
    );
  }

  const base = {
    createdBy: '1001',
    daysOfWeek: null,
    dayOfMonth: null,
    endDate: null,
    accountIds: null,
    platforms: null,
    locales: null,
    audience: 'ALL' as const,
    enabled: true,
    nextRunAt: null,
    linkType: 'NONE' as const,
    linkTarget: null,
    imageFile: null,
  };
  const schedules: MockSchedule[] = [
    {
      ...base,
      id: '1',
      repeat: 'DAILY',
      timeOfDay: '09:00',
      timezone: 'UTC',
      startDate: '2026-09-01',
      ...plain(0, 'en'),
    },
    {
      ...base,
      id: '2',
      repeat: 'WEEKLY',
      daysOfWeek: [1, 3, 5],
      timeOfDay: '20:30',
      timezone: 'Asia/Bangkok',
      startDate: '2026-09-15',
      platforms: ['ANDROID', 'IOS'],
      locales: ['th'],
      ...plain(1, 'th'),
    },
    {
      ...base,
      id: '3',
      repeat: 'MONTHLY',
      dayOfMonth: 31,
      timeOfDay: '08:00',
      timezone: 'America/Mexico_City',
      startDate: '2026-10-01',
      ...plain(2, 'es'),
    },
    {
      ...base,
      id: '4',
      repeat: 'DAILY',
      timeOfDay: '18:00',
      timezone: 'Asia/Riyadh',
      startDate: '2026-06-01',
      endDate: '2026-08-31',
      enabled: false,
      createdBy: '9999',
      ...plain(3, 'ar'),
    },
  ];
  for (const row of schedules) row.nextRunAt = nextRunAt(row, now);

  const reasons = [
    ['daily_recall', 'recall'],
    ['streak_at_risk', 'recall'],
    ['admin', 'announcement'],
    ['system_event', 'activity'],
  ] as const;
  const records: MockRecord[] = [];
  const deliveries: MockDelivery[] = [];
  const results: MockDelivery['result'][] = [
    'ACCEPTED',
    'ACCEPTED',
    'INVALID_TOKEN',
    'ACCEPTED',
    'FAILED',
  ];
  for (let n = 1; n <= 32; n += 1) {
    const [triggerReason, pushType] = reasons[n % 4];
    const createdAt = ago(n * 3 + 1);
    const id = `rec-${String(n).padStart(4, '0')}`;
    records.push({
      id,
      accountId: accountId(100 + (n % 9)),
      pushType,
      triggerReason,
      localDate: createdAt.slice(0, 10),
      createdAt,
    });
    for (let t = 0; t < 1 + (n % 3); t += 1) {
      deliveries.push({
        id: `del-${n}-${t}`,
        pushId: id,
        pushTokenId: `tok-${n}-${t}`,
        result: results[(n + t) % results.length],
        sentAt: createdAt,
      });
    }
  }

  return {
    templates,
    tasks,
    schedules,
    records,
    deliveries,
    uploads: new Map(),
    supportedLocales: [...META_DEFAULTS.supportedLocales],
    templateList: 'with-total',
    next: { template: tid, task: 29, schedule: 5, upload: 1 },
  };
}

const holder = globalThis as { __avatarAdminMockPush?: PushStore };

export const pushState: PushStore = (() => {
  holder.__avatarAdminMockPush ??= seed(new Date());
  return holder.__avatarAdminMockPush;
})();

export function resetPushStore(now: Date = new Date()): void {
  Object.assign(pushState, seed(now));
}

/** The name of the administrator, read when asked; `null` when the administrator has been deleted. */
export const usernameOf = (adminId: string | null): string | null =>
  adminId === null ? null : (store.admins.get(adminId)?.username ?? null);
