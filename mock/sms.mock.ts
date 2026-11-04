// The SMS endpoints of the mock backend (contract 23.4 and 23.6): channels, templates and send
// records with their export. What the contract leaves open (the name of the credentials field, the
// body of the switch, the answer of a test send, the names of the filters) follows
// docs/contract-requests/2026-10-26-admin-frontend-sms-email.md.
//
// A channel is answered without its credentials, always: `hasCredentials` is all there is. A number
// in a record is masked to its last four digits unless the administrator holds SMS:RECORD:PHONE_VIEW.

import type { PermissionCode } from '../src/access/permissionCodes';
import {
  DELIVERY_CHANNELS,
  DELIVERY_STATUSES,
  RECORD_PURPOSES,
  SEND_STATUSES,
  SMS_TYPES,
} from '../src/services/sms/types';
import { countCodePoints } from '../src/utils/codePoints';
import { trimSpec } from '../src/utils/trimSpec';
import { authenticate, guard, hasPermission } from './_core/auth';
import { currentValue } from './_core/configStore';
import { bodyOf, fail, invalidRequest, MockHttpError, ok, toUmiFile } from './_core/http';
import { paginateQuery } from './_core/paginate';
import {
  type MockChannel,
  type MockRecord,
  type MockTemplate,
  SMS_PROVIDERS,
  smsState,
  TEST_PER_DAY,
} from './_core/smsData';
import { store } from './_core/store';
import { maskPhone } from './_core/usersData';
import { buildXlsx, XLSX_CONTENT_TYPE } from './_core/xlsx';

type Detail = { ref: string; reason: string };

const ANY_SMS: PermissionCode[] = [
  'SMS:CHANNEL',
  'SMS:CHANNEL:CONFIG',
  'SMS:TEMPLATE',
  'SMS:RECORD',
  'SMS:RECORD:PHONE_VIEW',
  'SMS:RECORD:EXPORT',
];

const EXPORTS_PER_HOUR = 10;

const notFound = (what: string) =>
  new MockHttpError(404, 'RESOURCE_NOT_FOUND', `There is no such ${what}`);
const throwIf = (details: Detail[]) => {
  if (details.length > 0) throw invalidRequest('invalid request', details);
};
const idOf = (req: { params: Record<string, string> }) => req.params.id;
const isText = (value: unknown): value is string => typeof value === 'string';
const newest = <T extends { id: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => Number(b.id) - Number(a.id));
const textOf = (value: unknown): string => (isText(value) ? value : '');
const COUNTRY = /^[A-Za-z]{2}$/;

// ---- what makes the last OTP channel or template ----

/** The backend refuses the removal while phone sign-in is on or phone-number accounts exist (23.4). */
function phoneSignInMatters(): boolean {
  return currentValue('auth.phone_login_enabled') === true || smsState.phoneAccounts > 0;
}

const servesCountry = (channel: Pick<MockChannel, 'countries'>, country: string): boolean =>
  channel.countries.length === 0 || channel.countries.includes(country);

/**
 * True when the change leaves some country without an enabled OTP channel that it had before.
 * `after` is the channel as it will be, or null when it goes. Checked country by country, over every
 * country any channel names and one more that none names (served only by channels for all countries).
 */
function losesCoverage(before: MockChannel, after: MockChannel | null): boolean {
  const others = [...smsState.channels.values()].filter((c) => c.id !== before.id);
  const servers = (self: MockChannel | null) =>
    [...others, ...(self ? [self] : [])].filter((c) => c.enabled && c.smsType === 'OTP');
  const named = new Set<string>();
  for (const c of [...others, before, ...(after ? [after] : [])])
    for (const x of c.countries) named.add(x);
  const universe = [...named, '*other*'];
  return universe.some((country) => {
    const serves = (c: MockChannel) =>
      country === '*other*' ? c.countries.length === 0 : servesCountry(c, country);
    return servers(before).some(serves) && !servers(after).some(serves);
  });
}

/**
 * The backend answers 400 INVALID_REQUEST with the detail SmsChannel and one of two reasons: no
 * enabled OTP channel would be left at all (LAST_OTP_CHANNEL), or others are left but a country that
 * had one loses it (COUNTRY_LOSES_OTP_CHANNEL; answers 41 and the updated interface document 23.4).
 */
function refuseLastChannel(before: MockChannel, after: MockChannel | null) {
  if (phoneSignInMatters() && losesCoverage(before, after)) {
    const left = [...smsState.channels.values()].filter(
      (c) => c.id !== before.id && c.enabled && c.smsType === 'OTP',
    );
    if (after?.enabled && after.smsType === 'OTP') left.push(after);
    const none = left.length === 0;
    throw invalidRequest(
      none
        ? 'The last enabled OTP channel cannot be removed while phone sign-in is on or phone-number accounts exist'
        : 'A country that has an OTP channel would lose it while phone sign-in is on or phone-number accounts exist',
      [{ ref: 'SmsChannel', reason: none ? 'LAST_OTP_CHANNEL' : 'COUNTRY_LOSES_OTP_CHANNEL' }],
    );
  }
}

/** The template every country falls back to for codes: enabled, OTP, language en (any case), no country. */
const isEnglishFallback = (t: Pick<MockTemplate, 'enabled' | 'smsType' | 'locale' | 'country'>) =>
  t.enabled && t.smsType === 'OTP' && t.locale.toLowerCase() === 'en' && !t.country;

function refuseLastTemplate(before: MockTemplate, after: MockTemplate | null) {
  if (!phoneSignInMatters()) return;
  const others = [...smsState.templates.values()].filter((t) => t.id !== before.id);
  // The rule of the last enabled OTP template comes first, with its own message.
  const wasOtp = before.enabled && before.smsType === 'OTP';
  const stillOtp = after?.enabled === true && after.smsType === 'OTP';
  if (wasOtp && !stillOtp && !others.some((t) => t.enabled && t.smsType === 'OTP')) {
    throw invalidRequest(
      'The last enabled OTP template cannot be removed while phone sign-in is on or phone-number accounts exist',
      [{ ref: 'SmsTemplate', reason: 'LAST_OTP_TEMPLATE' }],
    );
  }
  // Then the one that must stay: only the removal of the last qualifying template is judged, so a
  // state that already lacks one does not stop an unrelated edit.
  if (isEnglishFallback(before) && !(after && isEnglishFallback(after))) {
    if (!others.some(isEnglishFallback)) {
      throw invalidRequest(
        'The last enabled OTP template in language en for every country (no country set) cannot be removed or changed while phone login is on or phone accounts exist',
        [{ ref: 'SmsTemplate', reason: 'LAST_ENGLISH_FALLBACK_TEMPLATE' }],
      );
    }
  }
}

// ---- channels ----

/** A channel as it is answered: no credentials, only whether there are some. */
function channelView(c: MockChannel) {
  return {
    id: c.id,
    channelCode: c.channelCode,
    name: c.name,
    providerCode: c.providerCode,
    apiUrl: c.apiUrl,
    // The backend always answers the extension as an object (answers 6).
    extConfig: c.extConfig ?? {},
    countries: c.countries,
    smsType: c.smsType,
    enabled: c.enabled,
    priority: c.priority,
    hasCredentials: c.credentials !== null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function channelDetails(body: Record<string, unknown>, stored: MockChannel | null): Detail[] {
  const creating = stored === null;
  const details: Detail[] = [];
  if (creating && trimSpec(textOf(body.channelCode)) === '') {
    details.push({ ref: 'channelCode', reason: 'EMPTY_NOT_ALLOWED' });
  }
  if (trimSpec(textOf(body.name)) === '')
    details.push({ ref: 'name', reason: 'EMPTY_NOT_ALLOWED' });
  const provider = SMS_PROVIDERS.find((p) => p.code === body.providerCode);
  if (!provider) details.push({ ref: 'providerCode', reason: 'OUT_OF_RANGE' });
  let url: URL | null = null;
  try {
    url = new URL(textOf(body.apiUrl));
  } catch {
    url = null;
  }
  if (url?.protocol !== 'https:') details.push({ ref: 'apiUrl', reason: 'NOT_HTTPS' });
  else if (
    provider &&
    !provider.allowedHosts.some((host) => host.toLowerCase() === url.hostname.toLowerCase())
  ) {
    details.push({ ref: 'apiUrl', reason: 'INVALID_HOST' });
  }
  if (!SMS_TYPES.includes(body.smsType as never))
    details.push({ ref: 'smsType', reason: 'OUT_OF_RANGE' });
  if (!Number.isInteger(body.priority)) details.push({ ref: 'priority', reason: 'NOT_AN_INTEGER' });
  const countries = body.countries ?? [];
  if (!Array.isArray(countries) || countries.some((c) => !isText(c) || !COUNTRY.test(c))) {
    details.push({ ref: 'countries', reason: 'OUT_OF_RANGE' });
  }
  const ext = body.extConfig;
  if (ext !== undefined && ext !== null && (typeof ext !== 'object' || Array.isArray(ext))) {
    details.push({ ref: 'extConfig', reason: 'OUT_OF_RANGE' });
  }
  details.push(
    ...credentialsDetail(
      body,
      provider,
      stored !== null && stored.providerCode !== body.providerCode,
    ),
  );
  return details;
}

/** The backend cannot read the body (a string or a list where a map is wanted): 400 INVALID_REQUEST, no details. */
const unreadableBody = () =>
  new MockHttpError(400, 'INVALID_REQUEST', 'Malformed or invalid request body');

/**
 * `credentials` is a map of names to text values (answers 5). Absent, null and {} mean "unchanged",
 * and are not checked against the provider, except on an update that changes the provider to one
 * that needs credentials: what is stored belongs to the old provider, so none given is 400
 * EMPTY_NOT_ALLOWED. A given map must have exactly the names the provider declares (`credentialNames`
 * of the meta): a name missing is EMPTY_NOT_ALLOWED, a name the provider does not use is
 * OUT_OF_RANGE (one detail, the missing names first), a null value is EMPTY_NOT_ALLOWED. An empty
 * value is accepted. Anything that is not a map (a string, a list) cannot be read: 400 without
 * details. A value that is a number or a boolean is not checked against the real backend (it may
 * turn it into text); the page never sends one, so the mock refuses it like an unreadable body.
 */
function credentialsDetail(
  body: Record<string, unknown>,
  provider: { credentialNames: string[] } | undefined,
  providerChanged: boolean,
): Detail[] {
  const value = body.credentials;
  const needed = provider?.credentialNames ?? [];
  const none: Detail[] =
    providerChanged && needed.length > 0
      ? [{ ref: 'credentials', reason: 'EMPTY_NOT_ALLOWED' }]
      : [];
  if (value === undefined || value === null) return none;
  if (typeof value !== 'object' || Array.isArray(value)) throw unreadableBody();
  const texts = Object.values(value);
  if (texts.some((text) => text !== null && !isText(text))) throw unreadableBody();
  if (texts.some((text) => text === null))
    return [{ ref: 'credentials', reason: 'EMPTY_NOT_ALLOWED' }];
  if (texts.length === 0) return none;
  if (!provider) return [];
  const names = Object.keys(value);
  if (needed.some((name) => !names.includes(name))) {
    return [{ ref: 'credentials', reason: 'EMPTY_NOT_ALLOWED' }];
  }
  if (names.some((name) => !needed.includes(name))) {
    return [{ ref: 'credentials', reason: 'OUT_OF_RANGE' }];
  }
  return [];
}

/** The map the body carries, or null when it carries none (absent, null or empty). */
function credentialsOf(body: Record<string, unknown>): Record<string, string> | null {
  const value = body.credentials as Record<string, string> | null | undefined;
  return value && Object.keys(value).length > 0 ? { ...value } : null;
}

const countriesOf = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter(isText).map((c) => c.toUpperCase()))] : [];

const nowIso = () => new Date().toISOString();

/** The fields of a channel that an update may leave out. */
const UPDATE_KEYS = [
  'name',
  'providerCode',
  'apiUrl',
  'extConfig',
  'countries',
  'smsType',
  'priority',
] as const;

// ---- templates ----

/** The limits and shapes of SmsInputs / SmsTemplateAdminService, in code points where it counts them. */
const TEMPLATE_NAME_MAX = 100;
const TEMPLATE_CONTENT_MAX = 1000;
const PROVIDER_TEMPLATE_ID_MAX = 128;
const TEMPLATE_CODE = /^[A-Za-z0-9_-]{1,64}$/;
const TEMPLATE_LOCALE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8}){0,3}$/;
const TEMPLATE_PLACEHOLDERS = ['{code}', '{minutes}', '{appName}'];

/** The country as the backend keeps it: stripped and upper case, none when blank (SmsInputs.optionalCountry). */
const countryKept = (value: unknown): string | null => {
  const text = isText(value) ? trimSpec(value) : '';
  return text === '' ? null : text.toUpperCase();
};

/** The id at the provider as the backend keeps it: stripped, none when blank (SmsInputs.optionalText). */
const providerIdKept = (value: unknown): string | null => {
  const text = isText(value) ? trimSpec(value) : '';
  return text === '' ? null : text;
};

/** A control character other than a line break, a carriage return or a tab (SmsInputs.content). */
const hasControlCharacter = (text: string): boolean =>
  [...text].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    const control = code < 0x20 || (code >= 0x7f && code <= 0x9f);
    return control && code !== 0x0a && code !== 0x0d && code !== 0x09;
  });

/**
 * What the backend refuses in a template, in its order, and only the first thing it finds (it stops
 * at the first refusal, so the answer has one detail): the code, the name, the language, the
 * country, the type, the content, the id at the provider.
 */
function templateDetails(body: Record<string, unknown>, creating: boolean): Detail[] {
  const refuse = (ref: string, reason: string): Detail[] => [{ ref, reason }];
  if (creating && !(isText(body.templateCode) && TEMPLATE_CODE.test(body.templateCode))) {
    return refuse('templateCode', 'OUT_OF_RANGE');
  }
  const name = trimSpec(textOf(body.name));
  if (name === '') return refuse('name', 'EMPTY_NOT_ALLOWED');
  if (countCodePoints(name) > TEMPLATE_NAME_MAX) return refuse('name', 'TOO_LONG');
  if (!(isText(body.locale) && TEMPLATE_LOCALE.test(body.locale))) {
    return refuse('locale', 'INVALID_LANGUAGE_TAG');
  }
  // blank is none; otherwise any case, which the backend turns into upper case
  const country = isText(body.country) ? trimSpec(body.country) : body.country;
  if (country !== undefined && country !== null && country !== '') {
    if (!(isText(country) && COUNTRY.test(country))) return refuse('country', 'OUT_OF_RANGE');
  }
  if (body.smsType === undefined || body.smsType === null) {
    return refuse('smsType', 'EMPTY_NOT_ALLOWED');
  }
  if (!SMS_TYPES.includes(body.smsType as never)) return refuse('smsType', 'OUT_OF_RANGE');
  const content = trimSpec(textOf(body.content));
  if (content === '') return refuse('content', 'EMPTY_NOT_ALLOWED');
  if (countCodePoints(content) > TEMPLATE_CONTENT_MAX) return refuse('content', 'TOO_LONG');
  // a control character other than a line break or a tab, and a token the backend does not know
  if (hasControlCharacter(content)) return refuse('content', 'OUT_OF_RANGE');
  for (const token of content.match(/\{[^{}]*\}/g) ?? []) {
    if (!TEMPLATE_PLACEHOLDERS.includes(token)) return refuse('content', 'OUT_OF_RANGE');
  }
  if (body.smsType === 'OTP' && !content.includes('{code}')) {
    return refuse('content', 'OUT_OF_RANGE');
  }
  const providerTemplateId = body.providerTemplateId;
  if (providerTemplateId !== undefined && providerTemplateId !== null) {
    if (!isText(providerTemplateId)) return refuse('providerTemplateId', 'OUT_OF_RANGE');
    if (countCodePoints(trimSpec(providerTemplateId)) > PROVIDER_TEMPLATE_ID_MAX) {
      return refuse('providerTemplateId', 'TOO_LONG');
    }
  }
  return [];
}

// ---- records ----

const canSeePhone = (admin: Parameters<typeof hasPermission>[0]) =>
  hasPermission(admin, 'SMS:RECORD:PHONE_VIEW');

const recordView = (r: MockRecord, seesPhone: boolean) => ({
  ...r,
  mobile: seesPhone ? r.mobile : maskPhone(r.mobile),
});

type Query = Record<string, unknown>;

const oneOf = (query: Query, ref: string, allowed: readonly string[], details: Detail[]) => {
  const value = query[ref];
  if (value === undefined || value === '') return undefined;
  if (isText(value) && allowed.includes(value)) return value;
  details.push({ ref, reason: 'OUT_OF_RANGE' });
  return undefined;
};

const instantOf = (query: Query, ref: string, details: Detail[]) => {
  const value = query[ref];
  if (value === undefined || value === '') return undefined;
  if (isText(value) && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  details.push({ ref, reason: 'OUT_OF_RANGE' });
  return undefined;
};

/** The records of the filter, newest first. The number matches whole; a part of it matches nothing. */
function filteredRecords(query: Query): MockRecord[] {
  const details: Detail[] = [];
  const channel = oneOf(query, 'channel', DELIVERY_CHANNELS, details);
  const purpose = oneOf(query, 'purpose', RECORD_PURPOSES, details);
  const sendStatus = oneOf(query, 'sendStatus', SEND_STATUSES, details);
  const deliveryStatus = oneOf(query, 'deliveryStatus', DELIVERY_STATUSES, details);
  const used = oneOf(query, 'used', ['true', 'false'], details);
  if (query.used !== undefined && query.used !== '' && used === undefined) {
    details.splice(
      details.findIndex((d) => d.ref === 'used'),
      1,
      { ref: 'used', reason: 'NOT_BOOLEAN' },
    );
  }
  const from = instantOf(query, 'from', details);
  const to = instantOf(query, 'to', details);
  throwIf(details);
  const text = (ref: string) => (isText(query[ref]) ? query[ref] : '');
  return smsState.records
    .filter(
      (r) =>
        (text('msgId') === '' || r.msgId === text('msgId')) &&
        (text('vendorMsgId') === '' || r.vendorMsgId === text('vendorMsgId')) &&
        (text('mobile') === '' || r.mobile === text('mobile')) &&
        (channel === undefined || r.channel === channel) &&
        (text('channelCode') === '' || r.channelCode === text('channelCode')) &&
        (purpose === undefined || r.purpose === purpose) &&
        (sendStatus === undefined || r.sendStatus === sendStatus) &&
        (deliveryStatus === undefined || r.deliveryStatus === deliveryStatus) &&
        (used === undefined || (used === 'true') === (r.usedAt !== null)) &&
        (from === undefined || r.createdAt >= from) &&
        (to === undefined || r.createdAt < to),
    )
    .sort((a, b) =>
      a.createdAt < b.createdAt
        ? 1
        : a.createdAt > b.createdAt
          ? -1
          : b.msgId.localeCompare(a.msgId),
    );
}

export default {
  // ---- the meta (any SMS code) ----
  'GET /api/admin/sms/meta': guard(ANY_SMS, (req) => {
    const today = nowIso().slice(0, 10);
    const used = smsState.testUsed.get(req.admin.id);
    const count = used && used.day === today ? used.count : 0;
    // Exactly these four, for an administrator with any SMS code: the page knows beforehand whether
    // the guard of the last OTP channel and template is on (answers 41).
    return ok({
      providers: SMS_PROVIDERS,
      testRemainingToday: Math.max(0, TEST_PER_DAY - count),
      phoneLoginEnabled: currentValue('auth.phone_login_enabled') === true,
      phoneAccountCount: smsState.phoneAccounts,
    });
  }),

  // ---- channels ----
  'GET /api/admin/sms/channels': guard('SMS:CHANNEL', (req) => {
    const page = paginateQuery(newest([...smsState.channels.values()]), req);
    return ok({ items: page.items.map(channelView), total: page.total });
  }),

  'GET /api/admin/sms/channels/:id': guard('SMS:CHANNEL', (req) => {
    const channel = smsState.channels.get(idOf(req));
    if (!channel) throw notFound('channel');
    return ok(channelView(channel));
  }),

  'POST /api/admin/sms/channels': guard('SMS:CHANNEL:CONFIG', (req) => {
    const body = bodyOf(req);
    throwIf(channelDetails(body, null));
    const code = trimSpec(textOf(body.channelCode));
    if ([...smsState.channels.values()].some((c) => c.channelCode === code)) {
      throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The channel code is taken', {
        field: 'channelCode',
      });
    }
    const id = String(smsState.next.channel++);
    const at = nowIso();
    const channel: MockChannel = {
      id,
      channelCode: code,
      name: trimSpec(textOf(body.name)),
      providerCode: textOf(body.providerCode),
      apiUrl: trimSpec(textOf(body.apiUrl)),
      credentials: credentialsOf(body),
      extConfig: (body.extConfig as Record<string, unknown> | null | undefined) ?? {},
      countries: countriesOf(body.countries),
      smsType: body.smsType as MockChannel['smsType'],
      // Not sent means on (answers 78).
      enabled: body.enabled !== false,
      priority: body.priority as number,
      createdAt: at,
      updatedAt: at,
    };
    smsState.channels.set(id, channel);
    return ok(channelView(channel));
  }),

  'PUT /api/admin/sms/channels/:id': guard('SMS:CHANNEL:CONFIG', (req) => {
    const channel = smsState.channels.get(idOf(req));
    if (!channel) throw notFound('channel');
    const sent = bodyOf(req);
    // A field the body leaves out or sends as null keeps its stored value (answers 78): null is not
    // a way to clear anything. The extension is cleared with {}, the countries with [].
    const body: Record<string, unknown> = { ...sent };
    for (const key of UPDATE_KEYS) {
      if (sent[key] === undefined || sent[key] === null) body[key] = channel[key];
    }
    throwIf(channelDetails(body, channel));
    const next: MockChannel = {
      ...channel,
      name: trimSpec(textOf(body.name)),
      providerCode: textOf(body.providerCode),
      apiUrl: trimSpec(textOf(body.apiUrl)),
      extConfig: body.extConfig as Record<string, unknown> | null,
      countries: countriesOf(body.countries),
      smsType: body.smsType as MockChannel['smsType'],
      priority: body.priority as number,
      updatedAt: nowIso(),
    };
    refuseLastChannel(channel, next);
    // A missing field, null or an empty map leaves the stored credentials alone; a map with entries replaces them all.
    const credentials = credentialsOf(body);
    if (credentials) next.credentials = credentials;
    smsState.channels.set(channel.id, next);
    return ok(channelView(next));
  }),

  'PUT /api/admin/sms/channels/:id/enabled': guard('SMS:CHANNEL:CONFIG', (req) => {
    const channel = smsState.channels.get(idOf(req));
    if (!channel) throw notFound('channel');
    const { enabled } = bodyOf(req);
    if (typeof enabled !== 'boolean')
      throw invalidRequest('enabled must be true or false', [
        { ref: 'enabled', reason: 'NOT_BOOLEAN' },
      ]);
    const next = { ...channel, enabled, updatedAt: nowIso() };
    if (!enabled) refuseLastChannel(channel, next);
    smsState.channels.set(channel.id, next);
    return ok(channelView(next));
  }),

  'DELETE /api/admin/sms/channels/:id': guard('SMS:CHANNEL:CONFIG', (req) => {
    const channel = smsState.channels.get(idOf(req));
    if (!channel) throw notFound('channel');
    refuseLastChannel(channel, null);
    smsState.channels.delete(channel.id);
    return ok(null);
  }),

  'POST /api/admin/sms/channels/:id/test': guard('SMS:CHANNEL:CONFIG', (req) => {
    const channel = smsState.channels.get(idOf(req));
    if (!channel) throw notFound('channel');
    const { mobile } = bodyOf(req);
    if (!isText(mobile) || !/^\+[1-9]\d{7,14}$/.test(mobile)) {
      throw new MockHttpError(400, 'PHONE_INVALID', 'The number is not valid');
    }
    const today = nowIso().slice(0, 10);
    const used = smsState.testUsed.get(req.admin.id);
    const count = used && used.day === today ? used.count : 0;
    if (count >= TEST_PER_DAY) {
      return fail(429, 'RATE_LIMITED', 'No test messages are left for today');
    }
    smsState.testUsed.set(req.admin.id, { day: today, count: count + 1 });
    const at = nowIso();
    const msgId = `00000000-0000-4000-8000-${String(smsState.next.record++).padStart(12, '0')}`;
    smsState.records.unshift({
      msgId,
      channel: 'SMS',
      vendorMsgId: `V-T${msgId.slice(-6)}`,
      channelCode: channel.channelCode,
      purpose: 'TEST',
      mobile,
      country: null,
      localeUsed: 'en',
      templateCode: null,
      contentRedacted: 'This is a test message from the admin console.',
      sendStatus: 'SUCCESS',
      deliveryStatus: 'PENDING',
      failReason: null,
      usedAt: null,
      createdAt: at,
      sentAt: at,
      deliveredAt: null,
    });
    return ok({ msgId });
  }),

  // ---- templates ----
  'GET /api/admin/sms/templates': guard('SMS:TEMPLATE', (req) => {
    const page = paginateQuery(newest([...smsState.templates.values()]), req);
    return ok({ items: page.items, total: page.total });
  }),

  'POST /api/admin/sms/templates': guard('SMS:TEMPLATE', (req) => {
    const body = bodyOf(req);
    throwIf(templateDetails(body, true));
    const code = trimSpec(textOf(body.templateCode));
    if ([...smsState.templates.values()].some((t) => t.templateCode === code)) {
      throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The template code is taken', {
        field: 'templateCode',
      });
    }
    const id = String(smsState.next.template++);
    const template: MockTemplate = {
      id,
      templateCode: code,
      name: trimSpec(textOf(body.name)),
      locale: trimSpec(textOf(body.locale)),
      country: countryKept(body.country),
      content: trimSpec(textOf(body.content)),
      providerTemplateId: providerIdKept(body.providerTemplateId),
      smsType: body.smsType as MockTemplate['smsType'],
      enabled: body.enabled !== false,
    };
    smsState.templates.set(id, template);
    return ok(template);
  }),

  'PUT /api/admin/sms/templates/:id': guard('SMS:TEMPLATE', (req) => {
    const template = smsState.templates.get(idOf(req));
    if (!template) throw notFound('template');
    const body = bodyOf(req);
    throwIf(templateDetails(body, false));
    const next: MockTemplate = {
      ...template,
      name: trimSpec(textOf(body.name)),
      locale: trimSpec(textOf(body.locale)),
      country: countryKept(body.country),
      content: trimSpec(textOf(body.content)),
      providerTemplateId: providerIdKept(body.providerTemplateId),
      smsType: body.smsType as MockTemplate['smsType'],
    };
    refuseLastTemplate(template, next);
    smsState.templates.set(template.id, next);
    return ok(next);
  }),

  'PUT /api/admin/sms/templates/:id/enabled': guard('SMS:TEMPLATE', (req) => {
    const template = smsState.templates.get(idOf(req));
    if (!template) throw notFound('template');
    const { enabled } = bodyOf(req);
    if (typeof enabled !== 'boolean')
      throw invalidRequest('enabled must be true or false', [
        { ref: 'enabled', reason: 'NOT_BOOLEAN' },
      ]);
    const next = { ...template, enabled };
    if (!enabled) refuseLastTemplate(template, next);
    smsState.templates.set(template.id, next);
    return ok(next);
  }),

  'DELETE /api/admin/sms/templates/:id': guard('SMS:TEMPLATE', (req) => {
    const template = smsState.templates.get(idOf(req));
    if (!template) throw notFound('template');
    refuseLastTemplate(template, null);
    smsState.templates.delete(template.id);
    return ok(null);
  }),

  // ---- records (the export first: it is a path of its own) ----
  'GET /api/admin/sms/records/export': toUmiFile((req) => {
    const admin = authenticate(req);
    if (!hasPermission(admin, 'SMS:RECORD:EXPORT') || !hasPermission(admin, 'SMS:RECORD')) {
      throw new MockHttpError(
        403,
        'ADMIN_FORBIDDEN',
        'The administrator lacks the permission for this export',
      );
    }
    const now = Date.now();
    const recent = (store.exportUses.get(admin.id) ?? []).filter((t) => now - t < 3_600_000);
    if (recent.length >= EXPORTS_PER_HOUR) {
      store.exportUses.set(admin.id, recent);
      return fail(429, 'RATE_LIMITED', 'Too many exports this hour');
    }
    const rows = filteredRecords(req.query);
    store.exportUses.set(admin.id, [...recent, now]);
    const seesPhone = canSeePhone(admin);
    const header = [
      'msgId',
      'vendorMsgId',
      'mobile',
      'country',
      'purpose',
      'channel',
      'channelCode',
      'sendStatus',
      'deliveryStatus',
      'usedAt',
      'failReason',
      'contentRedacted',
      'createdAt',
      'sentAt',
    ];
    const sheet: (string | number | null)[][] = [
      header,
      ...rows.map((r) => {
        const view = recordView(r, seesPhone) as unknown as Record<string, string | null>;
        return header.map((key) => view[key] ?? null);
      }),
    ];
    const day = (text: unknown, fallback: string) =>
      isText(text) && text !== '' ? text.slice(0, 10) : fallback;
    const today = new Date(now).toISOString().slice(0, 10);
    return {
      file: {
        contentType: XLSX_CONTENT_TYPE,
        filename: `sms-records-${day(req.query.from, today)}-${day(req.query.to, today)}.xlsx`,
        body: buildXlsx(sheet),
      },
    };
  }),

  'GET /api/admin/sms/records': guard('SMS:RECORD', (req) => {
    const seesPhone = canSeePhone(req.admin);
    const page = paginateQuery(filteredRecords(req.query), req);
    return ok({ items: page.items.map((r) => recordView(r, seesPhone)), total: page.total });
  }),
};
