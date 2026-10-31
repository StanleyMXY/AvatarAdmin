/**
 * The kinds of background alert (`AdminAlert.type`): the fourteen of contract 17.4 (spec 5.14 has
 * thirteen, it leaves out LOOK_PACKAGE_PREPARE_FAILED) and the four the backend added after it:
 * SUPPORT_FORWARD_FAILED, POSTBACK_CREDENTIAL_FAILED, SUBSCRIPTION_EVENT_FAILED and
 * STAT_RELAND_FAILED. The type filter of `GET /alerts` takes exactly these eighteen.
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
  'SUPPORT_FORWARD_FAILED',
  'POSTBACK_CREDENTIAL_FAILED',
  'SUBSCRIPTION_EVENT_FAILED',
  'STAT_RELAND_FAILED',
] as const;

export type AlertType = (typeof ALERT_TYPES)[number];

const KNOWN: ReadonlySet<string> = new Set(ALERT_TYPES);

export const isKnownAlertType = (type: string): type is AlertType => KNOWN.has(type);

/** The language-file key of the text of a type. */
export const alertTypeKey = (type: string): string => `monitor.alert.type.${type}`;

/**
 * The fixed values of `detail` the backend writes for a type, which are codes and not sentences:
 * the forwarding alert always says `attempts_exhausted`, the postback credential alert says
 * `token_unreadable` or `pixel_id_malformed` (any other value there is the error code of the ad
 * platform and is shown as it comes).
 */
const FIXED_DETAILS: Readonly<Record<string, readonly string[]>> = {
  SUPPORT_FORWARD_FAILED: ['attempts_exhausted'],
  POSTBACK_CREDENTIAL_FAILED: ['token_unreadable', 'pixel_id_malformed'],
};

/** The language-file key of the text of a fixed detail, or null when this type has no such detail. */
export const alertDetailKey = (type: string, detail: string): string | null =>
  Object.hasOwn(FIXED_DETAILS, type) && FIXED_DETAILS[type].includes(detail)
    ? `monitor.alert.detail.${detail}`
    : null;
