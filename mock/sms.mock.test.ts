import { beforeEach, describe, expect, it } from 'vitest';
import type { PermissionCode } from '../src/access/permissionCodes';
import { resetConfigStore, saved } from './_core/configStore';
import type { MockReq, MockRes } from './_core/http';
import {
  type MockChannel,
  type MockTemplate,
  resetSmsStore,
  SMS_PROVIDERS,
  smsState,
  TEST_PER_DAY,
} from './_core/smsData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import sms from './sms.mock';

const NOW = new Date('2026-10-26T10:00:00Z');

beforeEach(() => {
  resetStore();
  resetConfigStore();
  resetSmsStore(NOW);
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (sms as unknown as Record<string, H>)[name];

/** A token of the preset administrator `user`, whose permissions are replaced when `codes` is given. */
const tokenOf = (user: string, codes?: PermissionCode[]) => {
  const admin = adminOf(user);
  if (codes) admin.permissions = codes;
  return bearer(issueToken(admin).token).authorization;
};
// A query string holds text only, so the numbers of a test are turned into text first.
const asText = (query: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(query).map(([key, value]) => [key, String(value)]));
const get = (name: string, query: Record<string, unknown> = {}, params = {}, user = 'root') =>
  call(h(name), { headers: { authorization: tokenOf(user) }, query: asText(query), params });
const getAs = (
  name: string,
  codes: PermissionCode[],
  query: Record<string, unknown> = {},
  params = {},
) =>
  call(h(name), {
    headers: { authorization: tokenOf('support', codes) },
    query: asText(query),
    params,
  });
const send = (name: string, body: unknown, params = {}, user = 'root') =>
  call(h(name), { headers: { authorization: tokenOf(user) }, body, params });
const sendAs = (name: string, codes: PermissionCode[], body: unknown, params = {}) =>
  call(h(name), { headers: { authorization: tokenOf('support', codes) }, body, params });

const META = 'GET /api/admin/sms/meta';
const CHANNELS = 'GET /api/admin/sms/channels';
const CHANNEL = 'GET /api/admin/sms/channels/:id';
const CHANNEL_CREATE = 'POST /api/admin/sms/channels';
const CHANNEL_UPDATE = 'PUT /api/admin/sms/channels/:id';
const CHANNEL_DELETE = 'DELETE /api/admin/sms/channels/:id';
const CHANNEL_ENABLED = 'PUT /api/admin/sms/channels/:id/enabled';
const CHANNEL_TEST = 'POST /api/admin/sms/channels/:id/test';
const TEMPLATES = 'GET /api/admin/sms/templates';
const TEMPLATE_CREATE = 'POST /api/admin/sms/templates';
const TEMPLATE_UPDATE = 'PUT /api/admin/sms/templates/:id';
const TEMPLATE_DELETE = 'DELETE /api/admin/sms/templates/:id';
const TEMPLATE_ENABLED = 'PUT /api/admin/sms/templates/:id/enabled';
const RECORDS = 'GET /api/admin/sms/records';
const EXPORT = 'GET /api/admin/sms/records/export';

const channelBy = (code: string): MockChannel => {
  const found = [...smsState.channels.values()].find((c) => c.channelCode === code);
  if (!found) throw new Error(`no channel ${code}`);
  return found;
};
const templateBy = (code: string): MockTemplate => {
  const found = [...smsState.templates.values()].find((t) => t.templateCode === code);
  if (!found) throw new Error(`no template ${code}`);
  return found;
};
const goodChannel = (over: Record<string, unknown> = {}) => ({
  channelCode: 'gw_new',
  name: 'New channel',
  providerCode: 'gateway-a',
  apiUrl: 'https://sms.example.com/v1/send',
  credentials: 'typed-secret-value',
  extConfig: { appId: 'a1' },
  countries: ['TH'],
  smsType: 'OTP',
  priority: 40,
  enabled: false,
  ...over,
});
const goodTemplate = (over: Record<string, unknown> = {}) => ({
  templateCode: 'otp_new',
  name: 'New template',
  smsType: 'OTP',
  locale: 'en',
  country: null,
  content: 'Your code is {code}',
  providerTemplateId: null,
  enabled: false,
  ...over,
});
const refsOf = (answer: { body: { data: unknown } }) =>
  ((answer.body.data as { details?: { ref: string; reason: string }[] }).details ?? []).map(
    (d) => `${d.ref}:${d.reason}`,
  );
const phoneLoginOn = () =>
  saved.set('auth.phone_login_enabled', {
    value: true,
    updatedAt: NOW.toISOString(),
    updatedBy: '1',
    updatedByUsername: 'root',
  });

describe('permissions (contract 23.6)', () => {
  const cases: [string, PermissionCode[], PermissionCode[]][] = [
    [CHANNELS, ['SMS:TEMPLATE', 'SMS:RECORD', 'SMS:CHANNEL:CONFIG'], ['SMS:CHANNEL']],
    [CHANNEL, ['SMS:TEMPLATE'], ['SMS:CHANNEL']],
    [TEMPLATES, ['SMS:CHANNEL', 'SMS:CHANNEL:CONFIG', 'SMS:RECORD'], ['SMS:TEMPLATE']],
    [RECORDS, ['SMS:CHANNEL', 'SMS:RECORD:EXPORT', 'SMS:RECORD:PHONE_VIEW'], ['SMS:RECORD']],
  ];
  it.each(cases)(
    '%s is refused without its own code and answered with it',
    async (name, without, withCode) => {
      const params = name === CHANNEL ? { id: '1' } : {};
      expect((await getAs(name, without, {}, params)).status).toBe(403);
      expect((await getAs(name, withCode, {}, params)).status).toBe(200);
    },
  );

  it('needs SMS:CHANNEL:CONFIG for every write of a channel, and SMS:CHANNEL alone is not enough', async () => {
    const read: PermissionCode[] = ['SMS:CHANNEL'];
    expect((await sendAs(CHANNEL_CREATE, read, goodChannel())).status).toBe(403);
    expect((await sendAs(CHANNEL_UPDATE, read, goodChannel(), { id: '1' })).status).toBe(403);
    expect((await sendAs(CHANNEL_ENABLED, read, { enabled: false }, { id: '1' })).status).toBe(403);
    expect((await sendAs(CHANNEL_DELETE, read, {}, { id: '4' })).status).toBe(403);
    expect((await sendAs(CHANNEL_TEST, read, { mobile: '+66812345678' }, { id: '1' })).status).toBe(
      403,
    );
    expect(smsState.channels.size).toBe(5);
    expect(
      (await sendAs(CHANNEL_TEST, ['SMS:CHANNEL:CONFIG'], { mobile: '+66812345678' }, { id: '1' }))
        .status,
    ).toBe(200);
  });

  it('needs SMS:TEMPLATE for every write of a template', async () => {
    const other: PermissionCode[] = ['SMS:CHANNEL', 'SMS:RECORD', 'SMS:CHANNEL:CONFIG'];
    expect((await sendAs(TEMPLATE_CREATE, other, goodTemplate())).status).toBe(403);
    expect((await sendAs(TEMPLATE_UPDATE, other, goodTemplate(), { id: '1' })).status).toBe(403);
    expect((await sendAs(TEMPLATE_ENABLED, other, { enabled: false }, { id: '1' })).status).toBe(
      403,
    );
    expect((await sendAs(TEMPLATE_DELETE, other, {}, { id: '8' })).status).toBe(403);
  });

  it('answers the meta to an administrator with any SMS code, and to nobody else', async () => {
    for (const code of [
      'SMS:CHANNEL',
      'SMS:CHANNEL:CONFIG',
      'SMS:TEMPLATE',
      'SMS:RECORD',
      'SMS:RECORD:PHONE_VIEW',
      'SMS:RECORD:EXPORT',
    ] as PermissionCode[]) {
      expect((await getAs(META, [code])).status, code).toBe(200);
    }
    expect((await getAs(META, ['USER:VIEW', 'CONFIG:MANAGE'])).status).toBe(403);
  });

  it('answers 401 without a token', async () => {
    expect((await call(h(CHANNELS), {})).status).toBe(401);
  });
});

describe('the meta', () => {
  it('lists the registered providers with their host lists and the test sends left today', async () => {
    const answer = await get(META);
    expect(answer.body.data).toEqual({
      providers: SMS_PROVIDERS,
      testRemainingToday: TEST_PER_DAY,
    });
    expect(SMS_PROVIDERS.length).toBeGreaterThan(1);
    expect(SMS_PROVIDERS.every((p) => p.allowedHosts.length > 0)).toBe(true);
  });
});

describe('the channels never carry a credential', () => {
  const storedSecrets = () =>
    [...smsState.channels.values()].map((c) => c.credentials).filter(Boolean) as string[];
  it('answers hasCredentials and nothing else about them, in the list and in one channel', async () => {
    expect(storedSecrets().length).toBeGreaterThan(2);
    const list = await get(CHANNELS, { pageSize: 200 });
    const text = JSON.stringify(list.body);
    for (const secret of storedSecrets()) expect(text).not.toContain(secret);
    for (const row of list.body.data.items as Record<string, unknown>[]) {
      expect(Object.keys(row).filter((k) => /cred|secret|token|key/i.test(k))).toEqual([
        'hasCredentials',
      ]);
      expect(typeof row.hasCredentials).toBe('boolean');
    }
    expect(
      list.body.data.items.map((r: { channelCode: string; hasCredentials: boolean }) => [
        r.channelCode,
        r.hasCredentials,
      ]),
    ).toEqual(
      expect.arrayContaining([
        ['gw_th_otp', true],
        ['gw_es_promo', false],
      ]),
    );
    const one = await get(CHANNEL, {}, { id: channelBy('gw_th_otp').id });
    expect(JSON.stringify(one.body)).not.toContain('seed-secret-1');
    expect(one.body.data.hasCredentials).toBe(true);
  });

  it('answers the same on a create and on an update', async () => {
    const created = await send(CHANNEL_CREATE, goodChannel());
    expect(created.status).toBe(200);
    expect(JSON.stringify(created.body)).not.toContain('typed-secret-value');
    expect(created.body.data.hasCredentials).toBe(true);
    const updated = await send(CHANNEL_UPDATE, goodChannel({ credentials: 'another-secret' }), {
      id: created.body.data.id,
    });
    expect(JSON.stringify(updated.body)).not.toContain('another-secret');
    expect(channelBy('gw_new').credentials).toBe('another-secret');
  });
});

describe('listing the channels', () => {
  it('answers a page, newest first, with the columns of the channel', async () => {
    const answer = await get(CHANNELS, { page: 1, pageSize: 2 });
    expect(answer.body.data.total).toBe(5);
    expect(answer.body.data.items).toHaveLength(2);
    expect(Object.keys(answer.body.data.items[0]).sort()).toEqual(
      [
        'apiUrl',
        'channelCode',
        'countries',
        'createdAt',
        'enabled',
        'extConfig',
        'hasCredentials',
        'id',
        'name',
        'priority',
        'providerCode',
        'smsType',
        'updatedAt',
      ].sort(),
    );
    const ids = (await get(CHANNELS, { pageSize: 200 })).body.data.items.map((r: { id: string }) =>
      Number(r.id),
    );
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
  });

  it('refuses a page size above 200 and a page below 1 as INVALID_REQUEST with the parameter', async () => {
    const big = await get(CHANNELS, { pageSize: 201 });
    expect([big.status, big.body.code]).toEqual([400, 'INVALID_REQUEST']);
    expect(refsOf(big)).toEqual(['pageSize:OUT_OF_RANGE']);
    expect(refsOf(await get(CHANNELS, { page: 0 }))).toEqual(['page:OUT_OF_RANGE']);
  });

  it('answers 404 RESOURCE_NOT_FOUND for a channel that does not exist', async () => {
    const answer = await get(CHANNEL, {}, { id: '999' });
    expect([answer.status, answer.body.code]).toEqual([404, 'RESOURCE_NOT_FOUND']);
  });
});

describe('creating a channel', () => {
  it('stores it, keeps the credentials where the list cannot show them, and shows it in the list', async () => {
    const created = await send(CHANNEL_CREATE, goodChannel({ countries: ['th', 'vn'] }));
    expect(created.status).toBe(200);
    expect(created.body.data).toMatchObject({
      channelCode: 'gw_new',
      countries: ['TH', 'VN'],
      smsType: 'OTP',
      enabled: false,
      hasCredentials: true,
    });
    expect(channelBy('gw_new').credentials).toBe('typed-secret-value');
    expect((await get(CHANNELS)).body.data.total).toBe(6);
  });

  it('has no credentials when none were sent', async () => {
    const { credentials: _c, ...without } = goodChannel();
    const created = await send(CHANNEL_CREATE, without);
    expect(created.body.data.hasCredentials).toBe(false);
  });

  it('answers 409 DUPLICATE_RESOURCE with the field for a code that is taken, and creates nothing', async () => {
    const answer = await send(CHANNEL_CREATE, goodChannel({ channelCode: 'gw_th_otp' }));
    expect([answer.status, answer.body.code]).toEqual([409, 'DUPLICATE_RESOURCE']);
    expect(answer.body.data).toMatchObject({ field: 'channelCode' });
    expect(smsState.channels.size).toBe(5);
  });

  it('refuses an address that is not https, a host that the provider does not list, and a provider that is not registered', async () => {
    expect(
      refsOf(await send(CHANNEL_CREATE, goodChannel({ apiUrl: 'http://sms.example.com/x' }))),
    ).toEqual(['apiUrl:NOT_HTTPS']);
    expect(
      refsOf(await send(CHANNEL_CREATE, goodChannel({ apiUrl: 'https://evil.example.net/x' }))),
    ).toEqual(['apiUrl:INVALID_HOST']);
    expect(refsOf(await send(CHANNEL_CREATE, goodChannel({ providerCode: 'nope' })))).toContain(
      'providerCode:OUT_OF_RANGE',
    );
    const wrongType = await send(CHANNEL_CREATE, goodChannel({ smsType: 'VOICE' }));
    expect(refsOf(wrongType)).toEqual(['smsType:OUT_OF_RANGE']);
    expect(smsState.channels.size).toBe(5);
  });

  it('refuses an empty name or code, a priority that is not a whole number, and a country that is not two letters', async () => {
    expect(refsOf(await send(CHANNEL_CREATE, goodChannel({ name: '  ' })))).toEqual([
      'name:EMPTY_NOT_ALLOWED',
    ]);
    expect(refsOf(await send(CHANNEL_CREATE, goodChannel({ channelCode: '' })))).toEqual([
      'channelCode:EMPTY_NOT_ALLOWED',
    ]);
    expect(refsOf(await send(CHANNEL_CREATE, goodChannel({ priority: 1.5 })))).toEqual([
      'priority:NOT_AN_INTEGER',
    ]);
    expect(refsOf(await send(CHANNEL_CREATE, goodChannel({ countries: ['THA'] })))).toEqual([
      'countries:OUT_OF_RANGE',
    ]);
  });

  it('refuses an extension that is not an object', async () => {
    expect(refsOf(await send(CHANNEL_CREATE, goodChannel({ extConfig: [1] })))).toEqual([
      'extConfig:OUT_OF_RANGE',
    ]);
    expect((await send(CHANNEL_CREATE, goodChannel({ extConfig: null }))).status).toBe(200);
  });
});

describe('updating a channel', () => {
  it('keeps the stored credentials when the body has none, and replaces them when it has', async () => {
    const id = channelBy('gw_th_otp').id;
    const {
      credentials: _c,
      channelCode: _code,
      enabled: _e,
      ...patch
    } = goodChannel({ name: 'Renamed' });
    const answer = await send(CHANNEL_UPDATE, patch, { id });
    expect(answer.status).toBe(200);
    expect(answer.body.data.name).toBe('Renamed');
    expect(channelBy('gw_th_otp').credentials).toBe('seed-secret-1');
    await send(CHANNEL_UPDATE, { ...patch, credentials: 'fresh-one' }, { id });
    expect(channelBy('gw_th_otp').credentials).toBe('fresh-one');
  });

  it('does not change the code or the switch, whatever the body says', async () => {
    const id = channelBy('gw_th_otp').id;
    await send(CHANNEL_UPDATE, goodChannel({ channelCode: 'changed', enabled: false }), { id });
    expect(smsState.channels.get(id)).toMatchObject({ channelCode: 'gw_th_otp', enabled: true });
  });

  it('answers 404 for a channel that does not exist', async () => {
    expect((await send(CHANNEL_UPDATE, goodChannel(), { id: '999' })).status).toBe(404);
  });
});

describe('the switch of a channel', () => {
  it('turns it on and off at once', async () => {
    const id = channelBy('gw_es_promo').id;
    await send(CHANNEL_ENABLED, { enabled: true }, { id });
    expect(smsState.channels.get(id)?.enabled).toBe(true);
    await send(CHANNEL_ENABLED, { enabled: false }, { id });
    expect(smsState.channels.get(id)?.enabled).toBe(false);
    expect(refsOf(await send(CHANNEL_ENABLED, { enabled: 'yes' }, { id }))).toEqual([
      'enabled:NOT_BOOLEAN',
    ]);
  });
});

describe('the last enabled OTP channel (contract 23.4)', () => {
  // The three enabled OTP channels serve different countries: each is the last one for its own.
  it('cannot be deleted, switched off, turned into another type or narrowed while phone sign-in is on', async () => {
    phoneLoginOn();
    smsState.phoneAccounts = 0;
    const id = channelBy('gw_th_otp').id;
    const del = await send(CHANNEL_DELETE, {}, { id });
    expect([del.status, del.body.code]).toEqual([400, 'INVALID_REQUEST']);
    expect(smsState.channels.has(id)).toBe(true);
    const off = await send(CHANNEL_ENABLED, { enabled: false }, { id });
    expect([off.status, off.body.code]).toEqual([400, 'INVALID_REQUEST']);
    expect(smsState.channels.get(id)?.enabled).toBe(true);
    const type = await send(CHANNEL_UPDATE, goodChannel({ smsType: 'MARKETING' }), { id });
    expect(type.body.code).toBe('INVALID_REQUEST');
    const narrow = await send(CHANNEL_UPDATE, goodChannel({ countries: ['VN'] }), { id });
    expect(narrow.body.code).toBe('INVALID_REQUEST');
    expect(smsState.channels.get(id)).toMatchObject({ smsType: 'OTP', countries: ['TH'] });
  });

  it('is protected also when phone sign-in is off but there are phone-number accounts', async () => {
    smsState.phoneAccounts = 7;
    const id = channelBy('gw_th_otp').id;
    expect((await send(CHANNEL_DELETE, {}, { id })).body.code).toBe('INVALID_REQUEST');
    expect((await send(CHANNEL_ENABLED, { enabled: false }, { id })).body.code).toBe(
      'INVALID_REQUEST',
    );
  });

  it('can be removed when sign-in is off and there are no phone-number accounts', async () => {
    smsState.phoneAccounts = 0;
    const id = channelBy('gw_th_otp').id;
    expect((await send(CHANNEL_ENABLED, { enabled: false }, { id })).status).toBe(200);
    expect((await send(CHANNEL_DELETE, {}, { id })).status).toBe(200);
    expect(smsState.channels.has(id)).toBe(false);
  });

  it('can be removed when another enabled OTP channel serves all its countries', async () => {
    phoneLoginOn();
    const id = channelBy('gw_th_otp').id;
    await send(CHANNEL_ENABLED, { enabled: true }, { id: channelBy('gw_all_backup').id });
    expect((await send(CHANNEL_ENABLED, { enabled: false }, { id })).status).toBe(200);
    expect((await send(CHANNEL_DELETE, {}, { id })).status).toBe(200);
  });

  it('does not hold a channel that is off or not OTP, and a change that keeps the coverage is fine', async () => {
    phoneLoginOn();
    expect((await send(CHANNEL_DELETE, {}, { id: channelBy('gw_es_promo').id })).status).toBe(200);
    expect((await send(CHANNEL_DELETE, {}, { id: channelBy('gw_all_backup').id })).status).toBe(
      200,
    );
    const id = channelBy('gw_th_otp').id;
    expect(
      (await send(CHANNEL_UPDATE, goodChannel({ countries: ['TH', 'LA'] }), { id })).status,
    ).toBe(200);
    expect((await send(CHANNEL_UPDATE, goodChannel({ countries: [] }), { id })).status).toBe(200);
  });
});

describe('the test send', () => {
  it('takes one of the sends of the day, writes a TEST record and counts down in the meta', async () => {
    const id = channelBy('gw_th_otp').id;
    const answer = await send(CHANNEL_TEST, { mobile: '+66812345678' }, { id });
    expect(answer.status).toBe(200);
    expect((await get(META)).body.data.testRemainingToday).toBe(TEST_PER_DAY - 1);
    const records = (await get(RECORDS, { purpose: 'TEST', mobile: '+66812345678' })).body.data;
    expect(records.total).toBe(1);
    expect(records.items[0]).toMatchObject({
      channelCode: 'gw_th_otp',
      purpose: 'TEST',
      channel: 'SMS',
    });
  });

  it('answers 429 RATE_LIMITED after the sends of the day, for that administrator only', async () => {
    const id = channelBy('gw_th_otp').id;
    for (let i = 0; i < TEST_PER_DAY; i += 1) {
      expect((await send(CHANNEL_TEST, { mobile: '+66812345678' }, { id })).status).toBe(200);
    }
    const refused = await send(CHANNEL_TEST, { mobile: '+66812345678' }, { id });
    expect([refused.status, refused.body.code]).toEqual([429, 'RATE_LIMITED']);
    expect((await get(META)).body.data.testRemainingToday).toBe(0);
    expect(
      (await call(h(META), { headers: { authorization: tokenOf('support', ['SMS:CHANNEL']) } }))
        .body.data.testRemainingToday,
    ).toBe(TEST_PER_DAY);
  });

  it('refuses a number that is not a number and a channel that does not exist, and uses no send for them', async () => {
    const id = channelBy('gw_th_otp').id;
    expect((await send(CHANNEL_TEST, { mobile: 'abc' }, { id })).body.code).toBe('PHONE_INVALID');
    expect((await send(CHANNEL_TEST, {}, { id })).body.code).toBe('PHONE_INVALID');
    expect((await send(CHANNEL_TEST, { mobile: '+66812345678' }, { id: '999' })).status).toBe(404);
    expect((await get(META)).body.data.testRemainingToday).toBe(TEST_PER_DAY);
  });
});

describe('the templates', () => {
  it('lists a page of them with the columns of the template', async () => {
    const answer = await get(TEMPLATES, { pageSize: 200 });
    expect(answer.body.data.total).toBe(smsState.templates.size);
    expect(Object.keys(answer.body.data.items[0]).sort()).toEqual(
      [
        'content',
        'country',
        'enabled',
        'id',
        'locale',
        'name',
        'providerTemplateId',
        'smsType',
        'templateCode',
      ].sort(),
    );
  });

  it('creates one, and refuses a code that is taken', async () => {
    const created = await send(TEMPLATE_CREATE, goodTemplate({ country: 'th' }));
    expect(created.status).toBe(200);
    expect(created.body.data).toMatchObject({ templateCode: 'otp_new', country: 'TH' });
    const dup = await send(TEMPLATE_CREATE, goodTemplate());
    expect([dup.status, dup.body.code]).toEqual([409, 'DUPLICATE_RESOURCE']);
    expect(dup.body.data).toMatchObject({ field: 'templateCode' });
  });

  it('refuses the content of an OTP template that has no {code} written exactly', async () => {
    for (const content of [
      'no code here',
      'Your code is {CODE}',
      'Your code is { code }',
      'code',
    ]) {
      const answer = await send(TEMPLATE_CREATE, goodTemplate({ content }));
      expect([answer.status, answer.body.code], content).toEqual([400, 'INVALID_REQUEST']);
      expect(refsOf(answer)).toEqual(['content:MISSING_PLACEHOLDER']);
    }
    expect(
      (await send(TEMPLATE_CREATE, goodTemplate({ smsType: 'MARKETING', content: 'Sale' }))).status,
    ).toBe(200);
  });

  it('updates one without changing its code or switch, and refuses a missing {code} there too', async () => {
    const id = templateBy('otp_en').id;
    const { templateCode: _c, enabled: _e, ...patch } = goodTemplate({ name: 'Renamed' });
    const answer = await send(
      TEMPLATE_UPDATE,
      { ...patch, templateCode: 'x', enabled: false },
      { id },
    );
    expect(answer.body.data).toMatchObject({
      templateCode: 'otp_en',
      name: 'Renamed',
      enabled: true,
    });
    expect((await send(TEMPLATE_UPDATE, { ...patch, content: 'x' }, { id })).body.code).toBe(
      'INVALID_REQUEST',
    );
  });

  it('cannot lose the last enabled OTP template: not by the switch, by delete, or by changing the type', async () => {
    for (const t of smsState.templates.values()) if (t.templateCode !== 'otp_en') t.enabled = false;
    const id = templateBy('otp_en').id;
    expect((await send(TEMPLATE_ENABLED, { enabled: false }, { id })).body.code).toBe(
      'INVALID_REQUEST',
    );
    expect((await send(TEMPLATE_DELETE, {}, { id })).body.code).toBe('INVALID_REQUEST');
    const { templateCode: _c, enabled: _e, ...patch } = goodTemplate({ smsType: 'MARKETING' });
    expect((await send(TEMPLATE_UPDATE, patch, { id })).body.code).toBe('INVALID_REQUEST');
    expect(smsState.templates.get(id)).toMatchObject({ enabled: true, smsType: 'OTP' });
    // With another one on, the first can go: it has to be one in en for every country (e2).
    await send(TEMPLATE_ENABLED, { enabled: true }, { id: templateBy('otp_th').id });
    expect((await send(TEMPLATE_ENABLED, { enabled: false }, { id })).body.code).toBe(
      'INVALID_REQUEST',
    );
    await send(TEMPLATE_CREATE, goodTemplate({ templateCode: 'otp_en2', enabled: true }));
    expect((await send(TEMPLATE_ENABLED, { enabled: false }, { id })).status).toBe(200);
    expect((await send(TEMPLATE_DELETE, {}, { id })).status).toBe(200);
  });

  describe('the last enabled English OTP template for every country (e2, a6)', () => {
    const EN_MESSAGE =
      'The last enabled OTP template in language en for every country (no country set) cannot be removed or changed while phone login is on or phone accounts exist';
    const patchOf = (over: Record<string, unknown> = {}) => {
      const { templateCode: _c, enabled: _e, ...patch } = goodTemplate(over);
      return patch;
    };
    const refused = (answer: {
      status: number;
      body: { code: string; message: string; data: unknown };
    }) => {
      expect([answer.status, answer.body.code]).toEqual([400, 'INVALID_REQUEST']);
      expect(answer.body.message).toBe(EN_MESSAGE);
      expect(refsOf(answer)).toEqual(['SmsTemplate:OUT_OF_RANGE']);
    };

    it('refuses to switch off, delete, move to another language, give a country, or turn into another type the only such template, while other OTP templates are on', async () => {
      const en = templateBy('otp_en');
      expect(templateBy('otp_th').enabled).toBe(true);
      refused(await send(TEMPLATE_ENABLED, { enabled: false }, { id: en.id }));
      refused(await send(TEMPLATE_DELETE, {}, { id: en.id }));
      refused(await send(TEMPLATE_UPDATE, patchOf({ locale: 'th' }), { id: en.id }));
      refused(await send(TEMPLATE_UPDATE, patchOf({ country: 'TH' }), { id: en.id }));
      refused(
        await send(TEMPLATE_UPDATE, patchOf({ smsType: 'MARKETING', content: 'Sale' }), {
          id: en.id,
        }),
      );
      expect(smsState.templates.get(en.id)).toEqual(en);
    });

    it('takes en without regard to case as the language, and not en-GB or a template for one country', async () => {
      const en = templateBy('otp_en');
      const upper = await send(
        TEMPLATE_CREATE,
        goodTemplate({ templateCode: 'otp_EN', locale: 'EN', enabled: true }),
      );
      expect(upper.status).toBe(200);
      expect((await send(TEMPLATE_ENABLED, { enabled: false }, { id: en.id })).status).toBe(200);
      // Now the upper-case one is the only one: it is protected the same way.
      refused(await send(TEMPLATE_DELETE, {}, { id: String(upper.body.data.id) }));
      // Others that are close do not count as a replacement.
      await send(
        TEMPLATE_CREATE,
        goodTemplate({ templateCode: 'otp_gb', locale: 'en-GB', enabled: true }),
      );
      await send(
        TEMPLATE_CREATE,
        goodTemplate({ templateCode: 'otp_enth', locale: 'en', country: 'TH', enabled: true }),
      );
      await send(
        TEMPLATE_CREATE,
        goodTemplate({
          templateCode: 'promo_en2',
          smsType: 'MARKETING',
          content: 'Sale',
          enabled: true,
        }),
      );
      refused(await send(TEMPLATE_ENABLED, { enabled: false }, { id: String(upper.body.data.id) }));
    });

    it('lets one go when another enabled OTP template in en for every country remains', async () => {
      const en = templateBy('otp_en');
      await send(TEMPLATE_CREATE, goodTemplate({ templateCode: 'otp_en2', enabled: true }));
      expect((await send(TEMPLATE_ENABLED, { enabled: false }, { id: en.id })).status).toBe(200);
      expect((await send(TEMPLATE_DELETE, {}, { id: en.id })).status).toBe(200);
    });

    it('does not judge when phone login is off and no phone account exists, and does not judge a template that was never the qualifying one', async () => {
      const th = templateBy('otp_th');
      expect((await send(TEMPLATE_ENABLED, { enabled: false }, { id: th.id })).status).toBe(200);
      expect((await send(TEMPLATE_DELETE, {}, { id: templateBy('otp_ar').id })).status).toBe(200);
      smsState.phoneAccounts = 0;
      saved.set('auth.phone_login_enabled', {
        value: false,
        updatedAt: NOW.toISOString(),
        updatedBy: '1',
        updatedByUsername: 'root',
      });
      expect((await send(TEMPLATE_DELETE, {}, { id: templateBy('otp_en').id })).status).toBe(200);
    });

    it('judges when phone login is on even without phone accounts', async () => {
      smsState.phoneAccounts = 0;
      saved.set('auth.phone_login_enabled', {
        value: true,
        updatedAt: NOW.toISOString(),
        updatedBy: '1',
        updatedByUsername: 'root',
      });
      refused(await send(TEMPLATE_DELETE, {}, { id: templateBy('otp_en').id }));
    });

    it('does not stop an unrelated edit when the state already lacks such a template, and stops nothing at creation', async () => {
      templateBy('otp_en').locale = 'en-US';
      expect(
        (await send(TEMPLATE_ENABLED, { enabled: false }, { id: templateBy('otp_th').id })).status,
      ).toBe(200);
      expect(
        (
          await send(TEMPLATE_UPDATE, patchOf({ name: 'Renamed', locale: 'en-US' }), {
            id: templateBy('otp_en').id,
          })
        ).status,
      ).toBe(200);
      expect((await send(TEMPLATE_DELETE, {}, { id: templateBy('otp_en').id })).status).toBe(200);
      expect(
        (
          await send(
            TEMPLATE_CREATE,
            goodTemplate({ templateCode: 'otp_c', locale: 'th', enabled: true }),
          )
        ).status,
      ).toBe(200);
    });

    it('answers the old rule of the last OTP template first, with its own message and no SmsTemplate detail', async () => {
      for (const t of smsState.templates.values())
        if (t.templateCode !== 'otp_en') t.enabled = false;
      const answer = await send(
        TEMPLATE_ENABLED,
        { enabled: false },
        { id: templateBy('otp_en').id },
      );
      expect(answer.body.message).toBe(
        'The last enabled OTP template cannot be removed while phone sign-in is on or phone-number accounts exist',
      );
      expect(answer.body.data).toBeNull();
    });
  });

  it('deletes a template that is off', async () => {
    const id = templateBy('promo_en').id;
    expect((await send(TEMPLATE_DELETE, {}, { id })).status).toBe(200);
    expect(smsState.templates.has(id)).toBe(false);
    expect((await send(TEMPLATE_DELETE, {}, { id })).status).toBe(404);
  });
});

describe('the records', () => {
  it('answers a page, newest first, with the columns of the record and no code of a person', async () => {
    const answer = await get(RECORDS, { pageSize: 200 });
    const items = answer.body.data.items as Record<string, unknown>[];
    expect(answer.body.data.total).toBe(items.length);
    expect(items.length).toBeGreaterThan(30);
    const times = items.map((r) => String(r.createdAt));
    expect(times).toEqual([...times].sort().reverse());
    expect(Object.keys(items[0]).sort()).toEqual(
      [
        'channel',
        'channelCode',
        'contentRedacted',
        'country',
        'createdAt',
        'deliveredAt',
        'deliveryStatus',
        'failReason',
        'localeUsed',
        'mobile',
        'msgId',
        'purpose',
        'sendStatus',
        'sentAt',
        'templateCode',
        'usedAt',
        'vendorMsgId',
      ].sort(),
    );
    // Nothing in a record is a six-digit code of a person.
    expect(items.map((r) => String(r.contentRedacted)).join('\n')).not.toMatch(
      /(?<![\d+])\d{6}(?!\d)/,
    );
    expect(items.some((r) => String(r.contentRedacted).includes('****'))).toBe(true);
  });

  it('masks the number to its last four digits unless the administrator holds SMS:RECORD:PHONE_VIEW', async () => {
    const masked = (await getAs(RECORDS, ['SMS:RECORD'], { pageSize: 200 })).body.data.items as {
      mobile: string;
    }[];
    expect(masked.every((r) => /^\*{4}\d{4}$/.test(r.mobile))).toBe(true);
    const whole = (await getAs(RECORDS, ['SMS:RECORD', 'SMS:RECORD:PHONE_VIEW'], { pageSize: 200 }))
      .body.data.items as { mobile: string }[];
    expect(whole.every((r) => /^\+\d{8,15}$/.test(r.mobile))).toBe(true);
    expect(whole.map((r) => r.mobile.slice(-4))).toEqual(masked.map((r) => r.mobile.slice(-4)));
  });

  it('filters by the whole number only, also for an administrator who sees it masked', async () => {
    const all = (await getAs(RECORDS, ['SMS:RECORD', 'SMS:RECORD:PHONE_VIEW'], { pageSize: 200 }))
      .body.data.items as { mobile: string }[];
    const target = all[0].mobile;
    const exact = await getAs(RECORDS, ['SMS:RECORD'], { mobile: target, pageSize: 200 });
    expect(exact.body.data.total).toBe(all.filter((r) => r.mobile === target).length);
    expect(exact.body.data.total).toBeGreaterThan(0);
    for (const partial of [
      target.slice(0, -1),
      target.slice(-4),
      target.slice(1),
      `****${target.slice(-4)}`,
    ]) {
      expect(
        (await getAs(RECORDS, ['SMS:RECORD'], { mobile: partial })).body.data.total,
        partial,
      ).toBe(0);
    }
  });

  it('filters by id, vendor id, delivery channel, channel code, purpose, statuses, used and time', async () => {
    const all = (await get(RECORDS, { pageSize: 200 })).body.data.items as Record<
      string,
      string | null
    >[];
    const first = all[0];
    expect((await get(RECORDS, { msgId: first.msgId })).body.data.total).toBe(1);
    const withVendor = all.find((r) => r.vendorMsgId) as Record<string, string>;
    expect((await get(RECORDS, { vendorMsgId: withVendor.vendorMsgId })).body.data.total).toBe(1);
    const push = (await get(RECORDS, { channel: 'PUSH', pageSize: 200 })).body.data;
    expect(push.total).toBeGreaterThan(0);
    expect(push.items.every((r: { channel: string }) => r.channel === 'PUSH')).toBe(true);
    const sms = (await get(RECORDS, { channel: 'SMS', pageSize: 200 })).body.data;
    expect(push.total + sms.total).toBe(all.length);
    expect((await get(RECORDS, { channelCode: 'push', pageSize: 200 })).body.data.total).toBe(
      push.total,
    );
    expect(
      (await get(RECORDS, { purpose: 'DELETE', pageSize: 200 })).body.data.items.every(
        (r: { purpose: string }) => r.purpose === 'DELETE',
      ),
    ).toBe(true);
    const failed = (await get(RECORDS, { sendStatus: 'FAILED', pageSize: 200 })).body.data;
    expect(failed.total).toBeGreaterThan(0);
    expect(
      (await get(RECORDS, { deliveryStatus: 'DELIVERED', pageSize: 200 })).body.data.total,
    ).toBeGreaterThan(0);
    const used = (await get(RECORDS, { used: 'true', pageSize: 200 })).body.data;
    const unused = (await get(RECORDS, { used: 'false', pageSize: 200 })).body.data;
    expect(used.total + unused.total).toBe(all.length);
    expect(used.items.every((r: { usedAt: string | null }) => r.usedAt !== null)).toBe(true);
    const cut = String(all[10].createdAt);
    const recent = (await get(RECORDS, { from: cut, pageSize: 200 })).body.data;
    expect(recent.items.every((r: { createdAt: string }) => r.createdAt >= cut)).toBe(true);
    expect(recent.total).toBe(11);
    const older = (await get(RECORDS, { to: cut, pageSize: 200 })).body.data;
    expect(older.items.every((r: { createdAt: string }) => r.createdAt < cut)).toBe(true);
  });

  it('gives a push row no vendor id and no delivery status', async () => {
    const push = (await get(RECORDS, { channel: 'PUSH', pageSize: 200 })).body.data.items as Record<
      string,
      unknown
    >[];
    expect(
      push.every(
        (r) =>
          r.vendorMsgId === null &&
          r.deliveryStatus === 'NOT_APPLICABLE' &&
          r.channelCode === 'push',
      ),
    ).toBe(true);
  });

  it('refuses a filter value that is not one of the values', async () => {
    expect(refsOf(await get(RECORDS, { channel: 'FAX' }))).toEqual(['channel:OUT_OF_RANGE']);
    expect(refsOf(await get(RECORDS, { used: 'maybe' }))).toEqual(['used:NOT_BOOLEAN']);
  });
});

describe('the export of the records', () => {
  const download = async (codes: PermissionCode[], query: Record<string, string> = {}) => {
    const answer: {
      status: number;
      file?: Buffer;
      type?: string;
      disposition?: string;
      json?: { code: string };
    } = {
      status: 0,
    };
    const res: MockRes = {
      status(code) {
        answer.status = code;
        return res;
      },
      json(body) {
        answer.json = body as { code: string };
        return undefined;
      },
      setHeader(key, value) {
        if (key === 'Content-Type') answer.type = value;
        if (key === 'Content-Disposition') answer.disposition = value;
      },
      end(body) {
        answer.file = body as Buffer;
      },
    };
    const req: MockReq = {
      headers: { authorization: tokenOf('support', codes) },
      query,
      params: {},
      body: undefined,
    };
    await (h(EXPORT) as unknown as (r: MockReq, s: MockRes) => Promise<void>)(req, res);
    return answer;
  };

  it('needs both SMS:RECORD:EXPORT and SMS:RECORD', async () => {
    expect((await download(['SMS:RECORD'])).status).toBe(403);
    expect((await download(['SMS:RECORD:EXPORT'])).status).toBe(403);
    const ok = await download(['SMS:RECORD', 'SMS:RECORD:EXPORT']);
    expect(ok.status).toBe(200);
    expect(ok.type).toMatch(/spreadsheetml/);
    expect(ok.disposition).toMatch(/^attachment; filename="sms-records-.*\.xlsx"$/);
  });

  it('writes the rows of the filter, with the number masked unless the administrator may see it', async () => {
    const whole = await getAs(RECORDS, ['SMS:RECORD', 'SMS:RECORD:PHONE_VIEW'], { pageSize: 200 });
    const full = (whole.body.data.items as { mobile: string }[])[0].mobile;
    const masked = await download(['SMS:RECORD', 'SMS:RECORD:EXPORT']);
    const text = (masked.file as Buffer).toString('utf8');
    expect(text).toContain(`****${full.slice(-4)}`);
    expect(text).not.toContain(full);
    const seen = await download(['SMS:RECORD', 'SMS:RECORD:EXPORT', 'SMS:RECORD:PHONE_VIEW']);
    expect((seen.file as Buffer).toString('utf8')).toContain(full);
  });

  it('follows the filters of the list', async () => {
    const push = await download(['SMS:RECORD', 'SMS:RECORD:EXPORT'], { channel: 'PUSH' });
    const everything = await download(['SMS:RECORD', 'SMS:RECORD:EXPORT']);
    expect((push.file as Buffer).length).toBeLessThan((everything.file as Buffer).length);
  });

  it('answers 429 after the hourly number of exports, with JSON and no file', async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await download(['SMS:RECORD', 'SMS:RECORD:EXPORT'])).status).toBe(200);
    }
    const refused = await download(['SMS:RECORD', 'SMS:RECORD:EXPORT']);
    expect(refused.status).toBe(429);
    expect(refused.file).toBeUndefined();
    expect(refused.json?.code).toBe('RATE_LIMITED');
  });
});

describe('the sample data', () => {
  it('has all the languages that the product serves, in names, contents and records', () => {
    const text = [
      ...[...smsState.channels.values()].map((c) => c.name),
      ...[...smsState.templates.values()].map((t) => t.content),
      ...smsState.records.map((r) => r.contentRedacted),
    ].join('\n');
    expect(text).toMatch(/\p{Script=Thai}/u);
    expect(text).toMatch(/\p{Script=Arabic}/u);
    expect(text).toMatch(/\p{Script=Han}/u);
    expect(text).toMatch(/[ạảấầắằ]/);
    expect(text).toMatch(/[¿¡ñ]/);
    expect(text).toMatch(/Terima kasih|Kode/);
    expect(text).toMatch(/\p{Extended_Pictographic}/u);
    expect(text).toMatch(/A{300}/);
  });
});
