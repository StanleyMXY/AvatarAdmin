import { describe, expect, it } from 'vitest';
import { PERMISSION_CODES } from '../../access/permissionCodes';
import generated from './configKeys.generated.json';
import { CONFIG_HOSTS, CONFIG_SCHEMA, specOf, validateValue } from './configSchema';

describe('CONFIG_SCHEMA', () => {
  it('has the keys and edit permissions of the generated file, in the same order', () => {
    expect(CONFIG_SCHEMA.map((s) => ({ key: s.key, editPermission: s.editPermission }))).toEqual(
      generated,
    );
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

  it('marks the six risk keys, and no other', () => {
    expect(
      CONFIG_SCHEMA.filter((s) => s.risk)
        .map((s) => s.key)
        .sort(),
    ).toEqual([
      'chat.conversation_languages',
      'chat.model_tiers_allowed',
      'complaint.likeness_due_hours',
      'guest.call_minutes_total',
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
    expect(perPermission.get('CONFIG:MANAGE')).toBe(161);
    expect([...perPermission.values()].reduce((a, b) => a + b, 0)).toBe(225);
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
