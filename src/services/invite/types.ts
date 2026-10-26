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
  avgDepth: number | null;
  maxDepth: number | null;
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
  totalDescendants: number;
  /** The depth really reached by the descendants (not the depth asked for). */
  maxDepth: number | null;
};

/** One day of `StatShareFunnelDaily`. A UV is the number of different people of that day: it is not added over days. */
export type ShareFunnelRow = {
  statDate: string;
  sharePv: number;
  shareUv: number;
  linkClickPv: number;
  linkClickUv: number;
  downloadClickPv: number;
  downloadClickUv: number;
  registered: number;
};

/** One day and one share channel of `StatShareChannelDaily`. */
export type ShareChannelRow = {
  statDate: string;
  shareChannel: string;
  sharePv: number;
  shareUv: number;
};
