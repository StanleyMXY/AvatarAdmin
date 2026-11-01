import type { PermissionCode } from '../src/access/permissionCodes';
import { CONFIG_SCHEMA, specOf, validateValue } from '../src/pages/config/configSchema';
import { validateServerLink } from '../src/utils/linkRule';
import { adsState } from './_core/adsData';
import { guard, hasPermission } from './_core/auth';
import { campaignState } from './_core/campaignData';
import { currentValue, defaultOf, saved } from './_core/configStore';
import { bodyOf, invalidRequest, MockHttpError, ok } from './_core/http';
import { pushState } from './_core/pushData';
import { smsState } from './_core/smsData';

/** Keys this administrator may edit, by key name (contract 17.4: no 403, just fewer rows). */
const editableBy = (admin: Parameters<typeof hasPermission>[0]) =>
  CONFIG_SCHEMA.filter((spec) => hasPermission(admin, spec.editPermission as PermissionCode));

const bad = (key: string, reason: string) =>
  invalidRequest(`${key} is not valid`, [{ ref: key, reason }]);

// Relations between two keys (contract 17.5): `[smaller, larger]` must hold after the save.
// `strict`: the first must be below the second, not equal to it; `plus`: the second must be at least the first plus this.
const RELATIONS: { small: string; large: string; strict?: boolean }[] = [
  { small: 'retry.initial_seconds', large: 'retry.max_seconds' },
  { small: 'moderation.review_score', large: 'moderation.block_score', strict: true },
  { small: 'generation.voice_min_seconds', large: 'generation.voice_max_seconds' },
  { small: 'export.lease_minutes', large: 'export.job_timeout_minutes', strict: true },
];

/** What the server would refuse about `value` for `key`, as a reason code. The mock mirrors contract 17.5. */
function problemWith(key: string, value: unknown): string | null {
  const spec = specOf(key);
  if (!spec) return null;
  switch (spec.kind) {
    case 'int': {
      if (typeof value !== 'number' || !Number.isInteger(value)) return 'NOT_AN_INTEGER';
      if (spec.min !== undefined && value < spec.min) return 'OUT_OF_RANGE';
      if (spec.max !== undefined && value > spec.max) return 'OUT_OF_RANGE';
      if (spec.zeroOrMin !== undefined && value !== 0 && value < spec.zeroOrMin)
        return 'OUT_OF_RANGE';
      return null;
    }
    case 'number':
      return validateValue(spec, value);
    case 'bool':
      return typeof value === 'boolean' ? null : 'NOT_BOOLEAN';
    case 'url': {
      if (typeof value !== 'string') return 'NOT_HTTPS';
      const check = validateServerLink(value);
      return check.ok ? null : check.reasonKey;
    }
    case 'string':
      if (typeof value !== 'string' || value.length === 0) return 'EMPTY_NOT_ALLOWED';
      return validateValue(spec, value);
    case 'json':
      return spec.validate ? spec.validate(value) : null;
  }
}

function relationProblem(key: string, value: unknown): string | null {
  for (const { small, large, strict } of RELATIONS) {
    if (key !== small && key !== large) continue;
    const a = key === small ? value : currentValue(small);
    const b = key === large ? value : currentValue(large);
    if (typeof a === 'number' && typeof b === 'number' && (strict ? a >= b : a > b)) {
      return 'OUT_OF_RANGE';
    }
  }
  if (key === 'auth.access_ttl_minutes' && typeof value === 'number') {
    const days = currentValue('auth.refresh_ttl_days');
    if (typeof days === 'number' && value > days * 1440) return 'OUT_OF_RANGE';
  }
  if (key === 'auth.refresh_ttl_days' && typeof value === 'number') {
    const minutes = currentValue('auth.access_ttl_minutes');
    if (typeof minutes === 'number' && minutes > value * 1440) return 'OUT_OF_RANGE';
  }
  return null;
}

/** A refusal the way the backend words it: the message, the details (the saved key first) and extra `data` fields. */
type Refusal = { message: string; details: { ref: string; reason: string }[]; extra?: object };

const refused = ({ message, details, extra }: Refusal) =>
  new MockHttpError(400, 'INVALID_REQUEST', message, { details, ...extra });

const outOfRange = (...refs: string[]) => refs.map((ref) => ({ ref, reason: 'OUT_OF_RANGE' }));

/** The only language file that ships with the backend: a language needs `notification/templates/<tag>.json`. */
const SHIPPED_TEMPLATE_FILES = new Set(['en']);

/** The recall triggers of contract 8.4: the only reasons the default-language rule judges. */
const RECALL_REASONS = ['daily_recall', 'streak_at_risk'];

const numberOf = (key: string, saving: string, value: unknown): unknown =>
  key === saving ? value : currentValue(saving);

/**
 * The rules between two keys, and the rules that look at something else, for `value` becoming the
 * value of `key` (a reset passes the default). Contract 17.5 and the backend's checklist:
 * the default currency is among the allowed ones; catch-up minutes x 60 are at least 600 + the poll
 * seconds; the retention periods keep clear of the statistics landing window; a language needs its
 * template file; phone sign-in needs an English OTP template for every country.
 */
function refusalFor(key: string, value: unknown): Refusal | null {
  if (key === 'app.supported_locales' && Array.isArray(value)) {
    const missing = value.filter(
      (tag) => typeof tag === 'string' && !SHIPPED_TEMPLATE_FILES.has(tag.toLowerCase()),
    );
    if (missing.length > 0) {
      return {
        message: `${key} has languages without a notification template file: ${missing.join(', ')}`,
        details: outOfRange(key),
        extra: { missingLanguages: missing },
      };
    }
  }
  if (key === 'push.default_locale' && typeof value === 'string' && value !== '') {
    // Every recall reason with an enabled template needs an enabled template in the new language
    // (the tag is compared exactly); `data` names the language and the reasons that lack it.
    const reasons = RECALL_REASONS.filter(
      (reason) =>
        pushState.templates.some((t) => t.triggerReason === reason && t.enabled) &&
        !pushState.templates.some(
          (t) => t.triggerReason === reason && t.enabled && t.locale === value,
        ),
    ).sort();
    if (reasons.length > 0) {
      return {
        message: `push.default_locale cannot be ${value}: these recall reasons have enabled templates but none in ${value}: ${reasons.join(', ')}; enable the ${value} template of each of them first`,
        details: outOfRange(key),
        extra: { defaultLocale: value, reasons },
      };
    }
  }
  if (key === 'usage_price.default_currency' || key === 'usage_price.allowed_currencies') {
    const other =
      key === 'usage_price.default_currency'
        ? 'usage_price.allowed_currencies'
        : 'usage_price.default_currency';
    const def = numberOf(key, 'usage_price.default_currency', value);
    const allowed = numberOf(key, 'usage_price.allowed_currencies', value);
    if (Array.isArray(allowed) && typeof def === 'string' && !allowed.includes(def)) {
      return {
        message: 'usage_price.allowed_currencies must contain usage_price.default_currency',
        details: outOfRange(key, other),
      };
    }
  }
  if (key === 'push.schedule_catchup_minutes' || key === 'push.task_poll_seconds') {
    const other =
      key === 'push.task_poll_seconds' ? 'push.schedule_catchup_minutes' : 'push.task_poll_seconds';
    const catchup = numberOf(key, 'push.schedule_catchup_minutes', value);
    const poll = numberOf(key, 'push.task_poll_seconds', value);
    if (typeof catchup === 'number' && typeof poll === 'number' && catchup * 60 < 600 + poll) {
      return {
        message: 'push.schedule_catchup_minutes x 60 must be at least 600 + push.task_poll_seconds',
        details: outOfRange(key, other),
      };
    }
  }
  // Each retention period against the statistics landing window: [key, least value for a window w].
  const needs: [string, (window: number) => number, (v: number) => boolean][] = [
    ['events.ttl_days', (w) => 30 + w, () => true],
    ['chat.message_retention_days', (w) => w + 1, (v) => v > 0],
    ['guest.device_retention_days', (w) => 91 + w, (v) => v > 0],
  ];
  if (needs.some(([k]) => k === key) || key === 'stats.land_window_days') {
    const window = numberOf(key, 'stats.land_window_days', value);
    const broken = needs
      .filter(([k]) => k === key || key === 'stats.land_window_days')
      .filter(([k, least, applies]) => {
        const v = numberOf(key, k, value);
        return (
          typeof v === 'number' && typeof window === 'number' && applies(v) && v < least(window)
        );
      })
      .map(([k]) => k);
    if (broken.length > 0) {
      const refs =
        key === 'stats.land_window_days'
          ? ['stats.land_window_days', ...broken]
          : [key, 'stats.land_window_days'];
      return {
        message: `${key} is outside the range allowed with stats.land_window_days`,
        details: outOfRange(...refs),
      };
    }
  }
  if (key === 'invite.reward_start_at' || key === 'invite.reward_end_at') {
    // With both set, the start must be earlier than the end (instants, whatever zone they are written in).
    const other =
      key === 'invite.reward_start_at' ? 'invite.reward_end_at' : 'invite.reward_start_at';
    const start = Date.parse(String(numberOf(key, 'invite.reward_start_at', value) ?? ''));
    const end = Date.parse(String(numberOf(key, 'invite.reward_end_at', value) ?? ''));
    if (Number.isFinite(start) && Number.isFinite(end) && start >= end) {
      return {
        message: 'invite.reward_start_at must be earlier than invite.reward_end_at',
        details: outOfRange(key, other),
      };
    }
  }
  if (key === 'auth.phone_login_enabled' && value === true) {
    const served = [...smsState.templates.values()].some(
      (t) =>
        t.enabled && t.smsType === 'OTP' && t.locale.toLowerCase() === 'en' && t.country === null,
    );
    if (!served) {
      return {
        message:
          'auth.phone_login_enabled needs an enabled OTP SMS template in language en for every country (no country set)',
        details: [{ ref: 'SmsTemplate', reason: 'EMPTY_NOT_ALLOWED' }],
      };
    }
  }
  return null;
}

function warningsFor(
  key: string,
  value: unknown,
): { code: string; message: string; count?: number }[] {
  if (key === 'auth.phone_login_enabled' && value === false) {
    return [
      { code: 'PHONE_LOGIN_DISABLED_ACCOUNTS', message: 'Phone-number accounts exist', count: 3 },
    ];
  }
  if (key === 'sms.allowed_country_codes' && Array.isArray(value)) {
    // A country of the list that no enabled OTP channel serves (a channel with no countries serves all).
    const channels = [...smsState.channels.values()].filter(
      (c) => c.enabled && c.smsType === 'OTP',
    );
    const serves = (country: string) =>
      channels.some((c) => c.countries.length === 0 || c.countries.includes(country));
    const uncovered = value.filter((c): c is string => typeof c === 'string' && !serves(c));
    if (uncovered.length > 0) {
      return [
        {
          code: 'SMS_COUNTRY_UNCOVERED',
          message: `No enabled channel serves: ${uncovered.join(', ')}`,
        },
      ];
    }
  }
  if (key === 'ads.skip_after_seconds' && typeof value === 'number' && value > 5) {
    return [{ code: 'AD_SKIP_AFTER_TOO_LONG', message: 'A long skip delay can break store rules' }];
  }
  if (key === 'ads.force_close_seconds' && value === 0) {
    // Contract 17.4: a creative that cannot be skipped on a splash or interstitial placement can
    // then never be closed. A rejected creative is never served, so it does not count.
    const fullScreen = (unitId: string): boolean => {
      const unit = adsState.units.get(unitId);
      const format = unit ? adsState.placements.get(unit.placementId)?.adFormat : undefined;
      return format === 'SPLASH' || format === 'INTERSTITIAL';
    };
    const count = [...adsState.creatives.values()].filter(
      (c) => !c.skippable && c.reviewStatus !== 'REJECTED' && fullScreen(c.adUnitId),
    ).length;
    if (count > 0) {
      return [
        {
          code: 'AD_FORCE_CLOSE_DISABLED',
          message: 'A creative that cannot be skipped has no way out',
          count,
        },
      ];
    }
  }
  return [];
}

/**
 * One currency is used for all the cost rows, so `attribution.cost_currency` cannot change from the
 * value in force while a cost row exists (saving the same value always passes). Reset is a change to
 * the default.
 */
function costCurrencyLock(key: string, proposed: unknown) {
  if (key !== 'attribution.cost_currency' || campaignState.costs.length === 0) return null;
  const current = currentValue(key);
  if (proposed === current) return null;
  return invalidRequest(
    `${key} cannot be changed from ${String(current)} to ${String(proposed)} because cost rows exist (one currency is used for all cost rows)`,
    [{ ref: key, reason: 'OUT_OF_RANGE' }],
  );
}

const keyOf = (params: Record<string, string>): string => params.key ?? '';

export default {
  'GET /api/admin/config': guard(null, (req) => {
    const items = editableBy(req.admin)
      .map((spec) => {
        const row = saved.get(spec.key);
        return {
          key: spec.key,
          value: currentValue(spec.key),
          defaultValue: defaultOf(spec.key),
          editPermission: spec.editPermission,
          updatedAt: row?.updatedAt ?? null,
          updatedBy: row?.updatedBy ?? null,
          updatedByUsername: row?.updatedByUsername ?? null,
        };
      })
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    return ok({ items });
  }),

  'PUT /api/admin/config/:key': guard(null, (req) => {
    const key = keyOf(req.params);
    const spec = specOf(key);
    if (!spec)
      throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such configuration key');
    if (!hasPermission(req.admin, spec.editPermission as PermissionCode)) {
      throw new MockHttpError(403, 'ADMIN_FORBIDDEN', 'The administrator may not edit this key');
    }
    const body = bodyOf(req);
    if (!('value' in body)) throw bad(key, 'EMPTY_NOT_ALLOWED');
    const problem = problemWith(key, body.value) ?? relationProblem(key, body.value);
    if (problem) throw bad(key, problem);
    const refusal = refusalFor(key, body.value);
    if (refusal) throw refused(refusal);
    const locked = costCurrencyLock(key, body.value);
    if (locked) throw locked;
    saved.set(key, {
      value: body.value,
      updatedAt: new Date().toISOString(),
      updatedBy: req.admin.id,
      updatedByUsername: req.admin.username,
    });
    return ok({ key, value: body.value, warnings: warningsFor(key, body.value) });
  }),

  'DELETE /api/admin/config/:key': guard(null, (req) => {
    const key = keyOf(req.params);
    const spec = specOf(key);
    if (!spec)
      throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such configuration key');
    if (!hasPermission(req.admin, spec.editPermission as PermissionCode)) {
      throw new MockHttpError(403, 'ADMIN_FORBIDDEN', 'The administrator may not edit this key');
    }
    const locked = costCurrencyLock(key, defaultOf(key));
    if (locked) throw locked;
    const refusal = refusalFor(key, defaultOf(key));
    if (refusal) throw refused(refusal);
    saved.delete(key);
    return ok({ key, value: defaultOf(key), warnings: [] });
  }),
};
