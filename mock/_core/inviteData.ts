// Sample data of the invite endpoints of the mock backend: accounts with their invite codes, the
// invitations between them (a forest: every account has at most one inviter), the reward states of
// contract 9.1 and the share tables of 9.2. Everything is worked out from the current UTC day and
// fixed numbers, so the default range of a page always shows data and a test can compute what it
// expects from the same function. There are no writes in this module (reward settings go through
// `/config`, re-landing through `/stats/land`), so there is no state to keep on `globalThis`; the
// cache only saves the work and `resetInviteStore` empties it (a test with a fake clock calls it).
// Not a mock file itself: Umi's loader reads every file in mock/, and only files that export
// handlers belong there, so this one lives in _core/.
import { addDays, between, todayOf, unit } from './statData';

export type InviteAccount = {
  id: string;
  /** Masked: an e-mail, a phone number or the first eight characters of the account id. */
  label: string;
  /** The creation time of the account. */
  createdAt: string;
  code: string;
  /** Null for a root of a chain: an account nobody invited. */
  inviterId: string | null;
};

export type InviteRecordRow = {
  id: string;
  inviterAccountId: string;
  inviteeAccountId: string;
  inviterLabel: string;
  inviteeLabel: string;
  redeemedAt: string;
  rewardStatus: 'PENDING' | 'REWARDED' | 'NOT_ELIGIBLE';
  rewardReason: string | null;
  inviterCreditsGranted: number | null;
  inviteeCreditsGranted: number | null;
  rewardedAt: string | null;
};

export type InviteData = {
  today: string;
  accounts: InviteAccount[];
  /** Newest redemption first. */
  records: InviteRecordRow[];
  /** Depth of an account: the number of inviters above it (a root is 0, its invitee 1). */
  depthOf: Map<string, number>;
  rootOf: Map<string, string>;
  boundary: { lateDay: string; lateAt: string; earlyDay: string; earlyAt: string };
};

const HISTORY_DAYS = 44;
const EVENTS = 88;
const ROOTS = 14;
const DAY_MS = 86_400_000;
const REASONS = [
  'DISABLED',
  'OUT_OF_WINDOW',
  'ACCOUNT_STATE',
  'LIMIT_REACHED',
  'SAME_DEVICE',
  'PRIOR_ACCOUNT',
] as const;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const hex = (salt: string, length: number): string => {
  let out = '';
  for (let i = 0; out.length < length; i++) {
    out += Math.floor(unit('hex', salt, i) * 16).toString(16);
  }
  return out;
};
const accountId = (n: number): string =>
  `${hex(`a${n}`, 8)}-${hex(`b${n}`, 4)}-4${hex(`c${n}`, 3)}-8${hex(`d${n}`, 3)}-${hex(`e${n}`, 12)}`;
const codeOf = (n: number): string => {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += CODE_ALPHABET[Math.floor(unit('code', n, i) * CODE_ALPHABET.length)];
  }
  return code;
};

// Which account plays which part in the tests and in the browser check.
const INDEX = { deepRoot: 0, top: 1, lonely: ROOTS - 1 } as const;

export const FIXTURE = {
  /** A root with a chain of six levels below it and two more branches. */
  deepRoot: accountId(INDEX.deepRoot),
  deepChainLevels: 6,
  /** The inviter with the most invitees. */
  top: accountId(INDEX.top),
  /** A root nobody was invited by and who invited nobody. */
  lonely: accountId(INDEX.lonely),
  /** The invitee whose label is a long string without any space. */
  longLabelLength: 320,
  /** Two invitations one second apart that fall on different UTC days. */
  get boundary() {
    return inviteData().boundary;
  },
} as const;

const EMAILS = [
  (n: number) =>
    `${String.fromCharCode(97 + (n % 26))}***@${String.fromCharCode(100 + (n % 20))}***.com`,
  (n: number) => `ส***@${String.fromCharCode(103 + (n % 10))}***.co.th`,
  (n: number) => `م***@${String.fromCharCode(121 - (n % 10))}***.com`,
  (n: number) =>
    `+${['66', '62', '84', '34', '20'][n % 5]}*****${String(1000 + ((n * 37) % 9000))}`,
  (n: number) => accountId(n).slice(0, 8),
  (n: number) => ['ng***@g***.vn', 'ñ***@c***.es', '李***@q***.cn', 'a***@d***.id'][n % 4],
];
const labelOf = (n: number): string => EMAILS[n % EMAILS.length](n);

const isoSecond = (ms: number): string => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

function build(now: Date): InviteData {
  const today = todayOf(now);
  const start = Date.parse(`${addDays(today, -HISTORY_DAYS)}T00:00:00Z`);
  const span = HISTORY_DAYS * DAY_MS;

  type Draft = { id: string; label: string; createdAtMs: number; inviter: number | null };
  const drafts: Draft[] = [];
  const add = (label: string, createdAtMs: number, inviter: number | null): number => {
    drafts.push({ id: accountId(drafts.length), label, createdAtMs, inviter });
    return drafts.length - 1;
  };

  // Roots: created well before the history window.
  for (let i = 0; i < ROOTS; i++) {
    add(labelOf(i), start - (20 + i) * DAY_MS - between(0, 80_000, 'root', i) * 1000, null);
  }

  // The invitations, in the order they happen. Slots 20, 26, ... build the chain below the deep root
  // (each invites the next invitee of the chain); every fifth slot is a direct invitee of the top
  // inviter until it has sixteen; the rest pick an inviter among the accounts that exist by then,
  // leaning to the recent ones, which makes the chains grow.
  const chainSlots = [20, 26, 32, 38, 44, 50];
  const times: number[] = [];
  for (let k = 0; k < EVENTS; k++) {
    times.push(
      start + Math.floor(((k + 0.5) * span) / EVENTS) + between(0, 3600, 'jitter', k) * 1000,
    );
  }
  // One invitation at 23:59:59Z and the next at 00:00:00Z of the following day.
  const lateDay = new Date(times[40]).toISOString().slice(0, 10);
  const earlyDay = addDays(lateDay, 1);
  times[40] = Date.parse(`${lateDay}T23:59:59Z`);
  times[41] = Date.parse(`${earlyDay}T00:00:00Z`);
  for (let k = 42; k < EVENTS; k++)
    if (times[k] <= times[k - 1]) times[k] = times[k - 1] + 3_600_000;

  const events: { inviter: number; invitee: number; at: number }[] = [];
  let topCount = 0;
  let previousChain: number = INDEX.deepRoot;
  const pool: number[] = [];
  for (let i = 0; i < ROOTS; i++)
    if (i !== INDEX.lonely && i !== INDEX.top && i !== INDEX.deepRoot) pool.push(i);
  for (let k = 0; k < EVENTS; k++) {
    let inviter: number;
    const chainStep = chainSlots.indexOf(k);
    if (chainStep >= 0) inviter = previousChain;
    else if (k % 5 === 1 && topCount < 16) {
      inviter = INDEX.top;
      topCount += 1;
    } else if (k === 8 || k === 9) inviter = INDEX.deepRoot;
    else inviter = pool[Math.floor(Math.sqrt(unit('inviter', k)) * pool.length)];
    // the long unbroken label belongs to one invitee, a plain masked one to the rest
    const label = k === 60 ? 'ก็'.repeat(FIXTURE.longLabelLength / 2) : labelOf(ROOTS + k);
    const invitee = add(label, times[k], inviter);
    events.push({ inviter, invitee, at: times[k] });
    if (chainStep >= 0) previousChain = invitee;
    else if (inviter !== INDEX.top && inviter !== INDEX.deepRoot) pool.push(invitee);
  }

  const accounts: InviteAccount[] = drafts.map((d, i) => ({
    id: d.id,
    label: d.label,
    createdAt: isoSecond(d.createdAtMs),
    code: codeOf(i),
    inviterId: d.inviter === null ? null : drafts[d.inviter].id,
  }));

  const records: InviteRecordRow[] = events.map((event, k) => {
    const state = k % 5;
    const status = state <= 1 ? 'REWARDED' : state === 2 ? 'PENDING' : 'NOT_ELIGIBLE';
    const rewarded = status === 'REWARDED';
    return {
      id: String(k + 1),
      inviterAccountId: accounts[event.inviter].id,
      inviteeAccountId: accounts[event.invitee].id,
      inviterLabel: accounts[event.inviter].label,
      inviteeLabel: accounts[event.invitee].label,
      redeemedAt: isoSecond(event.at),
      rewardStatus: status,
      rewardReason: status === 'NOT_ELIGIBLE' ? REASONS[k % REASONS.length] : null,
      inviterCreditsGranted: rewarded ? 10 : 0,
      // "0 means this side gets nothing": some rewarded invitations paid only the inviter
      inviteeCreditsGranted: rewarded ? (k % 4 === 0 ? 0 : 5) : 0,
      rewardedAt: rewarded ? isoSecond(event.at + (k % 2 ? 3 * 3_600_000 : 0)) : null,
    };
  });
  records.sort((a, b) => b.redeemedAt.localeCompare(a.redeemedAt) || Number(b.id) - Number(a.id));

  const byId = new Map(accounts.map((a) => [a.id, a]));
  const depthOf = new Map<string, number>();
  const rootOf = new Map<string, string>();
  const resolve = (id: string): void => {
    const inviter = byId.get(id)?.inviterId ?? null;
    if (inviter === null) {
      depthOf.set(id, 0);
      rootOf.set(id, id);
      return;
    }
    if (!depthOf.has(inviter)) resolve(inviter);
    depthOf.set(id, (depthOf.get(inviter) as number) + 1);
    rootOf.set(id, rootOf.get(inviter) as string);
  };
  for (const account of accounts) resolve(account.id);

  return {
    today,
    accounts,
    records,
    depthOf,
    rootOf,
    boundary: {
      lateDay,
      lateAt: `${lateDay}T23:59:59Z`,
      earlyDay,
      earlyAt: `${earlyDay}T00:00:00Z`,
    },
  };
}

let cached: InviteData | null = null;

/** The sample data for the current UTC day (or for `now`). */
export function inviteData(now: Date = new Date()): InviteData {
  const today = todayOf(now);
  if (!cached || cached.today !== today) cached = build(now);
  return cached;
}

export function resetInviteStore(): void {
  cached = null;
}

// ---- the share tables (contract 17.6, StatShareFunnelDaily and StatShareChannelDaily) ----

export const SHARE_CHANNELS = [
  ['whatsapp', 0.34],
  ['facebook', 0.2],
  ['line', 0.14],
  ['telegram', 0.1],
  ['instagram', 0.08],
  ['messenger', 0.05],
  ['twitter', 0.04],
  ['tiktok', 0.02],
  ['sms', 0.02],
  ['unknown', 0.01],
] as const;

/** The days that have a row: the landing job has run for every day before today, back to 60 days. */
export const landedDays = (days: string[], today: string): string[] =>
  days.filter((day) => day < today && day >= addDays(today, -60));

export function funnelRow(day: string, registered: number) {
  const sharePv = between(300, 900, 'share', day);
  const shareUv = Math.floor(sharePv * (0.55 + unit('shareUv', day) * 0.25));
  const linkClickPv = Math.floor(sharePv * (0.4 + unit('link', day) * 0.2));
  const linkClickUv = Math.floor(linkClickPv * (0.6 + unit('linkUv', day) * 0.3));
  const downloadClickPv = Math.floor(linkClickPv * (0.3 + unit('dl', day) * 0.2));
  const downloadClickUv = Math.floor(downloadClickPv * (0.6 + unit('dlUv', day) * 0.3));
  return {
    statDate: day,
    sharePv,
    shareUv,
    linkClickPv,
    linkClickUv,
    downloadClickPv,
    downloadClickUv,
    registered,
  };
}

export function channelRows(day: string) {
  const total = funnelRow(day, 0).sharePv;
  const rows: { statDate: string; shareChannel: string; sharePv: number; shareUv: number }[] = [];
  for (const [shareChannel, weight] of SHARE_CHANNELS) {
    // the small channels are absent on some days, as a channel nobody shared to has no row
    if (weight <= 0.04 && unit('present', day, shareChannel) < 0.3) continue;
    const sharePv = Math.floor(total * weight * (0.85 + unit('w', day, shareChannel) * 0.3));
    if (sharePv === 0) continue;
    rows.push({
      statDate: day,
      shareChannel,
      sharePv,
      shareUv: Math.max(1, Math.floor(sharePv * (0.6 + unit('uv', day, shareChannel) * 0.3))),
    });
  }
  return rows;
}
