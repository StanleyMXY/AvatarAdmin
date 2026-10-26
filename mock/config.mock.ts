import type { PermissionCode } from '../src/access/permissionCodes';
import { CONFIG_SCHEMA, specOf } from '../src/pages/config/configSchema';
import { validateServerLink } from '../src/utils/linkRule';
import { guard, hasPermission } from './_core/auth';
import { currentValue, defaultOf, saved } from './_core/configStore';
import { bodyOf, invalidRequest, MockHttpError, ok } from './_core/http';

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
      return null;
    }
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? null : 'NOT_AN_INTEGER';
    case 'bool':
      return typeof value === 'boolean' ? null : 'NOT_BOOLEAN';
    case 'url': {
      if (typeof value !== 'string') return 'NOT_HTTPS';
      const check = validateServerLink(value);
      return check.ok ? null : check.reasonKey;
    }
    case 'string':
      return typeof value === 'string' && value.length > 0 ? null : 'EMPTY_NOT_ALLOWED';
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
  // Statistics events must outlive the 30-day look-back of the weekly and monthly numbers.
  if (key === 'events.ttl_days' && typeof value === 'number') {
    const window = currentValue('stats.land_window_days');
    if (typeof window === 'number' && value < 30 + window) return 'OUT_OF_RANGE';
  }
  if (key === 'stats.land_window_days' && typeof value === 'number') {
    const ttl = currentValue('events.ttl_days');
    if (typeof ttl === 'number' && ttl < 30 + value) return 'OUT_OF_RANGE';
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

function warningsFor(
  key: string,
  value: unknown,
): { code: string; message: string; count?: number }[] {
  if (key === 'auth.phone_login_enabled' && value === false) {
    return [
      { code: 'PHONE_LOGIN_DISABLED_ACCOUNTS', message: 'Phone-number accounts exist', count: 3 },
    ];
  }
  if (key === 'ads.skip_after_seconds' && typeof value === 'number' && value > 5) {
    return [{ code: 'AD_SKIP_AFTER_TOO_LONG', message: 'A long skip delay can break store rules' }];
  }
  return [];
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
    saved.delete(key);
    return ok({ key, value: defaultOf(key), warnings: [] });
  }),
};
