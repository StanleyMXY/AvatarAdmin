// The client configuration endpoints of the mock backend (contract 26.1 to 26.3, backend reply 2
// item 1). A key is saved as a whole: every language is checked first, and one that fails refuses
// the lot. What the contract leaves open (the reasons of a refused placeholder or query, the
// answer of a save) follows docs/contract-requests/2026-10-26-admin-frontend-notifications.md.

import { countCodePoints } from '../src/utils/codePoints';
import { validateServerLink } from '../src/utils/linkRule';
import { guard } from './_core/auth';
import {
  clientConfigState,
  instantAfter,
  keyOf,
  latestUpdatedAt,
  type MockKey,
  type MockRow,
  REGISTRY,
  systemValue,
} from './_core/clientConfigData';
import { bodyOf, invalidRequest, MockHttpError, ok } from './_core/http';

type Detail = { ref: string; reason: string };

const TAG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const TAG_MAX = 35;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const find = (key: string | undefined): MockKey => {
  const def = key === undefined ? undefined : keyOf(key);
  if (!def) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'There is no such key');
  return def;
};

/**
 * Contract request 4.4, for a save and for a reset: the time of the key the caller read (null: it
 * had no row) must still be the time of the key, or another administrator changed it in between
 * and nothing is changed. A request without the field is not checked.
 */
function checkExpectedVersion(def: MockKey, body: Record<string, unknown>): void {
  if (!('expectedUpdatedAt' in body)) return;
  const current = latestUpdatedAt(def.key);
  if (body.expectedUpdatedAt !== current) {
    throw new MockHttpError(409, 'INVALID_STATE', 'The key was changed by someone else', {
      updatedAt: current,
    });
  }
}

/** The reason a value is not acceptable for the key, or null. */
function refusal(def: MockKey, value: unknown): string | null {
  switch (def.type) {
    case 'URL': {
      if (typeof value !== 'string' || value === '') return 'EMPTY_NOT_ALLOWED';
      const check = validateServerLink(value);
      if (!check.ok) return check.reasonKey;
      if (def.noQuery && /[?#]/.test(value)) return 'INVALID_PATH';
      return null;
    }
    case 'EMAIL':
      if (typeof value !== 'string' || value === '') return 'EMPTY_NOT_ALLOWED';
      return EMAIL.test(value) && value.length <= 254 ? null : 'INVALID_EMAIL';
    case 'STRING': {
      if (typeof value !== 'string') return 'EMPTY_NOT_ALLOWED';
      if (def.maxLength !== undefined && countCodePoints(value) > def.maxLength) return 'TOO_LONG';
      const unknown = [...value.matchAll(/\{([^{}]*)\}/g)].some(
        (m) => !(def.placeholders ?? []).includes(m[1]),
      );
      return def.placeholders !== undefined && unknown ? 'INVALID_PLACEHOLDER' : null;
    }
    case 'BOOLEAN':
      return typeof value === 'boolean' ? null : 'NOT_BOOLEAN';
    case 'INT': {
      if (typeof value !== 'number' || !Number.isInteger(value)) return 'NOT_AN_INTEGER';
      const [min, max] = def.range ?? [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
      return value < min || value > max ? 'OUT_OF_RANGE' : null;
    }
    default:
      return 'INVALID_VALUE';
  }
}

function view(def: MockKey) {
  const readOnly = def.source !== undefined;
  const rows = clientConfigState.rows.get(def.key);
  const values: Record<string, unknown> = {};
  if (readOnly) values[''] = systemValue(def);
  else for (const [locale, row] of rows ?? []) values[locale] = row.value;
  const latest: MockRow | undefined = readOnly
    ? undefined
    : [...(rows?.values() ?? [])].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
  return {
    key: def.key,
    type: def.type,
    localized: def.localized,
    readOnly,
    configured: readOnly || (rows?.size ?? 0) > 0,
    defaultValue: def.defaultValue,
    values,
    updatedBy: latest?.updatedBy ?? null,
    updatedByUsername: latest ? usernameOf(latest.updatedBy) : null,
    updatedAt: latest?.updatedAt ?? null,
  };
}

import { store } from './_core/store';

const usernameOf = (adminId: string) => store.admins.get(adminId)?.username ?? null;

export default {
  'GET /api/admin/client-config': guard('CLIENTCONFIG:VIEW', () =>
    ok({
      items: [...REGISTRY].sort((a, b) => (a.key < b.key ? -1 : 1)).map((def) => view(def)),
    }),
  ),

  'PUT /api/admin/client-config/:key': guard('CLIENTCONFIG:MANAGE', (req) => {
    const def = find(req.params.key);
    if (def.source !== undefined || def.type === 'STRING_LIST') {
      throw new MockHttpError(
        400,
        'INVALID_REQUEST',
        'This key comes from the system configuration',
      );
    }
    const body = bodyOf(req);
    checkExpectedVersion(def, body);
    const values = body.values;
    if (typeof values !== 'object' || values === null || Array.isArray(values)) {
      throw invalidRequest('values must be an object', [
        { ref: 'values', reason: 'EMPTY_NOT_ALLOWED' },
      ]);
    }
    const entries = Object.entries(values as Record<string, unknown>);
    if (entries.length === 0) {
      throw invalidRequest('values must not be empty', [
        { ref: 'values', reason: 'EMPTY_NOT_ALLOWED' },
      ]);
    }
    const details: Detail[] = [];
    for (const [locale, value] of entries) {
      if (locale !== '' && (!TAG.test(locale) || locale.length > TAG_MAX || !def.localized)) {
        details.push({ ref: locale, reason: 'INVALID_LANGUAGE_TAG' });
        continue;
      }
      const reason = refusal(def, value);
      if (reason !== null) details.push({ ref: locale === '' ? 'default' : locale, reason });
    }
    if (details.length > 0) throw invalidRequest('invalid request', details);
    const now = instantAfter(latestUpdatedAt(def.key));
    clientConfigState.rows.set(
      def.key,
      new Map(
        entries.map(([locale, value]) => [
          locale,
          { value, updatedBy: req.admin.id, updatedAt: now },
        ]),
      ),
    );
    return ok(view(def));
  }),

  'POST /api/admin/client-config/:key/reset': guard('CLIENTCONFIG:MANAGE', (req) => {
    const def = find(req.params.key);
    if (def.source !== undefined || def.type === 'STRING_LIST') {
      throw new MockHttpError(
        400,
        'INVALID_REQUEST',
        'This key comes from the system configuration',
      );
    }
    checkExpectedVersion(def, bodyOf(req));
    clientConfigState.rows.delete(def.key);
    return ok(view(def));
  }),
};
