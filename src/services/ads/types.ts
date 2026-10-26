// The shapes of the in-app ad endpoints (contract 22.3, 22.9; the report rows are those of the
// backend's reply, item 18). A field that the contract does not pin down to one type is read with
// the helpers of the pages, never shown as it comes.

export type Page<T> = { items: T[]; total: number };

export const CAMPAIGN_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const UNIT_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED'] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export const AD_FORMATS = ['SPLASH', 'INTERSTITIAL', 'NATIVE', 'REWARDED'] as const;
export type AdFormat = (typeof AD_FORMATS)[number];

export const REVIEW_STATUSES = ['DRAFT', 'APPROVED', 'REJECTED'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const SERVING_STATUSES = ['ACTIVE', 'PAUSED'] as const;
export type ServingStatus = (typeof SERVING_STATUSES)[number];

export const CREATIVE_TYPES = ['IMAGE', 'VIDEO'] as const;
export type CreativeType = (typeof CREATIVE_TYPES)[number];

export const CLICK_ACTIONS = ['OPEN_URL', 'DEEP_LINK', 'IN_APP_ROUTE'] as const;
export type ClickAction = (typeof CLICK_ACTIONS)[number];

/** The eleven reasons an ad request got no ad (contract 22.4). */
export const NO_FILL_REASONS = [
  'GLOBAL_OFF',
  'ENTITLEMENT_OFF',
  'PLACEMENT_OFF',
  'NOT_FOR_GUEST',
  'FREQ_CAP',
  'COOLDOWN_SUPPRESSED',
  'NO_ELIGIBLE_UNIT',
  'TARGETING_MISS',
  'UNIT_DAILY_CAP',
  'NO_CREATIVE',
  'META_WRITE_FAIL',
] as const;
export type NoFillReason = (typeof NO_FILL_REASONS)[number];

export type AdCampaign = {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  priority: number;
  startAt: string | null;
  endAt: string | null;
  createdBy: string | null;
  createdByUsername: string | null;
  updatedBy: string | null;
  updatedByUsername: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignInput = {
  name: string;
  description: string | null;
  priority: number;
  startAt: string | null;
  endAt: string | null;
};

/** The update is a JSON Merge Patch: a field that is not there stays, an explicit `null` clears it. */
export type CampaignPatch = Partial<CampaignInput>;

export type AdPlacement = {
  id: string;
  slotKey: string;
  adFormat: AdFormat;
  name: string;
  enabled: boolean;
  frequencyCap: number | null;
  cooldownMinutes: number | null;
  rewardCredits: number | null;
  creativeAspect: string | null;
  creativeMinShortSide: number | null;
  creativeMaxBytes: number | null;
  updatedAt: string | null;
};

export type PlacementPatch = {
  enabled?: boolean;
  frequencyCap?: number;
  cooldownMinutes?: number;
  rewardCredits?: number;
};

/** `AdUnit.targeting` (contract 22.5): snake_case keys, all optional; an empty one means "no limit". */
export type DayPart = { start: string; end: string };
export type Targeting = {
  platforms?: string[] | null;
  geo?: string[] | null;
  os_version_min?: string | null;
  app_version_min?: string | null;
  languages?: string[] | null;
  day_parts?: DayPart[] | null;
};

export type AdUnit = {
  id: string;
  campaignId: string;
  placementId: string;
  name: string;
  status: UnitStatus;
  targeting: Targeting | null;
  weight: number | null;
  dailyImpressionCap: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type UnitInput = {
  campaignId: string;
  placementId: string;
  name: string;
  weight: number;
  dailyImpressionCap: number;
  targeting: Targeting;
};

/** Only these four are changed by `PUT /ads/units/{id}`; the campaign and the placement are fixed. */
export type UnitPatch = {
  name?: string;
  targeting?: Targeting;
  weight?: number;
  dailyImpressionCap?: number;
};

export type AdCreative = {
  id: string;
  adUnitId: string;
  type: CreativeType;
  uploadId: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  durationSeconds: number | null;
  clickAction: ClickAction;
  clickTarget: string | null;
  language: string;
  reviewStatus: ReviewStatus;
  servingStatus: ServingStatus;
  weight: number | null;
  rewardAfterSeconds: number | null;
  skippable: boolean;
  title: string | null;
  body: string | null;
  ctaText: string | null;
  advertiserName: string | null;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedByUsername: string | null;
  reviewedAt: string | null;
  createdBy: string | null;
  createdByUsername: string | null;
  createdAt: string;
  updatedAt: string;
};

/** What the form sends. Of the file only the upload id: the size, the dimensions and the addresses come from the upload record. */
export type CreativeFields = {
  clickAction: ClickAction;
  clickTarget: string;
  language: string;
  weight: number;
  skippable: boolean;
  rewardAfterSeconds: number | null;
  title: string | null;
  body: string | null;
  ctaText: string | null;
  advertiserName: string | null;
};

export type CreativeInput = CreativeFields & { adUnitId: string; uploadId: string };
export type CreativePatch = Partial<CreativeFields> & { uploadId?: string };

export type CreativeWarning = { code: string; message: string };

/** What `POST /ads/media` answers (contract 22.9). */
export type MediaUpload = {
  uploadId: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  durationSeconds: number | null;
  mediaType: 'IMAGE' | 'VIDEO' | string;
};

export type AdsMeta = { geoConfigured: boolean | null };

// ---- reports ----

export type ReportParams = {
  from: string;
  to: string;
  platform?: string;
  channelCode?: string;
};

/** The numbers of one row; the ratios are null when their denominator is 0. There is no count of distinct users. */
export type AdMetrics = {
  impressions: number | null;
  guestImpressions: number | null;
  starts: number | null;
  viewableImpressions: number | null;
  nonViewableImpressions: number | null;
  undeterminedImpressions: number | null;
  clicks: number | null;
  completions: number | null;
  skips: number | null;
  errors: number | null;
  totalWatchSeconds: number | null;
  ctr?: number | null;
  completionRate?: number | null;
  viewableRate?: number | null;
  measurableRate?: number | null;
  avgWatchSeconds?: number | null;
};

export type ReportOverview = {
  totals: Partial<AdMetrics>;
  daily: {
    statDate: string;
    impressions: number | null;
    clicks: number | null;
    completions: number | null;
  }[];
};

export type PlacementRow = AdMetrics & {
  placementId: string;
  slotKey: string;
  placementName: string;
};
export type CampaignRow = AdMetrics & { campaignId: string; campaignName: string };
export type CreativeRow = AdMetrics & { creativeId: string; creativeTitle: string | null };
/** The empty text is "unknown country". */
export type CountryRow = AdMetrics & { country: string };
/** No platform and no channel: the table is the total of what the filter selects. */
export type NoFillRow = { statDate: string; slotKey: string; reason: string; cnt: number };

export type ReportName =
  | 'overview'
  | 'by-placement'
  | 'by-campaign'
  | 'by-creative'
  | 'by-country'
  | 'nofill';
export type ListReportName = Exclude<ReportName, 'overview'>;
