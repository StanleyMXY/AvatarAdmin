import { beforeEach, describe, expect, it } from 'vitest';
import { notificationsState, resetNotificationsStore } from './_core/notificationsData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import { USER, usersState } from './_core/usersData';
import notifications from './notifications.mock';

beforeEach(() => {
  resetStore();
  resetNotificationsStore();
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (notifications as unknown as Record<string, H>)[name];
const token = (user: string) => bearer(issueToken(adminOf(user)).token).authorization;

const LIST = 'GET /api/admin/notifications';
const ONE = 'GET /api/admin/notifications/:id';
const SEND = 'POST /api/admin/notifications/send';

const get = (name: string, query: Record<string, unknown> = {}, params = {}, user = 'root') =>
  call(h(name), { headers: { authorization: token(user) }, query, params });
const send = (body: unknown, user = 'root') =>
  call(h(SEND), { headers: { authorization: token(user) }, body });

const body = (over: Record<string, unknown> = {}) => ({
  accountIds: [USER.rich],
  titleI18n: { en: 'Hello' },
  bodyI18n: { en: 'A message' },
  push: false,
  ...over,
});
const detailsOf = (answer: Awaited<ReturnType<typeof send>>) =>
  answer.body.data.details as { ref: string; reason: string }[];

describe('the list', () => {
  it('is answered to NOTIFICATION:VIEW only, newest first, with the fields of the contract', async () => {
    expect((await get(LIST, {}, {}, 'finance')).status).toBe(403);
    const answer = await get(LIST);
    expect(answer.status).toBe(200);
    const items = answer.body.data.items as Record<string, unknown>[];
    expect(items.length).toBe(20);
    expect(answer.body.data.total).toBe(notificationsState.rows.length);
    expect(Object.keys(items[0]).sort()).toEqual(
      [
        'id',
        'accountId',
        'category',
        'title',
        'isRead',
        'linkType',
        'linkTarget',
        'sentBy',
        'sentByUsername',
        'createdAt',
      ].sort(),
    );
    const times = items.map((i) => i.createdAt as string);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('filters by account, category, read state and time range, and pages with the usual limits', async () => {
    const one = notificationsState.rows[0];
    const byAccount = await get(LIST, { accountId: one.accountId, pageSize: '200' });
    for (const row of byAccount.body.data.items) expect(row.accountId).toBe(one.accountId);
    const system = await get(LIST, { category: 'SYSTEM_EVENT', pageSize: '200' });
    expect(system.body.data.items.length).toBeGreaterThan(0);
    for (const row of system.body.data.items) expect(row.category).toBe('SYSTEM_EVENT');
    const unread = await get(LIST, { isRead: 'false', pageSize: '200' });
    for (const row of unread.body.data.items) expect(row.isRead).toBe(false);
    const read = await get(LIST, { isRead: 'true', pageSize: '200' });
    expect(unread.body.data.total + read.body.data.total).toBe(notificationsState.rows.length);
    const newest = [...notificationsState.rows].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1,
    )[0];
    const ranged = await get(LIST, { from: newest.createdAt, pageSize: '200' });
    expect(ranged.body.data.items.map((r: { id: string }) => r.id)).toContain(newest.id);
    const before = await get(LIST, { to: newest.createdAt, pageSize: '200' });
    expect(before.body.data.items.map((r: { id: string }) => r.id)).not.toContain(newest.id);
    const bad = await get(LIST, { pageSize: '201' });
    expect(bad.status).toBe(400);
    expect(bad.body.data.details).toEqual([{ ref: 'pageSize', reason: 'OUT_OF_RANGE' }]);
  });

  it('gives the English title: the en entry for ADMIN, the rendered English text for SYSTEM_EVENT; the sender name is null for the system', async () => {
    const answer = await get(LIST, { pageSize: '200' });
    for (const row of answer.body.data.items) {
      const source = notificationsState.rows.find((r) => r.id === row.id);
      if (row.category === 'ADMIN') {
        expect(row.title).toBe(source?.titleI18n?.en);
        expect(row.sentByUsername).toBe('root');
      } else {
        expect(row.title.length).toBeGreaterThan(0);
        expect(row.sentBy).toBeNull();
        expect(row.sentByUsername).toBeNull();
      }
    }
  });

  it('has the seven languages and long text in the sample data', () => {
    const titles = notificationsState.rows.flatMap((r) => Object.values(r.titleI18n ?? {}));
    expect(titles.some((t) => /\p{Script=Thai}/u.test(t))).toBe(true);
    expect(titles.some((t) => /\p{Script=Arabic}/u.test(t))).toBe(true);
    expect(titles.some((t) => /\p{Script=Han}/u.test(t))).toBe(true);
    expect(titles.some((t) => /[ạảấềễ]/.test(t))).toBe(true);
    expect(titles.some((t) => /¿|¡|ñ/.test(t))).toBe(true);
    expect(titles.some((t) => /Terima/.test(t))).toBe(true);
    expect(titles.some((t) => /\p{Extended_Pictographic}/u.test(t))).toBe(true);
  });
});

describe('the detail', () => {
  it('has every language for ADMIN and the template for SYSTEM_EVENT, with the other pair null', async () => {
    const admin = notificationsState.rows.find(
      (r) => r.category === 'ADMIN' && Object.keys(r.titleI18n ?? {}).length > 3,
    );
    const system = notificationsState.rows.find((r) => r.category === 'SYSTEM_EVENT');
    const a = await get(ONE, {}, { id: admin?.id });
    expect(a.body.data.titleI18n).toEqual(admin?.titleI18n);
    expect(Object.keys(a.body.data.bodyI18n).length).toBe(
      Object.keys(admin?.titleI18n ?? {}).length,
    );
    expect(a.body.data.templateKey).toBeNull();
    expect(a.body.data.templateParams).toBeNull();
    expect(a.body.data.sentByUsername).toBe('root');
    const s = await get(ONE, {}, { id: system?.id });
    expect(s.body.data.titleI18n).toBeNull();
    expect(s.body.data.bodyI18n).toBeNull();
    expect(typeof s.body.data.templateKey).toBe('string');
    expect(typeof s.body.data.templateParams).toBe('object');
  });

  it('is 404 RESOURCE_NOT_FOUND for an id that is not there, 403 without the code', async () => {
    expect((await get(ONE, {}, { id: 'nope' })).body.code).toBe('RESOURCE_NOT_FOUND');
    expect((await get(ONE, {}, { id: 'x' }, 'finance')).status).toBe(403);
  });
});

describe('sending', () => {
  it('needs NOTIFICATION:SEND', async () => {
    const view = adminOf('reviewer');
    view.permissions = ['NOTIFICATION:VIEW'];
    expect((await send(body(), 'reviewer')).status).toBe(403);
  });

  it('writes one ADMIN row per recipient, in order, and answers {created}', async () => {
    const before = notificationsState.rows.length;
    const accounts = usersState.users
      .filter((u) => u.status === 'ACTIVE')
      .slice(0, 3)
      .map((u) => u.id);
    const answer = await send(
      body({ accountIds: accounts, linkType: 'SCREEN', linkTarget: 'store', push: true }),
    );
    expect(answer.status).toBe(200);
    expect(answer.body.data).toEqual({ created: 3 });
    expect(notificationsState.rows.length).toBe(before + 3);
    const mine = notificationsState.rows.slice(before);
    expect(mine.map((r) => r.accountId)).toEqual(accounts);
    for (const row of mine) {
      expect(row.category).toBe('ADMIN');
      expect(row.isRead).toBe(false);
      expect(row.sentBy).toBe('1001');
      expect(row.linkType).toBe('SCREEN');
      expect(row.linkTarget).toBe('store');
    }
  });

  it('stores the text without its surrounding whitespace and counts code points', async () => {
    const ok = await send(body({ titleI18n: { en: `  ${'😀'.repeat(100)}  ` } }));
    expect(ok.status).toBe(200);
    expect(notificationsState.rows.at(-1)?.titleI18n?.en).toBe('😀'.repeat(100));
    const long = await send(body({ titleI18n: { en: '😀'.repeat(101) } }));
    expect(long.status).toBe(400);
    expect(detailsOf(long)).toEqual([{ ref: 'titleI18n.en', reason: 'TOO_LONG' }]);
    const body501 = await send(body({ bodyI18n: { en: 'ก'.repeat(501) } }));
    expect(detailsOf(body501)).toEqual([{ ref: 'bodyI18n.en', reason: 'TOO_LONG' }]);
  });

  it('refuses a missing en, an empty text and a bad language tag, naming them', async () => {
    const noEn = await send(body({ titleI18n: { th: 'x' } }));
    expect(noEn.status).toBe(400);
    expect(detailsOf(noEn)).toContainEqual({ ref: 'titleI18n.en', reason: 'EMPTY_NOT_ALLOWED' });
    const blank = await send(body({ bodyI18n: { en: ` ${String.fromCharCode(0x3000)} ` } }));
    expect(detailsOf(blank)).toContainEqual({ ref: 'bodyI18n.en', reason: 'EMPTY_NOT_ALLOWED' });
    const tag = await send(body({ titleI18n: { en: 'x', 'not a tag': 'y' } }));
    expect(detailsOf(tag)).toContainEqual({
      ref: 'titleI18n.not a tag',
      reason: 'INVALID_LANGUAGE_TAG',
    });
  });

  it('refuses an empty list, a repeated account and too many recipients', async () => {
    expect(detailsOf(await send(body({ accountIds: [] })))).toEqual([
      { ref: 'accountIds', reason: 'EMPTY_NOT_ALLOWED' },
    ]);
    expect(detailsOf(await send(body({ accountIds: [USER.rich, USER.rich] })))).toEqual([
      { ref: 'accountIds', reason: 'DUPLICATE_VALUE' },
    ]);
    const many = Array.from({ length: 1001 }, (_, i) => `acc-${i}`);
    expect(detailsOf(await send(body({ accountIds: many })))).toEqual([
      { ref: 'accountIds', reason: 'OUT_OF_RANGE' },
    ]);
  });

  it('refuses the whole batch when an account is missing or not ACTIVE, listing each and writing nothing', async () => {
    const before = notificationsState.rows.length;
    const answer = await send(body({ accountIds: [USER.rich, 'ghost-1', USER.banned, 'ghost-2'] }));
    expect(answer.status).toBe(400);
    expect(answer.body.code).toBe('INVALID_REQUEST');
    expect(detailsOf(answer)).toEqual([
      { ref: 'ghost-1', reason: 'ACCOUNT_NOT_FOUND' },
      { ref: USER.banned, reason: 'ACCOUNT_NOT_ACTIVE' },
      { ref: 'ghost-2', reason: 'ACCOUNT_NOT_FOUND' },
    ]);
    expect(notificationsState.rows.length).toBe(before);
  });

  it('checks the link like the pushes do: https only, a screen of the list', async () => {
    const http = await send(body({ linkType: 'URL', linkTarget: 'http://example.com' }));
    expect(detailsOf(http)).toEqual([{ ref: 'linkTarget', reason: 'NOT_HTTPS' }]);
    const screen = await send(body({ linkType: 'SCREEN', linkTarget: 'companionship' }));
    expect(detailsOf(screen)).toEqual([{ ref: 'linkTarget', reason: 'INVALID_VALUE' }]);
    expect(
      (await send(body({ linkType: 'URL', linkTarget: 'https://example.com/a' }))).status,
    ).toBe(200);
    expect((await send(body({ linkType: 'NONE' }))).status).toBe(200);
  });
});
