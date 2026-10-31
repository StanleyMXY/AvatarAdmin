// State of the monitoring mock: the background alerts (one of each of the eighteen types: the
// fourteen of contract 17.4 and the four the backend added, some of them already resolved), the switch that makes the pipeline report nothing,
// and the list of driving packages whose failure count was reset by closing an alert. Kept on
// `globalThis` like the rest of the mock state; `resetMonitorStore` puts the sample data back.
import { daysAgoIso, makeUuid, sampleAny } from './fixtures';

export type AlertRow = {
  id: string;
  type: string;
  accountId: string | null;
  refType: string;
  refId: string;
  detail: string | null;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  resolvedAt: string | null;
};

type MonitorStore = {
  alerts: AlertRow[];
  /** When set, the pipeline has never received a report. */
  pipelineEmpty: boolean;
  /** `refId` of the driving package of every LOOK_PACKAGE_PREPARE_FAILED alert that was closed. */
  lookPackageResets: string[];
};

const holder = globalThis as { __avatarAdminMockMonitor?: MonitorStore };
holder.__avatarAdminMockMonitor ??= { alerts: [], pipelineEmpty: false, lookPackageResets: [] };

export const monitorStore: MonitorStore = holder.__avatarAdminMockMonitor;

export const PIPELINE_SOURCES = ['agent-server-1', 'agent-server-2', 'agent-server-3'] as const;
export const PIPELINE_STEP_MS = 5 * 60 * 1000;
export const PIPELINE_MAX_RANGE_DAYS = 7;
export const PIPELINE_MAX_POINTS = 5000;

type Seed = {
  type: string;
  refType: string;
  ref: () => string;
  withAccount: boolean;
  /** The account of the alert when it must be a given one (the owner of the feedback, say). */
  account?: string;
  detail: string;
};

const day = (n: number) => daysAgoIso(n).slice(0, 10);

const SEEDS: Seed[] = [
  {
    type: 'DELETION_FAILED',
    refType: 'ACCOUNT_DELETION',
    ref: makeUuid,
    withAccount: true,
    detail: 'The deletion failed 3 times in a row; last step: delete the voice files',
  },
  {
    type: 'SUBSCRIPTION_UNACKED',
    refType: 'SUBSCRIPTION',
    ref: makeUuid,
    withAccount: true,
    detail: 'The store subscription was not acknowledged within 3 hours',
  },
  {
    type: 'CREDIT_UNCONSUMED',
    refType: 'ONE_TIME_PURCHASE',
    ref: makeUuid,
    withAccount: true,
    detail: 'The credit purchase is still not consumed after 24 hours',
  },
  {
    type: 'CREDIT_CONSUMED_BEFORE_CREDITED',
    refType: 'STORE_ORDER',
    ref: () => `GOOGLE:GPA.${Math.floor(Math.random() * 9000 + 1000)}-5555-7777-12345`,
    withAccount: true,
    detail: 'The purchase was consumed by the client before it was credited',
  },
  {
    type: 'CREDIT_LEDGER_MISMATCH',
    refType: 'CREDIT_BALANCE',
    ref: () => '2001',
    withAccount: true,
    detail: 'Balance 120 but the ledger adds up to 100',
  },
  {
    type: 'MEMORY_SYNC_FAILED',
    refType: 'ACCOUNT_MEMORY_TIER',
    ref: () => '2002',
    withAccount: true,
    detail: 'The memory service answered 404: tier premium not found',
  },
  {
    type: 'SMS_DAILY_CAP_REACHED',
    refType: 'SMS_GLOBAL_CAP',
    ref: () => day(0),
    withAccount: false,
    detail: 'The daily SMS total reached 5000',
  },
  {
    type: 'FREE_CALL_MINUTES_HIGH',
    refType: 'FREE_CALL_BUDGET',
    ref: () => day(0),
    withAccount: false,
    detail: 'Free call minutes today: 9120, the alert level is 9000',
  },
  {
    type: 'USAGE_PRICE_MISSING',
    refType: 'USAGE_MODEL',
    ref: () => 'LLM/dashscope/qwen-max-2026',
    withAccount: false,
    detail: 'A usage report for a model that has no price',
  },
  {
    type: 'LLM_PRICE_SYNC_FAILED',
    refType: 'LLM_PRICE_SYNC',
    ref: () => 'ALL',
    withAccount: false,
    detail: 'The price sync job failed: the price API key is not set',
  },
  {
    type: 'AVATAR_DELETION_OVERDUE',
    refType: 'EXTERNAL_DELETION_JOB',
    ref: makeUuid,
    withAccount: false,
    detail: 'The external deletion job has run for more than 72 hours',
  },
  {
    type: 'LIKENESS_COMPLAINT_OVERDUE',
    refType: 'LIKENESS_COMPLAINT',
    ref: makeUuid,
    withAccount: false,
    detail: 'A likeness complaint is past its due time',
  },
  {
    type: 'GENERATION_CONFIG_MISSING',
    refType: 'APP_CONFIG',
    ref: () => 'GENERATION',
    withAccount: false,
    detail: 'generation.mouth_open_min_area is not configured',
  },
  {
    type: 'LOOK_PACKAGE_PREPARE_FAILED',
    refType: 'LOOK_PACKAGE',
    ref: makeUuid,
    withAccount: true,
    detail: 'Preparing the driving package failed 5 times',
  },
  // The feedback 5003 of the support mock is a FAILED one, sent by the account 2003.
  {
    type: 'SUPPORT_FORWARD_FAILED',
    refType: 'SUPPORT_FEEDBACK',
    ref: () => '5003',
    withAccount: true,
    account: '2003',
    detail: 'attempts_exhausted',
  },
  // The campaign 1 of the campaign mock; the two other detail values are added below.
  {
    type: 'POSTBACK_CREDENTIAL_FAILED',
    refType: 'ATTRIBUTION_CAMPAIGN',
    ref: () => '1',
    withAccount: false,
    detail: 'token_unreadable',
  },
  // What the backend says about this type is only its name; refType and detail are made up here.
  {
    type: 'SUBSCRIPTION_EVENT_FAILED',
    refType: 'SUBSCRIPTION_EVENT',
    ref: makeUuid,
    withAccount: true,
    detail: 'IllegalStateException',
  },
  {
    type: 'STAT_RELAND_FAILED',
    refType: 'STAT_RELAND_DAY',
    ref: () => `usage-cost:${day(8)}`,
    withAccount: false,
    detail: 'java.lang.IllegalStateException',
  },
];

export function resetMonitorStore(): void {
  monitorStore.pipelineEmpty = false;
  monitorStore.lookPackageResets = [];
  const rows: AlertRow[] = [];
  let n = 0;
  const add = (seed: Seed, status: 'OPEN' | 'RESOLVED', hoursAgo: number, detail?: string) => {
    n += 1;
    const createdAt = new Date(Date.now() - hoursAgo * 3600_000).toISOString();
    rows.push({
      id: String(100 + n),
      type: seed.type,
      accountId: seed.withAccount ? (seed.account ?? String(2000 + n)) : null,
      refType: seed.refType,
      refId: seed.ref(),
      detail: detail ?? seed.detail,
      status,
      createdAt,
      resolvedAt:
        status === 'RESOLVED' ? new Date(Date.parse(createdAt) + 3600_000).toISOString() : null,
    });
  };
  SEEDS.forEach((seed, i) => {
    add(seed, 'OPEN', 2 + i * 5);
  });
  // closed ones, and a second open one of a type with a long detail in many scripts
  for (const seed of SEEDS.slice(0, 6)) add(seed, 'RESOLVED', 100 + n * 3);
  add(SEEDS[0], 'OPEN', 1, `${sampleAny(0)} ${sampleAny(1)} ${'x'.repeat(300)}`);
  add(SEEDS[8], 'RESOLVED', 90, sampleAny(2));
  // the other two kinds of detail a postback credential alert has: the pixel id and the error code of the ad platform
  const postback = SEEDS.find((seed) => seed.type === 'POSTBACK_CREDENTIAL_FAILED') as Seed;
  add({ ...postback, ref: () => '4' }, 'OPEN', 3, 'pixel_id_malformed');
  add({ ...postback, ref: () => '6' }, 'OPEN', 4, '190');
  // a second forwarding alert, of another FAILED feedback of the support mock (5005, sent by the account 2005)
  const forward = SEEDS.find((seed) => seed.type === 'SUPPORT_FORWARD_FAILED') as Seed;
  add({ ...forward, ref: () => '5005', account: '2005' }, 'OPEN', 6);
  monitorStore.alerts = rows;
}

export type AlertDraft = {
  type: string;
  refType: string;
  refId: string;
  accountId: string | null;
  detail: string | null;
};

/**
 * What the backend does when a job fails: an object has one OPEN alert at a time. If one is open it
 * stays the one row, and only a postback credential alert takes the newer reason as its detail (a
 * later failure with another reason replaces the first); if none is open a new row is opened, so a
 * failure after a retry or a hand-closed alert shows as a new alert. Used by the tests and by the
 * other mock endpoints that cause an alert.
 */
export function raiseAlert(draft: AlertDraft): AlertRow {
  const open = monitorStore.alerts.find(
    (a) =>
      a.status === 'OPEN' &&
      a.type === draft.type &&
      a.refType === draft.refType &&
      a.refId === draft.refId,
  );
  if (open) {
    if (draft.type === 'POSTBACK_CREDENTIAL_FAILED') open.detail = draft.detail;
    return open;
  }
  const next = monitorStore.alerts.reduce((max, a) => Math.max(max, Number(a.id) || 0), 100) + 1;
  const row: AlertRow = {
    id: String(next),
    ...draft,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
  monitorStore.alerts.push(row);
  return row;
}

/** The backend closes every open alert of an object by itself when the cause is gone; the number closed. */
export function resolveAlertsOf(refType: string, refId: string): number {
  let closed = 0;
  for (const alert of monitorStore.alerts) {
    if (alert.status === 'OPEN' && alert.refType === refType && alert.refId === refId) {
      alert.status = 'RESOLVED';
      alert.resolvedAt = new Date().toISOString();
      closed += 1;
    }
  }
  return closed;
}

resetMonitorStore();
