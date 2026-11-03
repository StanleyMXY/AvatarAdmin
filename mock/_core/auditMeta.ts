// The values the audit log can hold (`GET /audit-logs/meta`, backend answer 45). The backend keeps one
// constant table for them (132 actions and 47 object types there; fewer here), and a test of its own
// makes sure every place that writes an audit row uses a value of the table. The mock keeps the table
// for the values it writes itself (the seed in systemData.ts and the writes of its routes; a test
// checks that) and for a few more, so the choice has something to choose from. Not a mock file
// itself: Umi's loader reads every file in mock/ except _core.
//
// Case is part of the value and is used as it is: four object types are written in capitals
// (`NOTIFICATION`, `PUSH_SCHEDULE`, `PUSH_TASK`, `PUSH_TEMPLATE`), the others in camel case with a
// capital first letter. The mock's own seed writes `USER`, `ROLE` and so on in capitals, as the older
// sample data did, so those are in the table too.

export const AUDIT_ACTIONS: readonly string[] = [
  'ADMIN_CREATE',
  'ADMIN_DELETE',
  'ADMIN_RESET_PASSWORD',
  'ADMIN_RESET_TOTP',
  'ADMIN_STATUS',
  'ADMIN_UPDATE',
  'AD_CAMPAIGN_CREATE',
  'AD_CREATIVE_REVIEW',
  'CAMPAIGN_UPDATE',
  'CONFIG_UPDATE',
  'COSMETIC_GRANT',
  'CREDIT_ADJUST_APPROVE',
  'MODERATION_REVIEW',
  'NOTIFICATION_SEND',
  'PERMISSION_CREATE',
  'PERMISSION_DELETE',
  'PERMISSION_UPDATE',
  'PUSH_SCHEDULE_CREATE',
  'PUSH_TASK_CREATE',
  'PUSH_TEMPLATE_UPDATE',
  'ROLE_CREATE',
  'ROLE_DELETE',
  'ROLE_UPDATE',
  'SUBSCRIPTION_GRANT',
  'SUBSCRIPTION_REVOKE',
  'USER_BAN',
  'USER_UNBAN',
  'USER_VIEW_AVATAR',
  'app_version_publish',
  'ñandú_legacy_action',
].sort(byCode);

export const AUDIT_TARGET_TYPES: readonly string[] = [
  'ACCOUNT',
  'ADMIN',
  'AVATAR_ASSET',
  'AdCampaign',
  'AdCreative',
  'AppVersion',
  'CAMPAIGN',
  'CONFIG',
  'CosmeticItem',
  'CreditAdjustment',
  'MODERATION_RECORD',
  'NOTIFICATION',
  'PERMISSION',
  'PUSH_SCHEDULE',
  'PUSH_TASK',
  'PUSH_TEMPLATE',
  'ROLE',
  'SmsChannel',
  'Subscription',
  'USER',
  'User',
].sort(byCode);

/** The order of the character codes (what the backend sorts by), not the order of a language. */
function byCode(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
