// State of the monitoring mock: the background alerts (one of each of the fourteen types of
// contract 17.4, some of them already resolved), the switch that makes the pipeline report nothing,
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
      accountId: seed.withAccount ? String(2000 + n) : null,
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
  monitorStore.alerts = rows;
}

resetMonitorStore();
