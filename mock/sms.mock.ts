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

function refuseLastChannel(before: MockChannel, after: MockChannel | null) {
  if (phoneSignInMatters() && losesCoverage(before, after)) {
    throw new MockHttpError(
      400,
      'INVALID_REQUEST',
      'The last enabled OTP channel of a country cannot be removed while phone sign-in is on or phone-number accounts exist',
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
    throw new MockHttpError(
      400,
      'INVALID_REQUEST',
      'The last enabled OTP template cannot be removed while phone sign-in is on or phone-number accounts exist',
    );
  }
  // Then the one that must stay: only the removal of the last qualifying template is judged, so a
  // state that already lacks one does not stop an unrelated edit.
  if (isEnglishFallback(before) && !(after && isEnglishFallback(after))) {
    if (!others.some(isEnglishFallback)) {
      throw invalidRequest(
        'The last enabled OTP template in language en for every country (no country set) cannot be removed or changed while phone login is on or phone accounts exist',
        [{ ref: 'SmsTemplate', reason: 'OUT_OF_RANGE' }],
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
    extConfig: c.extConfig,
    countries: c.countries,
    smsType: c.smsType,
    enabled: c.enabled,
    priority: c.priority,
    hasCredentials: c.credentials !== null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function channelDetails(body: Record<string, unknown>, creating: boolean): Detail[] {
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
  else if (provider && !provider.allowedHosts.includes(url.hostname.toLowerCase())) {
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
  return details;
}

const countriesOf = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter(isText).map((c) => c.toUpperCase()))] : [];

const nowIso = () => new Date().toISOString();

// ---- templates ----

function templateDetails(body: Record<string, unknown>, creating: boolean): Detail[] {
  const details: Detail[] = [];
  if (creating && trimSpec(textOf(body.templateCode)) === '') {
    details.push({ ref: 'templateCode', reason: 'EMPTY_NOT_ALLOWED' });
  }
  if (trimSpec(textOf(body.name)) === '')
    details.push({ ref: 'name', reason: 'EMPTY_NOT_ALLOWED' });
  if (!SMS_TYPES.includes(body.smsType as never))
    details.push({ ref: 'smsType', reason: 'OUT_OF_RANGE' });
  if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(textOf(body.locale))) {
    details.push({ ref: 'locale', reason: 'INVALID_LANGUAGE_TAG' });
  }
  const country = body.country;
  if (country !== undefined && country !== null && !(isText(country) && COUNTRY.test(country))) {
    details.push({ ref: 'country', reason: 'OUT_OF_RANGE' });
  }
  const content = textOf(body.content);
  if (trimSpec(content) === '') details.push({ ref: 'content', reason: 'EMPTY_NOT_ALLOWED' });
  else if (body.smsType === 'OTP' && !content.includes('{code}')) {
    details.push({ ref: 'content', reason: 'MISSING_PLACEHOLDER' });
  }
  const providerTemplateId = body.providerTemplateId;
  if (
    providerTemplateId !== undefined &&
    providerTemplateId !== null &&
    !isText(providerTemplateId)
  ) {
    details.push({ ref: 'providerTemplateId', reason: 'OUT_OF_RANGE' });
  }
  return details;
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
    return ok({ providers: SMS_PROVIDERS, testRemainingToday: Math.max(0, TEST_PER_DAY - count) });
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
    throwIf(channelDetails(body, true));
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
      credentials: trimSpec(textOf(body.credentials)) === '' ? null : textOf(body.credentials),
      extConfig: (body.extConfig as Record<string, unknown> | null | undefined) ?? null,
      countries: countriesOf(body.countries),
      smsType: body.smsType as MockChannel['smsType'],
      enabled: body.enabled === true,
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
    const body = bodyOf(req);
    throwIf(channelDetails(body, false));
    const next: MockChannel = {
      ...channel,
      name: trimSpec(textOf(body.name)),
      providerCode: textOf(body.providerCode),
      apiUrl: trimSpec(textOf(body.apiUrl)),
      extConfig: (body.extConfig as Record<string, unknown> | null | undefined) ?? null,
      countries: countriesOf(body.countries),
      smsType: body.smsType as MockChannel['smsType'],
      priority: body.priority as number,
      updatedAt: nowIso(),
    };
    refuseLastChannel(channel, next);
    // A blank or missing credentials field leaves the stored ones alone.
    if (isText(body.credentials) && trimSpec(body.credentials) !== '')
      next.credentials = body.credentials;
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
      country: isText(body.country) ? body.country.toUpperCase() : null,
      content: trimSpec(textOf(body.content)),
      providerTemplateId: isText(body.providerTemplateId) ? body.providerTemplateId : null,
      smsType: body.smsType as MockTemplate['smsType'],
      enabled: body.enabled === true,
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
      country: isText(body.country) ? body.country.toUpperCase() : null,
      content: trimSpec(textOf(body.content)),
      providerTemplateId: isText(body.providerTemplateId) ? body.providerTemplateId : null,
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
