/**
 * The kinds of background alert (`AdminAlert.type`): the fourteen of contract 17.4, not the
 * thirteen of spec 5.14 (it leaves out LOOK_PACKAGE_PREPARE_FAILED).
 */
export const ALERT_TYPES = [
  'DELETION_FAILED',
  'SUBSCRIPTION_UNACKED',
  'CREDIT_UNCONSUMED',
  'CREDIT_CONSUMED_BEFORE_CREDITED',
  'CREDIT_LEDGER_MISMATCH',
  'MEMORY_SYNC_FAILED',
  'SMS_DAILY_CAP_REACHED',
  'FREE_CALL_MINUTES_HIGH',
  'USAGE_PRICE_MISSING',
  'LLM_PRICE_SYNC_FAILED',
  'AVATAR_DELETION_OVERDUE',
  'LIKENESS_COMPLAINT_OVERDUE',
  'GENERATION_CONFIG_MISSING',
  'LOOK_PACKAGE_PREPARE_FAILED',
] as const;

export type AlertType = (typeof ALERT_TYPES)[number];

const KNOWN: ReadonlySet<string> = new Set(ALERT_TYPES);

export const isKnownAlertType = (type: string): type is AlertType => KNOWN.has(type);

/** The language-file key of the text of a type. */
export const alertTypeKey = (type: string): string => `monitor.alert.type.${type}`;
