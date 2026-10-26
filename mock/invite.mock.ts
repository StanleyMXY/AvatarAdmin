// The invite endpoints of the mock backend (contract 9.1, 9.2 and 17.4, invite row; the field names
// are the ones of the backend's reply 1, point 10). The share tables and the chain nodes follow the
// temporary shape written in docs/contract-requests/2026-10-26-admin-frontend-invite.md.
import { guard } from './_core/auth';
import { currentValue } from './_core/configStore';
import { invalidRequest, MockHttpError, type MockReq, ok } from './_core/http';
import {
  channelRows,
  funnelRow,
  type InviteAccount,
  inviteData,
  landedDays,
} from './_core/inviteData';
import { paginateQuery } from './_core/paginate';
import { daysIn, rangeOf, text } from './_core/statRange';

const REWARD_STATUSES = ['PENDING', 'REWARDED', 'NOT_ELIGIBLE'];
const CHANNEL_NAME = /^[a-z0-9_]{1,32}$/;
const RANKING_DEFAULT = 50;
const RANKING_MAX = 200;
const CHAIN_DEFAULT_DEPTH = 3;
const CHAIN_FALLBACK_MAX = 5;

/** A whole-number query parameter: undefined when absent, else the number or a 400 naming the parameter. */
function intParam(req: MockReq, name: string, min: number, max: number): number | undefined {
  const raw = text(req.query[name]).trim();
  if (raw === '') return undefined;
  if (!/^-?\d+$/.test(raw))
    throw invalidRequest(`${name} is not a whole number`, [
      { ref: name, reason: 'NOT_AN_INTEGER' },
    ]);
  const value = Number(raw);
  if (value < min || value > max) {
    throw invalidRequest(`${name} must be ${min} to ${max}`, [
      { ref: name, reason: 'OUT_OF_RANGE' },
    ]);
  }
  return value;
}

const dayOf = (iso: string): string => iso.slice(0, 10);

const chainMax = (): number => {
  const value = Number(currentValue('invite.chain_max_depth'));
  return Number.isInteger(value) && value >= 1 ? value : CHAIN_FALLBACK_MAX;
};

type Node = { accountId: string; label: string; joinedAt: string; children: Node[] };

export default {
  'GET /api/admin/invites/codes': guard('INVITE:VIEW', (req) => {
    const rows = [...inviteData().accounts]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
      .map((account, index) => ({
        id: String(index + 1),
        code: account.code,
        ownerAccountId: account.id,
        createdAt: account.createdAt,
      }));
    return ok(paginateQuery(rows, req));
  }),

  'GET /api/admin/invites/records': guard('INVITE:VIEW', (req) => {
    const status = text(req.query.rewardStatus);
    if (status !== '' && !REWARD_STATUSES.includes(status)) {
      throw invalidRequest('rewardStatus is not a reward status', [
        { ref: 'rewardStatus', reason: 'OUT_OF_RANGE' },
      ]);
    }
    const rows = inviteData().records.filter((r) => status === '' || r.rewardStatus === status);
    return ok(paginateQuery(rows, req));
  }),

  'GET /api/admin/invites/stats': guard('INVITE:VIEW', (req) => {
    const { from, to } = rangeOf(req);
    const limit = intParam(req, 'limit', 1, RANKING_MAX) ?? RANKING_DEFAULT;
    const data = inviteData();
    const inRange = data.records.filter(
      (r) => dayOf(r.redeemedAt) >= from && dayOf(r.redeemedAt) <= to,
    );
    const perInviter = new Map<string, number>();
    for (const r of inRange) {
      perInviter.set(r.inviterAccountId, (perInviter.get(r.inviterAccountId) ?? 0) + 1);
    }
    const rewarded = inRange.filter((r) => r.rewardStatus === 'REWARDED');
    const totalInvitees = inRange.length;
    const activeInviters = perInviter.size;
    return ok({
      totalInvitees,
      activeInviters,
      registeredAccounts: data.accounts.filter((a) => dayOf(a.createdAt) <= to).length,
      avgInvitesPerInviter: activeInviters === 0 ? null : totalInvitees / activeInviters,
      daily: daysIn(from, to).map((date) => {
        const that = inRange.filter((r) => dayOf(r.redeemedAt) === date);
        return {
          date,
          invitees: that.length,
          activeInviters: new Set(that.map((r) => r.inviterAccountId)).size,
        };
      }),
      ranking: [...perInviter.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, limit)
        .map(([inviterAccountId, inviteCount]) => ({ inviterAccountId, inviteCount })),
      rewardedInvitees: rewarded.length,
      creditsGranted: rewarded.reduce(
        (n, r) => n + (r.inviterCreditsGranted ?? 0) + (r.inviteeCreditsGranted ?? 0),
        0,
      ),
    });
  }),

  'GET /api/admin/invites/depth-stats': guard('INVITE:VIEW', (req) => {
    const { from, to } = rangeOf(req);
    const data = inviteData();
    const inRange = data.records.filter(
      (r) => dayOf(r.redeemedAt) >= from && dayOf(r.redeemedAt) <= to,
    );
    const counts = new Map<number, number>();
    const roots = new Set<string>();
    let sum = 0;
    for (const r of inRange) {
      const depth = data.depthOf.get(r.inviteeAccountId) as number;
      counts.set(depth, (counts.get(depth) ?? 0) + 1);
      roots.add(data.rootOf.get(r.inviteeAccountId) as string);
      sum += depth;
    }
    const depths = [...counts.keys()].sort((a, b) => a - b);
    return ok({
      depthDistribution: depths.map((depth) => ({ depth, count: counts.get(depth) as number })),
      avgDepth: inRange.length === 0 ? null : sum / inRange.length,
      maxDepth: depths.length === 0 ? null : depths[depths.length - 1],
      totalChains: roots.size,
    });
  }),

  'GET /api/admin/invites/chain': guard('INVITE:VIEW', (req) => {
    const rootId = text(req.query.rootAccountId).trim();
    if (rootId === '') {
      throw invalidRequest('rootAccountId is required', [
        { ref: 'rootAccountId', reason: 'EMPTY_NOT_ALLOWED' },
      ]);
    }
    const maxDepth = intParam(req, 'maxDepth', 1, chainMax()) ?? CHAIN_DEFAULT_DEPTH;
    const data = inviteData();
    const root = data.accounts.find((a) => a.id === rootId);
    if (!root) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such account');

    const redeemed = new Map(data.records.map((r) => [r.inviteeAccountId, r.redeemedAt]));
    const kids = new Map<string, InviteAccount[]>();
    for (const account of data.accounts) {
      if (account.inviterId === null) continue;
      kids.set(account.inviterId, [...(kids.get(account.inviterId) ?? []), account]);
    }
    let descendants = 0;
    let reached = 0;
    const nodeOf = (account: InviteAccount, depth: number): Node => {
      if (depth > 0) {
        descendants += 1;
        reached = Math.max(reached, depth);
      }
      const children =
        depth < maxDepth
          ? (kids.get(account.id) ?? [])
              .sort((a, b) => (redeemed.get(a.id) ?? '').localeCompare(redeemed.get(b.id) ?? ''))
              .map((child) => nodeOf(child, depth + 1))
          : [];
      return {
        accountId: account.id,
        label: account.label,
        joinedAt: redeemed.get(account.id) ?? account.createdAt,
        children,
      };
    };
    const tree = nodeOf(root, 0);
    return ok({
      root: { accountId: tree.accountId, label: tree.label, joinedAt: tree.joinedAt },
      children: tree.children,
      totalDescendants: descendants,
      maxDepth: reached,
    });
  }),

  'GET /api/admin/invites/share-funnel': guard('INVITE:VIEW', (req) => {
    const { from, to, today } = rangeOf(req);
    const { records } = inviteData();
    return ok({
      items: landedDays(daysIn(from, to), today).map((day) =>
        funnelRow(day, records.filter((r) => dayOf(r.redeemedAt) === day).length),
      ),
    });
  }),

  'GET /api/admin/invites/share-channels': guard('INVITE:VIEW', (req) => {
    const { from, to, today } = rangeOf(req);
    const channel = text(req.query.shareChannel);
    if (channel !== '' && !CHANNEL_NAME.test(channel)) {
      throw invalidRequest('shareChannel is not a share channel name', [
        { ref: 'shareChannel', reason: 'OUT_OF_RANGE' },
      ]);
    }
    return ok({
      items: landedDays(daysIn(from, to), today)
        .flatMap(channelRows)
        .filter((row) => channel === '' || row.shareChannel === channel),
    });
  }),
};
