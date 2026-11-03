import { beforeEach, describe, expect, it } from 'vitest';
import { resetConfigStore } from './_core/configStore';
import { pushState, resetPushStore } from './_core/pushData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import push from './push.mock';

// GET /push/records: `from` and `to` (YYYY-MM-DD, a UTC day, both ends included, each can be left out)
// filter on the creation time; a bad date, or a `to` before `from`, is a 400 with details.

beforeEach(() => {
  resetStore();
  resetConfigStore();
  resetPushStore();
});

type H = Parameters<typeof call>[0];
const RECORDS = 'GET /api/admin/push/records';
const token = () => bearer(issueToken(adminOf('root')).token).authorization;
const records = (query: Record<string, unknown> = {}) =>
  call((push as unknown as Record<string, H>)[RECORDS], {
    headers: { authorization: token() },
    query: { pageSize: '100', ...query },
  });

type Row = { id: string; createdAt: string; accountId: string; triggerReason: string };
const dayOf = (iso: string) => iso.slice(0, 10);
const days = () => [...new Set(pushState.records.map((r) => dayOf(r.createdAt)))].sort();
const idsOf = async (query: Record<string, unknown>) =>
  ((await records(query)).body.data.items as Row[]).map((r) => r.id).sort();
const expected = (keep: (r: Row) => boolean) =>
  pushState.records
    .filter((r) => keep(r as Row))
    .map((r) => r.id)
    .sort();

describe('the creation day filter of the push records', () => {
  it('has records on at least three UTC days, so that the filters below tell something', () => {
    expect(days().length).toBeGreaterThanOrEqual(3);
  });

  it('keeps the records from a day on (the day itself included) when only `from` is given', async () => {
    const [, middle] = days();
    expect(await idsOf({ from: middle })).toEqual(expected((r) => dayOf(r.createdAt) >= middle));
  });

  it('keeps the records up to a day (the whole day included) when only `to` is given', async () => {
    const [, middle] = days();
    const answer = await idsOf({ to: middle });
    expect(answer).toEqual(expected((r) => dayOf(r.createdAt) <= middle));
    // a record created late on that day is in
    const late = pushState.records.filter((r) => dayOf(r.createdAt) === middle);
    expect(late.length).toBeGreaterThan(0);
    for (const r of late) expect(answer).toContain(r.id);
  });

  it('keeps one day when `from` and `to` are the same day, and the total follows the filter', async () => {
    const [, middle] = days();
    const answer = await records({ from: middle, to: middle });
    const want = expected((r) => dayOf(r.createdAt) === middle);
    expect(want.length).toBeGreaterThan(0);
    expect(want.length).toBeLessThan(pushState.records.length);
    expect(answer.body.data.total).toBe(want.length);
    expect((answer.body.data.items as Row[]).map((r) => r.id).sort()).toEqual(want);
  });

  it('pages the filtered list: the total is the filtered count, not the page', async () => {
    const [first] = days();
    const all = expected((r) => dayOf(r.createdAt) >= first);
    const page = await records({ from: first, pageSize: '5', page: '2' });
    expect(page.body.data.total).toBe(all.length);
    expect(page.body.data.items).toHaveLength(Math.min(5, Math.max(0, all.length - 5)));
  });

  it('works together with the account and the reason (the filters that were there are unchanged)', async () => {
    const [, middle] = days();
    const probe = pushState.records.find((r) => dayOf(r.createdAt) >= middle);
    if (!probe) throw new Error('no record');
    const both = await idsOf({
      from: middle,
      accountId: probe.accountId,
      triggerReason: probe.triggerReason,
    });
    expect(both).toEqual(
      expected(
        (r) =>
          dayOf(r.createdAt) >= middle &&
          r.accountId === probe.accountId &&
          r.triggerReason === probe.triggerReason,
      ),
    );
    expect(both).toContain(probe.id);
  });

  it('gives an empty list, not an error, for a range with no record', async () => {
    const answer = await records({ from: '2001-01-01', to: '2001-01-31' });
    expect(answer.status).toBe(200);
    expect(answer.body.data).toEqual({ items: [], total: 0 });
  });

  it('takes an empty value as not given', async () => {
    expect(await idsOf({ from: '', to: '' })).toEqual(expected(() => true));
  });

  it('refuses a date that is not YYYY-MM-DD or not a day, and names the parameter', async () => {
    for (const bad of [
      '2026-02-30',
      '2026-1-5',
      '26-01-01',
      'yesterday',
      '2026-13-01',
      '2026-01-01T00:00:00Z',
      '0000-01-01',
    ]) {
      const from = await records({ from: bad });
      expect([from.status, from.body.code], bad).toEqual([400, 'INVALID_REQUEST']);
      expect(from.body.data.details, bad).toEqual([{ ref: 'from', reason: 'OUT_OF_RANGE' }]);
      const to = await records({ to: bad });
      expect(to.body.data.details, bad).toEqual([{ ref: 'to', reason: 'OUT_OF_RANGE' }]);
    }
  });

  it('names `from` first when both dates are bad, and names `to` when `to` is before `from`', async () => {
    const both = await records({ from: 'x', to: 'y' });
    expect(both.body.data.details).toEqual([{ ref: 'from', reason: 'OUT_OF_RANGE' }]);
    const before = await records({ from: '2026-10-20', to: '2026-10-19' });
    expect(before.status).toBe(400);
    expect(before.body.data.details).toEqual([{ ref: 'to', reason: 'OUT_OF_RANGE' }]);
    // a bad `from` is named even when `to` would also be before it
    const mixed = await records({ from: '2026-02-30', to: '2026-01-01' });
    expect(mixed.body.data.details).toEqual([{ ref: 'from', reason: 'OUT_OF_RANGE' }]);
    // the same day is not before
    expect((await records({ from: '2026-10-20', to: '2026-10-20' })).status).toBe(200);
  });
});
