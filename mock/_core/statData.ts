// Deterministic numbers for the statistics endpoints of the mock backend: the same day, platform
// and channel always give the same row, so a page can be checked by eye and by test.

/** A number in [0, 1) that depends only on the parts. */
export function unit(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

export const between = (lo: number, hi: number, ...parts: (string | number)[]) =>
  Math.floor(lo + unit(...parts) * (hi - lo + 1));

export const todayOf = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

export const addDays = (day: string, n: number): string => {
  const ms = Date.parse(`${day}T00:00:00Z`) + n * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
};

const platformFactor = (platform: string) =>
  platform === 'ANDROID' ? 0.6 : platform === 'IOS' ? 0.4 : platform === 'unknown' ? 0.02 : 1;
const channelFactor = (channel: string) => (channel === 'ALL' ? 1 : 0.3 + unit('c', channel) * 0.4);

export function dailyRow(day: string, platform: string, channel: string, today: string) {
  const scale = platformFactor(platform) * channelFactor(channel);
  const n = (lo: number, hi: number, key: string) =>
    Math.round(between(lo, hi, 'daily', key, day) * scale);
  const all = platform === 'ALL';
  const base = {
    statDate: day,
    platform,
    channelCode: channel,
    dau: n(800, 1600, 'dau'),
    dauDevices: n(900, 1800, 'dev'),
    wau: n(3000, 5000, 'wau'),
    mau: n(9000, 14000, 'mau'),
    avatarCreatedAccounts: n(20, 90, 'av'),
    voiceClonedAccounts: n(5, 40, 'vc'),
    sessionStartedAccounts: n(300, 900, 'ss'),
  };
  const business = {
    newAccountsRegistered: n(30, 120, 'reg'),
    guestDevicesNew: n(100, 300, 'gn'),
    guestDevicesConverted: n(10, 60, 'gc'),
    guestSessionsConnected: n(50, 200, 'gs'),
    guestCallSecondsTotal: n(4000, 20000, 'gcs'),
    sessionsConnected: n(600, 1500, 'sc'),
    accountsWithCall: n(300, 800, 'awc'),
    callSecondsTotal: n(60000, 200000, 'cst'),
    messagesUser: n(5000, 20000, 'mu'),
    messagesAssistant: n(5000, 22000, 'ma'),
    newSubscriptions: n(3, 30, 'ns'),
    creditPurchases: n(5, 40, 'cp'),
    creditsSpent: n(8000, 40000, 'cs'),
  };
  const noBusiness = Object.fromEntries(Object.keys(business).map((key) => [key, null]));
  // The day-end snapshot: none for today, and some past days have none either.
  // The snapshot exists only for platform ALL and channel ALL (contract 17.6).
  const hasSnapshot = all && channel === 'ALL' && day < today && unit('snap', day) > 0.12;
  return {
    ...base,
    ...(all ? business : noBusiness),
    activeSubscriptions: hasSnapshot ? between(900, 1400, 'subs', day) : null,
    activeSubscriptionsBackfilled: hasSnapshot ? unit('bf', day) > 0.7 : null,
  };
}

export const RETENTION_DAYS = [1, 3, 5, 7, 14, 21, 30, 60, 90] as const;
export const GUEST_COHORT_DAYS = [0, 1, 2, 3, 5, 7, 14, 30] as const;

/** Cells of a cohort: a day that has not come yet (after yesterday) is null. */
function cells<D extends number>(
  cohortDate: string,
  size: number,
  days: readonly D[],
  today: string,
  key: string,
  decay: (n: number) => number,
) {
  const yesterday = addDays(today, -1);
  const out: Record<string, number | null> = {};
  for (const n of days) {
    out[`d${n}`] =
      addDays(cohortDate, n) > yesterday
        ? null
        : Math.round(size * decay(n) * (0.8 + unit(key, cohortDate, n) * 0.4));
  }
  return out;
}

export function retentionRow(
  cohortDate: string,
  type: string,
  platform: string,
  channel: string,
  today: string,
) {
  const size = Math.round(
    between(60, 500, 'size', cohortDate) * platformFactor(platform) * channelFactor(channel),
  );
  const strength = type === 'CALL' ? 0.6 : 1;
  return {
    cohortDate,
    retentionType: type,
    platform,
    channelCode: channel,
    cohortSize: size,
    ...cells(
      cohortDate,
      size,
      RETENTION_DAYS,
      today,
      `ret${type}${platform}${channel}`,
      (n) => strength * 0.45 * Math.exp(-n / 25),
    ),
  };
}

export function guestRetentionRow(
  cohortDate: string,
  platform: string,
  channel: string,
  today: string,
) {
  const size = Math.round(
    between(100, 600, 'gsize', cohortDate) * platformFactor(platform) * channelFactor(channel),
  );
  return {
    cohortDate,
    platform,
    channelCode: channel,
    cohortSize: size,
    ...cells(
      cohortDate,
      size,
      RETENTION_DAYS,
      today,
      `gret${platform}${channel}`,
      (n) => 0.3 * Math.exp(-n / 15),
    ),
  };
}

export function guestCohortRow(cohortDate: string, today: string) {
  const size = between(100, 600, 'gcsize', cohortDate);
  const raw = cells(
    cohortDate,
    size,
    GUEST_COHORT_DAYS,
    today,
    'gco',
    (n) => 0.05 + 0.2 * (1 - Math.exp(-n / 8)),
  );
  // The cells count devices converted within N days, so they never fall from one day to the next.
  let highest = 0;
  const cumulative: Record<string, number | null> = {};
  for (const n of GUEST_COHORT_DAYS) {
    const value = raw[`d${n}`];
    if (value === null) {
      cumulative[`d${n}`] = null;
    } else {
      highest = Math.max(highest, value);
      cumulative[`d${n}`] = highest;
    }
  }
  return { cohortDate, cohortSize: size, ...cumulative };
}
