import { describe, expect, it } from 'vitest';
import { PERMISSION_CODES } from '../../access/permissionCodes';
import generated from './configKeys.generated.json';
import {
  CONFIG_HOSTS,
  CONFIG_SCHEMA,
  EXTRA_CONFIG_KEYS,
  specOf,
  validateValue,
} from './configSchema';

// The keys the backend has that contract 17.5 does not list yet (checklist section 2(d), the seven
// earlier ones, and the ranges of the group B additions): key, kind, edit permission, min, max.
const EXTRA_KEYS: [string, string, string, number?, number?][] = [
  ['chat.moderation_global_concurrency', 'int', 'CONFIG:MANAGE', 1, 512],
  ['export.parallelism', 'int', 'CONFIG:MANAGE', 1, 4],
  ['ratelimit.apk_download_per_ip_per_min', 'int', 'CONFIG:MANAGE', 1],
  ['ratelimit.push_image_per_ip_per_min', 'int', 'CONFIG:MANAGE', 1],
  ['ratelimit.ad_media_per_ip_per_min', 'int', 'CONFIG:MANAGE', 1],
  ['analytics.funnel_max_concurrency', 'int', 'CONFIG:MANAGE', 1, 32],
  ['integrity.app_attest_max_keys_per_device', 'int', 'CONFIG:MANAGE', 1],
  ['ratelimit.app_attest_challenge_per_ip_per_hour', 'int', 'CONFIG:MANAGE', 1],
  ['ratelimit.app_attest_key_per_ip_per_hour', 'int', 'CONFIG:MANAGE', 1],
  ['integrity.app_attest_unsupported_allowed', 'bool', 'CONFIG:MANAGE'],
  ['events.store_client_ip', 'bool', 'CONFIG:MANAGE'],
  ['ads.store_client_ip', 'bool', 'CONFIG:MANAGE'],
  ['attribution.store_click_ip', 'bool', 'ATTRIBUTION:MANAGE'],
  ['chat.message_retention_days', 'int', 'CONFIG:MANAGE', 0],
  ['voice.source_sample_retention_days', 'int', 'CONFIG:MANAGE', 0],
  ['guest.device_retention_days', 'int', 'CONFIG:MANAGE', 0],
  ['support.feedback_retention_days', 'int', 'CONFIG:MANAGE', 0],
  ['moderation.record_retention_days', 'int', 'MODERATION:CONFIG', 0],
  ['push.task_poll_seconds', 'int', 'PUSH:CONFIG', 1],
  ['memory.call_timeout_seconds', 'int', 'CONFIG:MANAGE', 1],
  ['attribution.postback_enabled', 'bool', 'ATTRIBUTION:MANAGE'],
  ['attribution.facebook_graph_version', 'string', 'ATTRIBUTION:MANAGE'],
  ['ratelimit.events_per_ip_per_minute', 'int', 'CONFIG:MANAGE', 1],
  ['chat.moderation_concurrency', 'int', 'CONFIG:MANAGE', 1, 32],
  ['chat.moderation_deadline_ms', 'int', 'CONFIG:MANAGE', 100, 2500],
];

describe('CONFIG_SCHEMA', () => {
  it('has the keys and edit permissions of the generated file first, in the same order, then the backend extras', () => {
    const entries = CONFIG_SCHEMA.map((s) => ({ key: s.key, editPermission: s.editPermission }));
    expect(entries.slice(0, generated.length)).toEqual(generated);
    expect(entries.slice(generated.length).map((e) => e.key)).toEqual(EXTRA_KEYS.map((e) => e[0]));
    expect(EXTRA_CONFIG_KEYS).toEqual(EXTRA_KEYS.map((e) => e[0]));
  });

  it('has the 25 backend extras with the kind, edit permission and range of the checklist', () => {
    expect(EXTRA_KEYS).toHaveLength(25);
    for (const [key, kind, permission, min, max] of EXTRA_KEYS) {
      const found = specOf(key);
      expect(found, key).toBeDefined();
      expect(found?.kind, key).toBe(kind);
      expect(found?.editPermission, key).toBe(permission);
      expect(found?.min, key).toBe(min);
      expect(found?.max, key).toBe(max);
      expect(found?.group, key).toBe(key.split('.')[0]);
    }
    // a key edited with its module permission, not CONFIG:MANAGE
    expect(specOf('attribution.store_click_ip')?.editPermission).toBe('ATTRIBUTION:MANAGE');
    expect(specOf('moderation.record_retention_days')?.editPermission).toBe('MODERATION:CONFIG');
  });

  it('changes the ranges of the group B keys: deadline 100 to 2500, recall 1 to 1440, catch-up 1 to 10080', () => {
    const range = (key: string) => [specOf(key)?.min, specOf(key)?.max];
    expect(range('chat.moderation_deadline_ms')).toEqual([100, 2500]);
    expect(range('recall.window_minutes')).toEqual([1, 1440]);
    expect(range('recall.scan_interval_minutes')).toEqual([1, 1440]);
    expect(range('push.schedule_catchup_minutes')).toEqual([1, 10080]);
  });

  it('has each key once, a known kind, a real permission code and the prefix as its group', () => {
    expect(new Set(CONFIG_SCHEMA.map((s) => s.key)).size).toBe(CONFIG_SCHEMA.length);
    for (const spec of CONFIG_SCHEMA) {
      expect(['int', 'number', 'string', 'bool', 'json', 'url'], spec.key).toContain(spec.kind);
      expect(PERMISSION_CODES as readonly string[], spec.key).toContain(spec.editPermission);
      expect(spec.key.startsWith(`${spec.group}.`), spec.key).toBe(true);
    }
  });

  it('stores no default value', () => {
    for (const spec of CONFIG_SCHEMA) expect(Object.keys(spec), spec.key).not.toContain('default');
  });

  it('marks the seven risk keys, and no other', () => {
    expect(
      CONFIG_SCHEMA.filter((s) => s.risk)
        .map((s) => s.key)
        .sort(),
    ).toEqual([
      'chat.conversation_languages',
      'chat.model_tiers_allowed',
      'complaint.likeness_due_hours',
      'guest.call_minutes_total',
      'guest.device_retention_days',
      'moderation.underage_reject_below_age',
      'render.cloud_enabled',
    ]);
  });

  it('sends moderation.text_rules to the rule editor, and only that key', () => {
    expect(
      CONFIG_SCHEMA.filter((s) => s.editedElsewhere).map((s) => [s.key, s.editedElsewhere]),
    ).toEqual([['moderation.text_rules', '/moderation/rules']]);
  });

  it('has a hosting page for every permission other than CONFIG:MANAGE', () => {
    const used = new Set(CONFIG_SCHEMA.map((s) => s.editPermission));
    used.delete('CONFIG:MANAGE');
    expect(used.size).toBe(10);
    for (const code of used) expect(CONFIG_HOSTS[code], code).toMatch(/^\//);
    for (const code of Object.keys(CONFIG_HOSTS)) expect(used.has(code as never), code).toBe(true);
  });

  it('counts keys of each kind and per permission as the contract table does', () => {
    const perPermission = new Map<string, number>();
    for (const s of CONFIG_SCHEMA)
      perPermission.set(s.editPermission, (perPermission.get(s.editPermission) ?? 0) + 1);
    // 161 of the contract table plus 20 extras; 225 of the table plus 25 extras
    expect(perPermission.get('CONFIG:MANAGE')).toBe(181);
    expect([...perPermission.values()].reduce((a, b) => a + b, 0)).toBe(250);
  });
});

describe('validateValue', () => {
  const spec = (key: string) => specOf(key) as NonNullable<ReturnType<typeof specOf>>;

  it('checks whole numbers and their range', () => {
    expect(validateValue(spec('auth.access_ttl_minutes'), 1440)).toBeNull();
    expect(validateValue(spec('auth.access_ttl_minutes'), 0)).toBe('OUT_OF_RANGE');
    expect(validateValue(spec('auth.access_ttl_minutes'), 1.5)).toBe('NOT_AN_INTEGER');
    expect(validateValue(spec('auth.access_ttl_minutes'), '5')).toBe('NOT_AN_INTEGER');
    expect(validateValue(spec('auth.access_ttl_minutes'), Number.NaN)).toBe('NOT_AN_INTEGER');
    expect(validateValue(spec('ads.skip_after_seconds'), 0)).toBeNull(); // 0 is allowed here
    expect(validateValue(spec('ads.skip_after_seconds'), 61)).toBe('OUT_OF_RANGE');
    expect(validateValue(spec('recall.local_send_hour'), 23)).toBeNull();
    expect(validateValue(spec('recall.local_send_hour'), 24)).toBe('OUT_OF_RANGE');
    expect(validateValue(spec('auth.password_max_length'), 7)).toBe('OUT_OF_RANGE');
    expect(validateValue(spec('invite.max_rewarded_per_inviter'), 0)).toBeNull();
  });

  it('checks the ranges of the extras: the retention keys take 0 or a minimum, the group B keys their new maximum', () => {
    expect(validateValue(spec('chat.moderation_deadline_ms'), 2500)).toBeNull();
    expect(validateValue(spec('chat.moderation_deadline_ms'), 2501)).toBe('OUT_OF_RANGE');
    expect(validateValue(spec('chat.moderation_deadline_ms'), 99)).toBe('OUT_OF_RANGE');
    expect(validateValue(spec('recall.window_minutes'), 1440)).toBeNull();
    expect(validateValue(spec('recall.window_minutes'), 1441)).toBe('OUT_OF_RANGE');
    expect(validateValue(spec('recall.scan_interval_minutes'), 1441)).toBe('OUT_OF_RANGE');
    expect(validateValue(spec('push.schedule_catchup_minutes'), 10080)).toBeNull();
    expect(validateValue(spec('push.schedule_catchup_minutes'), 10081)).toBe('OUT_OF_RANGE');
    expect(validateValue(spec('export.parallelism'), 5)).toBe('OUT_OF_RANGE');
    expect(validateValue(spec('chat.moderation_global_concurrency'), 512)).toBeNull();
    expect(validateValue(spec('ratelimit.apk_download_per_ip_per_min'), 100000)).toBeNull();
    expect(validateValue(spec('chat.message_retention_days'), 0)).toBeNull();
    expect(validateValue(spec('chat.message_retention_days'), 31)).toBe('OUT_OF_RANGE');
    expect(validateValue(spec('chat.message_retention_days'), 32)).toBeNull();
    expect(validateValue(spec('guest.device_retention_days'), 90)).toBe('OUT_OF_RANGE');
    expect(validateValue(spec('guest.device_retention_days'), 91)).toBeNull();
    expect(validateValue(spec('support.feedback_retention_days'), 1)).toBeNull();
    expect(validateValue(spec('support.feedback_retention_days'), -1)).toBe('OUT_OF_RANGE');
  });

  it('checks the shape of attribution.facebook_graph_version: v, two digits, a dot, one digit', () => {
    const s = spec('attribution.facebook_graph_version');
    expect(validateValue(s, 'v26.0')).toBeNull();
    for (const bad of ['26.0', 'v26', 'v2.0', 'V26.0', 'v26.00', ' v26.0', 'v26.0\n'])
      expect(validateValue(s, bad), bad).toBe('OUT_OF_RANGE');
  });

  it('checks booleans and plain numbers', () => {
    expect(validateValue(spec('integrity.check_enabled'), true)).toBeNull();
    expect(validateValue(spec('integrity.check_enabled'), 'true')).toBe('NOT_BOOLEAN');
    expect(validateValue(spec('moderation.face_min_det_score'), 0.5)).toBeNull();
    expect(
      validateValue(spec('moderation.face_min_det_score'), Number.POSITIVE_INFINITY),
    ).not.toBeNull();
  });

  it('checks links with the link rule and its reason codes', () => {
    expect(validateValue(spec('upload.public_base_url'), 'https://files.example.com/m')).toBeNull();
    expect(validateValue(spec('upload.public_base_url'), 'http://files.example.com')).toBe(
      'NOT_HTTPS',
    );
    expect(validateValue(spec('upload.public_base_url'), 5)).toBe('NOT_HTTPS');
  });

  it('checks the stage thresholds: positive whole numbers that rise', () => {
    const s = spec('companionship.stage_thresholds');
    expect(validateValue(s, { BONDING: 50, CLOSE: 150 })).toBeNull();
    expect(validateValue(s, { BONDING: 150, CLOSE: 150 })).toBe('OUT_OF_RANGE');
    expect(validateValue(s, { BONDING: 200, CLOSE: 150 })).toBe('OUT_OF_RANGE');
    expect(validateValue(s, { BONDING: 0, CLOSE: 150 })).toBe('OUT_OF_RANGE');
    expect(validateValue(s, { BONDING: 5.5, CLOSE: 150 })).toBe('NOT_AN_INTEGER');
    expect(validateValue(s, [50, 150])).toBe('OUT_OF_RANGE');
    expect(validateValue(s, null)).toBe('OUT_OF_RANGE');
  });

  it('checks the milestone days: 1 to 20 different positive whole numbers', () => {
    const s = spec('milestone.days');
    expect(validateValue(s, [7, 30, 100])).toBeNull();
    expect(validateValue(s, [])).toBe('OUT_OF_RANGE');
    expect(
      validateValue(
        s,
        Array.from({ length: 21 }, (_, i) => i + 1),
      ),
    ).toBe('OUT_OF_RANGE');
    expect(
      validateValue(
        s,
        Array.from({ length: 20 }, (_, i) => i + 1),
      ),
    ).toBeNull();
    expect(validateValue(s, [7, 7])).toBe('OUT_OF_RANGE');
    expect(validateValue(s, [0, 7])).toBe('OUT_OF_RANGE');
    expect(validateValue(s, [-3])).toBe('OUT_OF_RANGE');
    expect(validateValue(s, [Number.NaN])).toBe('NOT_AN_INTEGER');
    expect(validateValue(s, [1.5])).toBe('NOT_AN_INTEGER');
  });

  it('checks the supported locales: language tags, different, with en', () => {
    const s = spec('app.supported_locales');
    expect(validateValue(s, ['en'])).toBeNull();
    expect(validateValue(s, ['en', 'th', 'ar', 'vi', 'id', 'es', 'zh-Hans'])).toBeNull();
    expect(validateValue(s, ['th'])).toBe('OUT_OF_RANGE');
    expect(validateValue(s, ['en', 'en'])).toBe('OUT_OF_RANGE');
    expect(validateValue(s, ['en', 'english'])).toBe('INVALID_LANGUAGE_TAG');
    expect(validateValue(s, ['en', `zh-${'a'.repeat(36)}`])).toBe('INVALID_LANGUAGE_TAG');
    expect(validateValue(s, 'en')).toBe('INVALID_LANGUAGE_TAG');
  });

  it('checks country codes (two capitals) and conversation languages (two lower-case letters)', () => {
    expect(validateValue(spec('sms.allowed_country_codes'), ['TH', 'SG'])).toBeNull();
    expect(validateValue(spec('sms.allowed_country_codes'), ['th'])).toBe('OUT_OF_RANGE');
    expect(validateValue(spec('sms.allowed_country_codes'), ['THA'])).toBe('OUT_OF_RANGE');
    expect(validateValue(spec('chat.conversation_languages'), ['en', 'th', 'ar'])).toBeNull();
    expect(validateValue(spec('chat.conversation_languages'), ['EN'])).toBe('INVALID_LANGUAGE_TAG');
    expect(validateValue(spec('chat.conversation_languages'), ['eng'])).toBe(
      'INVALID_LANGUAGE_TAG',
    );
  });

  it('leaves other JSON values to the server', () => {
    expect(validateValue(spec('chat.model_tiers_allowed'), ['standard'])).toBeNull();
  });
});
