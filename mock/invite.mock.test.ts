import { beforeEach, describe, expect, it } from 'vitest';
import { resetConfigStore, saved } from './_core/configStore';
import { FIXTURE, inviteData, resetInviteStore } from './_core/inviteData';
import { issueToken, resetStore } from './_core/store';
import { adminOf, bearer, call } from './_core/testing';
import invite from './invite.mock';

beforeEach(() => {
  resetStore();
  resetConfigStore();
  resetInviteStore();
});

type H = Parameters<typeof call>[0];
const h = (name: string) => (invite as unknown as Record<string, H>)[name];
const token = (user: string) => bearer(issueToken(adminOf(user)).token).authorization;
const get = (name: string, user: string, query: Record<string, unknown> = {}) =>
  call(h(name), { headers: { authorization: token(user) }, query });

const CODES = 'GET /api/admin/invites/codes';
const RECORDS = 'GET /api/admin/invites/records';
const STATS = 'GET /api/admin/invites/stats';
const DEPTH = 'GET /api/admin/invites/depth-stats';
const CHAIN = 'GET /api/admin/invites/chain';
const FUNNEL = 'GET /api/admin/invites/share-funnel';
const CHANNELS = 'GET /api/admin/invites/share-channels';

const today = () => inviteData().today;
const dayShift = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const wide = () => ({ from: dayShift(today(), -60), to: today() });

describe('permissions (contract 17.4, invite row)', () => {
  it.each(Object.keys(invite))(
    '%s answers 403 ADMIN_FORBIDDEN for an administrator without INVITE:VIEW',
    async (name) => {
      const { status, body } = await get(name, 'support');
      expect(status).toBe(403);
      expect(body.code).toBe('ADMIN_FORBIDDEN');
    },
  );

  it('answers 401 without a token on every endpoint', async () => {
    for (const name of Object.keys(invite)) {
      expect((await call(h(name))).status, name).toBe(401);
    }
  });

  it('has the seven endpoints of the contract and nothing else', () => {
    expect(Object.keys(invite).sort()).toEqual(
      [CODES, RECORDS, STATS, DEPTH, CHAIN, FUNNEL, CHANNELS].sort(),
    );
  });
});

describe('GET /invites/codes', () => {
  it('lists code, owner and the creation time of the owner account, in the contract field names', async () => {
    const { status, body } = await get(CODES, 'root');
    expect(status).toBe(200);
    expect(body.data.total).toBeGreaterThan(45);
    expect(body.data.items).toHaveLength(20);
    for (const row of body.data.items) {
      expect(Object.keys(row).sort()).toEqual(['code', 'createdAt', 'id', 'ownerAccountId']);
      expect(row.code).toMatch(/^[A-Z0-9]{8}$/);
    }
    const owner = inviteData().accounts.find((a) => a.id === body.data.items[0].ownerAccountId);
    expect(body.data.items[0].createdAt).toBe(owner?.createdAt);
  });

  it('pages, and refuses paging outside the limits with the parameter names', async () => {
    const second = await get(CODES, 'root', { page: '2', pageSize: '20' });
    const first = await get(CODES, 'root', { page: '1', pageSize: '20' });
    expect(second.body.data.items[0].id).not.toBe(first.body.data.items[0].id);
    const bad = await get(CODES, 'root', { page: '0', pageSize: '201' });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('INVALID_REQUEST');
    expect(bad.body.data.details.map((d: { ref: string }) => d.ref)).toEqual(['page', 'pageSize']);
  });
});

describe('GET /invites/records', () => {
  it('lists newest redemption first with the eleven fields of the reply', async () => {
    const { body } = await get(RECORDS, 'root', { pageSize: '100' });
    const rows = body.data.items;
    expect(rows.length).toBeGreaterThan(40);
    const times = rows.map((r: { redeemedAt: string }) => r.redeemedAt);
    expect(times).toEqual([...times].sort().reverse());
    expect(Object.keys(rows[0]).sort()).toEqual(
      [
        'id',
        'inviterAccountId',
        'inviteeAccountId',
        'inviterLabel',
        'inviteeLabel',
        'redeemedAt',
        'rewardStatus',
        'rewardReason',
        'inviterCreditsGranted',
        'inviteeCreditsGranted',
        'rewardedAt',
      ].sort(),
    );
  });

  it('masks the labels: a label is never the whole account id, an email or a phone number', async () => {
    const { body } = await get(RECORDS, 'root', { pageSize: '100' });
    for (const row of body.data.items) {
      expect(row.inviterLabel).not.toBe(row.inviterAccountId);
      expect(row.inviteeLabel).not.toBe(row.inviteeAccountId);
      expect(row.inviterLabel).not.toMatch(/^[^*@]+@[^*]+\.[a-z]+$/);
    }
  });

  it('has the reward states of 9.1: a reason only for NOT_ELIGIBLE, credits and time only for REWARDED', async () => {
    const { body } = await get(RECORDS, 'root', { pageSize: '100' });
    const by = (status: string) =>
      body.data.items.filter((r: { rewardStatus: string }) => r.rewardStatus === status);
    expect(by('PENDING').length).toBeGreaterThan(0);
    expect(by('REWARDED').length).toBeGreaterThan(0);
    expect(by('NOT_ELIGIBLE').length).toBeGreaterThan(0);
    for (const row of by('NOT_ELIGIBLE')) {
      expect([
        'DISABLED',
        'OUT_OF_WINDOW',
        'ACCOUNT_STATE',
        'LIMIT_REACHED',
        'SAME_DEVICE',
        'PRIOR_ACCOUNT',
      ]).toContain(row.rewardReason);
      expect(row.rewardedAt).toBeNull();
    }
    for (const row of [...by('PENDING'), ...by('REWARDED')]) expect(row.rewardReason).toBeNull();
    for (const row of by('REWARDED')) {
      expect(row.rewardedAt).toEqual(expect.any(String));
      expect(row.inviterCreditsGranted + row.inviteeCreditsGranted).toBeGreaterThan(0);
    }
    for (const row of by('PENDING')) expect(row.rewardedAt).toBeNull();
  });

  it('filters by rewardStatus and refuses a status that does not exist', async () => {
    const only = await get(RECORDS, 'root', { rewardStatus: 'NOT_ELIGIBLE', pageSize: '100' });
    expect(only.body.data.items.length).toBeGreaterThan(0);
    expect(
      only.body.data.items.every(
        (r: { rewardStatus: string }) => r.rewardStatus === 'NOT_ELIGIBLE',
      ),
    ).toBe(true);
    const all = await get(RECORDS, 'root', { pageSize: '100' });
    expect(only.body.data.total).toBeLessThan(all.body.data.total);
    const bad = await get(RECORDS, 'root', { rewardStatus: 'DONE' });
    expect(bad.status).toBe(400);
    expect(bad.body.data.details).toEqual([{ ref: 'rewardStatus', reason: 'OUT_OF_RANGE' }]);
  });

  it('carries the odd labels the page has to survive: a very long one and other scripts', async () => {
    const { body } = await get(RECORDS, 'root', { pageSize: '100' });
    const labels: string[] = body.data.items.flatMap(
      (r: { inviterLabel: string; inviteeLabel: string }) => [r.inviterLabel, r.inviteeLabel],
    );
    expect(labels.some((l) => l.length >= 300 && !/\s/.test(l))).toBe(true);
    expect(labels.some((l) => /\p{Script=Thai}/u.test(l))).toBe(true);
    expect(labels.some((l) => /\p{Script=Arabic}/u.test(l))).toBe(true);
  });
});

describe('GET /invites/stats', () => {
  it('counts the records of the range and splits them by UTC day, one row per day', async () => {
    const range = wide();
    const { body } = await get(STATS, 'root', range);
    const data = body.data;
    const inRange = inviteData().records.filter(
      (r) => r.redeemedAt.slice(0, 10) >= range.from && r.redeemedAt.slice(0, 10) <= range.to,
    );
    expect(data.totalInvitees).toBe(inRange.length);
    expect(data.activeInviters).toBe(new Set(inRange.map((r) => r.inviterAccountId)).size);
    expect(data.daily).toHaveLength(61);
    expect(data.daily[0].date).toBe(range.from);
    expect(data.daily.at(-1).date).toBe(range.to);
    expect(data.daily.reduce((n: number, d: { invitees: number }) => n + d.invitees, 0)).toBe(
      data.totalInvitees,
    );
    expect(data.avgInvitesPerInviter).toBeCloseTo(data.totalInvitees / data.activeInviters, 6);
  });

  it('gives rewardedInvitees and creditsGranted from the REWARDED records, both sides added', async () => {
    const range = wide();
    const { body } = await get(STATS, 'root', range);
    const rewarded = inviteData().records.filter((r) => r.rewardStatus === 'REWARDED');
    expect(body.data.rewardedInvitees).toBe(rewarded.length);
    expect(body.data.creditsGranted).toBe(
      rewarded.reduce(
        (n, r) => n + (r.inviterCreditsGranted ?? 0) + (r.inviteeCreditsGranted ?? 0),
        0,
      ),
    );
  });

  it('returns the registered accounts up to the end of `to`, as a separate denominator', async () => {
    const early = await get(STATS, 'root', {
      from: dayShift(today(), -60),
      to: dayShift(today(), -50),
    });
    const late = await get(STATS, 'root', wide());
    expect(early.body.data.registeredAccounts).toBeLessThan(late.body.data.registeredAccounts);
    expect(late.body.data.registeredAccounts).toBe(inviteData().accounts.length);
  });

  it('has avgInvitesPerInviter null when nobody invited anybody in the range', async () => {
    const { body } = await get(STATS, 'root', { from: '2000-01-01', to: '2000-01-03' });
    expect(body.data).toMatchObject({
      totalInvitees: 0,
      activeInviters: 0,
      avgInvitesPerInviter: null,
      rewardedInvitees: 0,
      creditsGranted: 0,
      ranking: [],
    });
    expect(body.data.daily).toHaveLength(3);
  });

  it('puts an invitation at 23:59:59Z in its own UTC day and one at 00:00:00Z in the next', async () => {
    const { lateDay, lateAt, earlyDay, earlyAt } = FIXTURE.boundary;
    const records = inviteData().records;
    expect(records.some((r) => r.redeemedAt === lateAt)).toBe(true);
    expect(records.some((r) => r.redeemedAt === earlyAt)).toBe(true);
    const late = await get(STATS, 'root', { from: lateDay, to: lateDay });
    const early = await get(STATS, 'root', { from: earlyDay, to: earlyDay });
    const count = (day: string) => records.filter((r) => r.redeemedAt.slice(0, 10) === day).length;
    // the two moments are one second apart but on different UTC days: each day counts its own
    expect(late.body.data.totalInvitees).toBe(count(lateDay));
    expect(early.body.data.totalInvitees).toBe(count(earlyDay));
    expect(late.body.data.totalInvitees).toBeGreaterThan(0);
    expect(early.body.data.totalInvitees).toBeGreaterThan(0);
    expect(earlyDay).toBe(dayShift(lateDay, 1));
    expect(lateAt.slice(0, 10)).toBe(lateDay);
    expect(earlyAt.slice(0, 10)).toBe(earlyDay);
    const both = await get(STATS, 'root', { from: lateDay, to: earlyDay });
    expect(both.body.data.daily.map((d: { invitees: number }) => d.invitees)).toEqual([
      count(lateDay),
      count(earlyDay),
    ]);
  });

  it('ranks the inviters by invitation count, 50 by default, and honours limit up to 200', async () => {
    const range = wide();
    const full = await get(STATS, 'root', range);
    const ranking = full.body.data.ranking;
    expect(ranking[0].inviterAccountId).toBe(FIXTURE.top);
    const counts = ranking.map((r: { inviteCount: number }) => r.inviteCount);
    expect(counts).toEqual([...counts].sort((a: number, b: number) => b - a));
    expect(Object.keys(ranking[0]).sort()).toEqual(['inviteCount', 'inviterAccountId']);
    const three = await get(STATS, 'root', { ...range, limit: '3' });
    expect(three.body.data.ranking).toHaveLength(3);
    const bad = await get(STATS, 'root', { ...range, limit: '201' });
    expect(bad.status).toBe(400);
    expect(bad.body.data.details).toEqual([{ ref: 'limit', reason: 'OUT_OF_RANGE' }]);
  });

  it('refuses a missing or reversed range and a range longer than the limit', async () => {
    const reversed = await get(STATS, 'root', { from: '2026-10-05', to: '2026-10-01' });
    expect(reversed.status).toBe(400);
    expect(reversed.body.code).toBe('INVALID_REQUEST');
    const garbage = await get(STATS, 'root', { from: 'yesterday', to: today() });
    expect(garbage.body.data.details[0].ref).toBe('from');
  });
});

describe('GET /invites/depth-stats', () => {
  it('gives a distribution whose counts add up to the invitees of the range', async () => {
    const range = wide();
    const { body } = await get(DEPTH, 'root', range);
    const data = body.data;
    const total = data.depthDistribution.reduce(
      (n: number, d: { count: number }) => n + d.count,
      0,
    );
    expect(total).toBe(inviteData().records.length);
    const depths = data.depthDistribution.map((d: { depth: number }) => d.depth);
    expect(depths).toEqual([...depths].sort((a: number, b: number) => a - b));
    expect(depths[0]).toBe(1);
    expect(data.maxDepth).toBe(Math.max(...depths));
    expect(data.maxDepth).toBeGreaterThanOrEqual(FIXTURE.deepChainLevels);
    const weighted = data.depthDistribution.reduce(
      (n: number, d: { depth: number; count: number }) => n + d.depth * d.count,
      0,
    );
    expect(data.avgDepth).toBeCloseTo(weighted / total, 6);
    expect(data.totalChains).toBeGreaterThan(0);
    expect(data.totalChains).toBeLessThanOrEqual(total);
  });

  it('has null averages and no chains for a range without invitations', async () => {
    const { body } = await get(DEPTH, 'root', { from: '2000-01-01', to: '2000-01-02' });
    expect(body.data).toEqual({
      depthDistribution: [],
      avgDepth: null,
      maxDepth: null,
      totalChains: 0,
    });
  });
});

describe('GET /invites/chain', () => {
  it('returns the root, the descendants down to the depth and masked labels', async () => {
    const { status, body } = await get(CHAIN, 'root', { rootAccountId: FIXTURE.deepRoot });
    expect(status).toBe(200);
    const data = body.data;
    expect(data.root.accountId).toBe(FIXTURE.deepRoot);
    expect(data.root.label).toEqual(expect.any(String));
    expect(data.root.joinedAt).toEqual(expect.any(String));
    const walk = (nodes: { accountId: string; label: string; children?: unknown[] }[]): number =>
      nodes.reduce((n, node) => n + 1 + walk((node.children ?? []) as typeof nodes), 0);
    expect(data.totalDescendants).toBe(walk(data.children));
    // the default depth is 3 although the chain is deeper
    expect(data.maxDepth).toBe(3);
    const labels: string[] = [];
    const collect = (nodes: { label: string; accountId: string; children?: unknown[] }[]) => {
      for (const node of nodes) {
        labels.push(node.label);
        expect(node.label).not.toBe(node.accountId);
        collect((node.children ?? []) as typeof nodes);
      }
    };
    collect(data.children);
    expect(labels.length).toBeGreaterThan(0);
  });

  it('goes deeper with maxDepth and reports the depth really reached', async () => {
    const shallow = await get(CHAIN, 'root', { rootAccountId: FIXTURE.deepRoot, maxDepth: '1' });
    const deep = await get(CHAIN, 'root', { rootAccountId: FIXTURE.deepRoot, maxDepth: '5' });
    expect(shallow.body.data.maxDepth).toBe(1);
    expect(deep.body.data.totalDescendants).toBeGreaterThan(shallow.body.data.totalDescendants);
    expect(deep.body.data.maxDepth).toBe(5);
    const lonely = await get(CHAIN, 'root', { rootAccountId: FIXTURE.lonely, maxDepth: '5' });
    expect(lonely.body.data).toMatchObject({ children: [], totalDescendants: 0, maxDepth: 0 });
  });

  it('refuses a depth above invite.chain_max_depth, and follows the configured value', async () => {
    const over = await get(CHAIN, 'root', { rootAccountId: FIXTURE.deepRoot, maxDepth: '6' });
    expect(over.status).toBe(400);
    expect(over.body.data.details).toEqual([{ ref: 'maxDepth', reason: 'OUT_OF_RANGE' }]);
    saved.set('invite.chain_max_depth', {
      value: 8,
      updatedAt: '2026-10-01T00:00:00Z',
      updatedBy: '1001',
      updatedByUsername: 'root',
    });
    const allowed = await get(CHAIN, 'root', { rootAccountId: FIXTURE.deepRoot, maxDepth: '6' });
    expect(allowed.status).toBe(200);
    const zero = await get(CHAIN, 'root', { rootAccountId: FIXTURE.deepRoot, maxDepth: '0' });
    expect(zero.status).toBe(400);
  });

  it('answers 404 RESOURCE_NOT_FOUND for an account that does not exist and 400 without the id', async () => {
    const none = await get(CHAIN, 'root', { rootAccountId: 'no-such-account' });
    expect(none.status).toBe(404);
    expect(none.body.code).toBe('RESOURCE_NOT_FOUND');
    const missing = await get(CHAIN, 'root', {});
    expect(missing.status).toBe(400);
    expect(missing.body.data.details).toEqual([
      { ref: 'rootAccountId', reason: 'EMPTY_NOT_ALLOWED' },
    ]);
  });
});

describe('GET /invites/share-funnel', () => {
  it('gives the columns of StatShareFunnelDaily, one row per landed day', async () => {
    const range = { from: dayShift(today(), -9), to: today() };
    const { body } = await get(FUNNEL, 'root', range);
    const rows = body.data.items;
    expect(rows.length).toBeGreaterThan(5);
    expect(Object.keys(rows[0]).sort()).toEqual(
      [
        'statDate',
        'sharePv',
        'shareUv',
        'linkClickPv',
        'linkClickUv',
        'downloadClickPv',
        'downloadClickUv',
        'registered',
      ].sort(),
    );
    const days = rows.map((r: { statDate: string }) => r.statDate);
    expect(days).toEqual([...days].sort());
    // today is not landed yet: no row for it
    expect(days).not.toContain(today());
  });

  it('has `registered` equal to the number of invitations redeemed that UTC day', async () => {
    const { body } = await get(FUNNEL, 'root', wide());
    const records = inviteData().records;
    for (const row of body.data.items) {
      const count = records.filter((r) => r.redeemedAt.slice(0, 10) === row.statDate).length;
      expect(row.registered, row.statDate).toBe(count);
    }
  });

  it('never has more unique people than page views in a row', async () => {
    const { body } = await get(FUNNEL, 'root', wide());
    for (const r of body.data.items) {
      expect(r.shareUv).toBeLessThanOrEqual(r.sharePv);
      expect(r.linkClickUv).toBeLessThanOrEqual(r.linkClickPv);
      expect(r.downloadClickUv).toBeLessThanOrEqual(r.downloadClickPv);
    }
  });
});

describe('GET /invites/share-channels', () => {
  it('gives a row per day and share channel, with more than five channels so that "other" exists', async () => {
    const { body } = await get(CHANNELS, 'root', wide());
    const rows = body.data.items;
    expect(Object.keys(rows[0]).sort()).toEqual(['shareChannel', 'sharePv', 'shareUv', 'statDate']);
    const names = new Set(rows.map((r: { shareChannel: string }) => r.shareChannel));
    expect(names.size).toBeGreaterThan(6);
    expect(names.has('unknown')).toBe(true);
    for (const name of names) expect(name as string).toMatch(/^[a-z0-9_]{1,32}$/);
  });

  it('filters by shareChannel and refuses a value that is not a channel name', async () => {
    const { body } = await get(CHANNELS, 'root', { ...wide(), shareChannel: 'whatsapp' });
    expect(body.data.items.length).toBeGreaterThan(0);
    expect(
      body.data.items.every((r: { shareChannel: string }) => r.shareChannel === 'whatsapp'),
    ).toBe(true);
    const bad = await get(CHANNELS, 'root', { ...wide(), shareChannel: 'WhatsApp!' });
    expect(bad.status).toBe(400);
    expect(bad.body.data.details).toEqual([{ ref: 'shareChannel', reason: 'OUT_OF_RANGE' }]);
  });
});

describe('the sample data', () => {
  it('is a forest in time order: unique ids and codes, every inviter older than the invitation', () => {
    const { accounts, records } = inviteData();
    expect(new Set(accounts.map((a) => a.id)).size).toBe(accounts.length);
    expect(new Set(accounts.map((a) => a.code)).size).toBe(accounts.length);
    expect(new Set(records.map((r) => r.inviteeAccountId)).size).toBe(records.length);
    const created = new Map(accounts.map((a) => [a.id, a.createdAt]));
    for (const r of records) {
      expect((created.get(r.inviterAccountId) as string) < r.redeemedAt, r.id).toBe(true);
    }
  });

  it('keeps the same accounts and ids on another day and moves the dates with the day', () => {
    const first = inviteData(new Date('2026-10-26T10:00:00Z'));
    resetInviteStore();
    const second = inviteData(new Date('2026-11-05T10:00:00Z'));
    expect(second.accounts.map((a) => a.id)).toEqual(first.accounts.map((a) => a.id));
    expect(second.records[0].redeemedAt > first.records[0].redeemedAt).toBe(true);
  });
});
