import type {
  EntitlementDef,
  FeatureGate,
  FeatureKind,
  FeatureValue,
  TimelineEvent,
} from '../../services/subscriptions';
import { trimSpec } from '../../utils/trimSpec';

// The rules about the feature switches that the pages share (contract 15.3, spec 5.10).

export const CALL_KEYS = ['call.daily_minutes', 'call.monthly_minutes', 'call.lifetime_minutes'];
export const CHAT_KEYS = ['chat.daily_messages', 'chat.monthly_messages'];
/** The five quota switches: the only ones whose default may be "not configured". */
export const QUOTA_KEYS = [...CALL_KEYS, ...CHAT_KEYS];

export const LIFETIME_KEY = 'call.lifetime_minutes';
export const PERIOD_GRANT_KEY = 'credits.period_grant';
export const LOOKS_MAX_KEY = 'avatar.looks_max';

/** `UNSET` can be the default of a switch only for the five quota switches. */
export const allowUnsetForDefault = (key: string): boolean => QUOTA_KEYS.includes(key);

/** "No limit" makes sense for a number limit, but a period grant is a quantity, not a limit. */
export const allowUnlimitedFor = (gate: Pick<FeatureGate, 'key' | 'kind'>): boolean =>
  gate.kind === 'LIMIT' && gate.key !== PERIOD_GRANT_KEY;

/** `call.lifetime_minutes` only applies to free accounts; the backend refuses it in an entitlement. */
export const hiddenInEntitlement = (key: string): boolean => key === LIFETIME_KEY;

/** A credit price can be set on a permanent limit; the looks limit and the period grant never have one. */
export const creditCostEditable = (
  gate: Pick<FeatureGate, 'key' | 'kind' | 'limitScope'>,
): boolean =>
  gate.kind === 'LIMIT' &&
  gate.limitScope === 'PERMANENT' &&
  gate.key !== LOOKS_MAX_KEY &&
  gate.key !== PERIOD_GRANT_KEY;

const defaultOf = (gates: readonly FeatureGate[], key: string): FeatureGate | undefined =>
  gates.find((g) => g.key === key);

/**
 * The two red bars at the top of the switch page. A bar shows when every switch of its group has
 * the default "not configured"; one configured switch (a number, "no limit" or 0) is enough to
 * clear it. A switch the server did not list is unknown, so it says nothing.
 */
export function quotaBanners(gates: readonly FeatureGate[]): { call: boolean; chat: boolean } {
  const allUnset = (keys: string[]) =>
    keys.every((key) => defaultOf(gates, key)?.defaultMode === 'UNSET');
  return { call: allUnset(CALL_KEYS), chat: allUnset(CHAT_KEYS) };
}

/**
 * The reminder when saving an entitlement's values or a product mapping: a pair of switches
 * (`call.daily_minutes` and `call.monthly_minutes`; `chat.daily_messages` and `chat.monthly_messages`)
 * that this entitlement does not set and whose defaults are not set either means its subscribers
 * have no daily or monthly limit. One of them with a value is enough (contract 15.3: setting one key
 * is enough). `values` holds only the switches the entitlement has a state for; a missing one is UNSET.
 */
export function unrestrictedQuota(
  values: Readonly<Record<string, FeatureValue | undefined>>,
  gates: readonly FeatureGate[],
): { call: boolean; chat: boolean } {
  const unrestricted = (pair: string[]) => {
    const known = pair.every((key) => defaultOf(gates, key));
    if (!known) return false;
    const entitlementUnset = pair.every((key) => (values[key]?.mode ?? 'UNSET') === 'UNSET');
    const defaultsUnset = pair.every((key) => defaultOf(gates, key)?.defaultMode === 'UNSET');
    return entitlementUnset && defaultsUnset;
  };
  return {
    call: unrestricted(['call.daily_minutes', 'call.monthly_minutes']),
    chat: unrestricted(CHAT_KEYS),
  };
}

/** The feature states of a definition, by switch. */
export const valuesOf = (def: EntitlementDef): Record<string, FeatureValue> =>
  Object.fromEntries(
    def.features.map((f): [string, FeatureValue] => [
      f.featureKey,
      f.mode === 'VALUE'
        ? { mode: 'VALUE', value: f.value }
        : f.mode === 'UNLIMITED'
          ? { mode: 'UNLIMITED' }
          : { mode: 'UNSET' },
    ]),
  );

/** The same state, for comparing a draft with what was loaded. */
export const sameValue = (a: FeatureValue | undefined, b: FeatureValue | undefined): boolean => {
  const x = a ?? { mode: 'UNSET' as const };
  const y = b ?? { mode: 'UNSET' as const };
  if (x.mode !== y.mode) return false;
  return x.mode === 'VALUE' && y.mode === 'VALUE' ? Object.is(x.value, y.value) : true;
};

/**
 * What the form refuses before it sends, as a reason code of the language files (`reason.<code>`),
 * or null. The size of a limit is not checked here: its upper end is a configuration value the
 * browser is not given, so the server answers for it.
 */
export function valueProblem(kind: FeatureKind, value: unknown): string | null {
  if (value === null || value === undefined) return 'EMPTY_NOT_ALLOWED';
  switch (kind) {
    case 'BOOLEAN':
      return typeof value === 'boolean' ? null : 'NOT_BOOLEAN';
    case 'LIMIT':
      if (typeof value !== 'number' || !Number.isInteger(value)) return 'NOT_AN_INTEGER';
      return value < 0 ? 'OUT_OF_RANGE' : null;
    case 'STRING':
      return typeof value === 'string' && trimSpec(value) !== '' ? null : 'EMPTY_NOT_ALLOWED';
  }
}

const instant = (iso: string): number => {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
};

/** Newest event (by the time the store signed it) first; the one received later first on a tie. */
export function sortTimeline(events: readonly TimelineEvent[]): TimelineEvent[] {
  return [...events].sort(
    (a, b) =>
      instant(b.eventSignedAt) - instant(a.eventSignedAt) ||
      instant(b.receivedAt) - instant(a.receivedAt),
  );
}
