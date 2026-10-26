import type { GuestQuota, GuestQuotaBucketKey } from '../../../services/stats/types';
import { safeRatio } from '../../../utils/ratio';

/** The six buckets by share of the device's own allowance used, in the order of the contract. */
export const QUOTA_BUCKETS: GuestQuotaBucketKey[] = [
  'ZERO',
  'LE_25',
  'LE_50',
  'LE_75',
  'LT_100',
  'GE_100',
];

const minutes = (seconds: number | null): number | null =>
  seconds === null || !Number.isFinite(seconds) ? null : seconds / 60;

/**
 * The numbers of the six cards. The two shares are over the devices that were given an allowance
 * (`devices - noGrant`); with none of those there is no share (null, shown as a dash), not 0%.
 * `configuredMinutes` null means the setting is not configured, which is not the same as 0.
 */
export function quotaCards(quota: GuestQuota) {
  const granted = quota.devices - quota.noGrant;
  return {
    configuredMinutes: minutes(quota.configuredTotalSeconds),
    devices: quota.devices,
    noGrant: quota.noGrant,
    neverCalledShare: granted > 0 ? safeRatio(quota.neverCalled, granted) : null,
    exhaustedShare: granted > 0 ? safeRatio(quota.exhausted, granted) : null,
    avgUsedMinutes: minutes(quota.avgUsedSeconds),
  };
}

/** `converted / devices` of one bucket; no devices, no rate. */
export function bucketConversionRate(bucket: {
  devices: number;
  converted: number;
}): number | null {
  return safeRatio(bucket.converted, bucket.devices);
}
