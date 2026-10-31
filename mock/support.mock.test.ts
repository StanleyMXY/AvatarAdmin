import { beforeEach, describe, expect, it } from 'vitest';
import { monitorStore, raiseAlert, resetMonitorStore } from './_core/monitorData';
import { issueToken, resetStore } from './_core/store';
import { resetSupportStore, supportStore } from './_core/supportData';
import { adminOf, bearer, call } from './_core/testing';
import support from './support.mock';

beforeEach(() => {
  resetStore();
  resetSupportStore();
  resetMonitorStore();
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (support as unknown as Record<string, H>)[name];
const as = (user: string) => bearer(issueToken(adminOf(user)).token).authorization;
const act = (
  name: string,
  user: string,
  over: { query?: Record<string, string>; params?: Record<string, string> } = {},
) => call(h(name), { headers: { authorization: as(user) }, ...over });

describe('GET /support/feedback', () => {
  it('lists feedback newest first, with total, in every status and category', async () => {
    const { status, body } = await act('GET /api/admin/support/feedback', 'support', {
      query: { pageSize: '100' },
    });
    expect(status).toBe(200);
    const items = body.data.items as {
      createdAt: string;
      forwardStatus: string;
      category: string;
    }[];
    expect(body.data.total).toBe(items.length);
    const times = items.map((i) => Date.parse(i.createdAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(new Set(items.map((i) => i.forwardStatus))).toEqual(
      new Set(['PENDING', 'FORWARDED', 'FAILED']),
    );
    expect(new Set(items.map((i) => i.category))).toEqual(
      new Set(['BUG', 'QUESTION', 'SUGGESTION', 'OTHER']),
    );
  });

  it('gives the columns of SupportFeedback', async () => {
    const { body } = await act('GET /api/admin/support/feedback', 'support');
    expect(Object.keys(body.data.items[0]).sort()).toEqual(
      [
        'accountId',
        'attempts',
        'category',
        'context',
        'createdAt',
        'forwardRef',
        'forwardStatus',
        'id',
        'lastError',
        'message',
        'nextAttemptAt',
      ].sort(),
    );
  });

  it('has text in Thai, Arabic, Indonesian, Vietnamese, Spanish, English and Chinese and a very long string with no space', async () => {
    const { body } = await act('GET /api/admin/support/feedback', 'support', {
      query: { pageSize: '100' },
    });
    const all = (body.data.items as { message: string }[]).map((i) => i.message).join('\n');
    expect(all).toMatch(/[฀-๿]/);
    expect(all).toMatch(/[\u0600-\u06FF]/);
    expect(all).toMatch(/[一-鿿]/);
    expect(all).toMatch(/Terima kasih|Halo/);
    expect(all).toMatch(/Cảm ơn|Xin chào/);
    expect(all).toMatch(/Muchas gracias|Hola/);
    expect(all).toMatch(/Thank you|Hello/);
    expect(
      (body.data.items as { message: string }[]).some((i) => /^\S{3000,}$/u.test(i.message)),
    ).toBe(true);
  });

  it('pages and refuses bad paging', async () => {
    const page = await act('GET /api/admin/support/feedback', 'support', {
      query: { page: '2', pageSize: '10' },
    });
    expect(page.body.data.items).toHaveLength(10);
    const bad = await act('GET /api/admin/support/feedback', 'support', {
      query: { pageSize: '0' },
    });
    expect(bad.status).toBe(400);
    expect(bad.body.data.details[0].ref).toBe('pageSize');
  });

  it('needs SUPPORT:VIEW', async () => {
    expect((await act('GET /api/admin/support/feedback', 'reviewer')).status).toBe(403);
  });
});

describe('GET /support/feedback/:id', () => {
  it('gives one feedback with its context, and 404 for one that is not there', async () => {
    const id = supportStore.rows[0].id;
    const ok = await act('GET /api/admin/support/feedback/:id', 'support', { params: { id } });
    expect(ok.body.data.id).toBe(id);
    expect(Object.keys(ok.body.data.context ?? {}).length).toBeGreaterThan(0);
    const missing = await act('GET /api/admin/support/feedback/:id', 'support', {
      params: { id: '987654' },
    });
    expect([missing.status, missing.body.code]).toEqual([404, 'RESOURCE_NOT_FOUND']);
  });
});

describe('POST /support/feedback/:id/retry', () => {
  const failed = () => supportStore.rows.find((r) => r.forwardStatus === 'FAILED');
  const retry = (user: string, id: string) =>
    act('POST /api/admin/support/feedback/:id/retry', user, { params: { id } });

  it('puts a FAILED feedback back to PENDING with the failure count cleared', async () => {
    const row = failed();
    expect((await retry('support', row?.id ?? '')).status).toBe(200);
    expect(row).toMatchObject({
      forwardStatus: 'PENDING',
      attempts: 0,
      nextAttemptAt: null,
    });
  });

  it('answers 409 INVALID_STATE with the current status for a feedback that is not FAILED, and 404 for a missing one', async () => {
    const pending = supportStore.rows.find((r) => r.forwardStatus === 'FORWARDED');
    const refused = await retry('support', pending?.id ?? '');
    expect([refused.status, refused.body.code, refused.body.data]).toEqual([
      409,
      'INVALID_STATE',
      { status: 'FORWARDED' },
    ]);
    expect((await retry('support', '987654')).status).toBe(404);
  });

  it('resolves the open forwarding alert of that feedback, and only that one', async () => {
    const alert = monitorStore.alerts.find(
      (a) => a.type === 'SUPPORT_FORWARD_FAILED' && a.status === 'OPEN',
    );
    const others = monitorStore.alerts.filter((a) => a !== alert && a.status === 'OPEN').length;
    expect(alert).toBeTruthy();
    expect((await retry('support', alert?.refId ?? '')).status).toBe(200);
    expect(alert?.status).toBe('RESOLVED');
    expect(Date.parse(alert?.resolvedAt ?? '')).not.toBeNaN();
    expect(monitorStore.alerts.filter((a) => a.status === 'OPEN')).toHaveLength(others);
  });

  it('leaves the alert open when the retry changed nothing: a feedback that did not fail, or one that is not there', async () => {
    const alert = monitorStore.alerts.find((a) => a.type === 'SUPPORT_FORWARD_FAILED');
    const forwarded = supportStore.rows.find((r) => r.forwardStatus === 'FORWARDED');
    // the alert of a feedback that is no longer FAILED stays open until someone closes it
    if (alert) alert.refId = forwarded?.id ?? '';
    expect((await retry('support', forwarded?.id ?? '')).status).toBe(409);
    expect((await retry('support', '987654')).status).toBe(404);
    expect(alert?.status).toBe('OPEN');
  });

  it('opens a new alert when the feedback fails again, and the retry resolves that one too', async () => {
    const row = failed();
    if (!row) throw new Error('no failed feedback');
    const openOf = () =>
      monitorStore.alerts.filter((a) => a.refId === row.id && a.status === 'OPEN');
    await retry('support', row.id);
    row.forwardStatus = 'FAILED';
    raiseAlert({
      type: 'SUPPORT_FORWARD_FAILED',
      refType: 'SUPPORT_FEEDBACK',
      refId: row.id,
      accountId: row.accountId,
      detail: 'attempts_exhausted',
    });
    expect(openOf()).toHaveLength(1);
    await retry('support', row.id);
    expect(openOf()).toHaveLength(0);
  });

  it('needs SUPPORT:MANAGE', async () => {
    adminOf('reviewer').permissions = ['SUPPORT:VIEW'];
    const row = failed();
    const refused = await retry('reviewer', row?.id ?? '');
    expect([refused.status, refused.body.code]).toEqual([403, 'ADMIN_FORBIDDEN']);
    expect(row?.forwardStatus).toBe('FAILED');
  });
});
