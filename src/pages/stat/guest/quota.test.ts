import { describe, expect, it } from 'vitest';
import type { GuestQuota } from '../../../services/stats/types';
import { bucketConversionRate, QUOTA_BUCKETS, quotaCards } from './quota';

const quota = (over: Partial<GuestQuota> = {}): GuestQuota => ({
  configuredTotalSeconds: 600,
  devices: 1000,
  noGrant: 200,
  neverCalled: 200,
  avgUsedSeconds: 150,
  exhausted: 400,
  buckets: {
    ZERO: { devices: 200, converted: 4 },
    LE_25: { devices: 100, converted: 5 },
    LE_50: { devices: 100, converted: 6 },
    LE_75: { devices: 100, converted: 7 },
    LT_100: { devices: 100, converted: 8 },
    GE_100: { devices: 200, converted: 60 },
  },
  ...over,
});

describe('quotaCards', () => {
  it('uses the devices that were given an allowance as the denominator of both shares', () => {
    const cards = quotaCards(quota());
    expect(cards.neverCalledShare).toBe(0.25); // 200 / (1000 - 200)
    expect(cards.exhaustedShare).toBe(0.5); // 400 / 800
    expect(cards.avgUsedMinutes).toBe(2.5); // 150 / 60
    expect(cards.configuredMinutes).toBe(10); // 600 / 60
    expect(cards.devices).toBe(1000);
    expect(cards.noGrant).toBe(200);
  });

  it('gives a dash (null) for both shares when every device has no allowance', () => {
    const cards = quotaCards(
      quota({ devices: 50, noGrant: 50, neverCalled: 0, exhausted: 0, avgUsedSeconds: null }),
    );
    expect(cards.neverCalledShare).toBeNull();
    expect(cards.exhaustedShare).toBeNull();
    expect(cards.avgUsedMinutes).toBeNull();
  });

  it('gives a dash for no devices at all, and keeps a real 0 share as 0', () => {
    expect(quotaCards(quota({ devices: 0, noGrant: 0 })).neverCalledShare).toBeNull();
    const none = quotaCards(quota({ neverCalled: 0, exhausted: 0 }));
    expect(none.neverCalledShare).toBe(0);
    expect(none.exhaustedShare).toBe(0);
  });

  it('keeps "not configured" (null) apart from 0 minutes', () => {
    expect(quotaCards(quota({ configuredTotalSeconds: null })).configuredMinutes).toBeNull();
    expect(quotaCards(quota({ configuredTotalSeconds: 0 })).configuredMinutes).toBe(0);
  });

  it('keeps an average of 0 seconds as 0 minutes', () => {
    expect(quotaCards(quota({ avgUsedSeconds: 0 })).avgUsedMinutes).toBe(0);
  });
});

describe('the six buckets', () => {
  it('are in the order of the contract', () => {
    expect(QUOTA_BUCKETS).toEqual(['ZERO', 'LE_25', 'LE_50', 'LE_75', 'LT_100', 'GE_100']);
  });

  it('have a conversion rate of converted over devices, a dash for no devices', () => {
    expect(bucketConversionRate({ devices: 200, converted: 60 })).toBe(0.3);
    expect(bucketConversionRate({ devices: 0, converted: 0 })).toBeNull();
    expect(bucketConversionRate({ devices: 10, converted: 0 })).toBe(0);
  });
});
