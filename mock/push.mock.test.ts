import { beforeEach, describe, expect, it } from 'vitest';
import { resetConfigStore, saved } from './_core/configStore';
import { nextRunAt, pushState, resetPushStore } from './_core/pushData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import push from './push.mock';

beforeEach(() => {
  resetStore();
  resetConfigStore();
  resetPushStore();
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (push as unknown as Record<string, H>)[name];
const token = (user: string) => bearer(issueToken(adminOf(user)).token).authorization;

const get = (name: string, query: Record<string, unknown> = {}, params = {}, user = 'root') =>
  call(h(name), { headers: { authorization: token(user) }, query, params });
const send = (name: string, body: unknown, params = {}, user = 'root') =>
  call(h(name), { headers: { authorization: token(user) }, body, params });

const TEMPLATES = 'GET /api/admin/push/templates';
const TEMPLATE_CREATE = 'POST /api/admin/push/templates';
const TEMPLATE_UPDATE = 'PUT /api/admin/push/templates/:id';
const TEMPLATE_DELETE = 'DELETE /api/admin/push/templates/:id';
const TASKS = 'GET /api/admin/push/tasks';
const TASK_CREATE = 'POST /api/admin/push/tasks';
const TASK_CANCEL = 'POST /api/admin/push/tasks/:id/cancel';
const SCHEDULES = 'GET /api/admin/push/schedules';
const SCHEDULE_CREATE = 'POST /api/admin/push/schedules';
const SCHEDULE_UPDATE = 'PUT /api/admin/push/schedules/:id';
const SCHEDULE_DELETE = 'DELETE /api/admin/push/schedules/:id';
const RECORDS = 'GET /api/admin/push/records';
const RECORD = 'GET /api/admin/push/records/:id';
const UPLOAD = 'POST /api/admin/uploads/image';

const upload = async () => (await send(UPLOAD, undefined)).body.data.uploadId as string;

const template = (over: Record<string, unknown> = {}) => ({
  triggerReason: 'streak_at_risk',
  locale: 'en',
  title: 'Keep your streak',
  body: 'Come back today',
  linkType: 'NONE',
  linkTarget: '',
  enabled: false,
  ...over,
});

const task = (over: Record<string, unknown> = {}) => ({
  audience: 'ALL',
  title: 'News',
  body: 'Something new',
  linkType: 'NONE',
  linkTarget: '',
  ...over,
});

const schedule = (over: Record<string, unknown> = {}) => ({
  repeat: 'DAILY',
  timeOfDay: '09:30',
  timezone: 'UTC',
  startDate: '2026-01-01',
  endDate: null,
  enabled: true,
  audience: 'ALL',
  title: 'Daily',
  body: 'Hello',
  linkType: 'NONE',
  linkTarget: '',
  ...over,
});

describe('permissions (contract 17.4, the 推送管理 row)', () => {
  const cases: [string, string][] = [
    [TEMPLATES, 'PUSH:TEMPLATE'],
    [TEMPLATE_CREATE, 'PUSH:TEMPLATE'],
    [TASKS, 'PUSH:SEND'],
    [TASK_CREATE, 'PUSH:SEND'],
    [SCHEDULES, 'PUSH:SEND'],
    [SCHEDULE_CREATE, 'PUSH:SEND'],
    [RECORDS, 'PUSH:VIEW'],
    [UPLOAD, 'PUSH:TEMPLATE or PUSH:SEND'],
  ];
  it.each(cases)('%s answers 403 ADMIN_FORBIDDEN for an administrator without %s', async (name) => {
    const r = await get(name, {}, {}, 'support');
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('ADMIN_FORBIDDEN');
  });

  it('answers 401 without a token', async () => {
    const r = await call(h(TEMPLATES), {});
    expect(r.status).toBe(401);
  });
});

describe('the sample data', () => {
  it('has templates in several languages, a recall reason that lacks one, tasks of every state and records with deliveries', () => {
    const locales = new Set(pushState.templates.map((t) => t.locale));
    for (const l of ['en', 'th', 'ar', 'id', 'vi', 'es', 'zh-Hans'])
      expect(locales.has(l)).toBe(true);
    const has = (reason: string, locale: string) =>
      pushState.templates.some((t) => t.triggerReason === reason && t.locale === locale);
    expect(has('daily_recall', 'en')).toBe(true);
    expect(has('streak_at_risk', 'en')).toBe(false);
    expect(new Set(pushState.tasks.map((t) => t.status))).toEqual(
      new Set(['PENDING', 'RUNNING', 'DONE', 'CANCELLED']),
    );
    expect(pushState.records.length).toBeGreaterThan(25);
    expect(pushState.deliveries.length).toBeGreaterThan(pushState.records.length);
  });
});

describe('templates', () => {
  it('lists with the paging and answers 400 for a page size beyond 200', async () => {
    const r = await get(TEMPLATES, { page: '1', pageSize: '5' });
    expect(r.body.data.items).toHaveLength(5);
    expect(r.body.data.total).toBe(pushState.templates.length);
    const bad = await get(TEMPLATES, { pageSize: '201' });
    expect(bad.status).toBe(400);
    expect(bad.body.data.details).toEqual([{ ref: 'pageSize', reason: 'OUT_OF_RANGE' }]);
  });

  it('creates a template, takes the address from the upload and ignores an address in the body', async () => {
    const id = await upload();
    const r = await send(
      TEMPLATE_CREATE,
      template({ imageUploadId: id, imageUrl: 'https://evil.example/x.png' }),
    );
    expect(r.status).toBe(200);
    expect(r.body.data.imageUrl).toMatch(/mock-files/);
    expect(r.body.data.imageUrl).not.toContain('evil');
    expect(r.body.data.enabled).toBe(false);
    const list = await get(TEMPLATES, { pageSize: '200' });
    expect(list.body.data.items.some((t: { id: string }) => t.id === r.body.data.id)).toBe(true);
  });

  it('refuses a reason that has no templates (admin, system_event) and a made-up one', async () => {
    for (const reason of ['admin', 'system_event', 'nope']) {
      const r = await send(TEMPLATE_CREATE, template({ triggerReason: reason }));
      expect(r.status, reason).toBe(400);
      expect(r.body.data.details).toEqual([{ ref: 'triggerReason', reason: 'OUT_OF_RANGE' }]);
    }
  });

  it('answers 409 DUPLICATE_RESOURCE for a second template of the same reason and language', async () => {
    const first = pushState.templates[0];
    const r = await send(
      TEMPLATE_CREATE,
      template({ triggerReason: first.triggerReason, locale: first.locale }),
    );
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('DUPLICATE_RESOURCE');
    expect(r.body.data).toEqual({ field: 'locale' });
  });

  it('checks the words, the link and the upload', async () => {
    const empty = await send(
      TEMPLATE_CREATE,
      template({ title: ` ${String.fromCharCode(0x3000)} `, body: '' }),
    );
    expect(empty.body.data.details).toEqual([
      { ref: 'title', reason: 'EMPTY_NOT_ALLOWED' },
      { ref: 'body', reason: 'EMPTY_NOT_ALLOWED' },
    ]);
    const screen = await send(
      TEMPLATE_CREATE,
      template({ linkType: 'SCREEN', linkTarget: 'nowhere' }),
    );
    expect(screen.body.data.details).toEqual([{ ref: 'linkTarget', reason: 'OUT_OF_RANGE' }]);
    const url = await send(
      TEMPLATE_CREATE,
      template({ linkType: 'URL', linkTarget: 'http://x.example/' }),
    );
    expect(url.body.data.details).toEqual([{ ref: 'linkTarget', reason: 'NOT_HTTPS' }]);
    const none = await send(TEMPLATE_CREATE, template({ linkType: 'NONE', linkTarget: 'store' }));
    expect(none.body.data.details).toEqual([{ ref: 'linkTarget', reason: 'OUT_OF_RANGE' }]);
    const missing = await send(TEMPLATE_CREATE, template({ imageUploadId: 'nope' }));
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('uses an upload once: the second use is 409 INVALID_STATE', async () => {
    const id = await upload();
    expect((await send(TEMPLATE_CREATE, template({ imageUploadId: id }))).status).toBe(200);
    const again = await send(TEMPLATE_CREATE, template({ locale: 'fr', imageUploadId: id }));
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('INVALID_STATE');
  });

  describe('the list tells which supported languages have no enabled template (a14)', () => {
    it('answers missingLocales for both recall reasons, in the order of the supported languages, next to items and total', async () => {
      const r = await get(TEMPLATES, { page: '1', pageSize: '5' });
      expect(Object.keys(r.body.data).sort()).toEqual(['items', 'missingLocales', 'total']);
      expect(r.body.data.missingLocales).toEqual({
        // daily_recall has an enabled template in each of the seven languages
        daily_recall: [],
        // streak_at_risk has none enabled: the whole list
        streak_at_risk: pushState.supportedLocales,
      });
    });

    it('counts a template that is off as missing, follows a change, and does not depend on the page or the other reason', async () => {
      const daily = (locale: string) =>
        pushState.templates.find((t) => t.triggerReason === 'daily_recall' && t.locale === locale);
      const th = daily('th');
      if (!th) throw new Error('no sample');
      th.enabled = false;
      const page2 = await get(TEMPLATES, { page: '2', pageSize: '3' });
      expect(page2.body.data.missingLocales.daily_recall).toEqual(['th']);
      pushState.supportedLocales = ['th', 'fr', 'en'];
      const again = await get(TEMPLATES, { pageSize: '200' });
      expect(again.body.data.missingLocales).toEqual({
        daily_recall: ['th', 'fr'],
        streak_at_risk: ['th', 'fr', 'en'],
      });
    });
  });

  describe('the rule of the default language (a5, e1): a reason with an enabled template needs an enabled one in push.default_locale', () => {
    const update = (over: Record<string, unknown> = {}) => ({
      title: 'x',
      body: 'y',
      linkType: 'NONE',
      linkTarget: '',
      enabled: true,
      ...over,
    });
    const find = (reason: string, locale: string) => {
      const found = pushState.templates.find(
        (t) => t.triggerReason === reason && t.locale === locale,
      );
      if (!found) throw new Error(`no sample ${reason} ${locale}`);
      return found;
    };
    const refusal = (r: {
      status: number;
      body: { code: string; message: string; data: unknown };
    }) => {
      expect([r.status, r.body.code]).toEqual([400, 'INVALID_REQUEST']);
      return r.body;
    };

    it('refuses to create or switch on a template of another language while the reason has none enabled in the default language, with the data of the rule and not the old missingLocales', async () => {
      const th = find('streak_at_risk', 'th');
      const switchOn = refusal(await send(TEMPLATE_UPDATE, update(), { id: th.id }));
      expect(switchOn.data).toEqual({ defaultLocale: 'en', reason: 'streak_at_risk' });
      expect(switchOn.message).toBe(
        'streak_at_risk needs an enabled template in en (the default language) while other languages are enabled; enable or restore it first',
      );
      const before = pushState.templates.length;
      const created = refusal(
        await send(TEMPLATE_CREATE, template({ locale: 'vi', enabled: true })),
      );
      expect(created.data).toEqual({ defaultLocale: 'en', reason: 'streak_at_risk' });
      expect(pushState.templates).toHaveLength(before);
      expect(th.enabled).toBe(false);
    });

    it('accepts the default language first and the others in any order, and a disabled template of any language at any time', async () => {
      expect((await send(TEMPLATE_CREATE, template({ locale: 'vi', enabled: false }))).status).toBe(
        200,
      );
      expect((await send(TEMPLATE_CREATE, template({ enabled: true }))).status).toBe(200);
      expect(
        (await send(TEMPLATE_UPDATE, update(), { id: find('streak_at_risk', 'th').id })).status,
      ).toBe(200);
      expect((await send(TEMPLATE_CREATE, template({ locale: 'ar', enabled: true }))).status).toBe(
        200,
      );
    });

    it('does not ask for every supported language: a language outside the list and one the list lacks are both free', async () => {
      pushState.supportedLocales = ['en', 'vi'];
      expect((await send(TEMPLATE_CREATE, template({ enabled: true }))).status).toBe(200);
      expect((await send(TEMPLATE_CREATE, template({ locale: 'fr', enabled: true }))).status).toBe(
        200,
      );
    });

    it('refuses to switch off or delete the default-language template while other languages are on, and says what to do', async () => {
      const en = find('daily_recall', 'en');
      const off = refusal(await send(TEMPLATE_UPDATE, update({ enabled: false }), { id: en.id }));
      expect(off.data).toEqual({ defaultLocale: 'en', reason: 'daily_recall' });
      expect(off.message).toBe(
        'daily_recall needs an enabled template in en (the default language) while other languages are enabled; disable the other languages of daily_recall first, or keep the en template enabled',
      );
      const del = refusal(await send(TEMPLATE_DELETE, {}, { id: en.id }));
      expect(del.message).toBe(off.message);
      expect(pushState.templates.includes(en)).toBe(true);
      expect(en.enabled).toBe(true);
    });

    it('lets the last enabled template of a reason go, the default language one last', async () => {
      for (const t of pushState.templates) {
        if (t.triggerReason === 'daily_recall' && t.locale !== 'en') {
          expect(
            (await send(TEMPLATE_UPDATE, update({ enabled: false }), { id: t.id })).status,
          ).toBe(200);
        }
      }
      const en = find('daily_recall', 'en');
      expect((await send(TEMPLATE_UPDATE, update({ enabled: false }), { id: en.id })).status).toBe(
        200,
      );
    });

    it('lets any other language be switched off, edited and deleted at any time', async () => {
      const ar = find('daily_recall', 'ar');
      expect((await send(TEMPLATE_UPDATE, update({ title: 'ก' }), { id: ar.id })).status).toBe(200);
      expect((await send(TEMPLATE_UPDATE, update({ enabled: false }), { id: ar.id })).status).toBe(
        200,
      );
      expect((await send(TEMPLATE_DELETE, {}, { id: find('daily_recall', 'vi').id })).status).toBe(
        200,
      );
    });

    it('does not judge a template that is off before and after, even in a reason that breaks the rule', async () => {
      find('daily_recall', 'en').enabled = false;
      const off = find('daily_recall', 'ar');
      off.enabled = false;
      expect(
        (await send(TEMPLATE_UPDATE, update({ title: 'Renamed', enabled: false }), { id: off.id }))
          .status,
      ).toBe(200);
      expect((await send(TEMPLATE_DELETE, {}, { id: off.id })).status).toBe(200);
    });

    it('refuses to move the only enabled template of a reason, the default one, to another language, with the third message', async () => {
      pushState.templates = pushState.templates.filter(
        (t) => !(t.triggerReason === 'daily_recall' && t.locale !== 'en'),
      );
      const en = find('daily_recall', 'en');
      const moved = refusal(await send(TEMPLATE_UPDATE, update({ locale: 'th' }), { id: en.id }));
      expect(moved.data).toEqual({ defaultLocale: 'en', reason: 'daily_recall' });
      expect(moved.message).toBe(
        'daily_recall would have no enabled template in en, the default language: keep this template in en and enabled, and create the other language as a new template',
      );
      expect(en.locale).toBe('en');
    });

    it('judges the old reason too when a template changes its reason', async () => {
      const refused = refusal(
        await send(TEMPLATE_UPDATE, update({ triggerReason: 'streak_at_risk' }), {
          id: find('daily_recall', 'en').id,
        }),
      );
      expect(refused.data).toMatchObject({ defaultLocale: 'en' });
    });

    it('takes the default language from push.default_locale', async () => {
      saved.set('push.default_locale', {
        value: 'th',
        updatedAt: '2026-10-26T10:00:00Z',
        updatedBy: '1',
        updatedByUsername: 'root',
      });
      const en = find('daily_recall', 'en');
      // en is no longer the default one: it can go; th is.
      expect((await send(TEMPLATE_UPDATE, update({ enabled: false }), { id: en.id })).status).toBe(
        200,
      );
      const th = refusal(
        await send(TEMPLATE_UPDATE, update({ enabled: false }), {
          id: find('daily_recall', 'th').id,
        }),
      );
      expect(th.data).toEqual({ defaultLocale: 'th', reason: 'daily_recall' });
    });

    it('does not use the upload of a refused write', async () => {
      const id = await upload();
      refusal(
        await send(TEMPLATE_UPDATE, update({ imageUploadId: id }), {
          id: find('streak_at_risk', 'th').id,
        }),
      );
      expect(pushState.uploads.get(id)?.used).toBe(false);
    });
  });

  it('updates, answers 404 for an unknown template and deletes', async () => {
    // Not the default-language template of daily_recall: that one stays while other languages are on.
    const sample = pushState.templates.find(
      (t) => t.triggerReason === 'daily_recall' && t.locale === 'ar',
    ) as (typeof pushState.templates)[number];
    const id = sample.id;
    const r = await send(
      TEMPLATE_UPDATE,
      {
        title: 'New title',
        body: 'New body',
        linkType: 'NONE',
        linkTarget: '',
        enabled: sample.enabled,
      },
      { id },
    );
    expect(r.body.data.title).toBe('New title');
    expect((await send(TEMPLATE_UPDATE, template(), { id: 'zzz' })).status).toBe(404);
    expect((await send(TEMPLATE_DELETE, undefined, { id })).status).toBe(200);
    expect(pushState.templates.some((t) => t.id === id)).toBe(false);
    expect((await send(TEMPLATE_DELETE, undefined, { id })).status).toBe(404);
  });
});

describe('tasks', () => {
  it('lists newest first with the name of the creator, and null for a creator who was deleted', async () => {
    const r = await get(TASKS, { pageSize: '200' });
    const times = r.body.data.items.map((t: { scheduledAt: string }) => t.scheduledAt);
    expect(times).toEqual([...times].sort().reverse());
    expect(
      r.body.data.items.some(
        (t: { createdByUsername: string | null }) => t.createdByUsername === null,
      ),
    ).toBe(true);
    expect(
      r.body.data.items.some(
        (t: { createdByUsername: string | null }) => t.createdByUsername === 'root',
      ),
    ).toBe(true);
  });

  it('creates a task that goes out at once, as PENDING, with scheduledAt set by the backend', async () => {
    const before = Date.now();
    const r = await send(TASK_CREATE, task());
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('PENDING');
    expect(r.body.data.sentCount).toBe(0);
    expect(Date.parse(r.body.data.scheduledAt)).toBeGreaterThanOrEqual(before - 1000);
    expect(r.body.data.createdByUsername).toBe('root');
  });

  it('keeps a given time, and refuses a time that is not an instant', async () => {
    const r = await send(TASK_CREATE, task({ scheduledAt: '2030-01-01T10:00:00.000Z' }));
    expect(r.body.data.scheduledAt).toBe('2030-01-01T10:00:00.000Z');
    const bad = await send(TASK_CREATE, task({ scheduledAt: 'tomorrow' }));
    expect(bad.body.data.details).toEqual([{ ref: 'scheduledAt', reason: 'OUT_OF_RANGE' }]);
  });

  it('refuses platforms or languages together with an account list, and needs the list', async () => {
    const withPlatforms = await send(
      TASK_CREATE,
      task({ audience: 'ACCOUNT_IDS', accountIds: ['a'], platforms: ['IOS'] }),
    );
    expect(withPlatforms.status).toBe(400);
    expect(withPlatforms.body.data.details).toEqual([{ ref: 'platforms', reason: 'OUT_OF_RANGE' }]);
    const withLocales = await send(
      TASK_CREATE,
      task({ audience: 'ACCOUNT_IDS', accountIds: ['a'], locales: ['en'] }),
    );
    expect(withLocales.body.data.details).toEqual([{ ref: 'locales', reason: 'OUT_OF_RANGE' }]);
    const noList = await send(TASK_CREATE, task({ audience: 'ACCOUNT_IDS', accountIds: [] }));
    expect(noList.body.data.details).toEqual([{ ref: 'accountIds', reason: 'EMPTY_NOT_ALLOWED' }]);
    const ok = await send(TASK_CREATE, task({ audience: 'ACCOUNT_IDS', accountIds: ['a', 'b'] }));
    expect(ok.status).toBe(200);
    expect(ok.body.data.accountIds).toEqual(['a', 'b']);
  });

  it('refuses an unknown audience, platform and an account list on another audience', async () => {
    expect((await send(TASK_CREATE, task({ audience: 'EVERYONE' }))).body.data.details).toEqual([
      { ref: 'audience', reason: 'OUT_OF_RANGE' },
    ]);
    expect((await send(TASK_CREATE, task({ platforms: ['WEB'] }))).body.data.details).toEqual([
      { ref: 'platforms', reason: 'OUT_OF_RANGE' },
    ]);
    expect((await send(TASK_CREATE, task({ accountIds: ['a'] }))).body.data.details).toEqual([
      { ref: 'accountIds', reason: 'OUT_OF_RANGE' },
    ]);
  });

  it('cancels only a PENDING task: 409 INVALID_STATE with the current status for the others, 404 for an unknown one', async () => {
    const pending = pushState.tasks.find((t) => t.status === 'PENDING');
    const running = pushState.tasks.find((t) => t.status === 'RUNNING');
    expect(pending && running).toBeTruthy();
    const refused = await send(TASK_CANCEL, undefined, { id: (running as { id: string }).id });
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('INVALID_STATE');
    expect(refused.body.data).toEqual({ status: 'RUNNING' });
    const ok = await send(TASK_CANCEL, undefined, { id: (pending as { id: string }).id });
    expect(ok.status).toBe(200);
    expect(pushState.tasks.find((t) => t.id === pending?.id)?.status).toBe('CANCELLED');
    expect(
      (await send(TASK_CANCEL, undefined, { id: (pending as { id: string }).id })).status,
    ).toBe(409);
    expect((await send(TASK_CANCEL, undefined, { id: 'zzz' })).status).toBe(404);
  });
});

describe('schedules', () => {
  it('lists with nextRunAt, and creates one with the next time computed', async () => {
    const list = await get(SCHEDULES, { pageSize: '200' });
    expect(list.body.data.items.length).toBeGreaterThan(2);
    const r = await send(SCHEDULE_CREATE, schedule());
    expect(r.status).toBe(200);
    expect(r.body.data.nextRunAt).toMatch(/T09:30:00\.000Z$/);
    expect(r.body.data.createdByUsername).toBe('root');
    expect(r.body.data.daysOfWeek).toBeNull();
  });

  it('needs the days for a weekly schedule and the day for a monthly one, and refuses them on a daily one', async () => {
    expect((await send(SCHEDULE_CREATE, schedule({ repeat: 'WEEKLY' }))).body.data.details).toEqual(
      [{ ref: 'daysOfWeek', reason: 'EMPTY_NOT_ALLOWED' }],
    );
    expect(
      (await send(SCHEDULE_CREATE, schedule({ repeat: 'WEEKLY', daysOfWeek: [0, 8] }))).body.data
        .details,
    ).toEqual([{ ref: 'daysOfWeek', reason: 'OUT_OF_RANGE' }]);
    expect(
      (await send(SCHEDULE_CREATE, schedule({ repeat: 'MONTHLY' }))).body.data.details,
    ).toEqual([{ ref: 'dayOfMonth', reason: 'EMPTY_NOT_ALLOWED' }]);
    expect(
      (await send(SCHEDULE_CREATE, schedule({ repeat: 'MONTHLY', dayOfMonth: 32 }))).body.data
        .details,
    ).toEqual([{ ref: 'dayOfMonth', reason: 'OUT_OF_RANGE' }]);
    expect((await send(SCHEDULE_CREATE, schedule({ daysOfWeek: [1] }))).body.data.details).toEqual([
      { ref: 'daysOfWeek', reason: 'OUT_OF_RANGE' },
    ]);
  });

  it('checks the time, the time zone and the dates', async () => {
    expect((await send(SCHEDULE_CREATE, schedule({ timeOfDay: '9:5' }))).body.data.details).toEqual(
      [{ ref: 'timeOfDay', reason: 'OUT_OF_RANGE' }],
    );
    expect(
      (await send(SCHEDULE_CREATE, schedule({ timeOfDay: '24:00' }))).body.data.details,
    ).toEqual([{ ref: 'timeOfDay', reason: 'OUT_OF_RANGE' }]);
    expect(
      (await send(SCHEDULE_CREATE, schedule({ timezone: 'Mars/Base' }))).body.data.details,
    ).toEqual([{ ref: 'timezone', reason: 'OUT_OF_RANGE' }]);
    expect(
      (await send(SCHEDULE_CREATE, schedule({ startDate: '2026-02-30' }))).body.data.details,
    ).toEqual([{ ref: 'startDate', reason: 'OUT_OF_RANGE' }]);
    expect(
      (await send(SCHEDULE_CREATE, schedule({ startDate: '2026-05-02', endDate: '2026-05-01' })))
        .body.data.details,
    ).toEqual([{ ref: 'endDate', reason: 'OUT_OF_RANGE' }]);
  });

  it('updates, switches off and deactivates: the row stays, with enabled false and no next time, and its tasks are kept', async () => {
    const created = await send(SCHEDULE_CREATE, schedule());
    const id = created.body.data.id as string;
    const tasksBefore = pushState.tasks.length;
    const updated = await send(
      SCHEDULE_UPDATE,
      schedule({ title: 'Changed', timeOfDay: '10:00' }),
      { id },
    );
    expect(updated.body.data.title).toBe('Changed');
    expect(updated.body.data.nextRunAt).toMatch(/T10:00:00\.000Z$/);
    const off = await send(SCHEDULE_UPDATE, schedule({ enabled: false }), { id });
    expect(off.body.data.enabled).toBe(false);
    expect(off.body.data.nextRunAt).toBeNull();
    await send(SCHEDULE_UPDATE, schedule({ enabled: true }), { id });
    const removed = await send(SCHEDULE_DELETE, undefined, { id });
    expect(removed.status).toBe(200);
    const row = pushState.schedules.find((s) => s.id === id);
    expect(row?.enabled).toBe(false);
    expect(row?.nextRunAt).toBeNull();
    expect(pushState.tasks).toHaveLength(tasksBefore);
    expect((await send(SCHEDULE_UPDATE, schedule(), { id: 'zzz' })).status).toBe(404);
    expect((await send(SCHEDULE_DELETE, undefined, { id: 'zzz' })).status).toBe(404);
  });
});

describe('nextRunAt', () => {
  const from = new Date('2026-10-26T12:00:00.000Z');
  const base = {
    id: '1',
    createdBy: null,
    createdByUsername: null,
    daysOfWeek: null as number[] | null,
    dayOfMonth: null as number | null,
    enabled: true,
    audience: 'ALL' as const,
    accountIds: null,
    platforms: null,
    locales: null,
    title: 't',
    body: 'b',
    linkType: 'NONE' as const,
    linkTarget: null,
    imageFile: null,
    nextRunAt: null,
    startDate: '2026-01-01',
    endDate: null as string | null,
  };

  it('takes today when the time has not passed in the zone, else tomorrow', () => {
    expect(nextRunAt({ ...base, repeat: 'DAILY', timeOfDay: '13:00', timezone: 'UTC' }, from)).toBe(
      '2026-10-26T13:00:00.000Z',
    );
    expect(nextRunAt({ ...base, repeat: 'DAILY', timeOfDay: '11:00', timezone: 'UTC' }, from)).toBe(
      '2026-10-27T11:00:00.000Z',
    );
  });

  it('reads the time in the time zone of the schedule (UTC+7 has no daylight saving time)', () => {
    expect(
      nextRunAt({ ...base, repeat: 'DAILY', timeOfDay: '09:00', timezone: 'Asia/Bangkok' }, from),
    ).toBe('2026-10-27T02:00:00.000Z');
  });

  it('finds the next chosen weekday (Monday is 1)', () => {
    // 2026-10-26 is a Monday; 12:00Z is after 09:00 UTC, so the next Monday is a week on.
    expect(
      nextRunAt(
        { ...base, repeat: 'WEEKLY', daysOfWeek: [1], timeOfDay: '09:00', timezone: 'UTC' },
        from,
      ),
    ).toBe('2026-11-02T09:00:00.000Z');
    expect(
      nextRunAt(
        { ...base, repeat: 'WEEKLY', daysOfWeek: [3, 5], timeOfDay: '09:00', timezone: 'UTC' },
        from,
      ),
    ).toBe('2026-10-28T09:00:00.000Z');
  });

  it('uses the last day of a month that is too short for the chosen day', () => {
    expect(
      nextRunAt(
        { ...base, repeat: 'MONTHLY', dayOfMonth: 31, timeOfDay: '08:00', timezone: 'UTC' },
        new Date('2026-11-01T00:00:00.000Z'),
      ),
    ).toBe('2026-11-30T08:00:00.000Z');
    expect(
      nextRunAt(
        { ...base, repeat: 'MONTHLY', dayOfMonth: 31, timeOfDay: '08:00', timezone: 'UTC' },
        new Date('2027-02-01T00:00:00.000Z'),
      ),
    ).toBe('2027-02-28T08:00:00.000Z');
  });

  it('starts at the start date, stops after the end date, and is null when switched off', () => {
    expect(
      nextRunAt(
        { ...base, repeat: 'DAILY', timeOfDay: '09:00', timezone: 'UTC', startDate: '2026-12-01' },
        from,
      ),
    ).toBe('2026-12-01T09:00:00.000Z');
    expect(
      nextRunAt(
        { ...base, repeat: 'DAILY', timeOfDay: '09:00', timezone: 'UTC', endDate: '2026-10-26' },
        from,
      ),
    ).toBeNull();
    expect(
      nextRunAt(
        { ...base, repeat: 'DAILY', timeOfDay: '13:00', timezone: 'UTC', enabled: false },
        from,
      ),
    ).toBeNull();
  });
});

describe('records', () => {
  it('lists newest first with the paging', async () => {
    const r = await get(RECORDS, { page: '1', pageSize: '10' });
    expect(r.body.data.items).toHaveLength(10);
    expect(r.body.data.total).toBe(pushState.records.length);
    const times = r.body.data.items.map((x: { createdAt: string }) => x.createdAt);
    expect(times).toEqual([...times].sort().reverse());
    expect(Object.keys(r.body.data.items[0]).sort()).toEqual(
      ['accountId', 'createdAt', 'id', 'localDate', 'pushType', 'triggerReason'].sort(),
    );
  });

  it('gives the result for each token of a record, and 404 for an unknown record', async () => {
    const withMany = pushState.records.find(
      (rec) => pushState.deliveries.filter((d) => d.pushId === rec.id).length >= 2,
    );
    const r = await get(RECORD, {}, { id: (withMany as { id: string }).id });
    expect(r.body.data.deliveries.length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(r.body.data.deliveries[0]).sort()).toEqual(
      ['id', 'pushId', 'pushTokenId', 'result', 'sentAt'].sort(),
    );
    const results = new Set(pushState.deliveries.map((d) => d.result));
    expect(results).toEqual(new Set(['ACCEPTED', 'INVALID_TOKEN', 'FAILED']));
    expect((await get(RECORD, {}, { id: 'zzz' })).status).toBe(404);
  });
});

describe('the upload', () => {
  it('hands out an id and an address, for PUSH:TEMPLATE and for PUSH:SEND alike', async () => {
    const r = await send(UPLOAD, undefined);
    expect(r.status).toBe(200);
    expect(typeof r.body.data.uploadId).toBe('string');
  });
});
