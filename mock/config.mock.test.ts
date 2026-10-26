import { beforeEach, describe, expect, it } from 'vitest';
import { resetConfigStore } from './_core/configStore';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import config from './config.mock';

beforeEach(() => {
  resetStore();
  resetConfigStore();
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
  it('gives a super administrator all 225 keys, by key name', async () => {
    const { status, body } = await list('root');
    expect(status).toBe(200);
    const keys = body.data.items.map((r: { key: string }) => r.key);
    expect(keys).toHaveLength(225);
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
    expect((await put('root', 'app.supported_locales', ['en', 'th', 'ar'])).status).toBe(200);
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
