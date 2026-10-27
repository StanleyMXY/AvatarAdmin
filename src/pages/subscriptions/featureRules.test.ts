import { describe, expect, it } from 'vitest';
import type { FeatureGate, FeatureValue, TimelineEvent } from '../../services/subscriptions';
import {
  allowUnlimitedFor,
  allowUnsetForDefault,
  creditCostEditable,
  hiddenInEntitlement,
  quotaBanners,
  sortTimeline,
  unrestrictedQuota,
  valueProblem,
} from './featureRules';

const gate = (over: Partial<FeatureGate> & { key: string }): FeatureGate => ({
  kind: 'LIMIT',
  limitScope: 'PERIODIC',
  defaultMode: 'UNSET',
  defaultValue: null,
  creditCost: null,
  description: '',
  ...over,
});

const QUOTA = [
  'call.daily_minutes',
  'call.monthly_minutes',
  'call.lifetime_minutes',
  'chat.daily_messages',
  'chat.monthly_messages',
];

const allUnset = () => QUOTA.map((key) => gate({ key }));
const withDefault = (gates: FeatureGate[], key: string, value: number) =>
  gates.map((g) =>
    g.key === key ? { ...g, defaultMode: 'VALUE' as const, defaultValue: value } : g,
  );

describe('which states a feature value may take', () => {
  it('lets UNSET be a default only on the five quota switches', () => {
    for (const key of QUOTA) expect(allowUnsetForDefault(key), key).toBe(true);
    for (const key of [
      'assets.avatar_max',
      'memory.tier',
      'ads.removed',
      'credits.period_grant',
      'avatar.looks_max',
    ])
      expect(allowUnsetForDefault(key), key).toBe(false);
  });

  it('allows "no limit" for a LIMIT switch other than credits.period_grant', () => {
    expect(allowUnlimitedFor(gate({ key: 'assets.avatar_max', limitScope: 'PERMANENT' }))).toBe(
      true,
    );
    expect(allowUnlimitedFor(gate({ key: 'avatar.looks_max', limitScope: 'PERMANENT' }))).toBe(
      true,
    );
    expect(allowUnlimitedFor(gate({ key: 'credits.period_grant' }))).toBe(false);
    expect(allowUnlimitedFor(gate({ key: 'ads.removed', kind: 'BOOLEAN', limitScope: null }))).toBe(
      false,
    );
    expect(allowUnlimitedFor(gate({ key: 'memory.tier', kind: 'STRING', limitScope: null }))).toBe(
      false,
    );
  });

  it('keeps call.lifetime_minutes out of the values of an entitlement', () => {
    expect(hiddenInEntitlement('call.lifetime_minutes')).toBe(true);
    expect(hiddenInEntitlement('call.daily_minutes')).toBe(false);
  });

  it('lets only a permanent LIMIT have a credit price, and not avatar.looks_max or credits.period_grant', () => {
    expect(creditCostEditable(gate({ key: 'assets.avatar_max', limitScope: 'PERMANENT' }))).toBe(
      true,
    );
    expect(creditCostEditable(gate({ key: 'avatar.looks_max', limitScope: 'PERMANENT' }))).toBe(
      false,
    );
    expect(creditCostEditable(gate({ key: 'credits.period_grant', limitScope: 'PERIODIC' }))).toBe(
      false,
    );
    expect(creditCostEditable(gate({ key: 'call.daily_minutes', limitScope: 'PERIODIC' }))).toBe(
      false,
    );
    expect(creditCostEditable(gate({ key: 'call.lifetime_minutes', limitScope: 'LIFETIME' }))).toBe(
      false,
    );
    expect(
      creditCostEditable(gate({ key: 'ads.removed', kind: 'BOOLEAN', limitScope: null })),
    ).toBe(false);
    // even if a permanent switch were named credits.period_grant it stays disabled
    expect(creditCostEditable(gate({ key: 'credits.period_grant', limitScope: 'PERMANENT' }))).toBe(
      false,
    );
  });
});

describe('the red bars on the switch page', () => {
  it('shows the call bar when all three call defaults are unset', () => {
    expect(quotaBanners(allUnset())).toEqual({ call: true, chat: true });
  });

  it('shows no call bar when only one of the three call defaults is set, whichever one', () => {
    for (const key of ['call.daily_minutes', 'call.monthly_minutes', 'call.lifetime_minutes']) {
      expect(quotaBanners(withDefault(allUnset(), key, 10)).call, key).toBe(false);
    }
  });

  it('treats "no limit" and 0 as set (0 means "not allowed", not "not configured")', () => {
    const unlimited = allUnset().map((g) =>
      g.key === 'call.daily_minutes' ? { ...g, defaultMode: 'UNLIMITED' as const } : g,
    );
    expect(quotaBanners(unlimited).call).toBe(false);
    expect(quotaBanners(withDefault(allUnset(), 'call.monthly_minutes', 0)).call).toBe(false);
  });

  it('judges the two text switches on their own: one of the two set clears the text bar only', () => {
    const chat = quotaBanners(withDefault(allUnset(), 'chat.daily_messages', 20));
    expect(chat).toEqual({ call: true, chat: false });
    const call = quotaBanners(withDefault(allUnset(), 'call.daily_minutes', 5));
    expect(call).toEqual({ call: false, chat: true });
  });

  it('says nothing about a switch the server did not list', () => {
    expect(quotaBanners([])).toEqual({ call: false, chat: false });
    expect(quotaBanners(allUnset().filter((g) => g.key !== 'call.lifetime_minutes')).call).toBe(
      false,
    );
  });
});

describe('the reminder when an entitlement leaves the quotas unset', () => {
  const unset: FeatureValue = { mode: 'UNSET' };
  const value = (n: number): FeatureValue => ({ mode: 'VALUE', value: n });

  it('warns for calls when the entitlement sets neither call.daily_minutes nor call.monthly_minutes and neither default is set', () => {
    expect(unrestrictedQuota({}, allUnset())).toEqual({ call: true, chat: true });
    expect(
      unrestrictedQuota({ 'call.daily_minutes': unset, 'call.monthly_minutes': unset }, allUnset())
        .call,
    ).toBe(true);
  });

  it('does not warn when either key has a value in the entitlement, a number or "no limit"', () => {
    expect(unrestrictedQuota({ 'call.daily_minutes': value(30) }, allUnset()).call).toBe(false);
    expect(unrestrictedQuota({ 'call.monthly_minutes': value(600) }, allUnset()).call).toBe(false);
    expect(
      unrestrictedQuota({ 'call.monthly_minutes': { mode: 'UNLIMITED' } }, allUnset()).call,
    ).toBe(false);
    expect(unrestrictedQuota({ 'call.daily_minutes': value(0) }, allUnset()).call).toBe(false);
  });

  it('does not warn when either default of the two is set, even if the entitlement sets nothing', () => {
    expect(unrestrictedQuota({}, withDefault(allUnset(), 'call.daily_minutes', 5)).call).toBe(
      false,
    );
    expect(unrestrictedQuota({}, withDefault(allUnset(), 'call.monthly_minutes', 5)).call).toBe(
      false,
    );
  });

  it('is not moved by call.lifetime_minutes, which only free accounts use', () => {
    expect(unrestrictedQuota({}, withDefault(allUnset(), 'call.lifetime_minutes', 30)).call).toBe(
      true,
    );
  });

  it('judges the text switches the same way, on their own', () => {
    expect(unrestrictedQuota({ 'chat.daily_messages': value(50) }, allUnset())).toEqual({
      call: true,
      chat: false,
    });
    expect(unrestrictedQuota({}, withDefault(allUnset(), 'chat.monthly_messages', 9))).toEqual({
      call: true,
      chat: false,
    });
  });

  it('does not warn while the switches are not known', () => {
    expect(unrestrictedQuota({}, [])).toEqual({ call: false, chat: false });
  });
});

describe('what the form refuses before it sends', () => {
  it('asks for a value for every kind, and for a whole number of 0 or more for a limit', () => {
    expect(valueProblem('LIMIT', null)).toBe('EMPTY_NOT_ALLOWED');
    expect(valueProblem('LIMIT', 0)).toBeNull();
    expect(valueProblem('LIMIT', 7)).toBeNull();
    expect(valueProblem('LIMIT', 1.5)).toBe('NOT_AN_INTEGER');
    expect(valueProblem('LIMIT', Number.NaN)).toBe('NOT_AN_INTEGER');
    expect(valueProblem('LIMIT', -1)).toBe('OUT_OF_RANGE');
    expect(valueProblem('STRING', '')).toBe('EMPTY_NOT_ALLOWED');
    expect(valueProblem('STRING', '  ')).toBe('EMPTY_NOT_ALLOWED');
    expect(valueProblem('STRING', 'premium')).toBeNull();
    expect(valueProblem('BOOLEAN', false)).toBeNull();
    expect(valueProblem('BOOLEAN', null)).toBe('EMPTY_NOT_ALLOWED');
  });
});

describe('the event timeline', () => {
  const ev = (id: string, signed: string, received: string): TimelineEvent => ({
    id,
    type: 'DID_RENEW',
    subtype: null,
    eventSignedAt: signed,
    receivedAt: received,
    processedAt: null,
    error: null,
    needsAttention: false,
  });

  it('is newest signed first, whatever order it arrives in, and the later received first on a tie', () => {
    const sorted = sortTimeline([
      ev('a', '2026-10-01T00:00:00Z', '2026-10-01T00:00:05Z'),
      ev('b', '2026-10-03T00:00:00Z', '2026-10-03T00:00:05Z'),
      ev('c', '2026-10-02T00:00:00Z', '2026-10-02T00:00:05Z'),
      ev('d', '2026-10-02T00:00:00Z', '2026-10-02T00:00:09Z'),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['b', 'd', 'c', 'a']);
  });

  it('orders by the instant, not by the text (an offset writes the same moment differently)', () => {
    const sorted = sortTimeline([
      // 08:00+08:00 is 00:00Z: earlier than 01:00Z although its text sorts later
      ev('early', '2026-10-02T08:00:00+08:00', '2026-10-02T00:00:05Z'),
      ev('late', '2026-10-02T01:00:00Z', '2026-10-02T01:00:05Z'),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['late', 'early']);
  });

  it('does not change the array it is given', () => {
    const input = [
      ev('a', '2026-10-01T00:00:00Z', '2026-10-01T00:00:05Z'),
      ev('b', '2026-10-03T00:00:00Z', '2026-10-03T00:00:05Z'),
    ];
    sortTimeline(input);
    expect(input.map((e) => e.id)).toEqual(['a', 'b']);
  });
});
