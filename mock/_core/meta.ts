// `GET /api/admin/meta`: twelve configuration values (the defaults of contract 17.5; a key without
// a default would be null) and eight upload limits (backend reply 3). The one value that is not the
// contract's default is `supportedLocales`: the fake backend lists the seven languages of the product
// (the default is only `en`), so that the language tabs and the template matrix can be looked at with
// Thai, Arabic, Indonesian, Vietnamese, Spanish, English and Chinese.
export const META_DEFAULTS = {
  supportedLocales: ['en', 'zh-Hans', 'th', 'ar', 'id', 'vi', 'es'],
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
