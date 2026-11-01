import { currentValue, saved } from './configStore';

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

/**
 * The settings that `GET /meta` repeats, by the field it repeats them in. A field not named here has
 * no setting of its own in the list (limits the backend fixes).
 */
export const META_SETTING_KEY: Partial<Record<keyof typeof META_DEFAULTS, string>> = {
  supportedLocales: 'app.supported_locales',
  landIntervalMinutes: 'stats.land_interval_minutes',
  allowedCurrencies: 'usage_price.allowed_currencies',
  deletionAlertAfterFailures: 'deletion.alert_after_failures',
  inviteChainMaxDepth: 'invite.chain_max_depth',
  maxRecipients: 'notification.max_recipients',
  pushImageMaxBytes: 'upload.push_image_max_bytes',
  statsMaxRangeDays: 'stats.max_range_days',
  analyticsLiveMaxRangeDays: 'analytics.live_max_range_days',
  abuseClusterMinFreeAccounts: 'abuse.cluster_min_free_accounts',
  attributionClickRetentionDays: 'attribution.click_retention_days',
  declarationRequired: 'avatar.declaration_required',
  uploadMaxBytes: 'upload.max_bytes',
  adMediaMaxBytes: 'upload.ad_media_max_bytes',
  apkMaxBytes: 'upload.apk_max_bytes',
  renderAssetMaxBytes: 'upload.render_asset_max_bytes',
};

/**
 * The answer of `GET /meta` now: the defaults above, with the value of every setting that has been
 * saved through `PUT /config/{key}` in place of its default (a reset brings the default back). A
 * setting that was never saved leaves the field as it is above, so that the language list stays the
 * seven of the fake backend until someone saves one. A copy each time.
 */
export function currentMeta(): Record<string, unknown> {
  const meta = structuredClone(META_DEFAULTS) as Record<string, unknown>;
  for (const [field, key] of Object.entries(META_SETTING_KEY)) {
    if (key !== undefined && saved.has(key)) meta[field] = structuredClone(currentValue(key));
  }
  return meta;
}
