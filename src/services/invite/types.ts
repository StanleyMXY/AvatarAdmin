// Response types of the invite endpoints. Field names are the ones of the backend's reply (reply 1,
// point 10) and of contract 17.4 and 17.6; the share tables and the chain nodes are not written out
// there, see docs/contract-requests/2026-10-26-admin-frontend-invite.md.

export type Page<T> = { items: T[]; total: number };

/** The reward states of an invitation (contract 9.1); a state this list does not know is shown as sent. */
export const REWARD_STATUSES = ['PENDING', 'REWARDED', 'NOT_ELIGIBLE'] as const;
export type RewardStatus = (typeof REWARD_STATUSES)[number];

/** Why an invitation is NOT_ELIGIBLE (contract 9.1). */
export const REWARD_REASONS = [
  'DISABLED',
  'OUT_OF_WINDOW',
  'ACCOUNT_STATE',
  'LIMIT_REACHED',
  'SAME_DEVICE',
  'PRIOR_ACCOUNT',
] as const;

export type InviteCode = {
  id: string;
  code: string;
  ownerAccountId: string;
  /** The creation time of the owner's account. */
  createdAt: string;
};

export type InviteRecord = {
  id: string;
  inviterAccountId: string;
  inviteeAccountId: string;
  /** Masked: an e-mail, a phone number or the first eight characters of the account id. */
  inviterLabel: string;
  inviteeLabel: string;
  redeemedAt: string;
  rewardStatus: string;
  rewardReason: string | null;
  inviterCreditsGranted: number | null;
  inviteeCreditsGranted: number | null;
  rewardedAt: string | null;
};

export type InviteStats = {
  totalInvitees: number;
  activeInviters: number;
  /** The number of accounts up to the end of `to`: the denominator of the participation rate. */
  registeredAccounts: number;
  /** `totalInvitees / activeInviters`; null when nobody invited anybody. */
  avgInvitesPerInviter: number | null;
  daily: { date: string; invitees: number; activeInviters: number }[];
  ranking: { inviterAccountId: string; inviteCount: number }[];
  rewardedInvitees: number;
  creditsGranted: number;
};

export type DepthStats = {
  depthDistribution: { depth: number; count: number }[];
  /** Null when nobody was invited in the range. */
  avgDepth: number | null;
  /** The number 0, not null, when nobody was invited in the range (answer 116): then `depthDistribution` is empty and `totalChains` is 0. */
  maxDepth: number;
  /** The number of different root accounts (accounts without an inviter) in the range. */
  totalChains: number;
};

export type ChainNode = {
  accountId: string;
  /** Masked, like the labels of the record list. */
  label: string;
  joinedAt: string;
  children?: ChainNode[];
};

export type InviteChain = {
  root: ChainNode;
  children: ChainNode[];
  /** All the descendants within `maxDepth` levels of the request, whether or not the nodes were cut. */
  totalDescendants: number;
  /** The deepest level among the nodes returned (0 without descendants), not the depth asked for. */
  maxDepth: number;
  /** True when the backend returned only the first 10000 nodes (shallow levels first); `totalDescendants` still counts them all. */
  truncated: boolean;
};

/**
 * One day of `StatShareFunnelDaily`. A UV is the number of different people of that day: it is not
 * added over days. The six numbers that come from the events are `null` for a day landed after the
 * event log had expired (answer 36): then only `registered` has a value, and a null is not a 0.
 */
export type ShareFunnelRow = {
  statDate: string;
  sharePv: number | null;
  shareUv: number | null;
  linkClickPv: number | null;
  linkClickUv: number | null;
  downloadClickPv: number | null;
  downloadClickUv: number | null;
  registered: number;
};

/** One day and one share channel of `StatShareChannelDaily`. */
export type ShareChannelRow = {
  statDate: string;
  /** The channel code; the string `unknown` (not null, not empty) when the share had none the backend knows (answer 36). */
  shareChannel: string;
  sharePv: number;
  shareUv: number;
};
