// `GET /api/admin/meta`: twelve configuration values (the defaults of contract 17.5; a key without
// a default would be null) and eight upload limits (backend reply 3).
export const META_DEFAULTS = {
  supportedLocales: ['en'],
  landIntervalMinutes: 15,
  allowedCurrencies: ['USD'],
  deletionAlertAfterFailures: 5,
  inviteChainMaxDepth: 5,
  maxRecipients: 1000,
  pushImageMaxBytes: 1048576,
  statsMaxRangeDays: 366,
  analyticsLiveMaxRangeDays: 31,
  abuseClusterMinFreeAccounts: 5,
  attributionClickRetentionDays: 30,
  declarationRequired: true,
  uploadMaxBytes: 209715200,
  adMediaMaxBytes: 52428800,
  apkMaxBytes: 104857600,
  renderAssetMaxBytes: 104857600,
  catalogImageMaxBytes: 2097152,
  catalogImageMaxPixels: 36000000,
  adImageMaxPixels: 36000000,
  defaultAvatarSourceMaxPixels: 250000000,
} as const;

export const META_FIELDS = Object.keys(META_DEFAULTS);
