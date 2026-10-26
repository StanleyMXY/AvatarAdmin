// Response and request shapes of the campaign endpoints (contract 10.3 to 10.5, 17.4 "投放管理" row,
// and the backend replies in docs/backend-inputs: field names are theirs). What the contract leaves
// open is in docs/contract-requests/2026-10-26-admin-frontend-campaign.md.

export type { Page } from '../../request/errors';

// ---- campaigns (投放账户, ATTRIBUTION:MANAGE) ----

/** `GET /attribution/campaigns` (backend reply 11): the columns of `AttributionCampaign` plus three. */
export type AttributionCampaign = {
  id: string;
  code: string;
  name: string;
  mediaSource: string;
  utmMedium: string;
  campaign: string;
  adset: string | null;
  ad: string | null;
  facebookPixelId: string | null;
  googlePixelId: string | null;
  tiktokPixelId: string | null;
  remark: string | null;
  enabled: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** Null once the administrator has been deleted. */
  createdByUsername: string | null;
  channelCodes: string[];
  /** The only thing the backend says about the token: it is set or it is not. The token is never returned. */
  facebookAccessTokenSet: boolean;
};

/** What a campaign is saved with. The token is left out unless a new one was typed. */
export type CampaignFields = {
  name: string;
  mediaSource: string;
  campaign: string;
  utmMedium: string;
  adset: string | null;
  ad: string | null;
  facebookPixelId: string | null;
  googlePixelId: string | null;
  tiktokPixelId: string | null;
  channelCodes: string[];
  remark: string | null;
  enabled: boolean;
  facebookAccessToken?: string;
};

/** The `code` is the key of the campaign: it is sent when the campaign is made and never after. */
export type CampaignCreate = CampaignFields & { code: string };

export const LINK_PLATFORMS = ['FACEBOOK', 'GOOGLE', 'TIKTOK'] as const;
export type LinkPlatform = (typeof LINK_PLATFORMS)[number];

export type LinkQuery = {
  platform: LinkPlatform;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

// ---- costs (投放成本, ATTRIBUTION:MANAGE) ----

/** `GET /attribution/costs`: the columns of `AttributionCost` plus the name of who entered it. */
export type AttributionCost = {
  id: string;
  campaignId: string;
  /** A UTC day, `YYYY-MM-DD`. */
  statDate: string;
  /** A number; a decimal written as text is read as well. */
  amount: number | string;
  currency: string;
  remark: string | null;
  createdBy: string | null;
  createdByUsername: string | null;
  createdAt: string;
  updatedAt: string;
};

/** The body of `POST /attribution/costs` and `PUT /attribution/costs/{id}`. */
export type CostBody = {
  campaignId: string;
  statDate: string;
  amount: number;
  /** Left out when the one currency of the system is not known to the page: the backend fixes it. */
  currency?: string;
  remark: string | null;
};

export type CostQuery = {
  campaignId?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

export type { CostRow } from './parseCostBatch';

// ---- performance (投放效果, ATTRIBUTION:VIEW) ----

export const PERFORMANCE_GROUPS = ['campaign', 'day'] as const;
export type PerformanceGroup = (typeof PERFORMANCE_GROUPS)[number];

/**
 * A row of `GET /attribution/performance` (contract 10.5): the columns of `StatAttributionDaily` and
 * the rates. A campaign is named by `campaignId` (0 is the row of the installs that matched no
 * campaign); `campaignCode` and `campaignName` are read when the backend sends them.
 */
export type PerformanceRow = {
  campaignId?: string | number | null;
  campaignCode?: string | null;
  campaignName?: string | null;
  statDate?: string | null;
  pageViews?: number | null;
  clicks?: number | null;
  clickRate?: number | null;
  installs?: number | null;
  installRate?: number | null;
  registered?: number | null;
  registerRate?: number | null;
  cost?: number | string | null;
  cpa?: number | string | null;
  cpi?: number | string | null;
  /** Only on the row of campaign 0. */
  unattributedInstalls?: number | null;
};

// ---- the attribution details (归因明细, ATTRIBUTION:VIEW) ----

export const CLICK_STATUSES = ['PENDING', 'MATCHED', 'EXPIRED'] as const;
export type ClickStatus = (typeof CLICK_STATUSES)[number];

export const CLICK_CHANNELS = ['STORE_REDIRECT', 'APK_DOWNLOAD'] as const;
export type ClickChannel = (typeof CLICK_CHANNELS)[number];

/** `GET /attribution/clicks` (backend reply 11). `ip` is masked unless the administrator holds `ANALYTICS:IP_VIEW`. */
export type AttributionClick = {
  id: string;
  clickedAt: string;
  campaignId: string;
  campaignName: string | null;
  status: ClickStatus;
  channel: ClickChannel;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  ip: string | null;
  claimedAt: string | null;
};

export type ClicksQuery = {
  from?: string;
  to?: string;
  campaignId?: string;
  status?: ClickStatus;
  keyword?: string;
  page: number;
  pageSize: number;
};

export const RECORD_SOURCES = ['APPSFLYER', 'SELF'] as const;
export type RecordSource = (typeof RECORD_SOURCES)[number];

export const MATCH_TYPES = ['APK_BLOCK', 'REFERRER', 'FINGERPRINT'] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

/** `GET /attribution/records` (backend note 5): neither the device nor the platform's own identifiers are returned. */
export type AttributionRecord = {
  id: string;
  source: RecordSource;
  eventName: string | null;
  eventTime: string;
  conversionType: string | null;
  campaignType: string | null;
  mediaSource: string | null;
  campaign: string | null;
  adset: string | null;
  ad: string | null;
  installTime: string | null;
  isRetargeting: boolean | null;
  platform: string | null;
  countryCode: string | null;
  appVersion: string | null;
  cost: number | string | null;
  costCurrency: string | null;
  costModel: string | null;
  costInSelectedCurrency: number | string | null;
  accountId: string | null;
  registeredAt: string | null;
  matchType: MatchType | null;
  attributionCampaignId: string | null;
};

export type RecordsQuery = {
  source?: RecordSource;
  matchType?: MatchType;
  /** ISO-8601 instants; `from` is included and `to` is not. */
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

export const SUMMARY_GROUPS = ['source', 'media_source', 'campaign'] as const;
export type SummaryGroup = (typeof SUMMARY_GROUPS)[number];

export type SummaryCost = { currency: string; amount: number | string };

/** `GET /attribution/summary` (backend note 5): not paged; `costs` is empty when there is no cost. */
export type SummaryRow = {
  source: RecordSource;
  key: string | null;
  installs: number | null;
  activations: number | null;
  costs: SummaryCost[];
};

export type SummaryQuery = {
  groupBy: SummaryGroup;
  /** `YYYY-MM-DD`, UTC days, both ends included. */
  from?: string;
  to?: string;
};
