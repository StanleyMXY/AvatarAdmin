// The push endpoints of the mock backend (contract 8.3 to 8.5 and 17.4, the "推送管理" row). State
// lives in _core/pushData.ts. What the contract leaves open (the paging and filters of the lists,
// the answer of a refused enabling, the name of the picture field) follows
// docs/contract-requests/2026-10-26-admin-frontend-push.md. The statistics, the landing and the
// export of the push report are in stats.mock.ts and export.mock.ts.

import { countCodePoints } from '../src/utils/codePoints';
import { validateServerLink } from '../src/utils/linkRule';
import { SCREEN_TARGETS } from '../src/utils/screenTargets';
import { trimSpec } from '../src/utils/trimSpec';
import { guard } from './_core/auth';
import { currentValue } from './_core/configStore';
import { bodyOf, invalidRequest, MockHttpError, ok } from './_core/http';
import { paginateQuery } from './_core/paginate';
import {
  isTimeZone,
  type MockAudience,
  type MockContent,
  type MockSchedule,
  type MockTask,
  type MockTemplate,
  nextRunAt,
  pushState,
  usernameOf,
} from './_core/pushData';
import { validDay } from './_core/statRange';

type Detail = { ref: string; reason: string };

const RECALL_REASONS = ['daily_recall', 'streak_at_risk'];
const AUDIENCES = ['ALL', 'ACCOUNTS', 'GUESTS', 'ACCOUNT_IDS'];
const PLATFORMS = ['ANDROID', 'IOS'];
const REPEATS = ['DAILY', 'WEEKLY', 'MONTHLY'];
const LINK_TYPES = ['NONE', 'SCREEN', 'URL'];
const TEXT_MAX = { title: 200, body: 1000 };

const fail = (details: Detail[], message = 'invalid request') => invalidRequest(message, details);
const notFound = (what: string) =>
  new MockHttpError(404, 'RESOURCE_NOT_FOUND', `There is no such ${what}`);
const isInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);
const isText = (value: unknown): value is string => typeof value === 'string';
const imageUrlOf = (file: string | null) =>
  file === null ? null : `/api/admin/mock-files/${file}`;

// ---- the upload records: a picture goes up first, then is named by its uploadId ----

function newUpload() {
  const n = pushState.next.upload++;
  const upload = { id: `up-img-${String(n).padStart(4, '0')}`, used: false, file: `push-${n}.svg` };
  pushState.uploads.set(upload.id, upload);
  return upload;
}

/** The upload a request names: 404 when unknown, 409 when it was used already. */
function takeUpload(id: unknown): string {
  if (typeof id !== 'string' || id === '') {
    throw fail([{ ref: 'uploadId', reason: 'EMPTY_NOT_ALLOWED' }]);
  }
  const upload = pushState.uploads.get(id);
  if (!upload) throw notFound('upload');
  if (upload.used) {
    throw new MockHttpError(409, 'INVALID_STATE', 'The upload belongs to another object already', {
      status: 'USED',
    });
  }
  upload.used = true;
  return upload.file;
}

// ---- field checks shared by the three kinds of objects ----

function words(body: Record<string, unknown>, ref: 'title' | 'body', details: Detail[]): string {
  const value = isText(body[ref]) ? trimSpec(body[ref]) : '';
  const length = countCodePoints(value);
  if (length === 0) details.push({ ref, reason: 'EMPTY_NOT_ALLOWED' });
  else if (length > TEXT_MAX[ref]) details.push({ ref, reason: 'TOO_LONG' });
  return value;
}

function link(
  body: Record<string, unknown>,
  details: Detail[],
): { linkType: MockContent['linkType']; linkTarget: string | null } {
  const linkType = body.linkType;
  if (!isText(linkType) || !LINK_TYPES.includes(linkType)) {
    details.push({ ref: 'linkType', reason: 'OUT_OF_RANGE' });
    return { linkType: 'NONE', linkTarget: null };
  }
  const target = isText(body.linkTarget) ? body.linkTarget : '';
  if (linkType === 'NONE') {
    if (target !== '') details.push({ ref: 'linkTarget', reason: 'OUT_OF_RANGE' });
    return { linkType: 'NONE', linkTarget: null };
  }
  if (linkType === 'SCREEN') {
    if (!SCREEN_TARGETS.includes(target))
      details.push({ ref: 'linkTarget', reason: 'OUT_OF_RANGE' });
  } else {
    const check = validateServerLink(target);
    if (!check.ok) details.push({ ref: 'linkTarget', reason: check.reasonKey });
  }
  return { linkType: linkType as MockContent['linkType'], linkTarget: target };
}

function flag(value: unknown, ref: string, details: Detail[]): boolean {
  if (typeof value !== 'boolean') {
    details.push({ ref, reason: 'NOT_BOOLEAN' });
    return false;
  }
  return value;
}

/** Audience and filters (contract 8.5): the filters are refused together with an account list. */
function audience(body: Record<string, unknown>, details: Detail[]): MockAudience {
  const kind = body.audience;
  if (!isText(kind) || !AUDIENCES.includes(kind)) {
    details.push({ ref: 'audience', reason: 'OUT_OF_RANGE' });
    return { audience: 'ALL', accountIds: null, platforms: null, locales: null };
  }
  const list = (ref: string, allowed?: string[]): string[] | null => {
    const value = body[ref];
    if (value === undefined || value === null) return null;
    if (
      !Array.isArray(value) ||
      value.some((x) => !isText(x) || x.trim() === '' || (allowed && !allowed.includes(x)))
    ) {
      details.push({ ref, reason: 'OUT_OF_RANGE' });
      return null;
    }
    return value.length === 0 ? null : (value as string[]);
  };
  if (kind === 'ACCOUNT_IDS') {
    const ids = list('accountIds');
    if (Array.isArray(body.accountIds) && body.accountIds.length === 0) {
      details.push({ ref: 'accountIds', reason: 'EMPTY_NOT_ALLOWED' });
    } else if (body.accountIds === undefined || body.accountIds === null) {
      details.push({ ref: 'accountIds', reason: 'EMPTY_NOT_ALLOWED' });
    }
    if (body.platforms !== undefined && body.platforms !== null) {
      details.push({ ref: 'platforms', reason: 'OUT_OF_RANGE' });
    }
    if (body.locales !== undefined && body.locales !== null) {
      details.push({ ref: 'locales', reason: 'OUT_OF_RANGE' });
    }
    return { audience: kind, accountIds: ids, platforms: null, locales: null };
  }
  if (body.accountIds !== undefined && body.accountIds !== null) {
    details.push({ ref: 'accountIds', reason: 'OUT_OF_RANGE' });
  }
  return {
    audience: kind as MockAudience['audience'],
    accountIds: null,
    platforms: list('platforms', PLATFORMS),
    locales: list('locales'),
  };
}

const taskRow = (t: MockTask) => {
  const { imageFile, ...rest } = t;
  return { ...rest, createdByUsername: usernameOf(t.createdBy), imageUrl: imageUrlOf(imageFile) };
};

const scheduleRow = (s: MockSchedule) => {
  const { imageFile, ...rest } = s;
  return { ...rest, createdByUsername: usernameOf(s.createdBy), imageUrl: imageUrlOf(imageFile) };
};

const templateRow = (t: MockTemplate) => {
  const { imageFile, ...rest } = t;
  return { ...rest, imageUrl: imageUrlOf(imageFile) };
};

// ---- templates ----

/** `push.default_locale`: the language every recall reason with an enabled template must have an enabled template in (contract 8.4). */
function defaultLocale(): string {
  const value = currentValue('push.default_locale');
  return typeof value === 'string' && value !== '' ? value : 'en';
}

/**
 * The supported languages in which a recall reason has no enabled template: the languages that
 * fall back to the default one. Whole list, not narrowed by the page (a14).
 */
function missingLocales(): Record<string, string[]> {
  return Object.fromEntries(
    RECALL_REASONS.map((reason) => [
      reason,
      pushState.supportedLocales.filter(
        (locale) =>
          !pushState.templates.some(
            (t) => t.triggerReason === reason && t.locale === locale && t.enabled,
          ),
      ),
    ]),
  );
}

/**
 * The one hard rule of contract 8.4 and its three refusals (a5): after the write, a recall reason
 * with an enabled template has an enabled template in the default language. `before` and `after`
 * are the template as it was and as it will be (null for a create, for a delete). A write that
 * touches no enabled template is not judged. Nothing is written when it throws.
 */
function enforceDefaultLanguage(before: MockTemplate | null, after: MockTemplate | null): void {
  if (!(before?.enabled || after?.enabled)) return;
  const lang = defaultLocale();
  const next = [...pushState.templates.filter((t) => t !== before), ...(after ? [after] : [])];
  const reasons = new Set([before?.triggerReason, after?.triggerReason]);
  for (const reason of reasons) {
    if (reason === undefined || !RECALL_REASONS.includes(reason)) continue;
    const enabled = next.filter((t) => t.triggerReason === reason && t.enabled);
    if (enabled.length === 0 || enabled.some((t) => t.locale === lang)) continue;
    const hadDefault =
      before?.enabled === true && before.triggerReason === reason && before.locale === lang;
    const movedAway = hadDefault && enabled.length === 1 && enabled[0] === after;
    const base = `${reason} needs an enabled template in ${lang} (the default language) while other languages are enabled`;
    const message = movedAway
      ? `${reason} would have no enabled template in ${lang}, the default language: keep this template in ${lang} and enabled, and create the other language as a new template`
      : hadDefault
        ? `${base}; disable the other languages of ${reason} first, or keep the ${lang} template enabled`
        : `${base}; enable or restore it first`;
    throw new MockHttpError(400, 'INVALID_REQUEST', message, { defaultLocale: lang, reason });
  }
}

function templateFields(body: Record<string, unknown>, details: Detail[]) {
  const title = words(body, 'title', details);
  const text = words(body, 'body', details);
  const target = link(body, details);
  const enabled = flag(body.enabled, 'enabled', details);
  return { title, body: text, ...target, enabled };
}

const idOf = (req: { params: Record<string, string> }) => req.params.id;

export default {
  // ---- the picture of a template, a task or a schedule ----
  'POST /api/admin/uploads/image': guard(['PUSH:TEMPLATE', 'PUSH:SEND'], () => {
    const upload = newUpload();
    return ok({ uploadId: upload.id, url: imageUrlOf(upload.file) });
  }),

  // ---- templates ----
  'GET /api/admin/push/templates': guard('PUSH:TEMPLATE', (req) => {
    const rows = [...pushState.templates].sort(
      (a, b) =>
        a.triggerReason.localeCompare(b.triggerReason) ||
        a.locale.localeCompare(b.locale) ||
        Number(a.id) - Number(b.id),
    );
    // The contract (a14) has no total; the default answer keeps it, a test can ask for the other shapes.
    if (pushState.templateList === 'unpaged-without-total') {
      return ok({ items: rows.map(templateRow), missingLocales: missingLocales() });
    }
    const page = paginateQuery(rows, req);
    return pushState.templateList === 'paged-without-total'
      ? ok({ items: page.items.map(templateRow), missingLocales: missingLocales() })
      : ok({
          items: page.items.map(templateRow),
          total: page.total,
          missingLocales: missingLocales(),
        });
  }),

  'POST /api/admin/push/templates': guard('PUSH:TEMPLATE', (req) => {
    const body = bodyOf(req);
    const details: Detail[] = [];
    const triggerReason = isText(body.triggerReason) ? body.triggerReason : '';
    if (!RECALL_REASONS.includes(triggerReason)) {
      details.push({ ref: 'triggerReason', reason: 'OUT_OF_RANGE' });
    }
    const locale = isText(body.locale) ? trimSpec(body.locale) : '';
    if (locale === '') details.push({ ref: 'locale', reason: 'EMPTY_NOT_ALLOWED' });
    const fields = templateFields(body, details);
    if (details.length > 0) throw fail(details);
    if (pushState.templates.some((t) => t.triggerReason === triggerReason && t.locale === locale)) {
      throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The template exists already', {
        field: 'locale',
      });
    }
    enforceDefaultLanguage(null, { id: '', triggerReason, locale, imageFile: null, ...fields });
    const picture = body.uploadId === undefined ? null : takeUpload(body.uploadId);
    const created: MockTemplate = {
      id: String(pushState.next.template++),
      triggerReason,
      locale,
      imageFile: picture,
      ...fields,
    };
    pushState.templates.push(created);
    return ok(templateRow(created));
  }),

  'PUT /api/admin/push/templates/:id': guard('PUSH:TEMPLATE', (req) => {
    const found = pushState.templates.find((t) => t.id === idOf(req));
    if (!found) throw notFound('template');
    const body = bodyOf(req);
    const details: Detail[] = [];
    const fields = templateFields(body, details);
    if (details.length > 0) throw fail(details);
    // The key may move too (the backend allows it; this page never sends it).
    const triggerReason = isText(body.triggerReason) ? body.triggerReason : found.triggerReason;
    const locale = isText(body.locale) ? trimSpec(body.locale) : found.locale;
    if (!RECALL_REASONS.includes(triggerReason)) {
      throw fail([{ ref: 'triggerReason', reason: 'OUT_OF_RANGE' }]);
    }
    if (locale === '') throw fail([{ ref: 'locale', reason: 'EMPTY_NOT_ALLOWED' }]);
    if (
      pushState.templates.some(
        (t) => t !== found && t.triggerReason === triggerReason && t.locale === locale,
      )
    ) {
      throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'The template exists already', {
        field: 'locale',
      });
    }
    enforceDefaultLanguage(found, { ...found, triggerReason, locale, ...fields });
    if (body.uploadId !== undefined) found.imageFile = takeUpload(body.uploadId);
    Object.assign(found, fields, { triggerReason, locale });
    return ok(templateRow(found));
  }),

  'DELETE /api/admin/push/templates/:id': guard('PUSH:TEMPLATE', (req) => {
    const at = pushState.templates.findIndex((t) => t.id === idOf(req));
    if (at < 0) throw notFound('template');
    enforceDefaultLanguage(pushState.templates[at], null);
    pushState.templates.splice(at, 1);
    return ok(null);
  }),

  // ---- manual tasks ----
  'GET /api/admin/push/tasks': guard('PUSH:SEND', (req) => {
    const rows = [...pushState.tasks].sort(
      (a, b) => b.scheduledAt.localeCompare(a.scheduledAt) || Number(b.id) - Number(a.id),
    );
    const page = paginateQuery(rows, req);
    return ok({ items: page.items.map(taskRow), total: page.total });
  }),

  'POST /api/admin/push/tasks': guard('PUSH:SEND', (req) => {
    const body = bodyOf(req);
    const details: Detail[] = [];
    const who = audience(body, details);
    const title = words(body, 'title', details);
    const text = words(body, 'body', details);
    const target = link(body, details);
    let scheduledAt = new Date().toISOString();
    if (body.scheduledAt !== undefined && body.scheduledAt !== null) {
      const parsed = isText(body.scheduledAt) ? Date.parse(body.scheduledAt) : Number.NaN;
      if (Number.isNaN(parsed)) details.push({ ref: 'scheduledAt', reason: 'OUT_OF_RANGE' });
      else scheduledAt = new Date(parsed).toISOString();
    }
    if (details.length > 0) throw fail(details);
    const imageFile = body.uploadId === undefined ? null : takeUpload(body.uploadId);
    const created: MockTask = {
      id: String(pushState.next.task++),
      createdBy: req.admin.id,
      ...who,
      title,
      body: text,
      ...target,
      imageFile,
      scheduledAt,
      scheduleId: null,
      status: 'PENDING',
      note: null,
      sentCount: 0,
      failedCount: 0,
    };
    pushState.tasks.push(created);
    return ok(taskRow(created));
  }),

  'POST /api/admin/push/tasks/:id/cancel': guard('PUSH:SEND', (req) => {
    const found = pushState.tasks.find((t) => t.id === idOf(req));
    if (!found) throw notFound('task');
    if (found.status !== 'PENDING') {
      throw new MockHttpError(
        409,
        'INVALID_STATE',
        'Only a task that has not started can be cancelled',
        {
          status: found.status,
        },
      );
    }
    found.status = 'CANCELLED';
    return ok(taskRow(found));
  }),

  // ---- periodic pushes ----
  'GET /api/admin/push/schedules': guard('PUSH:SEND', (req) => {
    const rows = [...pushState.schedules].sort((a, b) => Number(b.id) - Number(a.id));
    const page = paginateQuery(rows, req);
    return ok({ items: page.items.map(scheduleRow), total: page.total });
  }),

  'POST /api/admin/push/schedules': guard('PUSH:SEND', (req) => {
    const body = bodyOf(req);
    const details: Detail[] = [];
    const fields = readSchedule(body, details);
    if (details.length > 0) throw fail(details);
    const imageFile = body.uploadId === undefined ? null : takeUpload(body.uploadId);
    const created: MockSchedule = {
      id: String(pushState.next.schedule++),
      createdBy: req.admin.id,
      ...fields,
      imageFile,
      nextRunAt: null,
    };
    created.nextRunAt = nextRunAt(created);
    pushState.schedules.push(created);
    return ok(scheduleRow(created));
  }),

  'PUT /api/admin/push/schedules/:id': guard('PUSH:SEND', (req) => {
    const found = pushState.schedules.find((s) => s.id === idOf(req));
    if (!found) throw notFound('schedule');
    const body = bodyOf(req);
    const details: Detail[] = [];
    const fields = readSchedule(body, details);
    if (details.length > 0) throw fail(details);
    if (body.uploadId !== undefined) found.imageFile = takeUpload(body.uploadId);
    Object.assign(found, fields);
    found.nextRunAt = nextRunAt(found);
    return ok(scheduleRow(found));
  }),

  // Deactivates: the row stays (switched off), the tasks it made are kept.
  'DELETE /api/admin/push/schedules/:id': guard('PUSH:SEND', (req) => {
    const found = pushState.schedules.find((s) => s.id === idOf(req));
    if (!found) throw notFound('schedule');
    found.enabled = false;
    found.nextRunAt = null;
    return ok(scheduleRow(found));
  }),

  // ---- records ----
  'GET /api/admin/push/records': guard('PUSH:VIEW', (req) => {
    const rows = [...pushState.records].sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    );
    return ok(paginateQuery(rows, req));
  }),

  'GET /api/admin/push/records/:id': guard('PUSH:VIEW', (req) => {
    const found = pushState.records.find((r) => r.id === idOf(req));
    if (!found) throw notFound('record');
    return ok({ ...found, deliveries: pushState.deliveries.filter((d) => d.pushId === found.id) });
  }),
};

type ScheduleFields = Omit<MockSchedule, 'id' | 'createdBy' | 'imageFile' | 'nextRunAt'>;

function readSchedule(body: Record<string, unknown>, details: Detail[]): ScheduleFields {
  const repeat = body.repeat;
  if (!isText(repeat) || !REPEATS.includes(repeat)) {
    details.push({ ref: 'repeat', reason: 'OUT_OF_RANGE' });
  }
  const days = body.daysOfWeek;
  let daysOfWeek: number[] | null = null;
  if (repeat === 'WEEKLY') {
    if (!Array.isArray(days) || days.length === 0) {
      details.push({ ref: 'daysOfWeek', reason: 'EMPTY_NOT_ALLOWED' });
    } else if (days.some((d) => !isInt(d) || d < 1 || d > 7)) {
      details.push({ ref: 'daysOfWeek', reason: 'OUT_OF_RANGE' });
    } else {
      daysOfWeek = [...new Set(days as number[])].sort((a, b) => a - b);
    }
  } else if (days !== undefined && days !== null) {
    details.push({ ref: 'daysOfWeek', reason: 'OUT_OF_RANGE' });
  }
  let dayOfMonth: number | null = null;
  if (repeat === 'MONTHLY') {
    if (body.dayOfMonth === undefined || body.dayOfMonth === null) {
      details.push({ ref: 'dayOfMonth', reason: 'EMPTY_NOT_ALLOWED' });
    } else if (!isInt(body.dayOfMonth) || body.dayOfMonth < 1 || body.dayOfMonth > 31) {
      details.push({ ref: 'dayOfMonth', reason: 'OUT_OF_RANGE' });
    } else {
      dayOfMonth = body.dayOfMonth;
    }
  } else if (body.dayOfMonth !== undefined && body.dayOfMonth !== null) {
    details.push({ ref: 'dayOfMonth', reason: 'OUT_OF_RANGE' });
  }
  const timeOfDay = isText(body.timeOfDay) ? body.timeOfDay : '';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeOfDay)) {
    details.push({ ref: 'timeOfDay', reason: 'OUT_OF_RANGE' });
  }
  const timezone = isText(body.timezone) ? body.timezone : '';
  if (timezone === '' || !isTimeZone(timezone)) {
    details.push({ ref: 'timezone', reason: 'OUT_OF_RANGE' });
  }
  const startDate = isText(body.startDate) ? body.startDate : '';
  if (!validDay(startDate)) details.push({ ref: 'startDate', reason: 'OUT_OF_RANGE' });
  let endDate: string | null = null;
  if (body.endDate !== undefined && body.endDate !== null) {
    if (!isText(body.endDate) || !validDay(body.endDate) || body.endDate < startDate) {
      details.push({ ref: 'endDate', reason: 'OUT_OF_RANGE' });
    } else {
      endDate = body.endDate;
    }
  }
  const enabled = flag(body.enabled, 'enabled', details);
  const who = audience(body, details);
  const title = words(body, 'title', details);
  const text = words(body, 'body', details);
  const target = link(body, details);
  return {
    repeat: (repeat ?? 'DAILY') as MockSchedule['repeat'],
    daysOfWeek,
    dayOfMonth,
    timeOfDay,
    timezone,
    startDate,
    endDate,
    enabled,
    ...who,
    title,
    body: text,
    ...target,
  };
}
