// The defaults the fake backend reports for the keys that contract 17.5 does not list yet (the list
// of the keys is src/pages/config/extraConfigKeys.ts). Values are the defaults of the backend's
// checklist. When the contract adopts a key it is generated into configDefaults.generated.json and
// its line goes from here.
export const EXTRA_DEFAULTS: Record<string, unknown> = {
  'chat.moderation_global_concurrency': 64,
  'export.parallelism': 3,
  'ratelimit.apk_download_per_ip_per_min': 30,
  'ratelimit.push_image_per_ip_per_min': 120,
  'ratelimit.ad_media_per_ip_per_min': 120,
  'analytics.funnel_max_concurrency': 2,
  'integrity.app_attest_max_keys_per_device': 3,
  'ratelimit.app_attest_challenge_per_ip_per_hour': 60,
  'ratelimit.app_attest_key_per_ip_per_hour': 20,
  'integrity.app_attest_unsupported_allowed': true,
  'events.store_client_ip': true,
  'ads.store_client_ip': true,
  'attribution.store_click_ip': true,
  'chat.message_retention_days': 0,
  'voice.source_sample_retention_days': 0,
  'guest.device_retention_days': 0,
  'support.feedback_retention_days': 0,
  'moderation.record_retention_days': 0,
  'push.task_poll_seconds': 15,
  'memory.call_timeout_seconds': 10,
  'attribution.postback_enabled': false,
  'attribution.facebook_graph_version': 'v26.0',
  'ratelimit.events_per_ip_per_minute': 600,
  'chat.moderation_concurrency': 16,
  'chat.moderation_deadline_ms': 2000,
};
