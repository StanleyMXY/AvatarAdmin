import { beforeEach, describe, expect, it } from 'vitest';
import { resetConfigStore } from './_core/configStore';
import { pushState, resetPushStore } from './_core/pushData';
import { resetSmsStore, smsState } from './_core/smsData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import config from './config.mock';

beforeEach(() => {
  resetStore();
  resetConfigStore();
  resetSmsStore();
  resetPushStore();
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (config as unknown as Record<string, H>)[name];
const token = (user: string) => bearer(issueToken(adminOf(user)).token).authorization;

const list = (user: string) =>
  call(h('GET /api/admin/config'), { headers: { authorization: token(user) } });
const put = (user: string, key: string, value: unknown) =>
  call(h('PUT /api/admin/config/:key'), {
    headers: { authorization: token(user) },
    params: { key },
    body: { value },
  });
const del = (user: string, key: string) =>
  call(h('DELETE /api/admin/config/:key'), {
    headers: { authorization: token(user) },
    params: { key },
  });

describe('GET /config', () => {
  it('gives a super administrator all 250 keys (225 of the contract and 25 the backend has before the contract does), by key name', async () => {
    const { status, body } = await list('root');
    expect(status).toBe(200);
    const keys = body.data.items.map((r: { key: string }) => r.key);
    expect(keys).toHaveLength(250);
    expect(keys).toEqual([...keys].sort());
  });

  it('gives an administrator with only a module permission those keys, and not a 403', async () => {
    const admin = adminOf('support');
    admin.permissions = ['COMPANIONSHIP:CONFIG'];
    const { status, body } = await list('support');
    expect(status).toBe(200);
    expect(body.data.items.map((r: { key: string }) => r.key)).toEqual([
      'companionship.stage_thresholds',
      'companionship.text_burst_minutes',
      'milestone.days',
    ]);
  });

  it('gives nothing, not an error, to an administrator without any config permission', async () => {
    const { status, body } = await list('support');
    expect(status).toBe(200);
    expect(body.data.items).toEqual([]);
  });

  it('shows default, value and "never saved" for an untouched key, and null for a key with no default', async () => {
    const items = (await list('root')).body.data.items as Record<string, unknown>[];
    const ttl = items.find((r) => r.key === 'auth.access_ttl_minutes');
    expect(ttl).toMatchObject({
      value: 1440,
      defaultValue: 1440,
      updatedAt: null,
      updatedBy: null,
      updatedByUsername: null,
      editPermission: 'CONFIG:MANAGE',
    });
    const none = items.find((r) => r.key === 'upload.public_base_url');
    expect(none).toMatchObject({ value: null, defaultValue: null });
  });

  it('needs a token', async () => {
    const { status } = await call(h('GET /api/admin/config'));
    expect(status).toBe(401);
  });
});

describe('PUT /config/:key', () => {
  it('saves the value and shows who saved it and when', async () => {
    const { status, body } = await put('root', 'auth.access_ttl_minutes', 600);
    expect(status).toBe(200);
    expect(body.data).toEqual({ key: 'auth.access_ttl_minutes', value: 600, warnings: [] });
    const row = (await list('root')).body.data.items.find(
      (r: { key: string }) => r.key === 'auth.access_ttl_minutes',
    );
    expect(row.value).toBe(600);
    expect(row.defaultValue).toBe(1440);
    expect(row.updatedByUsername).toBe('root');
    expect(row.updatedBy).toBe(adminOf('root').id);
    expect(Date.parse(row.updatedAt)).not.toBeNaN();
  });

  it('answers 404 for a key that does not exist and 403 for a key the administrator may not edit', async () => {
    expect((await put('root', 'no.such_key', 1)).status).toBe(404);
    expect((await del('root', 'no.such_key')).status).toBe(404);
    adminOf('support').permissions = ['COMPANIONSHIP:CONFIG'];
    const refused = await put('support', 'auth.access_ttl_minutes', 600);
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('ADMIN_FORBIDDEN');
    expect((await del('support', 'auth.access_ttl_minutes')).status).toBe(403);
    expect((await put('support', 'milestone.days', [7, 30])).status).toBe(200);
  });

  it('refuses a whole number below 1 with 400 and the key and reason in the details', async () => {
    const { status, body } = await put('root', 'auth.access_ttl_minutes', 0);
    expect(status).toBe(400);
    expect(body.code).toBe('INVALID_REQUEST');
    expect(body.data.details).toEqual([{ ref: 'auth.access_ttl_minutes', reason: 'OUT_OF_RANGE' }]);
    expect((await put('root', 'auth.access_ttl_minutes', 1.5)).body.data.details[0].reason).toBe(
      'NOT_AN_INTEGER',
    );
    expect((await put('root', 'integrity.check_enabled', 'yes')).body.data.details[0].reason).toBe(
      'NOT_BOOLEAN',
    );
    expect(
      (await put('root', 'upload.public_base_url', 'http://x.example')).body.data.details[0].reason,
    ).toBe('NOT_HTTPS');
  });

  it('refuses a body without value', async () => {
    const { status } = await call(h('PUT /api/admin/config/:key'), {
      headers: { authorization: token('root') },
      params: { key: 'auth.access_ttl_minutes' },
      body: {},
    });
    expect(status).toBe(400);
  });

  it('refuses a relation that would break: retry.initial_seconds above retry.max_seconds, review score above block score', async () => {
    expect((await put('root', 'retry.initial_seconds', 99999)).status).toBe(400);
    expect((await put('root', 'retry.initial_seconds', 100)).status).toBe(200);
    expect((await put('root', 'retry.max_seconds', 50)).status).toBe(400);
    await put('root', 'moderation.block_score', 0.9);
    expect((await put('root', 'moderation.review_score', 0.95)).status).toBe(400);
    expect((await put('root', 'moderation.review_score', 0.5)).status).toBe(200);
  });

  it('needs the review score strictly below the block score, and the job timeout strictly above the lease', async () => {
    await put('root', 'moderation.block_score', 5);
    expect((await put('root', 'moderation.review_score', 5)).status).toBe(400);
    expect((await put('root', 'moderation.review_score', 4)).status).toBe(200);
    expect((await put('root', 'export.job_timeout_minutes', 10)).status).toBe(400); // equal to the lease of 10
    expect((await put('root', 'export.job_timeout_minutes', 11)).status).toBe(200);
  });

  it('keeps events.ttl_days at least 30 days above stats.land_window_days', async () => {
    expect((await put('root', 'events.ttl_days', 10)).status).toBe(400);
    expect((await put('root', 'events.ttl_days', 33)).status).toBe(200); // the default window is 3
    expect((await put('root', 'stats.land_window_days', 4)).status).toBe(400);
  });

  it('keeps generation.max_attempts between 1 and 10', async () => {
    expect((await put('root', 'generation.max_attempts', 99)).status).toBe(400);
    expect((await put('root', 'generation.max_attempts', 10)).status).toBe(200);
  });

  it('gives an empty list as the default of moderation.text_rules', async () => {
    const row = (await list('root')).body.data.items.find(
      (r: { key: string }) => r.key === 'moderation.text_rules',
    );
    expect(row.defaultValue).toEqual([]);
  });

  it('keeps the access token life within the refresh token life', async () => {
    expect((await put('root', 'auth.access_ttl_minutes', 30 * 1440 + 1)).status).toBe(400);
    expect((await put('root', 'auth.refresh_ttl_days', 0)).status).toBe(400);
    expect((await put('root', 'auth.refresh_ttl_days', 1)).status).toBe(200);
    expect((await put('root', 'auth.access_ttl_minutes', 1440)).status).toBe(200);
    expect((await put('root', 'auth.access_ttl_minutes', 1441)).status).toBe(400);
  });

  it('checks the JSON keys with their rules', async () => {
    expect((await put('root', 'milestone.days', [7, 7])).status).toBe(400);
    expect(
      (await put('root', 'companionship.stage_thresholds', { BONDING: 200, CLOSE: 150 })).status,
    ).toBe(400);
    expect((await put('root', 'app.supported_locales', ['th'])).status).toBe(400);
    expect((await put('root', 'app.supported_locales', ['en'])).status).toBe(200);
  });

  it('warns, without refusing, when phone sign-in is turned off while phone-number accounts exist', async () => {
    const { status, body } = await put('root', 'auth.phone_login_enabled', false);
    expect(status).toBe(200);
    expect(body.data.warnings).toEqual([
      { code: 'PHONE_LOGIN_DISABLED_ACCOUNTS', message: expect.any(String), count: 3 },
    ]);
  });
});

describe('DELETE /config/:key', () => {
  it('puts the default back: the value is the default, the warnings are empty, and the row shows no update', async () => {
    await put('root', 'auth.access_ttl_minutes', 600);
    const { status, body } = await del('root', 'auth.access_ttl_minutes');
    expect(status).toBe(200);
    expect(body.data).toEqual({ key: 'auth.access_ttl_minutes', value: 1440, warnings: [] });
    const row = (await list('root')).body.data.items.find(
      (r: { key: string }) => r.key === 'auth.access_ttl_minutes',
    );
    expect(row.value).toBe(1440);
    expect(row.updatedAt).toBeNull();
  });

  it('is fine for a key that was never saved', async () => {
    expect((await del('root', 'auth.access_ttl_minutes')).status).toBe(200);
  });
});

describe('GET /config: the keys the contract does not list yet', () => {
  const rowOf = async (user: string, key: string) =>
    (await list(user)).body.data.items.find((r: { key: string }) => r.key === key);

  it('reports the default of each of the 25, and no saved row', async () => {
    const defaults: Record<string, unknown> = {
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
    expect(Object.keys(defaults)).toHaveLength(25);
    const items = (await list('root')).body.data.items as Record<string, unknown>[];
    for (const [key, value] of Object.entries(defaults)) {
      expect(
        items.find((r) => r.key === key),
        key,
      ).toMatchObject({
        value,
        defaultValue: value,
        updatedAt: null,
      });
    }
  });

  it('shows attribution.store_click_ip only to ATTRIBUTION:MANAGE and moderation.record_retention_days only to MODERATION:CONFIG', async () => {
    adminOf('support').permissions = ['ATTRIBUTION:MANAGE'];
    expect((await rowOf('support', 'attribution.store_click_ip')).editPermission).toBe(
      'ATTRIBUTION:MANAGE',
    );
    expect(await rowOf('support', 'moderation.record_retention_days')).toBeUndefined();
    expect(await rowOf('support', 'events.store_client_ip')).toBeUndefined();
    adminOf('support').permissions = ['MODERATION:CONFIG'];
    expect((await rowOf('support', 'moderation.record_retention_days')).editPermission).toBe(
      'MODERATION:CONFIG',
    );
    expect((await put('support', 'moderation.record_retention_days', 30)).status).toBe(200);
    expect((await put('support', 'events.store_client_ip', false)).status).toBe(403);
  });

  it('checks their ranges', async () => {
    expect((await put('root', 'chat.moderation_global_concurrency', 513)).status).toBe(400);
    expect((await put('root', 'export.parallelism', 5)).status).toBe(400);
    expect((await put('root', 'export.parallelism', 4)).status).toBe(200);
    expect((await put('root', 'ratelimit.apk_download_per_ip_per_min', 0)).status).toBe(400);
    expect((await put('root', 'ratelimit.apk_download_per_ip_per_min', 99999)).status).toBe(200);
    expect((await put('root', 'events.store_client_ip', 'no')).body.data.details[0].reason).toBe(
      'NOT_BOOLEAN',
    );
    expect((await put('root', 'chat.moderation_deadline_ms', 2501)).status).toBe(400);
    expect((await put('root', 'chat.moderation_deadline_ms', 2500)).status).toBe(200);
    expect((await put('root', 'recall.window_minutes', 1441)).status).toBe(400);
    expect((await put('root', 'recall.scan_interval_minutes', 1440)).status).toBe(200);
    expect((await put('root', 'attribution.facebook_graph_version', 'v26')).status).toBe(400);
    expect((await put('root', 'attribution.facebook_graph_version', 'v27.1')).status).toBe(200);
    expect((await put('root', 'chat.message_retention_days', 31)).status).toBe(400);
  });
});

describe('PUT /config/app.supported_locales: a language needs its notification template file', () => {
  it('refuses a language without the file, with the languages in the request order', async () => {
    const { status, body } = await put('root', 'app.supported_locales', ['en', 'th', 'ar']);
    expect(status).toBe(400);
    expect(body.code).toBe('INVALID_REQUEST');
    expect(body.message).toBe(
      'app.supported_locales has languages without a notification template file: th, ar',
    );
    expect(body.data.details).toEqual([{ ref: 'app.supported_locales', reason: 'OUT_OF_RANGE' }]);
    expect(body.data.missingLanguages).toEqual(['th', 'ar']);
  });

  it('accepts the list with only the shipped file, and the reset always', async () => {
    expect((await put('root', 'app.supported_locales', ['en'])).status).toBe(200);
    expect(
      (await put('root', 'app.supported_locales', ['en', 'TH'])).body.data.missingLanguages,
    ).toEqual(['TH']);
    expect((await del('root', 'app.supported_locales')).status).toBe(200);
  });
});

describe('PUT /config: the default currency must be among the allowed currencies', () => {
  it('names both keys, the saved one first, whichever is saved', async () => {
    const first = await put('root', 'usage_price.default_currency', 'EUR');
    expect(first.status).toBe(400);
    expect(first.body.message).toBe(
      'usage_price.allowed_currencies must contain usage_price.default_currency',
    );
    expect(first.body.data.details).toEqual([
      { ref: 'usage_price.default_currency', reason: 'OUT_OF_RANGE' },
      { ref: 'usage_price.allowed_currencies', reason: 'OUT_OF_RANGE' },
    ]);
    const second = await put('root', 'usage_price.allowed_currencies', ['EUR']);
    expect(second.status).toBe(400);
    expect(second.body.data.details).toEqual([
      { ref: 'usage_price.allowed_currencies', reason: 'OUT_OF_RANGE' },
      { ref: 'usage_price.default_currency', reason: 'OUT_OF_RANGE' },
    ]);
  });

  it('is met by adding the new default to the list first, and compares exactly (case counts)', async () => {
    expect((await put('root', 'usage_price.allowed_currencies', ['USD', 'EUR'])).status).toBe(200);
    expect((await put('root', 'usage_price.default_currency', 'EUR')).status).toBe(200);
    expect((await put('root', 'usage_price.allowed_currencies', ['USD'])).status).toBe(400);
    expect((await put('root', 'usage_price.default_currency', 'eur')).status).toBe(400);
    // a reset is judged by the default of the code
    expect((await del('root', 'usage_price.default_currency')).status).toBe(200);
    await put('root', 'usage_price.allowed_currencies', ['USD', 'EUR']);
    await put('root', 'usage_price.default_currency', 'EUR');
    expect((await del('root', 'usage_price.allowed_currencies')).status).toBe(400);
  });
});

describe('PUT /config: catch-up minutes times 60 must be at least 600 plus the poll seconds', () => {
  it('names both keys, the saved one first, and passes from 11 minutes with the default poll of 15 seconds', async () => {
    const low = await put('root', 'push.schedule_catchup_minutes', 10);
    expect(low.status).toBe(400);
    expect(low.body.data.details).toEqual([
      { ref: 'push.schedule_catchup_minutes', reason: 'OUT_OF_RANGE' },
      { ref: 'push.task_poll_seconds', reason: 'OUT_OF_RANGE' },
    ]);
    expect((await put('root', 'push.schedule_catchup_minutes', 11)).status).toBe(200);
    const poll = await put('root', 'push.task_poll_seconds', 61);
    expect(poll.status).toBe(400);
    expect(poll.body.data.details).toEqual([
      { ref: 'push.task_poll_seconds', reason: 'OUT_OF_RANGE' },
      { ref: 'push.schedule_catchup_minutes', reason: 'OUT_OF_RANGE' },
    ]);
    expect((await put('root', 'push.task_poll_seconds', 60)).status).toBe(200);
  });

  it('judges a reset too, and keeps the range of 1 to 10080 minutes', async () => {
    await put('root', 'push.schedule_catchup_minutes', 100);
    await put('root', 'push.task_poll_seconds', 5400);
    const reset = await del('root', 'push.schedule_catchup_minutes'); // back to 60: 3600 < 600 + 5400
    expect(reset.status).toBe(400);
    expect(reset.body.data.details[0]).toEqual({
      ref: 'push.schedule_catchup_minutes',
      reason: 'OUT_OF_RANGE',
    });
    expect((await put('root', 'push.schedule_catchup_minutes', 10081)).status).toBe(400);
    expect((await put('root', 'push.schedule_catchup_minutes', 10080)).status).toBe(200);
  });
});

describe('PUT /config: retention days against the statistics landing window', () => {
  it('needs chat.message_retention_days to be 0 or at least 32 and above stats.land_window_days, naming both keys', async () => {
    expect((await put('root', 'chat.message_retention_days', 0)).status).toBe(200);
    expect((await put('root', 'chat.message_retention_days', 32)).status).toBe(200);
    expect((await put('root', 'stats.land_window_days', 40)).body.data.details).toEqual([
      { ref: 'stats.land_window_days', reason: 'OUT_OF_RANGE' },
      { ref: 'chat.message_retention_days', reason: 'OUT_OF_RANGE' },
    ]);
    expect((await put('root', 'stats.land_window_days', 31)).status).toBe(200);
    expect((await put('root', 'chat.message_retention_days', 31)).body.data.details).toEqual([
      { ref: 'chat.message_retention_days', reason: 'OUT_OF_RANGE' },
    ]);
  });

  it('needs guest.device_retention_days to be 0 or at least 91 plus stats.land_window_days, naming both keys', async () => {
    expect((await put('root', 'guest.device_retention_days', 93)).status).toBe(400); // window 3: 94
    expect((await put('root', 'guest.device_retention_days', 94)).status).toBe(200);
    const raised = await put('root', 'stats.land_window_days', 4);
    expect(raised.status).toBe(400);
    expect(raised.body.data.details.map((d: { ref: string }) => d.ref)).toEqual([
      'stats.land_window_days',
      'guest.device_retention_days',
    ]);
  });
});

describe('PUT /config/auth.phone_login_enabled: needs an enabled English OTP template for every country', () => {
  const refused = async () => put('root', 'auth.phone_login_enabled', true);

  it('passes with the seeded template, and turning it off never needs one', async () => {
    expect((await refused()).status).toBe(200);
    smsState.templates.clear();
    expect((await put('root', 'auth.phone_login_enabled', false)).status).toBe(200);
  });

  it('refuses with ref SmsTemplate, not a setting key, and says what is missing in the message', async () => {
    smsState.templates.clear();
    const { status, body } = await refused();
    expect(status).toBe(400);
    expect(body.code).toBe('INVALID_REQUEST');
    expect(body.data.details).toEqual([{ ref: 'SmsTemplate', reason: 'EMPTY_NOT_ALLOWED' }]);
    expect(body.message).toContain(
      'an enabled OTP SMS template in language en for every country (no country set)',
    );
  });

  it('counts EN, and does not count en-GB, a template of one country, a disabled one or a non-OTP one', async () => {
    const english = [...smsState.templates.values()].find((t) => t.locale === 'en');
    if (!english) throw new Error('the seed has an English template');
    const variants = [
      { locale: 'en-GB' },
      { country: 'US' },
      { enabled: false },
      { smsType: 'MARKETING' as const },
    ];
    for (const change of variants) {
      resetSmsStore();
      smsState.templates.clear();
      smsState.templates.set(english.id, { ...english, ...change });
      expect((await refused()).status, JSON.stringify(change)).toBe(400);
    }
    smsState.templates.clear();
    smsState.templates.set(english.id, { ...english, locale: 'EN' });
    expect((await refused()).status).toBe(200);
  });
});

describe('PUT and DELETE /config/push.default_locale: every recall reason with an enabled template needs one in the new language', () => {
  const enableAll = () => {
    for (const t of pushState.templates) t.enabled = true;
  };

  it('names the language and the reasons that lack it, in letter order, with ref push.default_locale', async () => {
    enableAll();
    pushState.templates = pushState.templates.filter(
      (t) => !(t.locale === 'es' && t.triggerReason === 'daily_recall'),
    );
    pushState.templates = pushState.templates.filter(
      (t) => !(t.locale === 'es' && t.triggerReason === 'streak_at_risk'),
    );
    const { status, body } = await put('root', 'push.default_locale', 'es');
    expect(status).toBe(400);
    expect(body.code).toBe('INVALID_REQUEST');
    expect(body.data.details).toEqual([{ ref: 'push.default_locale', reason: 'OUT_OF_RANGE' }]);
    expect(body.data.defaultLocale).toBe('es');
    expect(body.data.reasons).toEqual(['daily_recall', 'streak_at_risk']);
    expect(body.message).toContain('push.default_locale cannot be es');
  });

  it('judges only the reasons that have an enabled template, and counts only enabled templates in the new language', async () => {
    // the seed: daily_recall is enabled in many languages; every streak_at_risk template is disabled
    const missing = await put('root', 'push.default_locale', 'sw');
    expect(missing.body.data.reasons).toEqual(['daily_recall']);
    const thai = await put('root', 'push.default_locale', 'th');
    expect(thai.status).toBe(200);
    for (const t of pushState.templates)
      if (t.triggerReason === 'daily_recall' && t.locale === 'ar') t.enabled = false;
    expect((await put('root', 'push.default_locale', 'ar')).body.data.reasons).toEqual([
      'daily_recall',
    ]);
  });

  it('compares the tag exactly, case included', async () => {
    expect((await put('root', 'push.default_locale', 'TH')).status).toBe(400);
  });

  it('judges a reset to the default language en as well', async () => {
    expect((await put('root', 'push.default_locale', 'th')).status).toBe(200);
    for (const t of pushState.templates)
      if (t.triggerReason === 'daily_recall' && t.locale === 'en') t.enabled = false;
    const reset = await del('root', 'push.default_locale');
    expect(reset.status).toBe(400);
    expect(reset.body.data.defaultLocale).toBe('en');
    expect(reset.body.data.reasons).toEqual(['daily_recall']);
  });

  it('is not affected by saving the supported languages, and an empty value is the usual refusal', async () => {
    expect((await put('root', 'push.default_locale', '')).body.data.details[0].reason).toBe(
      'EMPTY_NOT_ALLOWED',
    );
    expect((await put('root', 'app.supported_locales', ['en'])).status).toBe(200);
  });
});
