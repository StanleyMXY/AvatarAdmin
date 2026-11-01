import type { StatDailyRow } from '../../services/stats/types';
import { DASH, formatCount, safeRatio } from '../../utils/ratio';

/** A daily row with the three derived minute figures (the backend sends seconds). */
export type DailyViewRow = StatDailyRow & {
  callMinutesTotal: number | null;
  callMinutesPerAccount: number | null;
  guestCallMinutesTotal: number | null;
};

const toMinutes = (seconds: number | null | undefined): number | null =>
  typeof seconds === 'number' && Number.isFinite(seconds) ? seconds / 60 : null;

/**
 * The row as the table and the chart read it. Minutes per caller is `callSecondsTotal / 60 /
 * accountsWithCall`; with nobody who called (or a missing part) it is null, never 0 or NaN.
 */
export function toViewRow(row: StatDailyRow): DailyViewRow {
  const perAccount = safeRatio(row.callSecondsTotal, row.accountsWithCall);
  return {
    ...row,
    callMinutesTotal: toMinutes(row.callSecondsTotal),
    callMinutesPerAccount: perAccount === null ? null : perAccount / 60,
    guestCallMinutesTotal: toMinutes(row.guestCallSecondsTotal),
  };
}

type Group = 'date' | 'event' | 'business';
type Kind = 'date' | 'count' | 'minutes';

export type ColumnDef = {
  /** Also the language key `stat.daily.col.<key>` (and `.tip` when `tip` is set). */
  key: string;
  field: keyof DailyViewRow;
  kind: Kind;
  group: Group;
  /** The title has a hint icon with the definition. */
  tip: boolean;
  /** The platform filter is not All, and this metric has no platform dimension: the cells are dashes. */
  noPlatformDimension: boolean;
  fixed?: 'left';
};

// Event metrics come from the event table and have a platform; business metrics come from the account,
// session, message, subscription and credit tables and exist only for platform ALL (contract 17.6).
const SPEC: { key: string; field: keyof DailyViewRow; kind: Kind; group: Group; tip?: boolean }[] =
  [
    { key: 'statDate', field: 'statDate', kind: 'date', group: 'date' },
    { key: 'dau', field: 'dau', kind: 'count', group: 'event', tip: true },
    { key: 'wau', field: 'wau', kind: 'count', group: 'event', tip: true },
    { key: 'mau', field: 'mau', kind: 'count', group: 'event', tip: true },
    { key: 'dauDevices', field: 'dauDevices', kind: 'count', group: 'event', tip: true },
    {
      key: 'newAccountsRegistered',
      field: 'newAccountsRegistered',
      kind: 'count',
      group: 'business',
    },
    {
      key: 'guestDevicesNew',
      field: 'guestDevicesNew',
      kind: 'count',
      group: 'business',
      tip: true,
    },
    {
      key: 'guestDevicesConverted',
      field: 'guestDevicesConverted',
      kind: 'count',
      group: 'business',
    },
    { key: 'avatarCreatedAccounts', field: 'avatarCreatedAccounts', kind: 'count', group: 'event' },
    { key: 'voiceClonedAccounts', field: 'voiceClonedAccounts', kind: 'count', group: 'event' },
    {
      key: 'sessionStartedAccounts',
      field: 'sessionStartedAccounts',
      kind: 'count',
      group: 'event',
    },
    {
      key: 'sessionsConnected',
      field: 'sessionsConnected',
      kind: 'count',
      group: 'business',
      tip: true,
    },
    { key: 'accountsWithCall', field: 'accountsWithCall', kind: 'count', group: 'business' },
    { key: 'callMinutesTotal', field: 'callMinutesTotal', kind: 'minutes', group: 'business' },
    {
      key: 'callMinutesPerAccount',
      field: 'callMinutesPerAccount',
      kind: 'minutes',
      group: 'business',
    },
    { key: 'messagesUser', field: 'messagesUser', kind: 'count', group: 'business' },
    { key: 'messagesAssistant', field: 'messagesAssistant', kind: 'count', group: 'business' },
    { key: 'newSubscriptions', field: 'newSubscriptions', kind: 'count', group: 'business' },
    {
      key: 'activeSubscriptions',
      field: 'activeSubscriptions',
      kind: 'count',
      group: 'business',
      tip: true,
    },
    { key: 'creditPurchases', field: 'creditPurchases', kind: 'count', group: 'business' },
    { key: 'creditsSpent', field: 'creditsSpent', kind: 'count', group: 'business' },
    {
      key: 'guestSessionsConnected',
      field: 'guestSessionsConnected',
      kind: 'count',
      group: 'business',
    },
    {
      key: 'guestCallMinutesTotal',
      field: 'guestCallMinutesTotal',
      kind: 'minutes',
      group: 'business',
    },
  ];

/** The columns of the daily report in the order of the spec; for a platform other than `ALL` the business ones are marked. */
export function buildDailyColumns(platform: string): ColumnDef[] {
  return SPEC.map((spec) => ({
    key: spec.key,
    field: spec.field,
    kind: spec.kind,
    group: spec.group,
    tip: spec.tip === true,
    noPlatformDimension: platform !== 'ALL' && spec.group === 'business',
    ...(spec.kind === 'date' ? { fixed: 'left' as const } : {}),
  }));
}

/** The cell as text: a dash for a missing number, for a metric without a platform, and for no callers. */
export function formatDailyCell(def: ColumnDef, row: DailyViewRow, locale: string): string {
  if (def.kind === 'date') return row.statDate;
  if (def.noPlatformDimension) return DASH;
  const value = row[def.field];
  if (typeof value !== 'number' || !Number.isFinite(value)) return DASH;
  if (def.kind === 'minutes') {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  }
  return formatCount(value, locale);
}

/** True when the number shown is an approximation filled in afterwards (the snapshot was missing). */
export function isBackfilledCell(def: ColumnDef, row: DailyViewRow): boolean {
  return (
    def.key === 'activeSubscriptions' &&
    !def.noPlatformDimension &&
    typeof row.activeSubscriptions === 'number' &&
    row.activeSubscriptionsBackfilled === true
  );
}

const COLUMN_BY_FIELD = new Map(SPEC.map((spec) => [spec.field, spec.kind]));

/**
 * The row as the trend chart takes it: the minute figures to one decimal, as the table shows them
 * (the chart's tooltip prints the number as it is, and a division gives a long fraction).
 */
export function chartRow(row: DailyViewRow): DailyViewRow {
  const rounded: Record<string, unknown> = { ...row };
  for (const [field, kind] of COLUMN_BY_FIELD) {
    const value = row[field];
    if (kind === 'minutes' && typeof value === 'number' && Number.isFinite(value)) {
      rounded[field] = Math.round(value * 10) / 10;
    }
  }
  return rounded as DailyViewRow;
}
