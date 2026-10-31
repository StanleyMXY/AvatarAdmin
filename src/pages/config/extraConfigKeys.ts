import type { ConfigKeySpec } from './configSchema';

// The settings the backend has that contract 17.5 does not list yet (checklist of the backend,
// section 2(d), and the seven extra keys it names after it). `GET /config` returns them, so the
// page knows them and the check script lets them pass. When the contract adopts a key, delete its
// entry here, run `npm run gen:config-keys` and put the entry into the entries of the table in
// configSchema.ts in the order of the table; the check script says so ("is in the contract now").
// The schema holds no default: `GET /config` reports it. The fake backend keeps its defaults for
// these keys in mock/_core/configExtraDefaults.ts.

type Extra = Omit<ConfigKeySpec, 'validate'>;

const manage = (key: string, kind: Extra['kind'], rest: Partial<Extra> = {}): Extra => ({
  key,
  kind,
  editPermission: 'CONFIG:MANAGE',
  group: key.split('.')[0],
  ...rest,
});

export const EXTRA_ENTRIES: Extra[] = [
  // delivery 1 (d1 to d9)
  manage('chat.moderation_global_concurrency', 'int', { min: 1, max: 512 }),
  manage('export.parallelism', 'int', { min: 1, max: 4 }),
  manage('ratelimit.apk_download_per_ip_per_min', 'int', { min: 1 }),
  manage('ratelimit.push_image_per_ip_per_min', 'int', { min: 1 }),
  manage('ratelimit.ad_media_per_ip_per_min', 'int', { min: 1 }),
  manage('analytics.funnel_max_concurrency', 'int', { min: 1, max: 32 }),
  manage('integrity.app_attest_max_keys_per_device', 'int', { min: 1 }),
  manage('ratelimit.app_attest_challenge_per_ip_per_hour', 'int', { min: 1 }),
  manage('ratelimit.app_attest_key_per_ip_per_hour', 'int', { min: 1 }),
  // the switches of 2026-10-30 (d10 to d13); d13 is edited with the attribution permission
  manage('integrity.app_attest_unsupported_allowed', 'bool'),
  manage('events.store_client_ip', 'bool'),
  manage('ads.store_client_ip', 'bool'),
  {
    key: 'attribution.store_click_ip',
    kind: 'bool',
    editPermission: 'ATTRIBUTION:MANAGE',
    group: 'attribution',
  },
  // the retention periods (d14 to d18); 0 means no limit, d18 is edited with the moderation permission
  manage('chat.message_retention_days', 'int', { min: 0, zeroOrMin: 32 }),
  manage('voice.source_sample_retention_days', 'int', { min: 0 }),
  manage('guest.device_retention_days', 'int', { min: 0, zeroOrMin: 91, risk: true }),
  manage('support.feedback_retention_days', 'int', { min: 0 }),
  {
    key: 'moderation.record_retention_days',
    kind: 'int',
    editPermission: 'MODERATION:CONFIG',
    group: 'moderation',
    min: 0,
  },
  // the seven earlier keys
  {
    key: 'push.task_poll_seconds',
    kind: 'int',
    editPermission: 'PUSH:CONFIG',
    group: 'push',
    min: 1,
  },
  manage('memory.call_timeout_seconds', 'int', { min: 1 }),
  {
    key: 'attribution.postback_enabled',
    kind: 'bool',
    editPermission: 'ATTRIBUTION:MANAGE',
    group: 'attribution',
  },
  {
    key: 'attribution.facebook_graph_version',
    kind: 'string',
    editPermission: 'ATTRIBUTION:MANAGE',
    group: 'attribution',
    pattern: /^v[0-9]{2}\.[0-9]$/,
  },
  manage('ratelimit.events_per_ip_per_minute', 'int', { min: 1 }),
  manage('chat.moderation_concurrency', 'int', { min: 1, max: 32 }),
  manage('chat.moderation_deadline_ms', 'int', { min: 100, max: 2500 }),
];
